"""Probe OpenAQ archive location ids for Delhi stations (no API key): read one day's file per id."""
import csv, gzip, io, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
BASE = "https://openaq-data-archive.s3.amazonaws.com/records/csv.gz"
DAY = "20251028"
def probe(i):
    url = f"{BASE}/locationid={i}/year=2025/month=10/location-{i}-{DAY}.csv.gz"
    try:
        raw = urllib.request.urlopen(url, timeout=20).read()
    except urllib.error.HTTPError:
        return None
    except Exception as e:
        return (i, "ERR", str(e))
    rows = csv.DictReader(io.StringIO(gzip.decompress(raw).decode("utf-8")))
    r = next(rows, None)
    if not r: return None
    lat, lon = float(r["lat"]), float(r["lon"])
    if 28.35 < lat < 28.95 and 76.80 < lon < 77.45:
        return (i, r["location"], lat, lon)
    return None
lo, hi = int(sys.argv[1]), int(sys.argv[2])
ids = [int(l.split("=")[1].strip("/ \n")) for l in open(sys.argv[3]) if "locationid=" in l]
ids = [i for i in ids if lo <= i <= hi]
with ThreadPoolExecutor(48) as ex:
    for res in ex.map(probe, ids):
        if res: print(*res, sep="\t", flush=True)
print(f"# probed {len(ids)} ids in [{lo},{hi}]", file=sys.stderr)
