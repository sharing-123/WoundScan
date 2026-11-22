"""Case storage. SQLite (one local file, no server, no account) by default; PostgreSQL when DATABASE_URL is set, so a
hosted copy keeps its data across restarts. Patient codes are pseudonyms, never names.

Every row belongs to a workspace: a random id the browser keeps in its own storage and sends with each request. On a
shared server this keeps one user's saved cases out of another user's list. It is separation, not authentication."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))
DB_PATH = Path(os.environ.get("WOUNDSCAN_DB", Path(__file__).resolve().parents[1] / "data" / "woundscan.db"))

COLS = "id TEXT PRIMARY KEY, workspace TEXT NOT NULL DEFAULT '', patient_code TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, captured_at TEXT NOT NULL, model TEXT NOT NULL, calibrated INTEGER NOT NULL, area_cm2 REAL, perimeter_mm REAL, tbsa_percent REAL, mm_per_pixel REAL, notes TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, thumb "
SCHEMA = f"CREATE TABLE IF NOT EXISTS cases ({COLS}{'BYTEA' if PG else 'BLOB'});\nCREATE INDEX IF NOT EXISTS idx_cases_patient ON cases(workspace, patient_code, captured_at);"


def _q(sql: str) -> str:
    return sql.replace("?", "%s") if PG else sql


@contextmanager
def conn():
    if PG:
        import psycopg
        from psycopg.rows import dict_row
        c = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10)
        c.execute("ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT ''")
        for stmt in SCHEMA.split(";\n"):
            c.execute(stmt)
    else:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        c = sqlite3.connect(DB_PATH)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys=ON")
        have = {r[1] for r in c.execute("PRAGMA table_info(cases)").fetchall()}
        if have and "workspace" not in have:  # database from before workspaces existed
            c.execute("ALTER TABLE cases ADD COLUMN workspace TEXT NOT NULL DEFAULT ''")
        c.executescript(SCHEMA)
    try:
        yield c
        c.commit()
    finally:
        c.close()


def _x(c, sql, params=()):
    return c.execute(_q(sql), params)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def add_case(workspace, patient_code, label, captured_at, model, analysis, notes="", thumb=None):
    cid = uuid.uuid4().hex[:12]
    with conn() as c:
        _x(c, "INSERT INTO cases(id,workspace,patient_code,label,created_at,captured_at,model,calibrated,area_cm2,perimeter_mm,tbsa_percent,mm_per_pixel,notes,payload,thumb) "
              "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
           (cid, workspace, patient_code, label, now(), captured_at or now(), model, int(bool(analysis.get("calibrated"))),
            analysis.get("area_cm2"), analysis.get("perimeter_mm"), analysis.get("tbsa_percent"), analysis.get("mm_per_pixel"),
            notes, json.dumps(analysis), thumb))
    return cid


def row_to_dict(r, with_payload=False):
    d = {k: r[k] for k in r.keys() if k not in ("payload", "thumb", "workspace")}
    d["calibrated"] = bool(d["calibrated"])
    d["has_thumb"] = r["thumb"] is not None
    if with_payload:
        d["analysis"] = json.loads(r["payload"])
    return d


def list_cases(workspace, patient_code=None, limit=200):
    with conn() as c:
        if patient_code:
            rows = _x(c, "SELECT * FROM cases WHERE workspace=? AND patient_code=? ORDER BY captured_at DESC LIMIT ?", (workspace, patient_code, limit)).fetchall()
        else:
            rows = _x(c, "SELECT * FROM cases WHERE workspace=? ORDER BY captured_at DESC LIMIT ?", (workspace, limit)).fetchall()
    return [row_to_dict(r) for r in rows]


def get_case(workspace, cid):
    with conn() as c:
        r = _x(c, "SELECT * FROM cases WHERE id=? AND workspace=?", (cid, workspace)).fetchone()
    return None if r is None else row_to_dict(r, True)


def get_thumb(workspace, cid):
    with conn() as c:
        r = _x(c, "SELECT thumb FROM cases WHERE id=? AND workspace=?", (cid, workspace)).fetchone()
    return None if r is None or r["thumb"] is None else bytes(r["thumb"])


def delete_case(workspace, cid):
    with conn() as c:
        return _x(c, "DELETE FROM cases WHERE id=? AND workspace=?", (cid, workspace)).rowcount > 0


def patients(workspace):
    with conn() as c:
        rows = _x(c, "SELECT patient_code, COUNT(*) AS n, MIN(captured_at) AS first, MAX(captured_at) AS last FROM cases WHERE workspace=? GROUP BY patient_code ORDER BY last DESC", (workspace,)).fetchall()
    return [dict(r) for r in rows]


def label() -> str:
    return "postgresql" if PG else DB_PATH.name
