# Video script (issue #10)

Target 2:40, hard limit 3:00. 1920x1080. Voice: edge-tts `en-IN-NeerjaNeural`, rate +5%. The voice-over text alone is in `voiceover.txt` (one line per beat) so it can be rendered and timed separately.

Rules: every number on screen or in the voice-over traces to `spike/RESULTS.md`, `tests/` or the live `data/latest.json`. Never say or show "fake", "tampered" or "sprayed" about a station. We show numbers that don't add up.

| # | Time | On screen | Voice-over |
|---|---|---|---|
| 1 | 0:00-0:12 | Black. White text, typed: "Delhi, October 2025." Cut to a headline still: tankers near the Anand Vihar monitor (credit the outlet on screen). | Last October, water tankers were filmed near one of Delhi's air-quality monitors. |
| 2 | 0:12-0:24 | Grid of station names fading in, then a single big number: "PM2.5 = 182". | Delhi makes real decisions on these numbers: school closures, construction bans. But a published number tells you nothing about the station behind it. |
| 3 | 0:24-0:34 | Title card: **Ground Truth**. Subtitle: "Which of Delhi's air-quality numbers can you trust?" | So we built Ground Truth. Every monitor, checked three ways, every hour. |
| 4 | 0:34-0:52 | Live site, map loads, markers in three states. Hover the legend. | Physics: can this reading even be real? Neighbours: does it agree with the stations around it? History: has it suddenly changed against itself? |
| 5 | 0:52-1:12 | Click Vikas Sadan (`#301`). Physics card highlighted. | Some stations fail the first test. In October and November 2025, Vikas Sadan in Gurugram reported more fine dust than total dust in 31 percent of hours. That's physically impossible. |
| 6 | 1:12-1:42 | Click Anand Vihar (`#235`). Hour-of-day chart draws in; shade 11:00-17:00. | Here's Anand Vihar against its four nearest neighbours, hour by hour. At night it reads about 29 percent higher. Between 11 and 5, only 9 percent. That looks like spraying. But every polluted hotspot does this, because daytime air mixes. And the dip didn't change after the video. So we don't flag it, and we say so. |
| 7 | 1:42-2:02 | Terminal: `pytest -q tests` runs; zoom on `test_every_quiet_station_is_caught` going green. Overlay: "40% daytime drop planted → flagged 30/30". | How do we know the checks work? We plant a fake 40 percent daytime drop in real data. It gets caught at every station we tried, and doesn't spill onto its neighbours. |
| 8 | 2:02-2:20 | Architecture diagram (EventBridge → Lambda → S3 → CloudFront), then the 15 s console clip from #4. | On AWS, EventBridge triggers a Lambda every hour. It pulls new readings from OpenAQ, runs the checks, and writes JSON to S3, served through CloudFront. |
| 9 | 2:20-2:40 | Back to the map. Text: "A flag means the numbers don't add up. Not that anyone cheated." Then the URL and the repo. | A flag doesn't accuse anyone. It says: these numbers don't add up, look closer. Ground Truth. Open data, open code. |

## Shot list for Saturday

- [ ] Map at 1920x1080, browser zoom 100%, no bookmarks bar. URL hash `#301`, then `#235`.
- [ ] Terminal with a large font: `pytest -q tests -k "quiet or planted"`.
- [ ] The architecture diagram as one SVG (reuse the Leash diagram style).
- [ ] Console clip from #4.
- [ ] Headline still for beat 1: use a screenshot with the outlet's name visible and credit it on screen.

## Check before rendering

- [ ] Beat 5's 31% is the Oct-Nov 2025 figure (`docs/LEARNINGS.md`). If the live site shows a different period, say "last October and November", not "this week".
- [ ] Beat 6's 29% and 9% come from `spike/RESULTS.md`. The live chart covers 28 days, so if its numbers differ, record from a build of the Oct-Nov 2025 data or change the voice-over to the live numbers.
- [ ] Beat 7: the 30/30 figure is from `docs/LEARNINGS.md` (all 52 stations); the in-repo test runs on 16.

## Render the voice-over

```
pip install edge-tts
edge-tts --voice en-IN-NeerjaNeural --rate=+5% -f video/voiceover.txt --write-media video/voiceover.mp3
```
The script is 234 words, about 95 s of speech, leaving about a minute for pauses and on-screen moments inside 2:40.
