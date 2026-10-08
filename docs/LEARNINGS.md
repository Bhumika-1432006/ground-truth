# Learnings

What we already know, so nobody re-learns it this weekend.

## From First Commit (Leash, 28/30)

- **Design and the demo video cost 1 point each.** Both were left to the end. This time the design pass gets its own slot (Saturday morning, on real data), and the video script starts Thursday.
- A real AWS console clip in the video proves the cloud part isn't a mock (#4).
- Submit the night before the deadline. Sunday is a buffer only.
- One working feature beats five half-finished ones. The three checks share one data path; if time runs short, cut the history check, not the polish.

## From the data spike (Oct 2026, `spike/`)

- **OpenAQ archive:** `https://openaq-data-archive.s3.amazonaws.com/records/csv.gz/locationid=<id>/year=<Y>/month=<MM>/location-<id>-<YYYYMMDD>.csv.gz`. Public, us-east-1, 15-minute rows, timestamps in +05:30.
- **The archive is about 4 days behind** (8 Oct: latest file 4 Oct). Live data must come from the API.
- **Through the proxy, S3 sometimes answers 404, or cuts a transfer short, for files that exist.** List the prefix to decide which files exist, retry every error, and check that every gzip decompresses. A naive loop silently lost about 20% of the days.
- **The units label lies:** CO is tagged "ppb" but the values are CPCB mg/m³ (median about 1.5). NO2 is tagged "ppb" too. Don't convert. Every station shares the label, and logs of ratios cancel it.
- **Ids:** Anand Vihar 235, Jahangirpuri 8235, and 52 stations in total in `spike/delhi_stations.tsv`. Pusa and Lodhi Road each appear twice (DPCC/IMD, IMD/IITM, under 0.5 km apart). Don't use co-located twins as each other's neighbours.
- **Mixing confound:** by day the boundary layer mixes, so any station that reads high at night moves towards its neighbours by day (r = −0.72 across stations). A raw daytime dip is not evidence of anything. Compare a station against its own history, or correct for its night level.
- **Gas contrasts are noisy** (NO2 day-night gap ranges −0.8 to +1.4 across stations, against PM10's −0.3 to +0.4). Don't subtract them in a score; show them side by side.
- **Physics checks fire on real data:** PM2.5 > PM10 in 1,044 of 66,831 station-hours. Vikas Sadan, Gurugram: 31% of hours, plus 720 zero or negative hourly values. These are our clearest, least arguable flags.
- **Honest headline:** with this method, neither station named in the news stands out. Say so on the site and in the video. It makes everything else more credible.

## From building the scorer (8 Oct)

- **The planted-anomaly experiment** (52 stations, Nov 2025): a 40% daytime PM10 cut over 7 days is caught at 30 of 30 quiet stations. It newly flags 3 other stations across all 30 plantings, and moves about 1.6 others per planting (mostly between ok and watch).
- Two things made that work. A **Theil-Sen** city line, because a least-squares line let the planted station tilt everyone's z-scores. And a **second pass** that leaves first-pass suspects out of their neighbours' references.
- **Edge stations** (Narela, Najafgarh, the NCR fringe) have 2-3 neighbours, so their references are less stable. Expect more ok/watch flicker there.
- **The API's `/hours` endpoint averages UTC hours, which run 13:30-14:30 IST, not 13:00-14:00.** Mixing those with archive hours would shift the 11-17 window by half an hour for live data only. The ingest fetches raw `/measurements` and groups them into IST hours with the same code as the backfill.
- **The ingest logs `overlap_ratio`**: API values divided by archive values on the hours both have. On the first live run it should be about 1.0 for every parameter. If CO shows about 1000, the API serves µg/m³ where the archive has mg/m³.
- **On 4 Oct 2026 data** Jahangirpuri is flagged on history: daytime humidity against its neighbours is +5.2 pts above its previous 3 weeks. It's the same signature as after the Oct 2025 reports. It is still one humidity sensor, so present it as "worth a look", not as evidence of spraying.
