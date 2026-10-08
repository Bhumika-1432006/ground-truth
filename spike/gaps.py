"""Spray-signature test: does a station's PM10 drop against its neighbours by day while its gases don't?

    python gaps.py delhi_stations.tsv CACHE_DIR OUT_DIR

Method (fixed before looking at Jahangirpuri or Anand Vihar):
1. Hourly series. 15-min readings for pm10, pm25, no2, co, relativehumidity, converted to IST and averaged per
   hour (>=2 readings). Values are used as published: the archive labels no2 and co "ppb" for every Delhi station,
   but co values are CPCB's mg/m3 (median ~1.5). Every station shares the mislabel, and logs of ratios cancel it. Out-of-range values dropped, and runs of
   >=3 identical hourly values (stuck sensor) dropped.
2. Reference. For each station, its nearest 4 stations within 12 km (excluding co-located instruments < 0.5 km
   away). Reference = median of those neighbours each hour, needing >=2 neighbours reporting.
3. Gap. ln(station / reference) for pm10, pm25, no2, co; station - reference (points) for humidity.
4. Daily contrast. For each day: median gap over 11:00-16:59 IST minus median gap over 22:00-05:59 (same
   calendar day; >=4 hours in each window). Subtracting night cancels any fixed calibration or unit offset.
5. Score. S(day) = dGas - dPM10, with dGas the mean of dNO2 and dCO (whichever exist). Spraying lowers PM10 at
   the inlet in daytime only and leaves gases alone, so a sprayed station has S > 0. Station score = median S over
   days; t = mean/(sd/sqrt(n)). Humidity contrast (expected > 0 under spraying) is reported alongside, not scored.
6. Windows: all of Oct-Nov 2025; Oct 1-24 (before the Anand Vihar video) and Oct 25-Nov 30 (after).
"""
import glob, gzip, io, math, os, sys
import numpy as np, pandas as pd

PARAMS = ["pm10", "pm25", "no2", "co", "relativehumidity"]
LOG_PARAMS = ["pm10", "pm25", "no2", "co"]
RANGE = {"pm10": (1, 2000), "pm25": (1, 1500), "no2": (0.5, 1000), "co": (0.02, 50), "relativehumidity": (1, 100)}
NCR = ("Noida", "Ghaziabad", "Gurugram", "Faridabad", "Bahadurgarh", "Manesar")
DAY_H, NIGHT_H = range(11, 17), [22, 23, 0, 1, 2, 3, 4, 5]
K, RADIUS_KM, COLOC_KM = 4, 12.0, 0.5
WINDOWS = {"oct-nov": ("2025-10-01", "2025-11-30"), "oct01-24": ("2025-10-01", "2025-10-24"),
           "oct25-nov30": ("2025-10-25", "2025-11-30")}


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def load(cache, sid):
    frames = []
    for f in sorted(glob.glob(f"{cache}/{sid}/*.csv.gz")):
        if os.path.getsize(f):
            frames.append(pd.read_csv(io.BytesIO(gzip.decompress(open(f, "rb").read()))))
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames)
    df = df[df.parameter.isin(PARAMS)].copy()
    lo = df.parameter.map(lambda p: RANGE[p][0])
    hi = df.parameter.map(lambda p: RANGE[p][1])
    df = df[(df.value >= lo) & (df.value <= hi)]
    t = pd.to_datetime(df.datetime, utc=True).dt.tz_convert("Asia/Kolkata")
    # treat a stamp as the end of its 15-min interval, so 11:15-12:00 make up hour 11
    df["hour"] = (t - pd.Timedelta(minutes=1)).dt.floor("h").dt.tz_localize(None)
    g = df.groupby(["hour", "parameter"]).value
    hourly = g.mean()[g.count() >= 2].unstack("parameter")
    idx = pd.date_range("2025-10-01", "2025-12-01", freq="h", inclusive="left")
    hourly = hourly.reindex(idx).reindex(columns=PARAMS)
    for p in PARAMS:  # stuck sensor: >=3 identical consecutive hourly values
        s = hourly[p]
        run = s.groupby((s != s.shift()).cumsum()).transform("size")
        hourly.loc[(run >= 3) & s.notna(), p] = np.nan
    return hourly


