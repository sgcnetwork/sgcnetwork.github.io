# Revenue FPG — your original V74 engine, controlled from the website

Website: https://revenuefpg.sgcnetwork.co.za/

Your uploaded Python and BAS are included in `engine/` without a single byte changed. `original_files.json` records their SHA-256 hashes. The bridge refuses to run a Python file that does not match the uploaded V74 engine. The uploaded `(2)` suffix is removed only from the supplied copy's filename so the original BAS filename remains meaningful; the contents are unchanged. Your original uploads are not replaced.

## One-time Windows setup

1. Extract this ZIP to a normal folder on the SAME Windows PC that currently runs the BAS and accesses `localhost\SQLEXPRESS`, the company folders, Book2 and Wi-code MTM.
2. Double-click `Setup Revenue FPG.cmd`. It creates a separate `.venv` for the bridge, then asks for the existing Finance account email and password in the local console. Default email: netsgcwork@gmail.com. The password is hidden and saved encrypted for this Windows user through Windows DPAPI. It is not embedded in Python, GitHub, the website or this ZIP.
3. Double-click `Start Revenue FPG.cmd` and leave its window running. Open the website, sign in, then choose **Python controls** or **Treasury**. The connection indicator should show the source computer as connected.

The bridge runs the unmodified engine with **`py -3 original_file.py --scope ...`**, using the same system Python version selected by the BAS's `pyw.exe -3`. The bridge's separate environment does not replace the engine's existing dependencies. Setup tests the original interpreter with `--help`; this does not connect to SQL or run a refresh. Keep the existing Python engine dependencies, ODBC Driver 18, SQL Express database and file permissions that already make the BAS work. No source paths are moved, renamed or remapped.

If your working program folder already contains the exact uploaded engine, Setup uses it. Otherwise it uses the included unchanged copy. Its source/output constants still point to the ORIGINAL locations. `TREASURY_PROGRAM_DIR` and SQL environment variables retain their existing engine-defined meaning. No replacement source discovery or mapping logic has been added.

## The BAS controls map one-for-one

| Website control | Existing BAS macro | Exact original Python command |
| --- | --- | --- |
| Refresh All Sales | RefreshAllSales | --scope sales_all |
| Refresh Selected Month Sales | RefreshSelectedMonthSales | --scope sales_month --month YYYY-MM |
| Refresh All Settlement Reports | RefreshAllSettlementReports | --scope settlement_all |
| Refresh Yesterday | RefreshYesterday | --scope yesterday |
| Refresh Selected Month Settlement | RefreshSelectedMonthSettlement | --scope settlement_month --month YYYY-MM |
| Refresh Daily Recon — Selected Month | RefreshSelectedMonth | --scope month --month YYYY-MM |
| Open Recon Folder | OpenReconOutputs | Shows the original published files in the website; original files remain in the original Windows folders |
| Refresh Control Status | RefreshControlStatus | --scope status |
| Refresh Consol View | RefreshConsolView | --scope consol |
| Cancel Current Refresh | CancelCurrentRefresh | Requests termination of only the Python process started by the current website job |

The selected website month takes the place of B4. Before execution the bridge attaches to an already-open Excel instance and saves Book2.xlsx/Book2.xlsm and Wi-code MTM.xlsx/.xlsm, as the BAS does. It never opens another Excel instance for this pre-save. The original engine retains its own Excel/XLSB behaviour.

## What stays exactly in the original engine

