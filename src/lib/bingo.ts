// Client-side mirror of pkg/bingo/card.go ValidateBingo. The backend is
// authoritative; this only drives the UI (enabling the BINGO button and
// highlighting the winning line). Indexing matches the backend exactly:
//   - card.numbers is [row][col]; col 0..4 maps to letters B,I,N,G,O
//   - claim positions are row-major: position = row*5 + col  (0..24)
//   - the center cell numbers[2][2] === 0 is always "marked" (FREE)

import { COLUMN_RANGES, GRID, LETTERS } from "./constants";
import type { BingoCard, BingoLetter } from "@/types/api";

export const CENTER = 12;

/** Flatten a 5x5 [row][col] grid to a length-25 row-major array. */
export function flattenCard(card: BingoCard): number[] {
  const flat: number[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      flat.push(card.numbers?.[row]?.[col] ?? 0);
    }
  }
  return flat;
}

export function rowCol(pos: number): [number, number] {
  return [Math.floor(pos / GRID), pos % GRID];
}

/** Letter for a column index 0..4. */
export function letterForCol(col: number): BingoLetter {
  return LETTERS[col];
}

/** Letter for a drawn number 1..75 (matches GetLetterForNumber). */
export function letterForNumber(n: number): BingoLetter | "" {
  for (const l of LETTERS) {
    const [min, max] = COLUMN_RANGES[l];
    if (n >= min && n <= max) return l;
  }
  return "";
}

// All winning lines as arrays of board positions (0..24).
function buildLines(): number[][] {
  const lines: number[][] = [];
  // rows
  for (let r = 0; r < GRID; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * GRID + c));
  // cols
  for (let c = 0; c < GRID; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * GRID + c));
  // diagonals
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);
  return lines;
}

const LINES = buildLines();
const CORNERS = [0, 4, 20, 24];

/**
 * Given the set of positions the player has effectively marked (daubed AND
 * drawn; the center is implicitly always marked), return the winning positions
 * to highlight, or null if there is no bingo yet.
 */
export function findWinningPositions(marked: Set<number>): number[] | null {
  const isMarked = (p: number) => p === CENTER || marked.has(p);

  for (const line of LINES) {
    if (line.every(isMarked)) return line;
  }
  if (CORNERS.every(isMarked)) return CORNERS;
  return null;
}

export function hasBingo(marked: Set<number>): boolean {
  return findWinningPositions(marked) !== null;
}

/**
 * Auto-mark: every board position whose number has been drawn. The app marks
 * called numbers for the player automatically — there is no manual daubing.
 * The center (FREE, number 0) is implicitly marked everywhere and excluded here.
 */
export function autoMarked(card: BingoCard, drawn: Set<number>): Set<number> {
  const flat = flattenCard(card);
  const marked = new Set<number>();
  for (let pos = 0; pos < flat.length; pos++) {
    const num = flat[pos];
    if (num !== 0 && drawn.has(num)) marked.add(pos);
  }
  return marked;
}

/** Positions to submit in a claim: all marked cells plus the free center. */
export function claimPositions(marked: Set<number>): number[] {
  const set = new Set(marked);
  set.add(CENTER);
  return [...set].sort((a, b) => a - b);
}

/**
 * Map a winner's marked card NUMBERS (the WINNER event payload) back to board
 * positions (0-24), and the winning line through them. Numbers are unique on a
 * card and the FREE center is 0 → position 12, so the mapping is unambiguous.
 * Used to render the winner's card so other players can verify the win.
 */
export function winnerMarks(card: BingoCard, markedNumbers: number[]): {
  positions: Set<number>;
  winLine: number[] | null;
} {
  const flat = flattenCard(card);
  const positions = new Set<number>();
  for (const num of markedNumbers) {
    const pos = flat.indexOf(num);
    if (pos >= 0) positions.add(pos);
  }
  return { positions, winLine: findWinningPositions(positions) };
}
