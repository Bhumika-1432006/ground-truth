# site

The static front end: plain HTML, CSS and JS with no build step, served from S3 through CloudFront.

| File | What it is |
|---|---|
| `index.html` | Fog hero with a hand-drawn Delhi scene and a live example; the stats strip; "how it works in ten seconds" told with one real station; what the three answers mean (with the stations in each right now); the live map + station panel; the three checks, each with a picture from real data; who it is for; proof (30 of 30); the AWS flow; FAQ; foggy closing. |
| `scene3d.js` | The 3D Delhi (three.js): wards as the ground, low city blocks and trees, Qutub Minar, India Gate and the Lotus Temple at their real coordinates, a mast per monitor with a status light, a column as tall as its PM2.5 and smog clouds, fog and drifting dust. Orbit, auto-rotate in full screen, click a monitor to fly to it. |
| `app.js` | Loads `data/latest.json` and `data/stations/<id>.json` (contract in `docs/STACK.md`). Hands the stations to the 3D scene and handles full-screen 3D and the hour-of-day chart (Chart.js). Search, `#<id>` deep links, and the `?demo=1` tour. |
| `theme.css` | The whole design system, light mode only: silver fog for the hero and closing, white and soft-grey surfaces, Geist + Geist Mono, the station-state colours, motion (off for reduced motion), breakpoints. Rules in the comment at the top. Visual reference: neatlogs.com (fog hero, two-tone headlines, mono labels, window frame); the fog scene is our own SVG. |
| `vendor/` | three.js 0.160.0 with OrbitControls (MIT) and Chart.js 4.4.1 (MIT) from npm, with their licences. |
| `geo/` | Delhi wards and boundary (DataMeet, CC BY-SA 2.5 IN), the map's offline base. |

Run it locally with real data: `make local`, then open http://localhost:8000. Try `#235` (Anand Vihar), or `?demo=1` for the self-playing tour used in the video.

Design rules:
- **State is never colour alone.** ok = circle with a tick, worth a look = triangle, doesn't add up = diamond with a "!", no data = dashed ring, always with the words.
- **No accent colour.** Black, white and greys carry everything else.
- **Copy never accuses.** The words are "agrees with neighbours", "worth a look" and "doesn't add up".

`data/` is not committed here: `make local` copies `sample/data`, and in production the ingest Lambda writes it to S3.
