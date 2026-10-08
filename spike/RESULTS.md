# Spike result: can the data see station spraying?

**Short answer: the data is good enough to build on, but this test does not single out either named station.** The pre-registered score puts Anand Vihar 6th and Jahangirpuri 13th of 38 Delhi stations. Neither stands apart, and the score turns out to be driven by NO2, not PM10. What the hour-of-day gaps *do* show is real, clean and easy to explain. That is enough for a product that surfaces a station's anomaly by hour and leaves the "why" to people, not one that claims to detect spraying.

## Data

- 52 stations in the Delhi box (`delhi_stations.tsv`). The id sweep is finished: the four ids that timed out (4781, 4782, 4784, 10515) are in Germany and Poland.
- Oct 1 to Nov 30 2025, 3,150 of 3,172 station-days present, 15-minute readings, from the public OpenAQ S3 archive with no credentials (`fetch.py`).
- Gotchas for the build:
  - Through the proxy, S3 sometimes returns a spurious 404 or cuts a transfer short. Take the list of files from the bucket listing, retry every error, and check that each file decompresses before using it.
  - The archive labels CO "ppb", but the values are CPCB mg/m³. All stations share the mislabel, so ratios are unaffected.

## Method (written into `gaps.py` before looking at the two stations)

1. Hourly means in IST for pm10, pm25, no2, co and humidity. Out-of-range values and stuck sensors (3 or more identical hours in a row) are dropped.
2. Reference for each station = hourly median of its nearest 4 stations within 12 km. Co-located instruments less than 0.5 km away are excluded, and at least 2 neighbours must be reporting.
3. Gap = ln(station / reference). For humidity, the gap is the difference in percentage points.
4. Per day: median gap over 11:00-16:59 minus median gap over 22:00-05:59. Subtracting the night value cancels fixed calibration offsets.
5. Score = (NO2 and CO contrast) − (PM10 contrast). It is positive when PM10 falls relative to neighbours by day and the gases don't. The station score is the median over days. Humidity is reported, not scored.

Run it with `python fetch.py delhi_stations.tsv CACHE && python gaps.py delhi_stations.tsv CACHE out`. Outputs land in `out/`: `ranking.txt`, `scores.csv`, `hour_profiles.csv` and `coverage_hours.csv`.

## Results

| | Rank (of 38) | Score | PM10 day−night | NO2 | CO | RH (pts) |
|---|---|---|---|---|---|---|
| Anand Vihar (235), Oct-Nov | 6 | 0.30 | −0.17 | +0.41 | −0.13 | +7.2 |
| Anand Vihar, Oct 1-24 | 4 | 0.44 | −0.18 | +0.64 | −0.09 | +5.4 |
| Anand Vihar, Oct 25-Nov 30 | 10 | 0.22 | −0.15 | +0.31 | −0.14 | +7.9 |
| Jahangirpuri (8235), Oct-Nov | 13 | 0.13 | −0.04 | +0.21 | +0.05 | +6.4 |
| Jahangirpuri, Oct 1-24 | 18 | 0.02 | −0.02 | +0.21 | +0.02 | +2.5 |
| Jahangirpuri, Oct 25-Nov 30 | 13 | 0.16 | −0.06 | +0.22 | +0.08 | +10.9 |

Top of the pre-registered ranking: CRRI Mathura Road, Lodhi Road (IITM), IHBAS, Pusa (DPCC), Punjabi Bagh. There's no reason to think any of these was sprayed.

**Anand Vihar.** The PM10 gap has a clear trough at exactly 11:00-16:00 (about +0.09 by day against +0.29 at night), and humidity is higher by day. That looks like the hypothesis, but two things undercut it:
- The trough is the same before and after the 25 Oct video (−0.18 then −0.15). If spraying stopped after the video, the gap should have closed, and it didn't.
- Across all 38 stations, the daytime PM10 drop tracks how far above its neighbours a station sits at night (r = −0.72). Daytime mixing pulls every hotspot towards its neighbours. Corrected for that, Anand Vihar's dip is average (rank 23 of 38). *(post-hoc check)*

**Jahangirpuri.** The PM10 daytime dip is tiny (−0.04, about 4%) and does not deepen after 25 Oct. The one thing that moves is humidity: the daytime humidity gap rose from +2.5 to +10.9 points after 25 Oct, the 2nd-largest rise of 27 Delhi stations with humidity. That is consistent with water being sprayed near the inlet, but one sensor's humidity is weak evidence. Humidity offsets between stations run from −25 to +35 points. *(post-hoc check)*

## What this means for Ground Truth

- **Don't claim the tool detects spraying.** With a neighbour reference and hour-of-day gaps, the named stations do not stand out on PM10.
- **The score design was wrong.** Gas contrasts vary across stations far more than PM10 does (NO2 −0.8 to +1.4 against PM10 −0.3 to +0.4), so the dust-minus-gas score mostly ranks NO2 patterns. A better test needs the night-level correction and a per-station before/after design.
- **What we can honestly ship:** per-station hour-of-day gap charts against neighbours, with a flag when a station's daytime PM10 or humidity gap shifts sharply against its own history. That is an anomaly finder, not an accusation.
