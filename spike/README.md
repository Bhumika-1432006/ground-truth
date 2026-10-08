# Spike: is the data good enough?

Go/no-go for Ground Truth, run against the public OpenAQ archive (`s3://openaq-data-archive`, us-east-1, no credentials needed).

- `find_delhi.py LO HI ids.txt` - probes archive location ids in [LO, HI] for stations inside Delhi's bounding box by reading one day's file (2025-10-28) per id. Stdlib only. `ids.txt` comes from `aws s3 ls s3://openaq-data-archive/records/csv.gz/ --no-sign-request`.
- `delhi_stations.tsv` - 52 stations in the Delhi bounding box (Delhi DPCC/CPCB/IMD/IITM plus NCR edge: Noida, Ghaziabad, Gurugram, Faridabad). Ids 1-20000 fully probed; the four that timed out (4781, 4782, 4784, 10515) are European.
- `fetch.py` - downloads Oct-Nov 2025 for every station, using the bucket listing and checking every file.
- `gaps.py` - neighbour-reference hour-of-day gaps and the spray score. Outputs in `out/`.
- `RESULTS.md` - findings.

Confirmed: Jahangirpuri (8235) has every day of Oct 2025 at 15-minute resolution with pm10, pm25, no2, co, so2, o3, relativehumidity, temperature, wind.

Result: see `RESULTS.md`. The data is solid, but neither named station stands out on the pre-registered spray score.
