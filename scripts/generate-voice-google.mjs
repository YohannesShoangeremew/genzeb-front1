#!/usr/bin/env node
// Batch-generate the Amharic bingo caller voice with GOOGLE CLOUD TTS.
//
// A drop-in alternative to generate-voice.mjs (which uses Azure). Same phrases,
// same output files (public/audio/am/<n>.mp3) — only the TTS engine differs, so
// you can regenerate the caller with a Google voice and compare. Generating all
// 75 calls is ~1,100 characters total, well inside Google's free monthly tier.
//
// Auth is a simple API key (no service-account JSON needed):
//   1. console.cloud.google.com -> create/select a project
//   2. Enable the "Cloud Text-to-Speech API"
//   3. APIs & Services -> Credentials -> Create credentials -> API key
//
// Usage:
//   GOOGLE_TTS_KEY=xxxx node scripts/generate-voice-google.mjs [flags]
//
// Flags:
//   --list         List every am-ET voice Google offers (name + gender) and exit.
//                  Run this FIRST to pick the most natural female voice.
//   --dry-run      Print every Amharic phrase and exit (no API calls, no cost).
//   --only=45      Generate just number 45 (comma-list ok: --only=45,58,7).
//   --extras       Also generate the spoken cues in EXTRAS -> public/sounds/.
//   --normalize    Loudness-normalize the batch with ffmpeg (if installed).
//   --out=DIR      Write clips to DIR instead of public/audio/am (for A/B tests,
//                  so you don't overwrite your current Azure clips).
//
// Env: GOOGLE_TTS_KEY (required), GOOGLE_VOICE (optional, default a female voice).

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const SFX_DIR = join(REPO, "public", "sounds");

// ---- Config you may want to tweak -----------------------------------------

// Default FEMALE Amharic voice. am-ET-Standard-A is Google's female Amharic
// voice and is always available. Run `--list` to see if a higher-quality
// WaveNet or Chirp3-HD female voice exists on your account, then override with
// GOOGLE_VOICE=am-ET-Wavenet-A (or the Chirp voice name) for a more natural read.
const VOICE = process.env.GOOGLE_VOICE || "am-ET-Standard-A";
const KEY = process.env.GOOGLE_TTS_KEY;

// Slightly slower + natural pitch for a clear caller cadence (mirrors the Azure
// script's rate -6%). Tune to taste.
const SPEAKING_RATE = 0.94;
const PITCH = 0;
const SAMPLE_RATE = 24000;

// How each BINGO column letter is spoken in Amharic. Verify with --dry-run and a
// test clip; adjust to match how your callers actually say them.
const LETTER_AM = { B: "ቢ", I: "አይ", N: "ኤን", G: "ጂ", O: "ኦ" };

// Column ranges — mirror of src/lib/constants.ts COLUMN_RANGES.
const COLUMN_RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };

// Optional spoken cues (only with --extras) -> public/sounds/<key>.mp3.
const EXTRAS = {
  win: "እንኳን ደስ አለህ! ቢንጎ!", // "Congratulations! Bingo!"
};

// ---- Amharic number words (1..75) -----------------------------------------

const UNITS = ["", "አንድ", "ሁለት", "ሦስት", "አራት", "አምስት", "ስድስት", "ሰባት", "ስምንት", "ዘጠኝ"];
const TENS = { 10: "አሥር", 20: "ሃያ", 30: "ሰላሳ", 40: "አርባ", 50: "ሃምሳ", 60: "ስድሳ", 70: "ሰባ" };

function amNumber(n) {
  if (n <= 9) return UNITS[n];
  if (n === 10) return "አሥር";
  if (n <= 19) return `አሥራ ${UNITS[n - 10]}`; // teens take the combining prefix
  const t = Math.floor(n / 10) * 10;
  const u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]} ${UNITS[u]}`;
}

function letterForNumber(n) {
  for (const [l, [min, max]] of Object.entries(COLUMN_RANGES)) {
    if (n >= min && n <= max) return l;
  }
  return "";
}

// The spoken phrase for a number, e.g. 45 -> "ኤን ፣ አርባ አምስት".
function phraseFor(n) {
  const letter = LETTER_AM[letterForNumber(n)] ?? "";
  return `${letter}፣ ${amNumber(n)}`.trim();
}

// ---- Google TTS ------------------------------------------------------------

// Chirp3-HD voices take only plain text (no SSML); WaveNet/Standard accept SSML.
const isChirp = /chirp/i.test(VOICE);

function ssml(text) {
  // A short break between the letter and the number gives the natural caller
  // cadence ("under the N… forty-five").
  const withBreak = text.replace("፣ ", '<break time="180ms"/>');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="am-ET">` +
    `${withBreak}</speak>`
  );
}

