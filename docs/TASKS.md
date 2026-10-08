# Tasks

Every task is a GitHub issue. This file is the map; the issues hold the checklists. P0 = the demo doesn't exist without it.

## Abhijeet (thegoodengineer): AWS

| # | Task | P | Day |
|---|---|---|---|
| 1 | AWS account, profile, OpenAQ key in SSM (us-east-1) | P0 | Thu |
| 2 | Walking skeleton: S3 + CloudFront + one Lambda, public URL | P0 | Thu |
| 3 | Hourly ingest: EventBridge -> Lambda -> JSON in S3 | P0 | Fri |
| 4 | Video proof shot: 15 s of the real console | P1 | Sat |
| 5 | Stop the Leash EC2 brain | P1 | Thu |

## Chirag (Chirag6722): scorer, tests, story

| Task | P | Day |
|---|---|---|
| Scorer: physics, neighbour and history checks in pure Python, writing the JSON contract | P0 | Fri |
| Backfill: seed the 28-day hourly cache from the public archive | P0 | Thu-Fri |
| Tests + CI: planted-anomaly test, physics unit tests, contract test, GitHub Actions | P0 | Fri |
| Video: script Thursday, render Saturday (Hyperframes + edge-tts) | P1 | Thu -> Sat |
| Write-up and submission, submitted Saturday night | P0 | Sat |

## Bhumika (Bhumika-1432006): the site

| Task | P | Day |
|---|---|---|
| Site skeleton in the Leash paper design, reading `data/latest.json` (mock first) | P0 | Thu |
| Leaflet map: stations coloured by status, legend, last-updated time | P0 | Fri |
| Station panel: three check cards + Chart.js hour-of-day gap chart | P0 | Fri |
| Design pass on real data: mobile, empty and error states, "How it works / limits" section | P1 | Sat |

## Ayush (AyushVUpadhye): once he's a collaborator

Not yet on the repo, so no issues are assigned. Suggested:
- QA on Saturday: open the live URL on 3 phones and 2 browsers, try every station, and file bugs.
- Voice-over review and captions for the video.
- Second pair of eyes on the write-up's claims against `spike/RESULTS.md`.

## Order of work (critical path)

```
#1 AWS -> #2 skeleton URL -> #3 hourly ingest ----------> live data on the site
             |                    ^
backfill ----+---> scorer --------+   (scorer + tests can run locally on spike data before AWS exists)
mock JSON -> site skeleton -> map -> panel -> design pass on real data
video script (Thu) ---------------------------> record Sat (needs #4 + live site)
```

The site and the scorer meet only at the JSON contract in `docs/STACK.md`. Don't change it without telling the other side.
