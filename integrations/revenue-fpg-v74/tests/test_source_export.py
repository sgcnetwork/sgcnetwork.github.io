import datetime,decimal,gzip,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import Export_V74_Data as export
ROOT=Path(__file__).resolve().parents[1]
class Cursor:
    def __init__(self,cn):self.cn=cn;self.description=[];self.rows=[]
    def execute(self,sql,params=None):
        self.cn.commands.append((sql,params))
        if sql.startswith('SET '):return self
        names=['SEG','ReconDate','Amount','SourceRow','RowHash','SourceStore','FinalTender','TerminalNo','MerchantNo','CardNo','_StoreName','_SourceFileName','_SourceFilePath']
        self.description=[(n,) for n in names]
        self.rows=[('ATH',datetime.date(2026,11,3),decimal.Decimal('49.90'),42,b'\x01\xff','Original store','KIOSK','000123','000045','****1234','Book2 Store','Original.csv','C:\\Original.csv')]
        return self
    def fetchmany(self,n):r=self.rows[:n];self.rows=self.rows[n:];return r
class Connection:
    def __init__(self):self.commands=[];self.rolled_back=False;self.closed=False
    def cursor(self):return Cursor(self)
    def rollback(self):self.rolled_back=True
    def close(self):self.closed=True
class Tests(unittest.TestCase):
    def test_all_source_columns_and_precision_preserved_without_writes(self):
        cn=Connection()
        with tempfile.TemporaryDirectory() as d:
            m=export.export(ROOT/'engine'/'Treasury_Recon_FRESH_V74_OCTOBER_WICODE_ALL_MONTHS.py',d,'2026-11',lambda:cn)
            self.assertEqual(m['sales_rows'],1);self.assertEqual(m['settlement_rows'],1);self.assertTrue(cn.closed and cn.rolled_back)
            for kind in ['sales','settlements']:
                with gzip.open(Path(d)/(kind+'.jsonl.gz'),'rt',encoding='utf-8') as f:p=json.loads(f.readline())['payload']
                self.assertEqual(p['Amount'],'49.90');self.assertEqual(p['TerminalNo'],'000123');self.assertEqual(p['SEG'],'ATH');self.assertEqual(p['_StoreName'],'Book2 Store');self.assertEqual(p['RowHash'],'01ff');self.assertEqual(p['SourceRow'],42)
            for query,params in cn.commands:
                self.assertTrue(query.startswith('SET ') or query.startswith('WITH '))
                self.assertFalse(any(word in query.upper().split() for word in ['INSERT','UPDATE','DELETE','MERGE','DROP','ALTER']))
                if params:self.assertEqual(params,(datetime.date(2026,11,1),datetime.date(2026,12,1)))
    def test_month_validation(self):
        with self.assertRaises(ValueError):export.month_range('2026-11;delete')
        self.assertEqual(export.month_range(None),(None,None))
if __name__=='__main__':unittest.main()
