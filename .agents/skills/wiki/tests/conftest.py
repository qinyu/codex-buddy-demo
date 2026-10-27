from pathlib import Path

import pytest


@pytest.fixture
def tmp_ws(tmp_path: Path) -> Path:
    return tmp_path