async function synth(text) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`;
  const body = {
    input: isChirp ? { text } : { ssml: ssml(text) },
    voice: { languageCode: "am-ET", name: VOICE },
    audioConfig: {
      audioEncoding: "MP3",
      sampleRateHertz: SAMPLE_RATE,
      speakingRate: SPEAKING_RATE,
      pitch: PITCH,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google TTS ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.audioContent) throw new Error("no audioContent in response");
  return Buffer.from(json.audioContent, "base64");
}

async function listVoices() {
  const url = `https://texttospeech.googleapis.com/v1/voices?languageCode=am-ET&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`voices ${res.status}: ${await res.text()}`);
  const { voices = [] } = await res.json();
  if (!voices.length) {
    console.log("No am-ET voices returned. Is the Text-to-Speech API enabled for this key?");
    return;
  }
  console.log(`Amharic (am-ET) voices on your account:\n`);
  for (const v of voices) {
    console.log(`  ${v.name.padEnd(24)} ${v.ssmlGender.padEnd(8)} ${v.naturalSampleRateHertz} Hz`);
  }
  console.log(`\nPick a FEMALE one, then: GOOGLE_VOICE=<name> node scripts/generate-voice-google.mjs ...`);
}

function normalize(file) {
  // EBU R128 loudness normalization so every call sits at the same level.
  const tmp = `${file}.norm.mp3`;
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", file, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-b:a", "192k", tmp],
    { stdio: "ignore" },
  );
  if (r.status === 0) spawnSync("mv", [tmp, file]);
  return r.status === 0;
}

// ---- Runner ----------------------------------------------------------------

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const getArg = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const onlyRaw = getArg("only");
const only = onlyRaw ? onlyRaw.split(",").map((x) => Number(x.trim())).filter(Boolean) : null;
const outArg = getArg("out");
const AM_DIR = outArg ? (isAbsolute(outArg) ? outArg : join(REPO, outArg)) : join(REPO, "public", "audio", "am");

async function main() {
  const dryRun = has("--dry-run");

  if (has("--list")) {
    if (!KEY) return console.error("Set GOOGLE_TTS_KEY to list voices.");
    return listVoices();
  }

  const numbers = only ?? Array.from({ length: 75 }, (_, i) => i + 1);

  if (dryRun) {
    console.log(`Engine: Google · Voice: ${VOICE}${isChirp ? " (Chirp: plain text)" : " (SSML)"}\n`);
    for (const n of numbers) console.log(String(n).padStart(2), "→", phraseFor(n));
    if (has("--extras")) for (const [k, v] of Object.entries(EXTRAS)) console.log(k, "→", v);
    console.log("\n(dry run — no audio generated)");
    return;
  }

  if (!KEY) {
    console.error("Set GOOGLE_TTS_KEY (see the header). Get one at console.cloud.google.com.");
    process.exit(1);
  }

  await mkdir(AM_DIR, { recursive: true });
  const ffmpegOk = has("--normalize") && spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (has("--normalize") && !ffmpegOk) console.warn("⚠ ffmpeg not found — skipping normalization.");

  console.log(`Engine: Google · Voice: ${VOICE} · Out: ${AM_DIR}\n`);
  for (const n of numbers) {
    const file = join(AM_DIR, `${n}.mp3`);
    process.stdout.write(`#${String(n).padStart(2)} ${phraseFor(n)} … `);
    const buf = await synth(phraseFor(n));
    await writeFile(file, buf);
    if (ffmpegOk) normalize(file);
    console.log(`ok (${(buf.length / 1024).toFixed(1)} KB)`);
    await new Promise((r) => setTimeout(r, 80)); // gentle pacing
  }

  if (has("--extras")) {
    await mkdir(SFX_DIR, { recursive: true });
    for (const [key, text] of Object.entries(EXTRAS)) {
      const file = join(SFX_DIR, `${key}.mp3`);
      process.stdout.write(`cue ${key} "${text}" … `);
      const buf = await synth(text);
      await writeFile(file, buf);
      if (ffmpegOk) normalize(file);
      console.log("ok");
    }
  }

  console.log(`\nDone. Review the clips in ${AM_DIR}, then commit the mp3s.`);
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});
