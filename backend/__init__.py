"""Backend package compatibility helpers.

The application historically used ``backend`` as the import root when started
with ``--app-dir backend``. Keep that layout working while also allowing
``backend.main`` to be imported from the project root.
"""

from pathlib import Path
import sys


_BACKEND_DIR = str(Path(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
