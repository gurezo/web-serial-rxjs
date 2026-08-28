import { bench, describe } from 'vitest';

/** Pre-#589 implementation kept for benchmark comparison. */
function countCompletedLines(completed: string): number {
  if (completed.length === 0) {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < completed.length; i++) {
    if (completed.charAt(i) === '\n') {
      count++;
    }
  }
  return count;
}

function trimCompletedByMaxLinesLegacy(
  completed: string,
  maxLines: number,
): string {
  if (maxLines <= 0) {
    return completed;
  }

  let trimmed = completed;
  while (countCompletedLines(trimmed) > maxLines) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline < 0) {
      break;
    }
    trimmed = trimmed.slice(firstNewline + 1);
  }
  return trimmed;
}

/** Optimized single-slice implementation (target for #589). */
function trimCompletedByMaxLinesOptimized(
  completed: string,
  maxLines: number,
): string {
  if (maxLines <= 0) {
    return completed;
  }

  const lineCount = countCompletedLines(completed);
  if (lineCount <= maxLines) {
    return completed;
  }

  const linesToDrop = lineCount - maxLines;
  let dropped = 0;
  for (let i = 0; i < completed.length; i++) {
    if (completed.charAt(i) === '\n') {
      dropped++;
      if (dropped === linesToDrop) {
        return completed.slice(i + 1);
      }
    }
  }
  return completed;
}

function buildCompletedLines(lineCount: number): string {
  return `${Array.from({ length: lineCount }, (_, i) => `line${i + 1}`).join('\n')}\n`;
}

const LARGE_COMPLETED = buildCompletedLines(10_000);
const MAX_LINES = 1_000;

describe('trimCompletedByMaxLines bulk drop', () => {
  bench('legacy while-loop rescan', () => {
    trimCompletedByMaxLinesLegacy(LARGE_COMPLETED, MAX_LINES);
  });

  bench('optimized single-slice', () => {
    trimCompletedByMaxLinesOptimized(LARGE_COMPLETED, MAX_LINES);
  });
});
