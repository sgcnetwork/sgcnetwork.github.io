"""Read original V74 output files. Never calculate or rewrite reconciliation values."""
from __future__ import annotations
import csv, hashlib, posixpath, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/package/2006/relationships'}
M='{'+NS['s']+'}'

def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
    return h.hexdigest()

def col_number(ref):
    n=0
    for c in re.match(r'[A-Z]+',ref).group():n=n*26+ord(c)-64
    return n

def color(e):
    if e is None:return None
    rgb=e.get('rgb')
    return '#'+rgb[-6:] if rgb else None

def font(e):
    if e is None:return {}
    return {'bold':e.find(M+'b') is not None,'italic':e.find(M+'i') is not None,'color':color(e.find(M+'color')),'size':(e.find(M+'sz').get('val') if e.find(M+'sz') is not None else None)}

def fill(e):
    if e is None:return None
    pattern=e.find(M+'patternFill')
    if pattern is not None and pattern.get('patternType')=='solid':return color(pattern.find(M+'fgColor'))
    return None

def styles(z):
    from openpyxl.styles.numbers import BUILTIN_FORMATS
    if 'xl/styles.xml' not in z.namelist():return [{}],[]
    root=ET.fromstring(z.read('xl/styles.xml'))
    formats=dict(BUILTIN_FORMATS)
    for e in root.findall('s:numFmts/s:numFmt',NS):formats[int(e.get('numFmtId'))]=e.get('formatCode')
    fonts=[font(e) for e in root.findall('s:fonts/s:font',NS)]
    fills=[fill(e) for e in root.findall('s:fills/s:fill',NS)]
    result=[]
    for e in root.findall('s:cellXfs/s:xf',NS):
        a=e.find(M+'alignment')
        result.append({**fonts[int(e.get('fontId','0'))],'fill':fills[int(e.get('fillId','0'))],'format':formats.get(int(e.get('numFmtId','0')),'General'),'align':a.get('horizontal') if a is not None else None})
    dxfs=[]
    for e in root.findall('s:dxfs/s:dxf',NS):dxfs.append({**font(e.find(M+'font')),'fill':fill(e.find(M+'fill'))})
    return result,dxfs

def relationships(z,path):
    name=posixpath.join(posixpath.dirname(path),'_rels',posixpath.basename(path)+'.rels')
    if name not in z.namelist():return {}
    return {r.get('Id'):{'path':posixpath.normpath(posixpath.join(posixpath.dirname(path),r.get('Target'))).lstrip('/'),'type':r.get('Type','')} for r in ET.fromstring(z.read(name))}

def xlsx_metadata(path):
    with zipfile.ZipFile(path) as z:
        root=ET.fromstring(z.read('xl/workbook.xml'));rels=relationships(z,'xl/workbook.xml')
        style,dxf=styles(z);pr=root.find(M+'workbookPr')
        meta={'type':'xlsx','styles':style,'dxfs':dxf,'date1904':pr is not None and pr.get('date1904') in ('1','true'),'sheets':[]}
        for i,s in enumerate(root.findall('s:sheets/s:sheet',NS)):
            rid=s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target=rels[rid]['path'];target=target if target.startswith('xl/') else 'xl/'+target
            meta['sheets'].append({'index':i,'name':s.get('name'),'path':target,'max_row':0,'max_col':0,'columns':[],'merges':[],'conditional':[]})
        return meta

def rows_xlsx(path,meta):
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            with z.open('xl/sharedStrings.xml') as shared_stream:
                for event,e in ET.iterparse(shared_stream,events=('end',)):
                    if e.tag==M+'si':shared.append(''.join(e.itertext()));e.clear()
        for sheet in meta['sheets']:
            comments={}
            for rel in relationships(z,sheet['path']).values():
                if rel['type'].endswith('/comments') and rel['path'] in z.namelist():
                    for e in ET.fromstring(z.read(rel['path'])).findall('s:commentList/s:comment',NS):comments[e.get('ref')]=''.join(e.find(M+'text').itertext())
            with z.open(sheet['path']) as stream:
                for event,e in ET.iterparse(stream,events=('end',)):
                    if e.tag==M+'col':
                        sheet['columns'].append({'min':int(e.get('min')),'max':int(e.get('max')),'width':e.get('width'),'hidden':e.get('hidden')=='1'})
                    elif e.tag==M+'mergeCell':sheet['merges'].append(e.get('ref'))
                    elif e.tag==M+'conditionalFormatting':
                        for r in e.findall(M+'cfRule'):
                            sheet['conditional'].append({'range':e.get('sqref'),'type':r.get('type'),'priority':int(r.get('priority','999')),'dxf':int(r.get('dxfId','0')),'stop':r.get('stopIfTrue')=='1','formulas':[f.text or '' for f in r.findall(M+'formula')]})
                    elif e.tag==M+'row':
                        rn=int(e.get('r'));cells=[]
                        for c in e.findall(M+'c'):
                            ref=c.get('r');cn=col_number(ref);typ=c.get('t','n');v=c.find(M+'v');value=v.text if v is not None else ''
                            if typ=='s':value=shared[int(value)] if value else '';typ='s'
                            elif typ=='inlineStr':value=''.join(c.find(M+'is').itertext()) if c.find(M+'is') is not None else '';typ='s'
                            item={'c':cn,'v':value or '','t':typ,'s':int(c.get('s','0'))}
                            f=c.find(M+'f')
                            if f is not None:item['f']=f.text or ''
                            if ref in comments:item['note']=comments[ref]
                            cells.append(item);sheet['max_col']=max(sheet['max_col'],cn)
                        sheet['max_row']=max(sheet['max_row'],rn)
                        if cells:yield {'sheet_no':sheet['index'],'row_no':rn,'cells':cells}
                        e.clear()
            sheet['conditional'].sort(key=lambda r:r['priority'])

def csv_metadata(path):
    return {'type':'csv','styles':[{}, {'bold':True,'color':'#FFFFFF','fill':'#7030A0'}],'sheets':[{'index':0,'name':Path(path).stem,'max_row':0,'max_col':0,'columns':[],'merges':[],'conditional':[]}]}

def rows_csv(path,meta):
    with open(path,newline='',encoding='utf-8-sig') as f:
        for n,row in enumerate(csv.reader(f),1):
            meta['sheets'][0]['max_row']=n;meta['sheets'][0]['max_col']=max(meta['sheets'][0]['max_col'],len(row))
            yield {'sheet_no':0,'row_no':n,'cells':[{'c':i,'v':v,'t':'s','s':1 if n==1 else 0} for i,v in enumerate(row,1)]}

def output_reader(path):
    if Path(path).suffix.lower()=='.xlsx':meta=xlsx_metadata(path);return meta,rows_xlsx(path,meta)
    if Path(path).suffix.lower()=='.csv':meta=csv_metadata(path);return meta,rows_csv(path,meta)
    raise ValueError('Unsupported original output format')
