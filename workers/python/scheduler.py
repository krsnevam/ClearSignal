"""Runs every adapter on its refresh interval and pushes batches to the edge.

Events go through POST /ingest (not straight to Postgres) so there is one
Normalize stage, one tier registry and one place that wakes connected phones.
Usage:  python -m scheduler            # run forever
        python -m scheduler --once     # one pass over every adapter, then exit
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from adapters import all_adapters
from adapters._base import FetchResult

log = logging.getLogger("clearsignal.scheduler")
INGEST_URL = os.environ.get("EDGE_INGEST_URL", "http://localhost:8787/ingest")
INGEST_TOKEN = os.environ.get("INGEST_TOKEN", "")

_since: Dict[str, datetime] = {}


async def push(result: FetchResult) -> None:
    body = {
        "events": result.events,
        "source_results": [{"source_id": result.source_id, "ok": result.ok, **({"error": result.error} if result.error else {})}],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(INGEST_URL, json=body, headers={"authorization": "Bearer " + INGEST_TOKEN})
    r.raise_for_status()
    out = r.json()
    log.info("%s: %d events, %d inserted, %d rejected", result.source_id, len(result.events), out["inserted"], len(out["rejected"]))


async def run_adapter(adapter) -> None:
    now = datetime.now(timezone.utc)
    # First run looks back one refresh window (min 1 h); later runs overlap by 10 min — ingest is idempotent.
    since = _since.get(adapter.source_id, now - timedelta(seconds=max(adapter.refresh_interval_seconds, 3600)))
    result = await adapter.fetch(since)
    try:
        await push(result)
        if result.ok:
            _since[adapter.source_id] = now - timedelta(minutes=10)
    except Exception as e:  # edge unreachable: keep `since`, retry next tick
        log.warning("push %s failed: %s", adapter.source_id, e)


def active(adapters):
    out = []
    for a in adapters:
        if getattr(a, "configured", True):
            out.append(a)
        else:
            log.info("skipping %s: not configured", a.source_id)
    return out


async def main(once: bool) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if not INGEST_TOKEN:
        raise SystemExit("INGEST_TOKEN is not set")
    adapters = active(all_adapters())
    if once:
        await asyncio.gather(*(run_adapter(a) for a in adapters))
        return
    sched = AsyncIOScheduler(timezone="UTC")
    for a in adapters:
        sched.add_job(run_adapter, "interval", seconds=max(a.refresh_interval_seconds, 60), args=[a],
                      next_run_time=datetime.now(timezone.utc), max_instances=1, coalesce=True, id=a.source_id)
    try:
        from db import ensure_partitions
        sched.add_job(ensure_partitions, "cron", hour=0, minute=5, next_run_time=datetime.now(timezone.utc))
    except Exception as e:  # DATABASE_URL optional
        log.info("partition job disabled: %s", e)
    sched.start()
    await asyncio.Event().wait()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true")
    asyncio.run(main(p.parse_args().once))
