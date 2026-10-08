# Submission draft

Draft now, finish Saturday. Every number here must trace to `spike/RESULTS.md` or the live data. Fields in [brackets] are placeholders.

**Name:** Ground Truth

**Track:** Air

**Tagline:** Which of Delhi's air-quality numbers can you trust?

**Links:** live site [CloudFront URL] · repo https://github.com/thegoodengineers/ground-truth · video [URL]

## Problem

Delhi's air-quality readings drive real decisions: school closures, construction bans, the GRAP stages. In October 2025 water tankers were filmed near the Anand Vihar monitor, and Newslaundry reported daily spraying from 11am to 5pm at Jahangirpuri. A published reading gives no clue whether the station behind it is working, broken or being gamed.

## What it does

Ground Truth checks every Delhi and NCR monitor three ways, every hour:
- **Physics:** can this reading be real? For example, PM2.5 can never exceed PM10, and a sensor shouldn't repeat the same value for hours.
- **Neighbours:** does it agree, hour by hour, with the stations around it?
- **History:** has its pattern suddenly changed against its own last three weeks?

Each station gets ok, watch or flag on a map. Click it and you see the evidence: the hour-of-day chart against its neighbours.

## What we found (honestly)

- [N] stations report physically impossible values. In Oct-Nov 2025, Vikas Sadan (Gurugram) reported PM2.5 above PM10 in 31% of hours.
- We tested whether the stations named in the news show a spraying signature. **They don't stand out**: Anand Vihar ranked 6th and Jahangirpuri 13th of 38 on a method we fixed before looking. We say so, because a tool that accuses stations can't be trusted either.

## How we built it on AWS

EventBridge triggers a Python Lambda every hour. It pulls the latest readings from OpenAQ (key in SSM Parameter Store), merges them with a 28-day history seeded from the public OpenAQ archive on S3 (us-east-1), runs the checks and writes JSON to S3. CloudFront serves the static site and the JSON. SAM deploys it, and GitHub Actions runs the tests and the deploy. [Cost for the weekend: $X.]

## Challenges

- The archive runs about 4 days behind, so live data needs the API.
- Through a proxy, S3 sometimes returned 404 or a truncated file for files that exist. We switched to listing, retrying and verifying every file.
- The archive labels CO in ppb, but the values are mg/m³.
- Daytime mixing makes any polluted hotspot look "cleaner" by day. We nearly mistook that for a spraying signal.

## What's next

Other Indian cities, a public API, and a history page per station that journalists can cite.

## Team

Chirag (Chirag6722), Abhijeet (thegoodengineer), Bhumika (Bhumika-1432006), Ayush (AyushVUpadhye).
