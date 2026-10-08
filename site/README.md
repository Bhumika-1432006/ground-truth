# site

The static front end: plain HTML, CSS and JS with no build step, served from S3 through CloudFront.

| File | What it is |
|---|---|
| `index.html` | Fog hero with a hand-drawn Delhi scene (Qutub Minar, Lotus Temple, India Gate, a monitor mast), a live example, the stats strip, the map + station panel in a light product window, How it works, Proof, Built on AWS, FAQ, closing. |
| `app.js` | Loads `data/latest.json` and `data/stations/<id>.json` (contract in `docs/STACK.md`). Draws the map (Leaflet) and the hour-of-day chart (Chart.js). Search, `#<id>` deep links, and the `?demo=1` tour. |
| `theme.css` | The whole design system, light mode only: silver fog for the hero and closing, white and soft-grey surfaces, Geist + Geist Mono, the station-state colours, motion (off for reduced motion), breakpoints. Rules in the comment at the top. Visual reference: neatlogs.com (fog hero, two-tone headlines, mono labels, window frame); the fog scene is our own SVG. |
| `vendor/` | Leaflet 1.9.4 and Chart.js 4.4.1 from npm, with their licences (both MIT/BSD-2). |

Run it locally with real data: `make local`, then open http://localhost:8000. Try `#235` (Anand Vihar), or `?demo=1` for the self-playing tour used in the video.

Design rules:
- **State is never colour alone.** ok = circle with a tick, worth a look = triangle, doesn't add up = diamond with a "!", no data = dashed ring, always with the words.
- **No accent colour.** Black, white and greys carry everything else.
- **Copy never accuses.** The words are "agrees with neighbours", "worth a look" and "doesn't add up".

`data/` is not committed here: `make local` copies `sample/data`, and in production the ingest Lambda writes it to S3.
