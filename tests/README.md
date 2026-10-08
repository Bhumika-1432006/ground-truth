# tests

```
pip install pytest
pytest -q tests
```

CI runs this on every PR (`.github/workflows/test.yml`).

## Fixture

`fixtures/hourly_nov2025.json.gz` is real data: 16 north-Delhi stations, 3-30 Nov 2025, built with `src/backfill.py` and trimmed. `fixtures/stations.tsv` lists those stations.

## What is tested

| Test | Proves |
|---|---|
| `test_quiet_station_starts_ok` | The planted station (Ashok Vihar) is ok on every check before we touch it. |
| `test_planted_daytime_drop_is_flagged` | A 40% PM10 cut from 11:00 to 16:59 over the last 7 days flags the neighbour and history checks, and not physics. |
| `test_every_quiet_station_is_caught` | The same plant is flagged at every station that starts all-ok. |
| `test_planting_one_station_does_not_flag_the_others` | The anomaly doesn't spread: no other station is newly flagged. |
| `test_daytime_window_matters` | A drop planted at night is not read as a daytime drop. |
| physics tests | PM2.5 > PM10, stuck sensors and out-of-range values are caught; clean data passes; no data gives `nodata`. |
| contract tests | The output matches `docs/STACK.md`, with no NaN and 24-value hour profiles. |
| `test_copy_never_accuses` | No output text says fake, tamper, spray, cheat or fraud. |
| `test_matches_spike_numbers` | Optional (needs a backfill of Oct-Nov 2025 in `GT_HOURLY_2025`): reproduces `spike/RESULTS.md`. |

Deliberately breaking the daytime window or the PM2.5 > PM10 rule turns the suite red.
