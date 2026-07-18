from pathlib import Path
import runpy

workflow_path = Path('.github/workflows/apply-business-transaction-optional-v2.yml')
workflow = workflow_path.read_text(encoding='utf-8')
start_marker = "          python3 <<'PY'\n"
end_marker = "\n          PY\n\n      - name: Install dependencies"
start = workflow.find(start_marker)
end = workflow.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Could not extract one-time patch script')
raw_script = workflow[start + len(start_marker):end]
script = '\n'.join(
    line[10:] if line.startswith('          ') else line
    for line in raw_script.splitlines()
) + '\n'
script_path = Path('/tmp/apply_business_transaction_v2.py')
script_path.write_text(script, encoding='utf-8')
runpy.run_path(str(script_path), run_name='__main__')
