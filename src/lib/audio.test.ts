import { describe, it, expect } from "vitest";
import { CallGate } from "./audio";

// CallGate is the determinism guarantee of the number caller: an async-loaded
// clip may only START if its token is still current — i.e. it is the LATEST
// call and no hard stop (bingo / winner announcement / leaving the room)
// happened while it was loading. These tests pin down every ordering the
// game can produce.
describe("CallGate", () => {
  it("lets the latest call start", () => {
    const g = new CallGate();
    const t = g.next();
    expect(g.mayStart(t)).toBe(true);
  });

  it("rapid consecutive draws: a newer call supersedes older pending ones", () => {
    const g = new CallGate();
    const t1 = g.next(); // clip 1 still loading…
    const t2 = g.next(); // …when the next number is drawn
    const t3 = g.next();
    expect(g.mayStart(t1)).toBe(false); // stale — must never play late
    expect(g.mayStart(t2)).toBe(false);
    expect(g.mayStart(t3)).toBe(true); // only the number on the board voices
  });

  it("bingo mid-call: stop() blocks the pending clip even if it is the latest", () => {
    const g = new CallGate();
    const t = g.next(); // clip still downloading on a slow connection…
    g.stop(); // …when the winner announcement begins
    expect(g.mayStart(t)).toBe(false); // nothing may play over the announcement
  });

  it("stop() blocks everything issued before it, permanently", () => {
    const g = new CallGate();
    const t1 = g.next();
    const t2 = g.next();
    g.stop();
    expect(g.mayStart(t1)).toBe(false);
    expect(g.mayStart(t2)).toBe(false);
    g.stop(); // double stop (WINNER + GAME_STATUS FINISHED) stays blocked
    expect(g.mayStart(t2)).toBe(false);
  });

  it("recovers after a stop: the next round's calls play again", () => {
    const g = new CallGate();
    g.next();
    g.stop(); // round ends
    const t = g.next(); // next round's first draw
    expect(g.mayStart(t)).toBe(true);
  });

  it("a call issued after stop() is not blocked by a later stale token check", () => {
    const g = new CallGate();
    const old = g.next();
    g.stop();
    const fresh = g.next();
    expect(g.mayStart(old)).toBe(false);
    expect(g.mayStart(fresh)).toBe(true);
  });
});
