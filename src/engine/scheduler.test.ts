import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from './scheduler';
import { calendarInfo } from './calendar';
import { defaultState } from '../state/store';
import { newCard, reviewCard } from './srs';
import { readiness } from './readiness';
import { PHRASES } from '../data';
import type { LearnerState } from '../types';

function baseState(over: Partial<LearnerState> = {}): LearnerState {
  const s = defaultState();
  s.onboarded = true;
  s.settings.startDate = '2026-09-07';
  s.settings.departureDate = '2026-12-15';
  return { ...s, ...over };
}

describe('calendar', () => {
  it('fits 15 weeks into the days available', () => {
    const c = calendarInfo('2026-09-07', '2026-12-15', '2026-09-07');
    expect(c.dayNumber).toBe(1);
    expect(c.daysRemaining).toBe(99);
    expect(c.calendarWeek).toBe(1);
    expect(calendarInfo('2026-09-07', '2026-12-15', '2026-12-14').calendarWeek).toBe(15);
    expect(calendarInfo('2026-09-07', '2026-12-15', '2026-10-20').calendarWeek).toBe(7);
  });

  it('switches on immersion mode in the last week', () => {
    expect(calendarInfo('2026-09-07', '2026-12-15', '2026-12-07').immersion).toBe(false);
    expect(calendarInfo('2026-09-07', '2026-12-15', '2026-12-08').immersion).toBe(true);
  });
});

describe('daily plan', () => {
  it('fills the time budget with the five core activities on day one', () => {
    const plan = buildDailyPlan(baseState(), '2026-09-07', 45);
    const total = plan.activities.reduce((s, a) => s + a.minutes, 0);
    expect(total).toBe(45);
    const kinds = plan.activities.map((a) => a.kind);
    expect(kinds).toContain('phrases');
    expect(kinds).toContain('listening');
    expect(kinds).toContain('speaking');
    expect(kinds).toContain('scenario');
    expect(plan.week).toBe(1);
    expect(plan.immersion).toBe(false);
  });

  it('keeps a ten-minute day useful and speaking-based', () => {
    const plan = buildDailyPlan(baseState(), '2026-09-07', 10);
    const total = plan.activities.reduce((s, a) => s + a.minutes, 0);
    expect(total).toBe(10);
    expect(plan.activities.some((a) => a.kind === 'speaking')).toBe(true);
    expect(plan.activities.length).toBeLessThanOrEqual(3);
  });

  it('goes listening-heavy when listening is the weak skill', () => {
    const s = baseState({ skills: { listening: 0.3, speaking: 0.7, vocabulary: 0.7, conversation: 0.7 } });
    s.logs = { a: log('2026-09-07'), b: log('2026-09-08'), c: log('2026-09-09') };
    const plan = buildDailyPlan(s, '2026-09-10', 45);
    const listening = plan.activities.find((a) => a.kind === 'listening')!.minutes;
    const phrases = plan.activities.find((a) => a.kind === 'phrases')!.minutes;
    expect(listening).toBeGreaterThan(phrases);
    expect(plan.reason).toMatch(/listening/i);
  });

  it('drops new phrases in immersion mode and increases conversation', () => {
    const plan = buildDailyPlan(baseState(), '2026-12-10', 45);
    expect(plan.immersion).toBe(true);
    expect(plan.activities.some((a) => a.kind === 'phrases')).toBe(false);
    const scenario = plan.activities.find((a) => a.kind === 'scenario' || a.kind === 'challenge')!;
    expect(scenario.minutes).toBeGreaterThanOrEqual(12);
  });

  it('puts the weekly challenge in the plan once the week is done', () => {
    const s = baseState();
    s.completedLessons = ['w1d1', 'w1d2', 'w1d3', 'w1d4', 'w1d5'];
    const plan = buildDailyPlan(s, '2026-09-12', 45);
    expect(plan.activities.some((a) => a.kind === 'challenge')).toBe(true);
  });
});

describe('readiness', () => {
  it('starts near zero and caps at 60% without conversations', () => {
    const s = baseState();
    expect(readiness(s).overall).toBeLessThan(0.35);
    const now = new Date();
    for (const p of PHRASES.filter((p) => p.domains.includes('cafe'))) {
      let c = newCard(p.id, now);
      for (let i = 0; i < 5; i++) c = reviewCard(c, 'good', now);
      c.mastery = 5;
      s.cards[p.id] = c;
    }
    expect(readiness(s).domains.cafe).toBeCloseTo(0.6, 1);
    s.scenarioScores.cafe = [0.9, 0.9];
    expect(readiness(s).domains.cafe).toBeGreaterThan(0.9);
  });
});

function log(date: string) {
  return { date, minutesSpoken: 10, minutesListened: 10, cardsReviewed: 10, cardsCorrect: 8, phrasesLearned: 6, conversations: 1, completed: true };
}
