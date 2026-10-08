# src

The backend. Pure Python 3.11 standard library, with no dependencies, so the same code runs locally, in pytest and in Lambda.

| File | What it does |
|---|---|
| `stations.tsv` | The 52 OpenAQ locations in the Delhi box (id, name, lat, lon), from the spike sweep. |
| `backfill.py` | Builds hourly history from the public OpenAQ archive on S3 (no key). Lists the bucket to find files, retries every error and checks every gzip. Writes `{station_id: {param: {"YYYY-MM-DDTHH": value}}}` with IST hour keys. |
| `scorer.py` | The three checks per station (physics, neighbours, history). Writes `latest.json` and `stations/<id>.json` in the shape in `docs/STACK.md`. |

## Run

```
python src/backfill.py hourly.json --end 2026-10-04 --days 29 --cache .cache
python src/scorer.py hourly.json out            # scores the 28 days ending at the latest hour in the file
python src/scorer.py hourly.json out --now 2025-11-30T23 --days 61
```

The archive runs about 4 days behind real time, so for live data the ingest Lambda (#3) adds the latest hours from the OpenAQ API.

## How the checks work

See the table in `docs/PLAN.md`. In short:
- **physics:** share of the last 7 days' hours with PM2.5 > 1.05 × PM10, out-of-range values or a stuck PM sensor. Watch above 1%, flag above 5%.
- **neighbours:** daytime (11-17) minus night (22-06) PM10 gap against the median of the 4 nearest stations within 12 km, corrected for daytime mixing with a Theil-Sen line across the city. Robust z: watch at 2, flag at 3.
- **history:** the same contrast for PM10 and humidity, last 7 days against the previous 21 days, in robust SDs. Watch at 2, flag at 3.

Scoring runs twice: stations flagged in the first pass are left out of their neighbours' references in the second.
