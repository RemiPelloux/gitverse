/** Line-based diffing and three-way merge (diff3), used by diff/merge/rebase. */

export type DiffOp = { op: "eq" | "add" | "del"; line: string };

export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function joinLines(lines: string[]): string {
  return lines.length ? lines.join("\n") + "\n" : "";
}

/** LCS table based matching: returns, for each index of `a`, the matched index in `b` (or -1). */
function lcsMatch(a: string[], b: string[]): number[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const match = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      match[i] = j;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return match;
}

export function diffLines(a: string[], b: string[]): DiffOp[] {
  const match = lcsMatch(a, b);
  const ops: DiffOp[] = [];
  let j = 0;
  for (let i = 0; i < a.length; i++) {
    if (match[i] === -1) {
      ops.push({ op: "del", line: a[i] });
      continue;
    }
    while (j < match[i]) ops.push({ op: "add", line: b[j++] });
    ops.push({ op: "eq", line: a[i] });
    j++;
  }
  while (j < b.length) ops.push({ op: "add", line: b[j++] });
  return ops;
}

export interface Hunk {
  header: string;
  lines: DiffOp[];
}

/** Unified diff hunks with `context` lines around changes. */
export function hunks(oldText: string, newText: string, context = 3): Hunk[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = diffLines(a, b);
  const result: Hunk[] = [];
  const changed = ops.map((o) => o.op !== "eq");
  let idx = 0;
  while (idx < ops.length) {
    if (!changed[idx]) {
      idx++;
      continue;
    }
    let start = Math.max(0, idx - context);
    let end = idx;
    // extend while changes are within 2*context of each other
    while (end < ops.length) {
      let next = end;
      while (next < ops.length && changed[next]) next++;
      let gapEnd = next;
      while (gapEnd < ops.length && !changed[gapEnd] && gapEnd - next < context * 2) gapEnd++;
      if (gapEnd < ops.length && changed[gapEnd]) {
        end = gapEnd;
      } else {
        end = Math.min(ops.length, next + context);
        break;
      }
    }
    // compute line numbers
    let oldLine = 1;
    let newLine = 1;
    for (let k = 0; k < start; k++) {
      if (ops[k].op !== "add") oldLine++;
      if (ops[k].op !== "del") newLine++;
    }
    const slice = ops.slice(start, end);
    const oldCount = slice.filter((o) => o.op !== "add").length;
    const newCount = slice.filter((o) => o.op !== "del").length;
    result.push({
      header: `@@ -${oldCount ? oldLine : oldLine - 1},${oldCount} +${newCount ? newLine : newLine - 1},${newCount} @@`,
      lines: slice,
    });
    idx = end;
    start = end;
  }
  return result;
}

export interface Merge3Result {
  clean: boolean;
  text: string;
}

/**
 * Three-way line merge in the style of diff3. Non-overlapping changes merge
 * cleanly; overlapping changes produce Git-style conflict markers.
 */
export function merge3(
  base: string,
  ours: string,
  theirs: string,
  oursLabel = "HEAD",
  theirsLabel = "theirs",
): Merge3Result {
  const O = splitLines(base);
  const A = splitLines(ours);
  const B = splitLines(theirs);
  const mA = lcsMatch(O, A);
  const mB = lcsMatch(O, B);
  const out: string[] = [];
  let clean = true;
  let i = 0;
  let a = 0;
  let b = 0;
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v, k) => v === y[k]);

  const emitChunk = (o: string[], ca: string[], cb: string[]) => {
    if (eq(ca, o)) out.push(...cb);
    else if (eq(cb, o)) out.push(...ca);
    else if (eq(ca, cb)) out.push(...ca);
    else {
      clean = false;
      out.push(`<<<<<<< ${oursLabel}`, ...ca, "=======", ...cb, `>>>>>>> ${theirsLabel}`);
    }
  };

  while (true) {
    let j = i;
    while (j < O.length && !(mA[j] >= a && mB[j] >= b)) j++;
    if (j >= O.length) {
      emitChunk(O.slice(i), A.slice(a), B.slice(b));
      break;
    }
    if (j === i && mA[j] === a && mB[j] === b) {
      out.push(O[j]);
      i++;
      a++;
      b++;
      continue;
    }
    emitChunk(O.slice(i, j), A.slice(a, mA[j]), B.slice(b, mB[j]));
    i = j;
    a = mA[j];
    b = mB[j];
  }
  return { clean, text: joinLines(out) };
}

export const hasConflictMarkers = (text: string) =>
  /^<<<<<<< /m.test(text) && /^=======$/m.test(text) && /^>>>>>>> /m.test(text);
