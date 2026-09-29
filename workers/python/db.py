"""Neon housekeeping: create tomorrow's `events` partition (spec §8.3).

Event writes go through the edge /ingest endpoint; this module only manages
partitions. Needs DATABASE_URL.
"""
from __future__ import annotations

import logging
import os
from datetime import date, timedelta

from sqlalchemy import create_engine, text

log = logging.getLogger("clearsignal.db")


def _engine():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    # Neon URLs are postgres://; SQLAlchemy wants the psycopg (v3) driver name.
    url = url.replace("postgres://", "postgresql+psycopg://", 1).replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url, pool_pre_ping=True)


def ensure_partitions(days_ahead: int = 1) -> None:
    eng = _engine()
    with eng.begin() as conn:
        for d in range(0, days_ahead + 1):
            day = date.today() + timedelta(days=d)
            conn.execute(text("SELECT ensure_event_partition(:d)"), {"d": day})
            log.info("partition ready for %s", day)
