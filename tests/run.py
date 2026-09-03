import runpy
from pathlib import Path


ROOT = Path(__file__).parent
for test in ("test_extension.py", "test_ui.py"):
    runpy.run_path(str(ROOT / test), run_name="__main__")
