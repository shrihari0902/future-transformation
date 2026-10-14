import os
from pathlib import Path


def _test_database_url() -> str:
    configured = os.environ.get("DATABASE_URL")
    if not configured:
        env_file = Path(__file__).resolve().parents[1] / ".env"
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                configured = line.split("=", 1)[1].strip().strip('"')
                break
    if not configured:
        raise RuntimeError("DATABASE_URL must be configured before running backend tests")

    base_url, database_name = configured.rsplit("/", 1)
    if database_name.endswith("_test"):
        return configured
    return f"{base_url}/{database_name}_test"


# Must run before any test imports app.core.database or app.main.
os.environ["DATABASE_URL"] = _test_database_url()
