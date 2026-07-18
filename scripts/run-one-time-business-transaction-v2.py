from pathlib import Path
import textwrap

workflow_path = Path('.github/workflows/apply-business-transaction-optional-v2.yml')
workflow = workflow_path.read_text(encoding='utf-8')
start_marker = "          python3 <<'PY'\n"
end_marker = "\n          PY\n\n      - name: Install dependencies"
start = workflow.find(start_marker)
end = workflow.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Could not extract one-time patch script')
script = textwrap.dedent(workflow[start + len(start_marker):end])
exec(compile(script, str(workflow_path), 'exec'), {'__name__': '__main__'})
