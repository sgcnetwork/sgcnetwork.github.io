#!/usr/bin/env python3
"""Website controller for the byte-identical V74 engine. No reconciliation logic lives here."""
from __future__ import annotations
import argparse, ast, base64, ctypes, getpass, hashlib, json, os, re, socket, subprocess, sys, time, urllib.request, urllib.error, uuid
from datetime import datetime
from pathlib import Path
from v74_outputs import sha256,output_reader

HERE=Path(__file__).resolve().parent
EXPECTED_HASH='c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1'
SCOPES={'sales_all','sales_month','settlement_all','settlement_month','yesterday','month','status','consol'}
MONTH_SCOPES={'sales_month','settlement_month','month'}
ENGINE_NAME='Treasury_Recon_FRESH_V74_OCTOBER_WICODE_ALL_MONTHS.py'
DEFAULT_PROGRAM=r'C:\Users\FPG\OneDrive - FPG Group\Desktop\Riefa G\S.G Programme'
DEFAULT_CONTROL=r'C:\Users\FPG\FPG Group\Financial Retail - Documents\FPG Foods Accounting Dept\Treasury Recon\All tenders Recon'
DEFAULT_OUTPUT=r'C:\Users\FPG\FPG Group\Financial Retail - Documents\FPG Foods Accounting Dept\Treasury Recon\All tenders Recons\Recons'
DEFAULT_CONSOL=r'C:\Users\FPG\FPG Group\Financial Retail - Documents\FPG Foods Accounting Dept\Treasury Recon\All tenders Recons\Consols'
CONFIG=HERE/'bridge.settings.json'

class Cancelled(Exception):pass

class API:
    def __init__(self,config,password):self.config=config;self.password=password;self.token=None;self.expires=0
    def login(self):
        d=self.request('/auth/v1/token?grant_type=password',{'email':self.config['email'],'password':self.password},'POST',auth=False)
        self.token=d['access_token'];self.expires=time.time()+d.get('expires_in',3600)-90
    def request(self,path,data=None,method='GET',auth=True,headers=None):
        if auth and (not self.token or time.time()>self.expires):self.login()
        h={'apikey':self.config['publishable_key'],'Content-Type':'application/json'}
        if auth:h['Authorization']='Bearer '+self.token
        if headers:h.update(headers)
        body=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
        req=urllib.request.Request(self.config['supabase_url'].rstrip('/')+path,data=body,method=method,headers=h)
        try:
            with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read() or b'null')
        except urllib.error.HTTPError as e:
            try:message=json.loads(e.read()).get('message') or 'Request rejected'
            except Exception:message='Request rejected'
            raise RuntimeError('Finance API HTTP '+str(e.code)+': '+str(message)) from None
    def rpc(self,action,**kw):return self.request('/rest/v1/rpc/fpg_v74',{'p':{'action':action,'worker_id':self.config['worker_id'],**kw}},'POST')
    def upload(self,path,file):
        if not self.token or time.time()>self.expires:self.login()
        typ='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if file.suffix.lower()=='.xlsx' else 'text/csv'
        from urllib.parse import quote
        with file.open('rb') as f:
            req=urllib.request.Request(self.config['supabase_url'].rstrip('/')+'/storage/v1/object/fpg-v74-outputs/'+quote(path,safe='/'),data=f,method='POST',headers={'apikey':self.config['publishable_key'],'Authorization':'Bearer '+self.token,'Content-Type':typ,'Content-Length':str(file.stat().st_size)})
            try:
                with urllib.request.urlopen(req,timeout=600) as r:r.read()
            except urllib.error.HTTPError as e:raise RuntimeError('Original output upload rejected: HTTP '+str(e.code)) from None

def dpapi(value,decrypt=False):
    if os.name!='nt':raise RuntimeError('Saved credentials require Windows. Use setup on the source PC.')
    from ctypes import wintypes
    class BLOB(ctypes.Structure):_fields_=[('cbData',wintypes.DWORD),('pbData',ctypes.POINTER(ctypes.c_byte))]
    raw=base64.b64decode(value) if decrypt else value.encode('utf-8');buf=ctypes.create_string_buffer(raw)
    inp=BLOB(len(raw),ctypes.cast(buf,ctypes.POINTER(ctypes.c_byte)));out=BLOB()
    crypt=ctypes.windll.crypt32;fn=crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    ok=fn(ctypes.byref(inp),None,None,None,None,1,ctypes.byref(out))
    if not ok:raise ctypes.WinError()
    try:result=ctypes.string_at(out.pbData,out.cbData)
    finally:ctypes.windll.kernel32.LocalFree(out.pbData)
    return result.decode('utf-8') if decrypt else base64.b64encode(result).decode('ascii')

