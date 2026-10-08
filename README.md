# ground-truth
Which of Delhi's air-quality numbers can you trust? Every monitor checked against its neighbours, its own history and its own physics. Environmental Hacks 2026, Air track.

## Layout

- `template.yaml`, `Makefile`: SAM stack (S3 + CloudFront + hourly Lambda) and the commands to deploy, seed and run it.
- `src/ingest.py`: the hourly Lambda: OpenAQ API -> 29-day cache in S3 -> scorer -> site JSON.
- `src/backfill.py`: hourly history from the public OpenAQ archive (no key needed).
- `src/scorer.py`: the three checks. Writes `latest.json` and `stations/<id>.json` (the contract is in `docs/STACK.md`).
- `sample/data/`: real scorer output for 28 days to 4 Oct 2026, for building the site.
- `tests/`: pytest, including the planted-anomaly tests, on a real-data fixture.
- `spike/`: the data spike and its results (`spike/RESULTS.md`).
- `docs/`: plan, stack, tasks, questions, learnings, submission draft.

## Deploy (AWS, us-east-1)

Needs the `groundtruth` profile and the OpenAQ key in SSM (issue #1).

```
make deploy   # sam build + deploy, then upload site/ if it exists
make seed     # one-off: 28 days of history from the public archive into the cache
make run      # run the ingest now and print its summary
make url      # the CloudFront URL
```

## Run it locally

```
python src/backfill.py hourly.json --end 2026-10-04 --days 29 --cache .cache
python src/scorer.py hourly.json out
pip install pytest && pytest -q tests
```
