import { describe, expect, it } from 'vitest';
import { averageMastery, dueCards, isDue, markUsed, newCard, reviewCard, weakCards } from './srs';

const day = 86_400_000;
const t0 = new Date('2026-09-07T09:00:00Z');

describe('spaced repetition', () => {
  it('new cards start unseen and due now', () => {
    const c = newCard('w01d1p1', t0);
    expect(c.mastery).toBe(0);
    expect(isDue(c, t0)).toBe(true);
  });

  it('follows the 1, 3, 7, 14, 30 day ladder on repeated success', () => {
    let c = newCard('p', t0);
    const gaps: number[] = [];
    let now = t0;
    for (let i = 0; i < 5; i++) {
      c = reviewCard(c, 'good', now);
      const next = new Date(c.nextReview);
      gaps.push(Math.round((next.getTime() - now.getTime()) / day));
      now = next;
    }
    expect(gaps).toEqual([1, 3, 7, 14, 30]);
    expect(c.mastery).toBe(3); // flashcards cap at level 3
  });

  it('a mistake resets the streak, drops one level and comes back in minutes', () => {
    let c = newCard('p', t0);
    c = reviewCard(c, 'good', t0);
    c = reviewCard(c, 'good', new Date(t0.getTime() + day));
    expect(c.mastery).toBe(2);
    c = reviewCard(c, 'wrong', new Date(t0.getTime() + 4 * day));
    expect(c.streak).toBe(0);
    expect(c.mastery).toBe(1);
    const gapMin = (new Date(c.nextReview).getTime() - (t0.getTime() + 4 * day)) / 60000;
    expect(gapMin).toBeLessThanOrEqual(15);
  });

  it('showing the full answer counts as help, not an independent recall', () => {
    let c = newCard('p', t0);
    c = reviewCard(c, 'good', t0);
    c = reviewCard(c, 'good', new Date(t0.getTime() + day));
    const helped = reviewCard(c, 'good', new Date(t0.getTime() + 4 * day), { helpLevel: 3 });
    expect(helped.helpUsed).toBe(1);
    expect(helped.mastery).toBeLessThanOrEqual(2);
    expect(helped.streak).toBe(0);
    // But it is not punished as harshly as a mistake.
    expect(helped.mistakes).toBe(0);
    expect(helped.ease).toBeGreaterThanOrEqual(c.ease - 0.1);
  });

  it('ease adapts intervals to performance', () => {
    let easy = newCard('a', t0);
    let hard = newCard('b', t0);
    let now = t0;
    for (let i = 0; i < 4; i++) {
      easy = reviewCard(easy, 'easy', now);
      hard = reviewCard(hard, 'hard', now);
      now = new Date(now.getTime() + 3 * day);
    }
    expect(new Date(easy.nextReview).getTime()).toBeGreaterThan(new Date(hard.nextReview).getTime());
  });

  it('levels 4 and 5 only come from use in sentences and conversations', () => {
    let c = newCard('p', t0);
    for (let i = 0; i < 6; i++) c = reviewCard(c, 'good', new Date(t0.getTime() + i * 40 * day));
    expect(c.mastery).toBe(3);
    c = markUsed(c, t0, 4);
    expect(c.mastery).toBe(4);
    c = markUsed(c, t0, 5);
    expect(c.mastery).toBe(5);
  });

  it('finds due and weak cards', () => {
    const a = reviewCard(newCard('a', t0), 'good', t0);
    const b = reviewCard(newCard('b', t0), 'wrong', t0);
    const later = new Date(t0.getTime() + 2 * day);
    const cards = { a, b };
    expect(dueCards(cards, later).map((c) => c.phraseId)).toEqual(['b', 'a']);
    expect(weakCards(cards).map((c) => c.phraseId)).toContain('b');
    expect(averageMastery([a, b], 4)).toBeCloseTo((1 + 1) / 20);
  });
});
