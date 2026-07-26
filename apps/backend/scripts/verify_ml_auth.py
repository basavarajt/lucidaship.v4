"""
End-to-end smoke verification for Lucida ML + Firebase auth readiness.

The script intentionally uses only the Python standard library so it can run
from a bare Python install. The backend server under test still needs the
project requirements installed and running.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any
from urllib import error, parse, request


TRAIN_ROWS = [
    ["company", "revenue", "employees", "website_visits", "email_opens", "converted"],
    ["Acme Analytics", 135000, 42, 380, 31, 1],
    ["Beacon Labs", 82000, 18, 140, 8, 0],
    ["Cobalt Systems", 410000, 210, 690, 48, 1],
    ["Delta Retail", 54000, 12, 76, 4, 0],
    ["Evergreen Health", 225000, 88, 510, 36, 1],
    ["Futura AI", 310000, 135, 620, 44, 1],
    ["Gridline Ops", 99000, 26, 210, 10, 0],
    ["Helio Works", 185000, 64, 355, 27, 1],
    ["Ion Media", 72000, 15, 95, 6, 0],
    ["Juniper Cloud", 265000, 112, 490, 33, 1],
    ["Keystone Foods", 68000, 22, 120, 7, 0],
    ["Lumen Bank", 360000, 180, 705, 52, 1],
]

SCORE_ROWS = [
    ["company", "revenue", "employees", "website_visits", "email_opens"],
    ["Northstar Sales", 290000, 96, 580, 39],
    ["Orbit Tools", 64000, 17, 88, 5],
    ["Pioneer Data", 345000, 155, 660, 46],
]


@dataclass
class HttpResult:
    status: int
    body: Any
    raw: str


class SmokeFailure(RuntimeError):
    pass


def csv_bytes(rows: list[list[Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def decode_body(payload: bytes) -> tuple[Any, str]:
    raw = payload.decode("utf-8", errors="replace")
    try:
        return json.loads(raw), raw
    except json.JSONDecodeError:
        return raw, raw


def build_multipart(field_name: str, filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = f"----lucida-smoke-{uuid.uuid4().hex}"
    parts = [
        f"--{boundary}\r\n".encode(),
        (
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'
            "Content-Type: text/csv\r\n\r\n"
        ).encode(),
        content,
        b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def auth_headers(token: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"} if token else {}


def http_json(
    method: str,
    base_url: str,
    path: str,
    *,
    token: str | None = None,
    body: bytes | None = None,
    content_type: str | None = None,
    timeout: int = 60,
) -> HttpResult:
    url = base_url.rstrip("/") + path
    headers = auth_headers(token)
    if content_type:
        headers["Content-Type"] = content_type
    req = request.Request(url, data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            parsed, raw = decode_body(resp.read())
            return HttpResult(resp.status, parsed, raw)
    except error.HTTPError as exc:
        parsed, raw = decode_body(exc.read())
        return HttpResult(exc.code, parsed, raw)
    except error.URLError as exc:
        raise SmokeFailure(f"{method} {url} failed to connect: {exc.reason}") from exc


def post_csv(
    base_url: str,
    path: str,
    *,
    token: str | None,
    filename: str,
    content: bytes,
    timeout: int = 120,
) -> HttpResult:
    body, content_type = build_multipart("files", filename, content)
    return http_json("POST", base_url, path, token=token, body=body, content_type=content_type, timeout=timeout)


def data(result: HttpResult) -> Any:
    if isinstance(result.body, dict) and "data" in result.body:
        return result.body["data"]
    return result.body


def assert_status(result: HttpResult, expected: int | set[int], label: str) -> None:
    expected_set = expected if isinstance(expected, set) else {expected}
    if result.status not in expected_set:
        raise SmokeFailure(f"{label}: expected HTTP {sorted(expected_set)}, got {result.status}: {result.raw[:500]}")


def assert_success(result: HttpResult, label: str) -> Any:
    assert_status(result, 200, label)
    if not isinstance(result.body, dict) or result.body.get("success") is not True:
        raise SmokeFailure(f"{label}: expected standard success response, got: {result.raw[:500]}")
    return result.body.get("data")


def poll_job(base_url: str, job_id: str, token: str | None, timeout_seconds: int) -> Any:
    deadline = time.time() + timeout_seconds
    last_status = None
    while time.time() < deadline:
        status_result = http_json("GET", base_url, f"/train/status/{job_id}", token=token, timeout=30)
        status_data = assert_success(status_result, "poll training status")
        last_status = status_data.get("status")
        print(f"  job {job_id}: {last_status} {status_data.get('progress')}% - {status_data.get('current_step')}")
        if last_status == "completed":
            result = http_json("GET", base_url, f"/train/{job_id}/result", token=token, timeout=60)
            return assert_success(result, "fetch training result")
        if last_status == "failed":
            raise SmokeFailure(f"training job failed: {status_data.get('error')}")
        time.sleep(3)
    raise SmokeFailure(f"training job {job_id} did not complete within {timeout_seconds}s; last status={last_status}")


def verify_auth_boundaries(base_url: str, token: str | None, expect_auth: bool) -> None:
    health = http_json("GET", base_url, "/health", timeout=30)
    assert_status(health, 200, "health check")
    print("PASS health check")

    no_auth_me = http_json("GET", base_url, "/auth/me", timeout=30)
    if expect_auth:
        assert_status(no_auth_me, 401, "unauthenticated /auth/me")
        print("PASS unauthenticated /auth/me returns 401")
    else:
        assert_success(no_auth_me, "local bypass /auth/me")
        print("PASS local bypass /auth/me")

    no_auth_models = http_json("GET", base_url, "/models", timeout=30)
    if expect_auth:
        assert_status(no_auth_models, 401, "unauthenticated /models")
        print("PASS unauthenticated /models returns 401")
    else:
        assert_status(no_auth_models, {200, 404}, "local bypass /models")
        print("PASS local bypass reaches /models")

    if expect_auth and not token:
        raise SmokeFailure("--expect-auth requires --token or LUCIDA_FIREBASE_ID_TOKEN")

    if token:
        me = assert_success(http_json("GET", base_url, "/auth/me", token=token, timeout=30), "authenticated /auth/me")
        for field in ("id", "tenant_id", "email", "role", "clerk_user_id", "firebase_uid"):
            if field not in me:
                raise SmokeFailure(f"authenticated /auth/me missing field: {field}")
        print(f"PASS authenticated /auth/me tenant={me['tenant_id']}")


def verify_ml_flow(base_url: str, token: str | None, model_name: str, timeout_seconds: int) -> str:
    query = parse.urlencode({"model_name": model_name, "target_column": "converted", "mode": "supervised"})
    queued = post_csv(
        base_url,
        f"/train/async?{query}",
        token=token,
        filename="lucida-smoke-train.csv",
        content=csv_bytes(TRAIN_ROWS),
        timeout=120,
    )
    queued_data = assert_success(queued, "queue async training")
    job_id = queued_data.get("job_id")
    if not job_id:
        raise SmokeFailure(f"queue async training did not return job_id: {queued.raw[:500]}")
    print(f"PASS queued async training job={job_id}")

    final = poll_job(base_url, job_id, token, timeout_seconds)
    result = final.get("result") if isinstance(final, dict) and "result" in final else final
    if not isinstance(result, dict) or result.get("model_name") != model_name:
        raise SmokeFailure(f"training result missing expected model_name={model_name}: {json.dumps(final)[:500]}")
    print("PASS async training completed")

    score_query = parse.urlencode({"model_name": model_name, "auto_select_model": "false"})
    scored = post_csv(
        base_url,
        f"/score-csv?{score_query}",
        token=token,
        filename="lucida-smoke-score.csv",
        content=csv_bytes(SCORE_ROWS),
        timeout=120,
    )
    scored_data = assert_success(scored, "score trained model")
    results = scored_data.get("results") if isinstance(scored_data, dict) else None
    if not isinstance(results, list) or len(results) != len(SCORE_ROWS) - 1:
        raise SmokeFailure(f"scoring did not return expected results: {scored.raw[:500]}")
    first = results[0]
    required = {"score", "profile_score", "rationale", "rationale_summary", "recommended_action"}
    missing = sorted(required - set(first))
    if missing:
        raise SmokeFailure(f"scoring result missing fields {missing}: {json.dumps(first)[:500]}")
    scores = [row.get("score", 0) for row in results]
    if scores != sorted(scores, reverse=True):
        raise SmokeFailure(f"scoring results are not ranked descending: {scores}")
    print("PASS scoring returns ranked enriched leads")
    return job_id


def verify_cross_tenant(base_url: str, job_id: str, token_b: str) -> None:
    status_result = http_json("GET", base_url, f"/train/status/{job_id}", token=token_b, timeout=30)
    assert_status(status_result, 403, "second tenant blocked from first tenant job")
    print("PASS second Firebase user cannot access first user's training job")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify Lucida ML + Firebase auth readiness.")
    parser.add_argument(
        "--base-url",
        default=os.getenv("LUCIDA_BACKEND_URL"),
        required=not bool(os.getenv("LUCIDA_BACKEND_URL")),
        help="Backend URL, for example http://localhost:8000. Defaults to LUCIDA_BACKEND_URL.",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("LUCIDA_FIREBASE_ID_TOKEN"),
        help="Firebase ID token for the primary test user. Defaults to LUCIDA_FIREBASE_ID_TOKEN.",
    )
    parser.add_argument(
        "--token-b",
        default=os.getenv("LUCIDA_FIREBASE_ID_TOKEN_B"),
        help="Firebase ID token for a second test user. Defaults to LUCIDA_FIREBASE_ID_TOKEN_B.",
    )
    parser.add_argument("--expect-auth", action="store_true", help="Require unauthenticated protected routes to return 401")
    parser.add_argument("--model-name", default=f"smoke-{uuid.uuid4().hex[:8]}")
    parser.add_argument("--timeout-seconds", type=int, default=240)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = args.token
    token_b = args.token_b
    try:
        verify_auth_boundaries(args.base_url, token, args.expect_auth)
        job_id = verify_ml_flow(args.base_url, token, args.model_name, args.timeout_seconds)
        if token_b:
            verify_cross_tenant(args.base_url, job_id, token_b)
    except SmokeFailure as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    print("PASS Lucida ML + auth smoke verification complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
