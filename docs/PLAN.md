# Plan

**Ground Truth: which of Delhi's air-quality numbers can you trust?** Every monitor checked against its neighbours, its own history and its own physics. Environmental Hacks 2026, Air track. Submission Sunday 11 Oct 2026.

## The pitch in one breath

Delhi publishes readings from about 40 monitors, and people make decisions on them: schools, outdoor work, GRAP stages. In Oct-Nov 2025 reporters filmed water tankers spraying around monitors. Nobody can tell from the published number whether a station is behaving. Ground Truth puts every station on a map, gives each one three plain checks, and shows the hour-of-day chart behind every flag, so anyone can see *why* a station is flagged.

## What the spike taught us (see `spike/RESULTS.md`)

- The data is solid. The public OpenAQ archive has 52 stations in the Delhi box at 15-minute resolution, Oct-Nov 2025 is 99% complete, and no credentials are needed.
- We **cannot** claim to detect spraying. On a method fixed in advance, Anand Vihar ranks 6th and Jahangirpuri 13th of 38. So the product is an *anomaly finder that shows its evidence*, never an accusation.
- The physics checks are cheap and they fire. 1,044 of 66,831 station-hours have PM2.5 above PM10, which is physically impossible. Three stations do it more than 5% of the time (Vikas Sadan 31%, Arya Nagar 14%, Gwal Pahari 7%), and the same two have about 700 stuck or zero hours each.
- The neighbour chart is the clearest picture we have. Anand Vihar's PM10 sits 29% above its neighbours at night and only 9% above them at 11:00-16:00. Whatever the cause, a viewer gets that in one glance.

## The three checks (each station gets ok / watch / flag per check)

| Check | Question | Rule (v1) |
|---|---|---|
| **Physics** | Can this reading be real? | PM2.5 > 1.05 × PM10, values out of range, or 3+ identical hours in a row. Flag if >5% of the last 7 days' hours fail; watch if >1%. |
| **Neighbours** | Does it agree with stations around it? | Log gap against the median of its nearest 4 within 12 km (co-located twins skipped). Last 7 days' daytime (11-17) minus night (22-06) PM10 contrast, corrected for daytime mixing with a city-wide Theil-Sen line against the night gap, as a robust z across stations. Watch at \|z\| ≥ 2, flag at ≥ 3. |
| **History** | Has it changed against itself? | The same contrast for PM10 and humidity: the last 7 days against the 21 before, in robust SDs of the station's own day-to-day spread. Watch at 2, flag at 3. |

Scoring runs twice. Stations flagged on neighbours or history in the first pass are left out of everyone else's reference in the second, so one misbehaving station doesn't drag its neighbours with it.

The headline status is the worst of the three. Copy says "doesn't agree with its neighbours" and never "fake" or "tampered".

## Architecture

```
EventBridge rate(1 hour)
   -> ingest Lambda (Python 3.11)
        reads: OpenAQ API (latest hours, key from SSM)
               + data/raw/hourly.json rolling 28-day cache in S3 (seeded once from the public archive)
        runs:  scorer (pure Python, the same code pytest runs)
        writes: data/latest.json, data/stations/<id>.json   (site bucket)
   -> CloudFront -> static site (vanilla HTML/JS, Leash paper design)
        Leaflet map of stations coloured by status
        click a station -> three check cards + Chart.js hour-of-day gap chart
```

The archive runs about 4 days behind (on 8 Oct the latest file was 4 Oct), so the live hour must come from the API (#3), while the 28-day history is seeded from the archive.

## Schedule

| When | Goal | Owner |
|---|---|---|
| **Thu 8 Oct** | Plan merged. AWS account + key (#1). Walking skeleton live: a URL showing one real Jahangirpuri reading (#2). JSON contract agreed. Video script v1. | All |
| **Fri 9 Oct** | Scorer + tests on the spike data. Ingest writes real JSON hourly (#3). Map + station panel read the JSON. | Chirag, Abhijeet, Bhumika |
| **Sat 10 Oct** | Design pass on the real data. Record the console shot (#4) and the video. Write-up. **Submit Saturday night.** | All |
| **Sun 11 Oct** | Buffer only: fix links and re-record if needed. Nothing new. | - |

## Out of scope

Claims about spraying, cities other than Delhi, alerts and notifications, user accounts, forecasting, any ML model.

## How we'll know it worked

- A judge opens the URL, sees the map in under 2 seconds, clicks Vikas Sadan and understands why it's flagged without reading docs.
- The data is less than 2 hours old during judging.
- `pytest` passes, including a planted-anomaly test: inject a daytime PM10 drop at one station and the neighbour and history checks flag it, while the untouched stations stay ok.
- The video is under 3 minutes, shows the real console, and states the limits honestly.