def engine_info(path):
    path=Path(path).resolve()
    if sha256(path)!=EXPECTED_HASH:raise RuntimeError('Original V74 Python changed. Nothing will be executed. Use the supplied unchanged engine.')
    # Read configuration constants only, without importing or executing the engine.
    ast.parse(path.read_text(encoding='utf-8-sig'))
    return path

def command(engine,scope,period=None):
    if scope not in SCOPES:raise ValueError('Unknown BAS command')
    args=(["py","-3"] if os.name=='nt' else [sys.executable])+[str(engine),'--scope',scope]
    if scope in MONTH_SCOPES:
        if not isinstance(period,str) or not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])',period):raise ValueError('Choose YYYY-MM')
        args+=['--month',period]
    return args

def parse_state(path):
    try:return dict(line.split('=',1) for line in path.read_text(encoding='utf-8-sig').splitlines() if '=' in line)
    except (OSError,UnicodeError):return {}

def save_open_reference_workbooks():
    """Same pre-run saves as BAS. Attach only to an already open Excel instance."""
    if os.name!='nt':return 'Excel pre-save unavailable outside Windows'
    try:
        import pythoncom,win32com.client
        pythoncom.CoInitialize()
        try:excel=win32com.client.GetActiveObject('Excel.Application')
        except Exception:return 'No open Excel instance; saved Book2 / Wi-code files will be read'
        saved=[]
        for workbook in list(excel.Workbooks):
            if str(workbook.Name).strip().lower() in {'book2.xlsx','book2.xlsm','wi-code mtm.xlsx','wi-code mtm.xlsm','wi-code mtm'}:
                try:workbook.Save();saved.append(str(workbook.Name))
                except Exception:pass  # BAS uses On Error Resume Next for these pre-saves.
        return 'Saved open references: '+(', '.join(saved) or 'none')
    except ImportError:raise RuntimeError('Install requirements on Windows so open Book2 / Wi-code workbooks can be saved like the BAS')
    finally:
        try:pythoncom.CoUninitialize()
        except Exception:pass

def source_paths(config):
    # These match the unchanged engine constants. Only TREASURY_PROGRAM_DIR is an engine-supported override.
    program=Path(os.environ.get('TREASURY_PROGRAM_DIR',DEFAULT_PROGRAM))
    control=Path(DEFAULT_CONTROL);consol=Path(DEFAULT_CONSOL)
    return {'program':program,'control':control,'output':Path(DEFAULT_OUTPUT),'consol':consol,'state':control/'Treasury_Recon_Run_State.txt','lock':control/'Treasury_Recon_RUNNING.lock','audit':program/'Recon Outputs'}

def candidates(paths):
    result=[]
    for root in (paths['output'],paths['audit']):
        if root.exists():result+=list(root.glob('*.xlsx'))
    for root in (paths['control'],paths['consol']):
        if root.exists():result+=list(root.glob('Treasury_Recon*.csv'))+list(root.glob('Treasury_Recon*.xlsx'))
    program=paths['program']
    if program.exists():
        for pattern in ('*Sage*Check*.xlsx','*SAGE*CHECK*.xlsx'):result+=list(program.glob(pattern))
    return sorted({p.resolve() for p in result if p.is_file() and not p.name.startswith('~$')})

def file_stamp(p):
    st=p.stat();return (st.st_mtime_ns,st.st_size)

def original_outputs(paths,before):
    always={paths['control']/'Treasury_Recon_Status.csv',paths['control']/'Treasury_Recon_Source_SQL_Validation.csv',paths['consol']/'Treasury_Recon_Consol.csv',paths['consol']/'Treasury_Recon_Store_Daily_Consol.xlsx'}
    return [p for p in candidates(paths) if p in always or before.get(str(p))!=file_stamp(p)]

def output_kind(path):
    n=path.name.lower()
    if n=='treasury_recon_status.csv':return 'status'
    if n=='treasury_recon_source_sql_validation.csv':return 'validation'
    if n=='treasury_recon_consol.csv':return 'consol'
    if n=='treasury_recon_store_daily_consol.xlsx':return 'store_consol'
    if path.suffix.lower()=='.xlsx':return 'daily_recon'
    return 'run_log'

