"""Narration: one audio file per script row -> video/vo/NN.mp3 (+ NN.txt with the text).

    python video/narrate.py            # every row
    python video/narrate.py 7 12       # only rows 7 and 12
    python video/narrate.py --silent   # timed silence instead of a voice (drafts, or no network)

Voice: edge-tts (free). If the TTS service can't be reached, a row falls back to silence of the
estimated length, and the run says so, so the rest of the pipeline can still be built and checked.
"""
import asyncio, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VO = HERE / "vo"
VOICE, RATE = "en-IN-NeerjaNeural", "+5%"
WORDS_PER_SEC = 2.6  # for the silent fallback only
WATCH = ["NCR", "OpenAQ", "SAM", "Lambda", "Gurugram", "Jahangirpuri", "Anand Vihar"]


def rows():
    out = []
    for line in (HERE / "script.md").read_text(encoding="utf-8").splitlines():
        if re.match(r"^\| \d+ \|", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            out.append((int(cells[0]), cells[1], cells[3]))
    return out


def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(path)]).decode().strip())


def silence(path, seconds):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-t", f"{seconds:.2f}", "-c:a", "libmp3lame", "-q:a", "4", str(path)], check=True)


async def speak(text, path):
    import edge_tts
    await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))


async def main(args):
    silent = "--silent" in args
    wanted = {int(a) for a in args if a.isdigit()}
    VO.mkdir(exist_ok=True)
    total, fell_back = 0.0, []
    for n, scene, text in rows():
        if wanted and n not in wanted:
            continue
        mp3 = VO / f"{n:02d}.mp3"
        (VO / f"{n:02d}.txt").write_text(text + "\n", encoding="utf-8")
        if not silent:
            try:
                await speak(text, mp3)
            except Exception as e:  # no network, service down: keep the pipeline moving
                fell_back.append((n, type(e).__name__))
        if silent or not mp3.exists() or mp3.stat().st_size == 0 or fell_back and fell_back[-1][0] == n:
            silence(mp3, len(text.split()) / WORDS_PER_SEC)
        d = duration(mp3)
        total += d
        flags = [w for w in WATCH if w in text]
        print(f"{n:02d} {d:5.1f}s  {scene:<22} {text[:60]}{'…' if len(text) > 60 else ''}"
              + (f"   [listen: {', '.join(flags)}]" if flags else ""))
    print(f"narration total {total:.1f}s")
    if fell_back:
        print(f"WARNING: {len(fell_back)} rows are timed silence, not a voice ({fell_back[0][1]}). "
              "Re-run on a machine that can reach the TTS service.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
