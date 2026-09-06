// Number caller + sound effects.
//
// Playback uses the Web Audio API: each clip is fetched once and decoded into an
// AudioBuffer, then played through a short gain envelope. Versus HTMLAudio this
// gives gapless, zero-latency, click-free calls with no cross-clip overlap — so
// the caller flows instead of stuttering. Falls back to a synthesized beep if a
// clip is missing or can't decode.

const MAX_CALL = 75; // clips are /audio/am/1..75.mp3

// Cache-busting tag appended to every audio fetch. Audio files keep stable
// names (e.g. 45.mp3), so a browser/Telegram that cached an old clip would
// keep serving it after we swap the file. BUMP THIS whenever any file under
// /public/audio or /public/sounds is replaced — every player then fetches the
// fresh clip instead of the cached one. (A build-time tag would work too, but
// would needlessly re-download all 75 clips on every deploy.)
const AUDIO_VERSION = "2026-07-18";

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function resume() {
  const c = audioCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// Decoded-buffer cache. The value is a promise (resolving to the buffer or null)
// so concurrent requests for the same clip share one fetch+decode.
const buffers = new Map<string, Promise<AudioBuffer | null>>();
function load(src: string): Promise<AudioBuffer | null> {
  let p = buffers.get(src);
  if (!p) {
    const c = audioCtx();
    p = c
      ? fetch(`${src}?v=${AUDIO_VERSION}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((buf) => c.decodeAudioData(buf))
          .catch(() => null)
      : Promise.resolve(null);
    buffers.set(src, p);
  }
  return p;
}

// The currently-playing source per exclusive group, so a new call cleanly cuts
// the previous one (they never pile up on top of each other).
const active = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();

function playBuffer(
  src: string,
  opts: { volume?: number; group?: string; fallback?: () => void } = {},
) {
  const c = audioCtx();
  if (!c) return opts.fallback?.();
  resume();
  load(src)
    .then((buffer) => {
      if (!buffer) return opts.fallback?.();
      const now = c.currentTime;
      const vol = opts.volume ?? 1;

      // Fade out + stop whatever is already playing in this group (avoids the
      // click of a hard stop and any muddy overlap of two calls).
      if (opts.group) {
        const prev = active.get(opts.group);
        if (prev) {
          try {
            prev.gain.gain.cancelScheduledValues(now);
            prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
            prev.gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
            prev.src.stop(now + 0.03);
          } catch {
            /* already stopped */
          }
          active.delete(opts.group);
        }
      }

      const source = c.createBufferSource();
      source.buffer = buffer;
      const gain = c.createGain();

      // Micro fade in/out so the clip edges never click.
      const end = now + buffer.duration;
      const fadeIn = 0.012;
      const fadeOut = Math.min(0.04, buffer.duration / 3);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + fadeIn);
      gain.gain.setValueAtTime(vol, Math.max(now + fadeIn, end - fadeOut));
      gain.gain.linearRampToValueAtTime(0.0001, end);

      source.connect(gain).connect(c.destination);
      source.start(now);

      if (opts.group) {
        active.set(opts.group, { src: source, gain });
        source.onended = () => {
          if (active.get(opts.group!)?.src === source) active.delete(opts.group!);
        };
      }
    })
    .catch(() => opts.fallback?.());
}

function beep(freq: number, durationMs = 160) {
  const c = audioCtx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000);
}

// ---- Latest-wins voice caller ----------------------------------------------
// The board updates the INSTANT a NUMBER_DRAWN event arrives, and the voice
// must track it exactly. So the caller has no queue: a new call cuts whatever
// clip is playing (20ms fade, no click) and starts at once — clips are
// pre-decoded (see preloadCalls) so in steady play the voice starts in the
// same tick as the display. A queue would drift seconds behind the board the
// moment calls bunch up, and dropping its overflow silently skipped numbers.
//
// Every call takes a token from the gate; a clip may only START if its token
// is still current when the (usually cached) decode resolves. That closes the
// race the old code had on slow connections: a clip whose fetch was still in
// flight when "Bingo!" hit would begin playing over the announcement, because
// only the ALREADY-playing source got stopped. Now stopCalls() bumps the
// epoch, so anything not yet started can never start.

/**
 * Decides whether an async-loaded call clip may still start. Exported for
 * tests: this small state machine IS the determinism guarantee.
 * - a newer call supersedes older pending ones (latest wins);
 * - stop() (bingo, winner announcement, leaving the room) invalidates
 *   everything pending until the next call.
 */
export class CallGate {
  private seq = 0;
  private epoch = 0;

  /** Register a new call; returns its token. */
  next(): { seq: number; epoch: number } {
    return { seq: ++this.seq, epoch: this.epoch };
  }

  /** Hard stop: nothing pending may start until the next call. */
  stop() {
    this.epoch++;
  }

  /** May the clip holding this token start playing now? */
  mayStart(token: { seq: number; epoch: number }): boolean {
    return token.seq === this.seq && token.epoch === this.epoch;
  }
}

const callGate = new CallGate();
let currentVoice: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

// Fade out + stop the clip that is currently audible (click-free hard cut).
function cutCurrentVoice() {
  if (!currentVoice) return;
  const { src, gain } = currentVoice;
  currentVoice = null;
  try {
    src.onended = null;
    const c = audioCtx();
    if (c) {
      const now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
      src.stop(now + 0.03);
    } else {
      src.stop();
    }
  } catch {
    /* already stopped */
  }
}

export const sound = {
  enabled: true,

  /**
   * Warm the audio pipeline: resume the context and fetch+decode every call clip
   * (and the win cue) up front, so the very first call plays instantly and every
   * later one is gapless. Safe to call repeatedly — cached after the first time.
   * Call it when the game room mounts.
   */
  preloadCalls() {
    if (!this.enabled) return;
    resume();
    for (let n = 1; n <= MAX_CALL; n++) load(`/audio/am/${n}.mp3`);
    load("/sounds/bingo.aac");
  },

  /**
   * Voice the drawn number NOW, in sync with the board: cuts any clip still
   * playing (latest wins) and starts immediately — clips are pre-decoded so
   * this is same-tick in steady play. On a cold cache the clip may start a
   * beat late, but only while its number is still the latest call and no hard
   * stop happened meanwhile; a superseded clip is skipped entirely (playing it
   * late would be more out of sync than silence).
   */
  callNumber(n: number) {
    if (!this.enabled) return;
    resume();
    const token = callGate.next();
    load(`/audio/am/${n}.mp3`).then((buffer) => {
      if (!callGate.mayStart(token)) return; // superseded or hard-stopped
      cutCurrentVoice();
      const c = audioCtx();
      if (!c) return;
      if (!buffer) {
        // Missing/undecodable clip: short beep so the call isn't fully silent.
        beep(460, 180);
        return;
      }
      const now = c.currentTime;
      const source = c.createBufferSource();
      source.buffer = buffer;
      const gain = c.createGain();
      const end = now + buffer.duration;
      const fadeIn = 0.01;
      const fadeOut = Math.min(0.035, buffer.duration / 4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(1, now + fadeIn);
      gain.gain.setValueAtTime(1, Math.max(now + fadeIn, end - fadeOut));
      gain.gain.linearRampToValueAtTime(0.0001, end);
      source.connect(gain).connect(c.destination);
      currentVoice = { src: source, gain };
      source.onended = () => {
        if (currentVoice?.src === source) currentVoice = null;
      };
      source.start(now);
    });
  },

  /**
   * Hard-stop the number caller: cut the audible clip and invalidate every
   * pending one (even clips whose download is still in flight can never
   * start). Call on winner announcement, game end/cancel, and when leaving
   * the room. Deliberately NOT gated on `enabled` — stopping must always work.
   */
  stopCalls() {
    callGate.stop();
    cutCurrentVoice();
  },

  /** The "Bingo!" voice announcement — hard-stops number calls, plays once. */
  bingo() {
    this.stopCalls();
    if (!this.enabled) return;
    playBuffer("/sounds/bingo.aac", {
      fallback: () => {
        beep(660, 120);
        setTimeout(() => beep(880, 200), 130);
      },
    });
  },

  daub() {
    if (!this.enabled) return;
    playBuffer("/sounds/daub.mp3", { volume: 0.8, fallback: () => beep(720, 70) });
  },

  join() {
    if (!this.enabled) return;
    playBuffer("/sounds/join.mp3", { volume: 0.8, fallback: () => beep(540, 90) });
  },
};