def publish_output(api,job,file,heartbeat):
    before=file_stamp(file);digest=sha256(file)
    if file.stat().st_size>536870912:raise RuntimeError('Output exceeds the 512 MB upload limit; no values have been truncated: '+file.name)
    artifact=api.rpc('artifact',job_id=job['id'],name=file.name,kind=output_kind(file),sha256=digest,size_bytes=file.stat().st_size)
    heartbeat('Uploading original file: '+file.name)
    api.upload(artifact['path'],file)
    meta,rows=output_reader(file);batch=[];count=0
    for row in rows:
        batch.append(row);count+=1
        if len(batch)>=100:
            api.rpc('rows',job_id=job['id'],artifact_id=artifact['id'],rows=batch);batch=[];heartbeat('Publishing original sheet rows: '+file.name+' · '+str(count))
    if batch:api.rpc('rows',job_id=job['id'],artifact_id=artifact['id'],rows=batch)
    if file_stamp(file)!=before or sha256(file)!=digest:raise RuntimeError('Output changed while being read. Snapshot not published: '+file.name)
    api.rpc('publish_artifact',job_id=job['id'],artifact_id=artifact['id'],expected_rows=count,metadata=meta)

def terminate_owned(process):
    # Never enumerate or kill unrelated Python/Excel/SQL processes.
    if process.poll() is None:
        process.terminate()
        try:process.wait(timeout=15)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=15)

