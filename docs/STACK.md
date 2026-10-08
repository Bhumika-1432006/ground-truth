# Stack

Reuse what worked on Leash. Nothing new unless it saves a day.

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11 | Lambda runtime; Leash already uses it. |
| Scorer | Pure Python (`statistics`, `math`), no pandas or numpy | The data is small (about 50 stations × 672 hours). No layer to build, fast cold start, and the same code runs in pytest and in Lambda. The spike's pandas code is a reference, not a dependency. |
| Infra as code | AWS SAM (`template.yaml`) | Copied from Leash. `sam deploy` once with `--guided`, then `make deploy`. |
| Schedule | EventBridge `rate(1 hour)` -> ingest Lambda | #3 |
| Secrets | SSM SecureString `/ground-truth/openaq-key` | #1. Never in the repo. |
| Storage + hosting | One S3 bucket (`index.html`, `assets/`, `data/`) behind CloudFront | #2. Falls back to the S3 website endpoint if CloudFront is blocked on the plan. |
| Data in | OpenAQ API v3 (latest hours) + public archive `s3://openaq-data-archive` (backfill, us-east-1) | The archive is about 4 days behind, so the API covers the gap. |
| Front end | Vanilla HTML/CSS/JS, no build step | Leash paper design system (tokens, type, cards). One `index.html`, one `app.js`, one `style.css`. |
| Map | Leaflet 1.9.4 (cdnjs) + OSM tiles | Light and well known. Show attribution. |
| Chart | Chart.js 4.4.x (cdnjs, exact version pinned) | Hour-of-day gap line, neighbour band, 11-17 window shaded. |
| Tests | pytest. Planted-anomaly test + physics unit tests + JSON contract test | Run in CI on every PR. |
| CI/CD | GitHub Actions: `pytest` on PR; `sam deploy` on merge to main (OIDC role, no long-lived keys) | Copied from Leash. |
| Video | Hyperframes (HTML -> video) + edge-tts voice-over | Scripted from day 1 so it isn't rushed on Sunday. |

## JSON contract (front end <-> Lambda)

`data/latest.json`
```json
{
  "generated_at": "2026-10-09T10:05:00+05:30",
  "data_through": "2026-10-09T09:00:00+05:30",
  "stations": [
    {"id": 8235, "name": "Jahangirpuri", "lat": 28.733, "lon": 77.171,
     "status": "watch",
     "checks": {
       "physics":    {"status": "ok",    "detail": "0.4% of hours fail (PM2.5 > PM10 or stuck)"},
       "neighbours": {"status": "watch", "detail": "Daytime PM10 4% lower than neighbours vs night"},
       "history":    {"status": "flag",  "detail": "Daytime humidity gap +8 pts vs last 3 weeks"}
     },
     "latest": {"pm25": 182, "pm10": 301, "no2": 61, "co": 1.4, "relativehumidity": 64}}
  ]
}
```

`data/stations/<id>.json`
```json
{"id": 8235, "neighbours": [8915, 8917, 5541, 10831],
 "hour_profile": {"pm10": [0.12, 0.10, ...24 values], "pm25": [...], "no2": [...], "co": [...], "relativehumidity": [...]},
 "daily": [{"date": "2026-10-08", "d_pm10": -0.05, "d_rh": 9.1, "physics_fail_pct": 0.0}]}
```

Status values are exactly `ok`, `watch`, `flag` or `nodata`. Gaps are natural-log ratios, except humidity, which is in percentage points.
