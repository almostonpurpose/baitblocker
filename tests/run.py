import runpy
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).parent

subprocess.run(
    [ "node", str(ROOT / "background_harness.mjs") ],
    check=True,
    stdout=sys.stdout,
    stderr=sys.stderr,
)

for test in ("test_extension.py", "test_churn.py", "test_ui.py"):
    runpy.run_path(str(ROOT / test), run_name="__main__")