def run_job(api,config,job):
    engine=engine_info(config['engine_path']);paths=source_paths(config);jid=job['id'];process=None;state={};engine_id=None;last_push=0;before={};checkpoint=HERE/'local-state'/str(jid)
    checkpoint.mkdir(parents=True,exist_ok=True)
    try:
        # Avoid the original engine's failure-finally cleanup touching another active run's lock.
        if paths['lock'].exists() and time.time()-paths['lock'].stat().st_mtime<1800:raise RuntimeError('A Treasury refresh is already running in Excel / Python. Wait for it to finish; no second engine was started.')
        save_note=save_open_reference_workbooks();api.rpc('progress',job_id=jid,message=save_note)
        before={str(p):file_stamp(p) for p in candidates(paths)}
        old_id=parse_state(paths['state']).get('RUN_ID')
        try:paths['state'].unlink(missing_ok=True)
        except OSError:raise RuntimeError('Cannot clear the previous BAS run-state file')
        started=time.time()
        with (checkpoint/'engine.log').open('w',encoding='utf-8') as log:
            process=subprocess.Popen(command(engine,job['scope'],job.get('period')),cwd=engine.parent,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            (checkpoint/'process.json').write_text(json.dumps({'pid':process.pid,'job_id':jid}),encoding='utf-8')
            while process.poll() is None:
                current=parse_state(paths['state'])
                if current.get('RUN_ID') and current.get('RUN_ID')!=old_id:state=current;engine_id=current['RUN_ID']
                try:
                    result=api.rpc('progress',job_id=jid,engine_state=state,message=state.get('MESSAGE','Starting original V74 engine'))
                except Exception as network_error:
                    print('Progress connection interrupted; original Python continues: '+str(network_error),flush=True)
                    result={}
                if result.get('cancel_requested'):raise Cancelled('Cancellation requested from the website')
                # The BAS wait timeout never changes the engine's calculations. Do not kill a healthy engine merely because a browser or network timed out.
                time.sleep(1)
            code=process.wait();current=parse_state(paths['state'])
            if current.get('RUN_ID') and current.get('RUN_ID')!=old_id:state=current;engine_id=current['RUN_ID']
            if code!=0 or state.get('STATE')!='COMPLETE':raise RuntimeError(state.get('MESSAGE') or 'Original Python did not report COMPLETE; inspect the local engine log')
        engine_info(engine)
        outputs=original_outputs(paths,before)
        if not outputs:raise RuntimeError('Original Python completed but no original output files are available')
        def heartbeat(message):
            nonlocal last_push
            if time.monotonic()-last_push<2:return
            j=api.rpc('progress',job_id=jid,engine_state=state,message=message);last_push=time.monotonic()
            if j['cancel_requested']:raise Cancelled('Publication cancelled; previous snapshots remain available')
        for file in outputs:publish_output(api,job,file,heartbeat)
        api.rpc('finish',job_id=jid,status='complete',engine_state=state,exit_code=0,message=state.get('MESSAGE','Original V74 completed')+' · Original outputs published')
    except Exception as e:
        if process is not None:terminate_owned(process)
        if isinstance(e,Cancelled) and engine_id and parse_state(paths['state']).get('RUN_ID')==engine_id:
            # BAS also removes the current engine lock when cancelling. Only remove our run's lock.
            try:
                if paths['lock'].read_text(encoding='utf-8').splitlines()[0]==engine_id:paths['lock'].unlink()
            except OSError:pass
            paths['state'].write_text('STATE=CANCELLED\nMESSAGE=REFRESH CANCELLED\nRUN_ID='+engine_id+'\n',encoding='utf-8')
        api.rpc('finish',job_id=jid,status='cancelled' if isinstance(e,Cancelled) else 'failed',engine_state=state,exit_code=process.returncode if process else None,message=str(e)[:2000])
        print(type(e).__name__+': '+str(e),flush=True)


def setup():
    if os.name!='nt':raise RuntimeError('Run Setup on the same Windows PC as the original BAS/Python sources and SQL Express')
    fallback=HERE/'engine'/ENGINE_NAME;original=Path(DEFAULT_PROGRAM)/ENGINE_NAME
    engine=original if original.exists() and sha256(original)==EXPECTED_HASH else fallback
    engine_info(engine)
    dependency_check=subprocess.run(['py','-3',str(engine),'--help'],capture_output=True,text=True)
    if dependency_check.returncode:raise RuntimeError('The original Python environment cannot load V74. Keep using the same dependencies as the working BAS, then rerun Setup. '+dependency_check.stderr[-800:])
    print('Revenue FPG connection. Your original reconciliation engine and files remain unchanged.')
    email=input('Finance account email [netsgcwork@gmail.com]: ').strip() or 'netsgcwork@gmail.com'
    password=getpass.getpass('Finance account password (hidden): ')
    config={'supabase_url':'https://bxpexanyoyubxeqqlggh.supabase.co','publishable_key':'sb_publishable_Z0_Y-Bj_G5qw4hMgDbQlgA__jj8rGGq','email':email,'worker_id':str(uuid.uuid4()),'engine_path':str(engine)}
    api=API(config,password);api.login();api.rpc('agent',name=socket.gethostname(),engine_sha256=EXPECTED_HASH,message='Setup connected; start the bridge to process commands')
    config['password_dpapi']=dpapi(password);CONFIG.write_text(json.dumps(config,indent=2),encoding='utf-8')
    print('Connection saved for this Windows user. Run Start Revenue FPG.cmd to connect the website controls.')

def single_instance():
    if os.name!='nt':raise RuntimeError('This source-connected bridge runs on Windows')
    import msvcrt
    handle=(HERE/'bridge.instance.lock').open('a+b');handle.seek(0);handle.write(b'1');handle.flush();handle.seek(0)
    try:msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
    except OSError:handle.close();raise RuntimeError('Revenue FPG Bridge is already running')
    return handle

def release_abandoned(api,job_id):
    state=HERE/'local-state'/job_id/'process.json'
    if not state.exists():raise RuntimeError('No local ownership checkpoint for that job')
    info=json.loads(state.read_text());pid=info['pid']
    if os.name!='nt':raise RuntimeError('Inspect process state on Windows')
    from ctypes import wintypes
    ctypes.windll.kernel32.OpenProcess.restype=wintypes.HANDLE
    ctypes.windll.kernel32.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
    h=ctypes.windll.kernel32.OpenProcess(0x1000,False,pid)
    if h:
        code=ctypes.c_ulong();ctypes.windll.kernel32.GetExitCodeProcess(h,ctypes.byref(code));ctypes.windll.kernel32.CloseHandle(h)
        if code.value==259:raise RuntimeError('Original process still exists. Wait for it; no duplicate command will be started.')
    api.rpc('finish',job_id=job_id,status='failed',message='Worker stopped before confirmed publication. Original command was not rerun. Inspect local engine.log and original output files before queuing again.')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--setup',action='store_true');parser.add_argument('--once',action='store_true');parser.add_argument('--release-abandoned');args=parser.parse_args()
    if args.setup:setup();return
    lock=single_instance()
    if not CONFIG.exists():raise RuntimeError('Run Setup Revenue FPG.cmd first')
    config=json.loads(CONFIG.read_text(encoding='utf-8'));engine=engine_info(config['engine_path']);password=os.environ.get('REVENUE_WORKER_PASSWORD') or dpapi(config['password_dpapi'],decrypt=True);api=API(config,password)
    if args.release_abandoned:release_abandoned(api,args.release_abandoned);return
    print('Revenue FPG connected. The website now queues the original BAS commands. Ctrl+C stops the bridge.',flush=True)
    while True:
        try:
            api.rpc('agent',name=socket.gethostname(),engine_sha256=sha256(engine),message='Connected · awaiting commands')
            job=api.rpc('claim')
            if job:run_job(api,config,job)
        except KeyboardInterrupt:break
        except Exception as e:print(type(e).__name__+': '+str(e),flush=True)
        if args.once:break
        time.sleep(3)

if __name__=='__main__':
    try:main()
    except Exception as exc:print('STOPPED: '+str(exc),file=sys.stderr);sys.exit(1)
