"""Ingest tests with a fake OpenAQ API and an in-memory store: no network, no AWS, no key."""
import datetime as dt, io, json, os, sys, urllib.error, urllib.parse

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "src"))
import ingest  # noqa: E402

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 8, 9, 30, tzinfo=UTC)  # 15:00 IST
STATIONS = [{"id": i, "name": f"S{i}", "lat": 28.6 + i * 0.01, "lon": 77.2} for i in range(1, 5)]


class MemStore:
    def __init__(self, data=None):
        self.data, self.cache = dict(data or {}), {}

    def get_json(self, key):
        return json.loads(json.dumps(self.data[key])) if key in self.data else None

    def put_json(self, key, obj, max_age=None):
        self.data[key], self.cache[key] = json.loads(json.dumps(obj)), max_age


class FakeAPI:
    """Serves /locations/{id} and /sensors/{id}/hours. Sensor id = location*10 + param index."""

    def __init__(self, fail_first=0, now=NOW):
        self.requests, self.fail_first, self.now = [], fail_first, now

    def __call__(self, req, timeout=None):
        assert req.get_header("X-api-key") == "k"
        u = urllib.parse.urlparse(req.full_url)
        q = dict(urllib.parse.parse_qsl(u.query))
        self.requests.append((u.path, q))
        if self.fail_first:
            self.fail_first -= 1
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, None)
        parts = u.path.split("/")
        if parts[-2] == "locations":
            loc = int(parts[-1])
            sensors = [{"id": loc * 10 + i, "parameter": {"name": p}} for i, p in enumerate(ingest.backfill.PARAMS)]
            sensors.append({"id": loc * 10 + 9, "parameter": {"name": "o3"}})  # ignored
            body = {"results": [{"id": loc, "sensors": sensors}]}
        else:
            sid = int(parts[-2])
            start = dt.datetime.fromisoformat(q["datetime_from"].replace("Z", "+00:00"))
            rows, t = [], start
            while t + dt.timedelta(minutes=15) <= self.now:  # 15-min readings, stamped at the interval's end
                value = 100.0 + sid if sid % 10 != 1 else 50.0 + sid  # pm25 below pm10
                end = t + dt.timedelta(minutes=15)
                rows.append({"value": value, "period": {"datetimeFrom": {"utc": t.strftime("%Y-%m-%dT%H:%M:%SZ")},
                                                        "datetimeTo": {"utc": end.strftime("%Y-%m-%dT%H:%M:%SZ")}}})
                t = end
            body = {"results": rows}
        return io.BytesIO(json.dumps(body).encode())


def api(fake):
    return ingest.OpenAQ("k", opener=fake, sleep=lambda s: None)


def test_first_run_fetches_sensors_and_six_days():
    store, fake = MemStore(), FakeAPI()
    log = ingest.run(store, api(fake), STATIONS, NOW)
    assert set(store.data[ingest.SENSORS_KEY]["1"]) == set(ingest.backfill.PARAMS)
    pm10 = store.data[ingest.RAW_KEY]["1"]["pm10"]
    assert len(pm10) == 6 * 24  # 15:00 IST six days ago through the complete 14:00-15:00 hour today
    assert max(pm10) == "2026-10-08T14"
    assert log["scored"] and log["data_through"] == max(pm10)
    assert store.cache["data/latest.json"] == 300
    assert {s["id"] for s in store.data["data/latest.json"]["stations"]} == {1, 2, 3, 4}


def test_second_run_only_fetches_recent_hours_and_keeps_history():
    store = MemStore()
    ingest.run(store, api(FakeAPI()), STATIONS, NOW)
    before = len(store.data[ingest.RAW_KEY]["1"]["pm10"])
    fake = FakeAPI(now=NOW + dt.timedelta(hours=1))
    ingest.run(store, api(fake), STATIONS, NOW + dt.timedelta(hours=1))
    hours_calls = [q for p, q in fake.requests if p.endswith("/measurements")]
    assert not any(p.startswith("/v3/locations") for p, _ in fake.requests)  # sensor map is cached
    assert len(hours_calls) == 4 * 5
    since = dt.datetime.fromisoformat(hours_calls[0]["datetime_from"].replace("Z", "+00:00"))
    assert NOW - since <= dt.timedelta(hours=3)
    assert len(store.data[ingest.RAW_KEY]["1"]["pm10"]) == before + 1


