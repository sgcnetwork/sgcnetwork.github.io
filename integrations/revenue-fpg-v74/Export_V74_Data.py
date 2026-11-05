#!/usr/bin/env python3
"""Read-only export of the V74 SQL facts. No mappings, amounts or reconciliations are changed."""
import argparse,datetime,decimal,gzip,hashlib,importlib.util,json,re,sys,uuid
from pathlib import Path
EXPECTED_HASH='c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1'

def encode(v):
    if v is None or isinstance(v,(str,int,bool)):return v
    if isinstance(v,decimal.Decimal):return str(v)
    if isinstance(v,(datetime.datetime,datetime.date,datetime.time)):return v.isoformat()
    if isinstance(v,(bytes,bytearray,memoryview)):return bytes(v).hex()
    if isinstance(v,uuid.UUID):return str(v)
    if isinstance(v,float):return v
    raise TypeError('Unsupported original SQL value type: '+type(v).__name__)

def month_range(period):
    if not period:return None,None
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])',period):raise ValueError('Use YYYY-MM')
    a=datetime.date.fromisoformat(period+'-01');b=(a.replace(day=28)+datetime.timedelta(days=4)).replace(day=1);return a,b

def export(engine_path,destination,period=None,connection_factory=None):
    engine_path=Path(engine_path).resolve()
    if hashlib.sha256(engine_path.read_bytes()).hexdigest()!=EXPECTED_HASH:raise RuntimeError('Original V74 engine changed')
    if connection_factory is None:
        spec=importlib.util.spec_from_file_location('original_v74_engine',engine_path);engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
        # Import only defines functions/constants; __main__ is never called.
        connection_factory=engine.connection
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    first,last=month_range(period);manifest={'engine_sha256':EXPECTED_HASH,'period':period,'extracted_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only':True,'columns':{},'stores':{},'tenders':[]};tenders=set();cn=connection_factory()
    try:
        # One consistent, read-only transaction while copying to local gzip files.
        # No network uploading happens while SQL read locks are held.
        cn.cursor().execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')
        for kind,table in [('sales','fact.Sale'),('settlements','fact.Settlement')]:
            where='WHERE src.ReconDate>=? AND src.ReconDate<?' if first else ''
            query=f'''WITH StoreNames AS (SELECT UPPER(LTRIM(RTRIM(SEG))) SEG,MIN(NULLIF(LTRIM(RTRIM(TrueStoreName)),'')) StoreName FROM ref.StoreAlias GROUP BY UPPER(LTRIM(RTRIM(SEG))))
SELECT src.*,n.StoreName AS _StoreName,f.FileName AS _SourceFileName,f.FullPath AS _SourceFilePath,f.LoadStatus AS _SourceLoadStatus,f.LoadFinished AS _SourceLoadFinished,f.Fingerprint AS _SourceFingerprint
FROM {table} src LEFT JOIN StoreNames n ON n.SEG=UPPER(LTRIM(RTRIM(src.SEG))) LEFT JOIN etl.SourceFile f ON f.SourceFileId=src.SourceFileId {where}
ORDER BY src.ReconDate,src.SEG,src.SourceFileId,src.SourceRow'''
            cursor=cn.cursor();cursor.execute(query,(first,last)) if first else cursor.execute(query)
            columns=[c[0] for c in cursor.description]
            if len(columns)!=len(set(columns)):raise RuntimeError('Duplicate SQL field names in original source export')
            manifest['columns'][kind]=columns;count=0
            with gzip.open(destination/(kind+'.jsonl.gz'),'wt',encoding='utf-8',newline='\n') as output:
                while True:
                    chunk=cursor.fetchmany(2000)
                    if not chunk:break
                    for values in chunk:
                        count+=1;payload={k:encode(v) for k,v in zip(columns,values)}
                        output.write(json.dumps({'row_no':count,'payload':payload},ensure_ascii=False,separators=(',',':'))+'\n')
                        seg=str(payload.get('SEG') or '');name=payload.get('_StoreName') or payload.get('SourceStore') or seg
                        if seg:manifest['stores'][seg]=name
                        if payload.get('FinalTender'):tenders.add(str(payload['FinalTender']))
            manifest['sales_rows' if kind=='sales' else 'settlement_rows']=count
        cn.rollback()  # Read-only transaction: release SQL read locks; never commit source writes.
    finally:cn.close()
    manifest['tenders']=sorted(tenders)
    (destination/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--engine',required=True);p.add_argument('--destination',required=True);p.add_argument('--period');a=p.parse_args()
    try:
        m=export(a.engine,a.destination,a.period);print('Read-only SQL export complete: '+str(m['sales_rows'])+' sales · '+str(m['settlement_rows'])+' settlements')
    except Exception as exc:print('Read-only SQL export failed: '+str(exc),file=sys.stderr);sys.exit(1)
