# Spike: is the data good enough?

Go/no-go for Ground Truth, run against the public OpenAQ archive (`s3://openaq-data-archive`, us-east-1, no credentials needed).

- `find_delhi.py LO HI ids.txt` - probes archive location ids in [LO, HI] for stations inside Delhi's bounding box by reading one day's file (2025-10-28) per id. Stdlib only. `ids.txt` comes from `aws s3 ls s3://openaq-data-archive/records/csv.gz/ --no-sign-request`.
- `delhi_stations.tsv` - stations found so far (id, name, lat, lon). Ids 7900-8600 fully probed; 1-20000 partially.

Confirmed: Jahangirpuri (8235) has every day of Oct 2025 at 15-minute resolution with pm10, pm25, no2, co, so2, o3, relativehumidity, temperature, wind.

Next: finish the id sweep (1-20000, then 20000-500000 if Delhi coverage is thin), download Oct-Nov 2025 for every Delhi station, and test three gaps against neighbours by hour of day: PM10 (dust), NO2/CO (gas), relative humidity. Hypothesis for a sprayed station: PM gap opens 11:00-17:00 IST while the gas gap does not, and humidity rises. Named in reporting: Jahangirpuri (spraying 11am-5pm daily, Newslaundry 30 Oct 2025), Anand Vihar (tankers filmed ~25 Oct 2025, stopped after the video went viral).
