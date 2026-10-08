"""Download Oct-Nov 2025 daily files for every station in delhi_stations.tsv (no API key).

    python fetch.py delhi_stations.tsv CACHE_DIR

Which days exist comes from the S3 bucket listing; every listed file is downloaded into
CACHE_DIR/<id>/<YYYYMMDD>.csv.gz and checked to decompress. Any error, 404 included, is retried:
through a proxy, S3 occasionally answers 404 or cuts a transfer short for files that do exist.
"""
import gzip, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
BUCKET = "https://openaq-data-archive.s3.amazonaws.com"
MONTHS = [(2025, 10), (2025, 11)]


def fetch(url, check_gzip=False):
    for attempt in range(8):
        try:
            raw = urllib.request.urlopen(url, timeout=60).read()
            if check_gzip:
                gzip.decompress(raw)
            return raw
        except Exception:
            time.sleep(min(2 ** attempt, 30))
    raise RuntimeError(url)


def listing(job):
    i, y, m = job
    prefix = f"records/csv.gz/locationid={i}/year={y}/month={m:02d}/"
    xml = fetch(f"{BUCKET}/?list-type=2&prefix={prefix}").decode()
    return [(i, k) for k in re.findall(r"<Key>([^<]+)</Key>", xml)]


def get(job):
    i, key = job
    out = f"{CACHE}/{i}/{key[-15:-7]}.csv.gz"
    if os.path.exists(out):
        try:
            gzip.decompress(open(out, "rb").read())
            return 0
        except Exception:
            os.remove(out)
    try:
        raw = fetch(f"{BUCKET}/{key}", check_gzip=True)
    except RuntimeError:
        return 1
    with open(out, "wb") as f:
        f.write(raw)
    return 0


ids = [l.split("\t")[0] for l in open(sys.argv[1]) if l.strip()]
CACHE = sys.argv[2]
for i in ids:
    os.makedirs(f"{CACHE}/{i}", exist_ok=True)
with ThreadPoolExecutor(12) as ex:
    keys = [k for ks in ex.map(listing, [(i, y, m) for i in ids for y, m in MONTHS]) for k in ks]
    failed = sum(ex.map(get, keys))
print(f"{len(keys)} files listed, {failed} failed", file=sys.stderr)
