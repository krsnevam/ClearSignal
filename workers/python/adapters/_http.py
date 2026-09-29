"""Shared HTTP client with retries (tenacity, exponential backoff)."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

log = logging.getLogger("clearsignal.http")

TIMEOUT = httpx.Timeout(20.0, connect=10.0)
HEADERS = {"User-Agent": "ClearSignal/0.1 (+https://clearsignal.app; disaster-response research)"}

_etags: Dict[str, str] = {}
_bodies: Dict[str, Any] = {}


class Transient(Exception):
    pass


@retry(
    retry=retry_if_exception_type((httpx.TransportError, Transient)),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def get_json(url: str, params: Optional[Dict[str, Any]] = None, use_etag: bool = False) -> Any:
    headers = dict(HEADERS)
    key = url + repr(sorted((params or {}).items()))
    if use_etag and key in _etags:
        headers["If-None-Match"] = _etags[key]
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=headers, follow_redirects=True) as client:
        r = await client.get(url, params=params)
    if r.status_code == 304 and key in _bodies:
        return _bodies[key]
    if r.status_code in (429, 500, 502, 503, 504):
        raise Transient("HTTP %d from %s" % (r.status_code, url))
    r.raise_for_status()
    body = r.json()
    if use_etag and "etag" in r.headers:
        _etags[key] = r.headers["etag"]
        _bodies[key] = body
    return body


@retry(
    retry=retry_if_exception_type((httpx.TransportError, Transient)),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def get_text(url: str, params: Optional[Dict[str, Any]] = None) -> str:
    async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
        r = await client.get(url, params=params)
    if r.status_code in (429, 500, 502, 503, 504):
        raise Transient("HTTP %d from %s" % (r.status_code, url))
    r.raise_for_status()
    return r.text


async def post_data(url: str, data: Dict[str, str]) -> Any:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0), headers=HEADERS) as client:
        r = await client.post(url, data=data)
    r.raise_for_status()
    return r.json()
