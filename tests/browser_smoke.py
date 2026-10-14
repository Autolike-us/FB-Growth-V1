"""Compatibility entrypoint for the offline JavaScript browser fixtures."""
from pathlib import Path
import subprocess
subprocess.run(["node", str(Path(__file__).with_name("browser.test.cjs"))], check=True)
