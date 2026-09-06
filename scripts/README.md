# Voice generation

`generate-voice.mjs` rebuilds the Amharic bingo caller with **Azure Neural TTS**
as natural **letter + number** calls (e.g. `45 → "ኤን ፣ አርባ አምስት"`).

It writes static mp3s the app already loads (`public/audio/am/<n>.mp3`); the
runtime playback code is unchanged. Run it once, review, commit the clips.

## Prerequisites

- An Azure Speech resource. Grab its **key** and **region** (e.g. `eastus`).
- Node 20+ (uses native `fetch`). No npm deps.
- Optional: `ffmpeg` on PATH for `--normalize` (loudness matching across clips).

## Use

```bash
# 1. Review every phrase first — no API calls, no cost:
node scripts/generate-voice.mjs --dry-run --extras

# 2. Generate all 75 calls (+ the spoken cues) at 48 kHz / 192 kbps:
AZURE_SPEECH_KEY=xxxx AZURE_SPEECH_REGION=eastus \
  node scripts/generate-voice.mjs --extras --normalize

# Regenerate a single clip you didn't like:
AZURE_SPEECH_KEY=xxxx AZURE_SPEECH_REGION=eastus \
  node scripts/generate-voice.mjs --only=45
```

Voice defaults to `am-ET-MekdesNeural`; try `AZURE_VOICE=am-ET-AmehaNeural`
for a male caller.

## Tuning

Edit the config block at the top of the script:

- `LETTER_AM` — how B/I/N/G/O are pronounced. **Verify with `--dry-run` and one
  test clip** and adjust to match how your callers actually say the letters.
- `prosody rate` / `break time` (in `ssml()`) — pacing of the call.
- `EXTRAS` — spoken cues written to `public/sounds/`. `daub`/`join` are
  non-verbal ticks; source real SFX for those rather than TTS.