def daily_contrast(gap):
    g = gap.copy()
    g["date"], g["h"] = g.index.normalize(), g.index.hour
    day = g[g.h.isin(DAY_H)].groupby("date")
    night = g[g.h.isin(NIGHT_H)].groupby("date")
    cols = [c for c in gap.columns]
    dmed = day[cols].median().where(day[cols].count() >= 4)
    nmed = night[cols].median().where(night[cols].count() >= 4)
    return dmed - nmed


def main(tsv, cache, out):
    os.makedirs(out, exist_ok=True)
    st = pd.read_csv(tsv, sep="\t", header=None, names=["id", "name", "lat", "lon"])
    st["ncr"] = st.name.map(lambda n: any(w in n for w in NCR))
    data = {r.id: load(cache, r.id) for r in st.itertuples()}
    cover = {sid: {p: int(h[p].notna().sum()) if len(h) else 0 for p in PARAMS} for sid, h in data.items()}
    pd.DataFrame(cover).T.assign(name=st.set_index("id").name).to_csv(f"{out}/coverage_hours.csv")

    rows, profiles = [], {}
    for r in st.itertuples():
        me = data[r.id]
        if me.empty:
            continue
        d = sorted((km((r.lat, r.lon), (o.lat, o.lon)), o.id) for o in st.itertuples() if o.id != r.id)
        nb = [i for dist, i in d if COLOC_KM <= dist <= RADIUS_KM and not data[i].empty][:K]
        if len(nb) < 2:
            continue
        gap = pd.DataFrame(index=me.index)
        for p in PARAMS:
            stack = pd.concat([data[i][p] for i in nb], axis=1)
            ref = stack.median(axis=1).where(stack.count(axis=1) >= 2)
            gap[p] = np.log(me[p] / ref) if p in LOG_PARAMS else me[p] - ref
        profiles[r.id] = gap.groupby(gap.index.hour).median()
        dc = daily_contrast(gap)
        gas = dc[["no2", "co"]].mean(axis=1)
        dc["S"] = gas - dc["pm10"]
        for w, (a, b) in WINDOWS.items():
            s = dc.loc[a:b]
            S = s.S.dropna()
            n = len(S)
            rows.append(dict(window=w, id=r.id, name=r.name.split(" - ")[0], ncr=r.ncr, neighbours=" ".join(map(str, nb)),
                             days=n, score=S.median() if n else np.nan,
                             t=S.mean() / (S.std() / math.sqrt(n)) if n > 2 and S.std() > 0 else np.nan,
                             frac_pos=(S > 0).mean() if n else np.nan,
                             d_pm10=s.pm10.median(), d_pm25=s.pm25.median(), d_no2=s.no2.median(),
                             d_co=s.co.median(), d_rh=s.relativehumidity.median()))
    res = pd.DataFrame(rows)
    res.to_csv(f"{out}/scores.csv", index=False, float_format="%.3f")
    pd.concat(profiles, names=["id", "hour_ist"]).to_csv(f"{out}/hour_profiles.csv", float_format="%.3f")
    for w in WINDOWS:
        t = res[(res.window == w) & ~res.ncr & (res.days >= 10)].sort_values("score", ascending=False).reset_index(drop=True)
        t.index += 1
        print(f"\n## {w}: Delhi stations ranked by spray score (n={len(t)})\n")
        print(t[["id", "name", "days", "score", "t", "frac_pos", "d_pm10", "d_no2", "d_co", "d_rh"]]
              .to_string(float_format="%.2f"))


if __name__ == "__main__":
    main(*sys.argv[1:4])
