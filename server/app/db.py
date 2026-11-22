"""SQLite storage (single local file, no server, no account). Patient codes are pseudonyms, never names."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("WOUNDSCAN_DB", Path(__file__).resolve().parents[1] / "data" / "woundscan.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  patient_code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  model TEXT NOT NULL,
  calibrated INTEGER NOT NULL,
  area_cm2 REAL,
  perimeter_mm REAL,
  tbsa_percent REAL,
  mm_per_pixel REAL,
  notes TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  thumb BLOB
);
CREATE INDEX IF NOT EXISTS idx_cases_patient ON cases(patient_code, captured_at);
"""


@contextmanager
def conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.executescript(SCHEMA)
    try:
        yield c
        c.commit()
    finally:
        c.close()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def add_case(patient_code, label, captured_at, model, analysis, notes="", thumb=None):
    cid = uuid.uuid4().hex[:12]
    with conn() as c:
        c.execute(
            "INSERT INTO cases(id,patient_code,label,created_at,captured_at,model,calibrated,area_cm2,perimeter_mm,tbsa_percent,mm_per_pixel,notes,payload,thumb) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (cid, patient_code, label, now(), captured_at or now(), model, int(bool(analysis.get("calibrated"))),
             analysis.get("area_cm2"), analysis.get("perimeter_mm"), analysis.get("tbsa_percent"), analysis.get("mm_per_pixel"),
             notes, json.dumps(analysis), thumb))
    return cid


def row_to_dict(r, with_payload=False):
    d = {k: r[k] for k in r.keys() if k not in ("payload", "thumb")}
    d["calibrated"] = bool(d["calibrated"])
    d["has_thumb"] = r["thumb"] is not None
    if with_payload:
        d["analysis"] = json.loads(r["payload"])
    return d


def list_cases(patient_code=None, limit=200):
    with conn() as c:
        if patient_code:
            rows = c.execute("SELECT * FROM cases WHERE patient_code=? ORDER BY captured_at DESC LIMIT ?", (patient_code, limit)).fetchall()
        else:
            rows = c.execute("SELECT * FROM cases ORDER BY captured_at DESC LIMIT ?", (limit,)).fetchall()
    return [row_to_dict(r) for r in rows]


def get_case(cid):
    with conn() as c:
        r = c.execute("SELECT * FROM cases WHERE id=?", (cid,)).fetchone()
    return None if r is None else row_to_dict(r, True)


def get_thumb(cid):
    with conn() as c:
        r = c.execute("SELECT thumb FROM cases WHERE id=?", (cid,)).fetchone()
    return None if r is None else r["thumb"]


def delete_case(cid):
    with conn() as c:
        return c.execute("DELETE FROM cases WHERE id=?", (cid,)).rowcount > 0


def patients():
    with conn() as c:
        rows = c.execute("SELECT patient_code, COUNT(*) n, MIN(captured_at) first, MAX(captured_at) last FROM cases GROUP BY patient_code ORDER BY last DESC").fetchall()
    return [dict(r) for r in rows]
