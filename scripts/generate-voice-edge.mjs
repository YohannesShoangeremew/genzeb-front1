#!/usr/bin/env node
// Refine the Amharic bingo caller with edge-tts (FREE Microsoft neural voices —
// no API key, no billing) + ffmpeg post-processing. This is what produced the
// shipped clips in public/audio/am/.
//
// It uses the SAME neural voice as before (am-ET-MekdesNeural, female) but makes
// it feel like a real caller:
//   • clear caller cadence: letter, pause, number (e.g. "ኤን፣ አርባ አምስት").
//     Pass --repeat to say the number twice ("… አርባ አምስት፣ አርባ አምስት").
//   • slightly slower rate for clarity
//   • trims the ~0.9s of dead air edge-tts bakes onto each clip (the main cause
//     of the choppy flow), then loudness-normalizes so every call is even
//
// Prereqs (both free, no account):
//   pipx install edge-tts        (or: pip install edge-tts)
//   ffmpeg on PATH               (apt install ffmpeg, or a static build)
//
// Usage:
//   node scripts/generate-voice-edge.mjs [--only=45,7] [--repeat]
//        [--voice=am-ET-MekdesNeural] [--rate=-8%] [--extras] [--out=DIR]
//
//   --extras     also (re)generate the "Bingo!" win cue -> public/sounds/win.mp3
//   --out=DIR    write elsewhere (A/B test) instead of public/audio/am
//   --dry-run    print phrases only

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const getArg = (n, d = null) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const VOICE = getArg("voice", "am-ET-MekdesNeural");
const RATE = getArg("rate", "-8%");
const REPEAT = has("--repeat"); // default: single call ("letter number")
const onlyRaw = getArg("only");
const only = onlyRaw ? onlyRaw.split(",").map((x) => Number(x.trim())).filter(Boolean) : null;
const outArg = getArg("out");
const AM_DIR = outArg ? (isAbsolute(outArg) ? outArg : join(REPO, outArg)) : join(REPO, "public", "audio", "am");
const SFX_DIR = join(REPO, "public", "sounds");

// ---- Amharic phrases -------------------------------------------------------
const LETTER_AM = { B: "ቢ", I: "አይ", N: "ኤን", G: "ጂ", O: "ኦ" };
const COLUMN_RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
const UNITS = ["", "አንድ", "ሁለት", "ሦስት", "አራት", "አምስት", "ስድስት", "ሰባት", "ስምንት", "ዘጠኝ"];
const TENS = { 10: "አሥር", 20: "ሃያ", 30: "ሰላሳ", 40: "አርባ", 50: "ሃምሳ", 60: "ስድሳ", 70: "ሰባ" };

function amNumber(n) {
  if (n <= 9) return UNITS[n];
  if (n === 10) return "አሥር";
  if (n <= 19) return `አሥራ ${UNITS[n - 10]}`;
  const t = Math.floor(n / 10) * 10, u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]} ${UNITS[u]}`;
}
function letterFor(n) {
  for (const [l, [a, b]] of Object.entries(COLUMN_RANGES)) if (n >= a && n <= b) return l;
  return "";
}
function phraseFor(n) {
  const letter = LETTER_AM[letterFor(n)];
  const num = amNumber(n);
  return REPEAT ? `${letter}፣ ${num}፣ ${num}` : `${letter}፣ ${num}`;
}

// ---- edge-tts + ffmpeg -----------------------------------------------------
// Trim leading/trailing silence, normalize loudness, add a tiny release pad.
const FILTER =
  "silenceremove=start_periods=1:start_threshold=-50dB:start_duration=0.02," +
  "areverse," +
  "silenceremove=start_periods=1:start_threshold=-50dB:start_duration=0.02," +
  "areverse," +
  "loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.06";

function edgeExe() {
  for (const c of ["edge-tts", "edge_tts"]) {
    if (spawnSync(c, ["--list-voices"], { stdio: "ignore" }).status === 0) return c;
  }
  return null;
}

function synth(text, outFile, edge) {
  const raw = `${outFile}.raw.mp3`;
  let r = spawnSync(edge, ["--voice", VOICE, `--rate=${RATE}`, "--text", text, "--write-media", raw], { stdio: "ignore" });
  if (r.status !== 0) return false;
  r = spawnSync("ffmpeg", ["-y", "-i", raw, "-af", FILTER, "-ar", "24000", "-ac", "1", "-b:a", "64k", outFile], { stdio: "ignore" });
  spawnSync("rm", ["-f", raw]);
  return r.status === 0;
}

async function main() {
  const numbers = only ?? Array.from({ length: 75 }, (_, i) => i + 1);

  if (has("--dry-run")) {
    console.log(`Voice: ${VOICE} · rate ${RATE} · repeat=${REPEAT}\n`);
    for (const n of numbers) console.log(String(n).padStart(2), "→", phraseFor(n));
    if (has("--extras")) console.log("win →", "እንኳን ደስ አለህ! ቢንጎ!");
    return;
  }

  const edge = edgeExe();
  if (!edge) return console.error("edge-tts not found. Install: pipx install edge-tts");
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0)
    return console.error("ffmpeg not found on PATH.");

  await mkdir(AM_DIR, { recursive: true });
  let fail = 0;
  for (const n of numbers) {
    process.stdout.write(`#${String(n).padStart(2)} ${phraseFor(n)} … `);
    const ok = synth(phraseFor(n), join(AM_DIR, `${n}.mp3`), edge);
    console.log(ok ? "ok" : "FAIL");
    if (!ok) fail++;
  }
  if (has("--extras")) {
    await mkdir(SFX_DIR, { recursive: true });
    process.stdout.write("win cue … ");
    const ok = synth("እንኳን ደስ አለህ! ቢንጎ!", join(SFX_DIR, "win.mp3"), edge);
    console.log(ok ? "ok" : "FAIL");
    if (!ok) fail++;
  }
  console.log(fail ? `\nDone with ${fail} failure(s).` : "\nDone. Review, then commit the mp3s.");
}

main();
