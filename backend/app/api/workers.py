"""Worker management + personal history endpoints."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_worker
from app.database import get_db
from app.models import Reading, User
from app.schemas import WorkerCreate, UserOut
from app.security import hash_password
from app.serializers import reading_out, worker_summary

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("")
def list_workers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
    q: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
):
    users = db.query(User).filter(User.role == "worker").order_by(
        User.employee_id).all()
    today = dt.datetime.utcnow().date()
    rows = [worker_summary(w, today) for w in users]
    if q:
        ql = q.lower()
        rows = [r for r in rows
                if ql in r["name"].lower() or ql in r["employee_id"].lower()
                or (r["department"] and ql in r["department"].lower())]
    if status_filter in ("SAFE", "DANGER"):
        rows = [r for r in rows if r["status"] == status_filter]
    return rows


@router.post("", response_model=UserOut, status_code=201)
def create_worker(payload: WorkerCreate,
                  db: Session = Depends(get_db),
                  _admin: User = Depends(require_admin)):
    email = payload.email.lower()
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(409, "A user with this email already exists.")
    if db.query(User).filter_by(employee_id=payload.employee_id).first():
        raise HTTPException(409, "This employee ID is already registered.")
    user = User(
        name=payload.name, email=email, employee_id=payload.employee_id,
        hashed_password=hash_password(payload.password), role="worker",
        department=payload.department, mobile=payload.mobile,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/summary")
def my_summary(db: Session = Depends(get_db),
               worker: User = Depends(require_worker)):
    today = dt.datetime.utcnow().date()
    return worker_summary(worker, today)


@router.get("/me/readings")
def my_readings(
    db: Session = Depends(get_db),
    worker: User = Depends(require_worker),
    limit: int = 50,
):
    rows = (
        db.query(Reading)
        .filter_by(worker_id=worker.id)
        .order_by(Reading.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [reading_out(r) for r in rows]


@router.get("/{worker_id}")
def get_worker(worker_id: int,
               db: Session = Depends(get_db),
               viewer: User = Depends(get_current_user)):
    w = db.get(User, worker_id)
    if w is None or w.role != "worker":
        raise HTTPException(404, "Worker not found.")
    if viewer.role != "admin" and viewer.id != w.id:
        raise HTTPException(403, "Not permitted.")
    today = dt.datetime.utcnow().date()
    return worker_summary(w, today)


@router.get("/{worker_id}/readings")
def worker_readings(worker_id: int,
                    db: Session = Depends(get_db),
                    viewer: User = Depends(get_current_user),
                    limit: int = 100):
    w = db.get(User, worker_id)
    if w is None:
        raise HTTPException(404, "Worker not found.")
    if viewer.role != "admin" and viewer.id != w.id:
        raise HTTPException(403, "Not permitted.")
    rows = (
        db.query(Reading)
        .filter_by(worker_id=worker_id)
        .order_by(Reading.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [reading_out(r) for r in rows]