- Sales and settlement refreshes are separate. The bridge does not combine them or import sources while building a selected-month daily recon.
- Selected-month and yesterday recons run the original SQL-only code. Yesterday still rebuilds the month containing yesterday, exactly as the supplied Python does.
- Original Book2 sales mappings, merchant/speedpoint/terminal precedence, fingerprints, duplicate-load controls, SQL cache, Wi-code date interpretation and voucher allocation are not rewritten.
- Original transaction Difference column U remains the original difference. Adjusted CONSOL/title/daily totals remain the original engine's values; the website never recomputes these from sales minus settlements.
- Daily Tender Summary, tender CONSOL sheets, tender RECON BREAKDOWN sheets, voucher notes, hidden VOUCHER markers and supported conditional fills are read from the generated workbook.
- Original CSV control status, CONSOL VIEW, SOURCE SQL CHECK and STORE DAILY CONSOL workbook are read as outputs.
- Original output filenames, versioning and Windows locations remain controlled by the original Python. The website offers a download of each original XLSX/CSV file, byte-for-byte, with its SHA-256 hash.
- The engine's original TARGET_TENDERS remain C&C, KIOSK, CARD, MANUAL CARD and MPOS. This connection does not invent Cash, MRD or Uber calculations absent from that original engine.

## What Supabase does

The website writes a small command to a protected queue. The local bridge claims that command and executes your unchanged Python. It reads the same `Treasury_Recon_Run_State.txt` as the BAS, publishes STATE/MESSAGE/RUN_ID progress, then uploads the original output files and their worksheet rows to private Finance storage. The website renders those rows; it does not run new reconciliation math.

Only a successful original `STATE=COMPLETE`, successful process exit and fully staged original output can become the current published result. Failed/cancelled jobs do not replace the last complete snapshot. Ordinary source refreshes are still your existing Python/SQL operations, not new Supabase calculations. No inbound connection or open port to your PC is required; the bridge makes outgoing HTTPS requests.

The original Excel/BAS workflow remains available. Do not start a second refresh simultaneously from Excel; the bridge checks the original run lock and refuses to launch a duplicate engine. Cancel stops only its owned child process and clears only the matching run's lock. The BAS itself is not altered. A network failure while reporting progress does not kill the engine or silently rerun it. The bridge keeps monitoring a healthy engine beyond the BAS's 60-minute UI wait limit, rather than killing or duplicating it; financial logic and engine arguments remain unchanged.

The standalone job queue and output snapshots are deployed already. The older generic CSV refresh adapter is not used for these controls. Existing operational workflow records are separate from the original-engine report snapshots. This package does not infer failed-integration captures, bank confirmations or refund identity from an aggregate workbook; those require their relevant transactional evidence.

## Important verification boundary

This package has NOT been installed or executed on your Windows/company computer by ChatGPT. The environment here cannot reach your Windows shared-drive files or local SQL Express instance. Actual balances and workbook parity against your company data must be checked after the first local run. File-hash equality, BAS command parity, transport controls, raw CSV/workbook value preservation, voucher comments/format markers, cancellation and network-progress handling have been tested with isolated fixtures. No company transaction values have been fabricated or marked reconciled.

The web viewer pages the original worksheet rows and supports the formatting rules used by the supplied V74 daily recon. The original Excel file remains the exact reference for Excel-specific behaviour such as printer settings, desktop comments and any features outside this viewer. No workbook formulas are recalculated by the bridge or browser. Files over 512 MB are refused without truncation or partial publication.

## If the bridge stops mid-run

Inspect `local-state/<job-id>/engine.log` and the original output/state files first. The system does not automatically rerun a command whose outcome is uncertain. If the original Python process has definitely finished, the SAME configured Windows bridge can release its abandoned website job using:

```
.venv\Scripts\python.exe Revenue_FPG_Bridge.py --release-abandoned JOB_ID
```

It verifies the locally recorded process is no longer active, marks the job failed for review and does not rerun or modify original source data. Never share `bridge.settings.json`, `.venv/`, `local-state/` or encrypted credential files with anyone; they are not part of the install ZIP.

## Tests

`python -m unittest discover -s tests -v` covers the six bridge/output tests. `tests/test_backend.sql` is a rolled-back server test of execution permissions, fingerprint checks, exact queue commands, duplicate prevention, false-completion rejection and cancellation. The SQL backend in this ZIP documents the already-applied implementation; do not rerun its CREATE TABLE statements against the live database.