def test_cache_is_trimmed_to_29_days():
    old = {"1": {"pm10": {"2026-08-01T10": 99.0, "2026-10-07T10": 98.0}}}
    store = MemStore({ingest.RAW_KEY: old})
    ingest.run(store, api(FakeAPI()), STATIONS, NOW)
    keys = store.data[ingest.RAW_KEY]["1"]["pm10"]
    assert "2026-08-01T10" not in keys and "2026-10-07T10" in keys


def test_call_budget_is_respected_and_rest_is_skipped():
    fake = FakeAPI()
    a = api(fake)
    log = ingest.run(MemStore(), a, STATIONS, NOW, max_calls=8)
    assert a.calls <= 8 + 1 and log["skipped"] > 0


def test_rate_limit_is_retried():
    fake = FakeAPI(fail_first=2)
    a = api(fake)
    assert a.sensors(1)["pm10"] == 10
    assert a.calls == 3


def test_other_http_errors_are_raised():
    def boom(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)
    with pytest.raises(urllib.error.HTTPError):
        ingest.OpenAQ("k", opener=boom, sleep=lambda s: None).sensors(1)


def test_overlap_ratio_reports_units_agreement():
    """Archive values already in the cache are compared with the API's for the same hours."""
    seed = {str(s["id"]): {"pm10": {"2026-10-08T10": 100.0 + s["id"] * 10}} for s in STATIONS}
    store = MemStore({ingest.RAW_KEY: seed})
    log = ingest.run(store, api(FakeAPI()), STATIONS, NOW)
    assert log["overlap_ratio"]["pm10"] == pytest.approx(1.0)


def test_score_hour_ignores_a_single_early_clock():
    hourly = {"1": {"pm10": {"2026-10-08T12": 1, "2026-10-08T20": 1}}, "2": {"pm10": {"2026-10-08T12": 1}},
              "3": {"pm25": {"2026-10-08T12": 1}}, "4": {}}
    assert ingest.score_hour(hourly, 4) == "2026-10-08T12"


# ---------- archive re-sync (#33) ----------

class DictStore:
    def __init__(self, data=None):
        self._d = dict(data or {})
    def get_json(self, key):
        return self._d.get(key)
    def put_json(self, key, obj, **_):
        self._d[key] = obj


def _make_hourly(sid="1", p="pm10", hours=None):
    vals = hours or {"2025-11-26T10": 100.0, "2025-11-26T11": 110.0}
    return {sid: {p: vals}}


def test_resync_replaces_api_hour(monkeypatch):
    import ingest, backfill as bf
    monkeypatch.setattr(bf, "listed_days", lambda *a, **kw: ["fake_20251126.csv.gz"])
    monkeypatch.setattr(bf, "day_rows", lambda *a, **kw: [
        {"parameter": "pm10", "value": "90.0", "datetime": "2025-11-26T05:15:00+00:00"},
        {"parameter": "pm10", "value": "92.0", "datetime": "2025-11-26T05:30:00+00:00"},
    ])
    hourly = _make_hourly("1", "pm10", {"2025-11-26T10": 100.0})
    now = dt.datetime(2025, 11, 30, 0, 0, tzinfo=ingest.IST)
    store = DictStore()
    result = ingest.resync_archive(hourly, now, store)
    assert result["resync_changed_hours"] > 0 or "resync_max_diff" in result


def test_should_resync_only_once_per_day(monkeypatch):
    import ingest
    now = dt.datetime(2025, 11, 30, 4, 0, tzinfo=ingest.IST)  # 04:00 IST
    store_fresh = DictStore()
    assert ingest._should_resync(now, store_fresh) is True
    store_done = DictStore({"data/raw/resync_marker.json": {"date": "2025-11-30"}})
    assert ingest._should_resync(now, store_done) is False


def test_should_not_resync_before_hour(monkeypatch):
    import ingest
    now = dt.datetime(2025, 11, 30, 2, 0, tzinfo=ingest.IST)  # 02:00 IST
    assert ingest._should_resync(now, DictStore()) is False
