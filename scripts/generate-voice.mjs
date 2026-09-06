#!/usr/bin/env node
// Batch-generate the Amharic bingo caller voice with Azure Neural TTS.
//
// Produces one clip per number 1..75 as a natural "letter + number" call
// (e.g. 45 -> "ኤን ፣ አርባ አምስት") into public/audio/am/<n>.mp3, plus optional
// spoken cues into public/sounds/. Run once, review, ship the mp3s as static
// assets — the app's playback code is unchanged (one clip = one call).
//
// Usage:
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=eastus \
//     node scripts/generate-voice.mjs [--dry-run] [--only=45] [--extras] [--normalize]
//
// Flags:
//   --dry-run    Print every Amharic phrase and exit (no API calls). Review first!
//   --only=N     Generate just number N (handy for fixing one clip).
//   --extras     Also generate the spoken cues in EXTRAS -> public/sounds/.
//   --normalize  Loudness-normalize the batch with ffmpeg (if installed).
//   --force      Overwrite clips that already exist. WITHOUT this flag, any
//                existing mp3 is left untouched — this guards the hand-recorded
//                human voice clips from being clobbered by a stray regen.
//
// Env: AZURE_SPEECH_KEY (required), AZURE_SPEECH_REGION (required),
//      AZURE_VOICE (optional, default am-ET-MekdesNeural; try am-ET-AmehaNeural).

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const AM_DIR = join(REPO, "public", "audio", "am");
const SFX_DIR = join(REPO, "public", "sounds");

// ---- Config you may want to tweak -----------------------------------------

const VOICE = process.env.AZURE_VOICE || "am-ET-MekdesNeural";
const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
// 48 kHz / 192 kbps mono — a big step up from the current 24 kHz / 48 kbps.
const OUTPUT_FORMAT = "audio-48khz-192kbitrate-mono-mp3";

// How each BINGO column letter is spoken in Amharic. Verify these with a
// --dry-run + one test clip; adjust to match how your callers actually say them.
const LETTER_AM = { B: "ቢ", I: "አይ", N: "ኤን", G: "ጂ", O: "ኦ" };

// Column ranges — mirror of src/lib/constants.ts COLUMN_RANGES.
const COLUMN_RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };

// Optional spoken cues (only with --extras) -> public/sounds/<key>.mp3.
// daub/join are non-verbal ticks — source real SFX for those instead of TTS.
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

// ---- Azure TTS -------------------------------------------------------------

function ssml(text) {
  // A short break between the letter and the number gives the natural
  // caller cadence ("under the N… forty-five"); a slight slow-down helps clarity.
  const withBreak = text.replace("፣ ", '<break time="180ms"/>');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="am-ET">` +
    `<voice name="${VOICE}"><prosody rate="-6%">${withBreak}</prosody></voice></speak>`
  );
}

async function synth(text) {
  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
      "User-Agent": "habesha-bingo-voicegen",
    },
    body: ssml(text),
  });
  if (!res.ok) {
    throw new Error(`Azure TTS ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
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
const only = (() => {
  const a = args.find((x) => x.startsWith("--only="));
  return a ? Number(a.split("=")[1]) : null;
})();

async function main() {
  const dryRun = has("--dry-run");
  const force = has("--force");
  let skipped = 0;

  if (!dryRun && (!KEY || !REGION)) {
    console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (see --help in the header).");
    process.exit(1);
  }

  const numbers = only ? [only] : Array.from({ length: 75 }, (_, i) => i + 1);

  if (dryRun) {
    console.log(`Voice: ${VOICE}\n`);
    for (const n of numbers) console.log(String(n).padStart(2), "→", phraseFor(n));
    if (has("--extras")) for (const [k, v] of Object.entries(EXTRAS)) console.log(k, "→", v);
    console.log("\n(dry run — no audio generated)");
    return;
  }

  await mkdir(AM_DIR, { recursive: true });
  const ffmpegOk = has("--normalize") && spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (has("--normalize") && !ffmpegOk) console.warn("⚠ ffmpeg not found — skipping normalization.");

  for (const n of numbers) {
    const file = join(AM_DIR, `${n}.mp3`);
    if (existsSync(file) && !force) {
      console.log(`#${String(n).padStart(2)} skip — ${n}.mp3 exists (use --force to overwrite)`);
      skipped++;
      continue;
    }
    process.stdout.write(`#${String(n).padStart(2)} ${phraseFor(n)} … `);
    const buf = await synth(phraseFor(n));
    await writeFile(file, buf);
    if (ffmpegOk) normalize(file);
    console.log(`ok (${(buf.length / 1024).toFixed(1)} KB)`);
    await new Promise((r) => setTimeout(r, 120)); // gentle pacing for the API
  }

  if (has("--extras")) {
    await mkdir(SFX_DIR, { recursive: true });
    for (const [key, text] of Object.entries(EXTRAS)) {
      const file = join(SFX_DIR, `${key}.mp3`);
      if (existsSync(file) && !force) {
        console.log(`cue ${key} skip — ${key}.mp3 exists (use --force to overwrite)`);
        skipped++;
        continue;
      }
      process.stdout.write(`cue ${key} "${text}" … `);
      const buf = await synth(text);
      await writeFile(file, buf);
      if (ffmpegOk) normalize(file);
      console.log("ok");
    }
  }

  if (skipped > 0) {
    console.log(`\n${skipped} existing clip(s) left untouched. Re-run with --force to overwrite them.`);
  }
  console.log("\nDone. Review the clips, then commit the mp3s.");
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});
