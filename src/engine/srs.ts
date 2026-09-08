import type { CardState, MasteryLevel } from '../types';

/**
 * Spaced repetition for phrases.
 *
 * Mastery levels (0..5) describe what the learner can do with the phrase.
 * Flashcards alone can lift a phrase to level 3 (independent recall).
 * Level 4 requires using it in a speaking exercise, level 5 requires using it
 * in a real conversation. The interval ladder is driven by the recall streak
 * and an ease factor that adapts to performance.
 */

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  0: 'Never seen',
  1: 'Recognises',
  2: 'Recalls with help',
  3: 'Recalls independently',
  4: 'Uses in a sentence',
  5: 'Uses naturally',
};

/** Base intervals in days by streak position. */
export const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];
const RELEARN_MINUTES = 10;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.5;

export type ReviewOutcome = 'wrong' | 'hard' | 'good' | 'easy';

export function newCard(phraseId: string, now: Date, custom?: CardState['custom']): CardState {
  return {
    phraseId,
    mastery: 0,
    streak: 0,
    successes: 0,
    mistakes: 0,
    nextReview: now.toISOString(),
    ease: 2.0,
    helpUsed: 0,
    ...(custom ? { custom } : {}),
  };
}

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/**
 * Apply a review outcome. `helpLevel` 0..3 is how much help was used
 * (0 none, 3 full answer shown). Help lowers the gain, never punishes harshly.
 * `cap` is the maximum mastery this activity can award (3 for flashcards,
 * 4 for speaking exercises, 5 for conversations).
 */
export function reviewCard(
  card: CardState,
  outcome: ReviewOutcome,
  now: Date,
  opts: { helpLevel?: 0 | 1 | 2 | 3; cap?: MasteryLevel } = {},
): CardState {
  const helpLevel = opts.helpLevel ?? 0;
  const cap = opts.cap ?? 3;
  const next: CardState = { ...card, lastReviewed: now.toISOString() };

  if (outcome === 'wrong') {
    next.mistakes += 1;
    next.streak = 0;
    next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    next.mastery = Math.max(1, card.mastery - 1) as MasteryLevel;
    next.nextReview = addMinutes(now, RELEARN_MINUTES).toISOString();
    return next;
  }

  next.successes += 1;
  if (helpLevel > 0) next.helpUsed += 1;

  // Help reduces the effective quality of the recall.
  const effective: ReviewOutcome = helpLevel >= 3 ? 'hard' : helpLevel >= 1 && outcome === 'easy' ? 'good' : outcome;

  if (effective === 'hard') {
    // Hard: keep the streak, shorten the gap, small ease penalty.
    next.ease = Math.max(MIN_EASE, card.ease - 0.1);
    next.streak = Math.max(1, card.streak);
    if (helpLevel >= 3) {
      // Full answer shown: not an independent recall. Review again this session.
      next.streak = 0;
      next.mastery = Math.max(1, Math.min(card.mastery, 2)) as MasteryLevel;
      next.nextReview = addMinutes(now, RELEARN_MINUTES).toISOString();
      return next;
    }
  } else {
    next.streak = card.streak + 1;
    if (effective === 'easy') next.ease = Math.min(MAX_EASE, card.ease + 0.1);
  }

  // Mastery: rises one level per successful independent recall, up to cap.
  const gain = helpLevel > 0 ? (card.mastery < 2 ? 1 : 0) : 1;
  next.mastery = Math.min(cap, Math.max(1, card.mastery + gain)) as MasteryLevel;

  const idx = Math.min(next.streak - 1, INTERVALS_DAYS.length - 1);
  const base = INTERVALS_DAYS[Math.max(0, idx)];
  const easeAdj = next.streak >= 2 ? next.ease / 2.0 : 1;
  const hardAdj = effective === 'hard' ? 0.6 : 1;
  const days = Math.max(1, Math.round(base * easeAdj * hardAdj));
  next.nextReview = addDays(now, days).toISOString();
  return next;
}

/** Record that a phrase was used successfully in a sentence or conversation. */
export function markUsed(card: CardState, now: Date, level: 4 | 5): CardState {
  const next = { ...card, lastReviewed: now.toISOString() };
  if (card.mastery < level) next.mastery = Math.max(card.mastery + 1, Math.min(level, 4)) as MasteryLevel;
  if (level === 5 && card.mastery >= 4) next.mastery = 5;
  next.successes += 1;
  if (next.streak < 2) next.streak = 2;
  return next;
}

export function isDue(card: CardState, now: Date): boolean {
  return new Date(card.nextReview).getTime() <= now.getTime();
}

export function dueCards(cards: Record<string, CardState>, now: Date): CardState[] {
  return Object.values(cards)
    .filter((c) => c.mastery > 0 && isDue(c, now))
    .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
}

/** Weak = has mistakes and low mastery, or a poor success ratio. */
export function weakCards(cards: Record<string, CardState>): CardState[] {
  return Object.values(cards)
    .filter((c) => c.mastery > 0 && (c.mastery <= 2 || (c.mistakes >= 2 && c.mistakes >= c.successes / 2)))
    .sort((a, b) => {
      const ra = a.mistakes / Math.max(1, a.successes + a.mistakes);
      const rb = b.mistakes / Math.max(1, b.successes + b.mistakes);
      return rb - ra || a.mastery - b.mastery;
    });
}

export function masteredCount(cards: Record<string, CardState>, minLevel: MasteryLevel = 3): number {
  return Object.values(cards).filter((c) => c.mastery >= minLevel).length;
}

/** Average mastery (0..1) over a set of cards; unseen phrases count as 0. */
export function averageMastery(cards: CardState[], total: number): number {
  if (total === 0) return 0;
  const sum = cards.reduce((s, c) => s + c.mastery, 0);
  return sum / (5 * total);
}
