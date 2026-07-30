import asyncio
import json

from app.api import scoring


class _Result:
    def __init__(self, rows):
        self.rows = rows


class _Connection:
    def __init__(self):
        self.calls = []

    def execute(self, query, params):
        self.calls.append((query, params))
        if "COUNT(*)" in query:
            return _Result([("run-a", "enterprise", "v1", 2, "2026-07-30 10:00:00", 91.0, 64.0)])
        return _Result([
            (json.dumps({"company": "Acme"}), 91.0, "enterprise", "v1", "2026-07-30 10:00:00"),
            (json.dumps({"company": "Globex"}), 64.0, "enterprise", "v1", "2026-07-30 10:00:00"),
        ])


def test_saved_rankings_are_scoped_to_the_authenticated_tenant(monkeypatch):
    conn = _Connection()
    monkeypatch.setattr(scoring, "get_db", lambda: conn)
    user = {"tenant_id": "tenant-a"}

    listing = asyncio.run(scoring.list_saved_ranked_lists(user))
    listed = json.loads(listing.body)
    assert listed["data"]["ranked_lists"][0]["run_id"] == "run-a"
    assert conn.calls[0][1] == ["tenant-a"]

    ranked = asyncio.run(scoring.get_saved_ranked_list("run-a", user))
    payload = json.loads(ranked.body)["data"]
    assert payload["n_leads"] == 2
    assert payload["results"][0]["data"]["company"] == "Acme"
    assert conn.calls[1][1] == ["tenant-a", "run-a"]
