/** Text normalisation and fuzzy matching for spoken/typed Spanish answers. */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/ñ/g, 'n')
    .replace(/[¿?¡!.,;:"'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const cur = Math.min(prev[j] + 1, last + 1, prev[j - 1] + cost);
      prev[j - 1] = last;
      last = cur;
    }
    prev[b.length] = last;
  }
  return prev[b.length];
}

/** 0..1 similarity between two strings, tolerant of accents, punctuation and small slips. */
export function similarity(answer: string, target: string): number {
  const a = normalize(answer);
  const t = normalize(target);
  if (!a || !t) return 0;
  if (a === t) return 1;
  const charScore = 1 - levenshtein(a, t) / Math.max(a.length, t.length);
  // Token overlap (order-insensitive), rewards getting the key words.
  const at = a.split(' ');
  const tt = t.split(' ');
  let matched = 0;
  const used = new Set<number>();
  for (const w of at) {
    for (let i = 0; i < tt.length; i++) {
      if (used.has(i)) continue;
      if (w === tt[i] || (w.length > 3 && levenshtein(w, tt[i]) <= 1)) {
        used.add(i);
        matched++;
        break;
      }
    }
  }
  const tokenScore = (2 * matched) / (at.length + tt.length);
  return Math.max(0, Math.min(1, 0.5 * charScore + 0.5 * tokenScore));
}

export type Grade = 'correct' | 'close' | 'wrong';

export function grade(answer: string, target: string): { grade: Grade; score: number } {
  const score = similarity(answer, target);
  if (score >= 0.82) return { grade: 'correct', score };
  if (score >= 0.55) return { grade: 'close', score };
  return { grade: 'wrong', score };
}

/** True if any keyword appears (normalised) in the answer. */
export function containsAny(answer: string, keywords: string[]): boolean {
  const a = ' ' + normalize(answer) + ' ';
  return keywords.some((k) => {
    const nk = normalize(k);
    return nk.length > 0 && a.includes(' ' + nk + ' ');
  });
}

/** Rough word count of a spoken transcript. */
export function wordCount(s: string): number {
  return tokens(s).length;
}
