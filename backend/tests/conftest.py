"""Pytest fixtures: isolated SQLite DB + synthetic-image helpers."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(REPO))

_tmp = tempfile.mkdtemp(prefix="hydronexus-test-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(_tmp) / 'test.db'}")
os.environ.setdefault("AUTO_SEED", "0")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.database import Base, SessionLocal, engine
    from app.main import app
    from app.seed import seed_if_empty

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_if_empty(db, force=True)
    db.close()

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(client):
    def login(email, password):
        r = client.post("/api/auth/login",
                        json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        return r.json()["access_token"]

    return {
        "admin": login("admin@hydronexus.io", "admin@1234"),
        "worker": login("w1024@hydronexus.io", "worker@1234"),
        "worker6": login("w1029@hydronexus.io", "worker@1234"),
    }


@pytest.fixture
def rng():
    return np.random.default_rng(1234)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
