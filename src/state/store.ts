import { useSyncExternalStore } from 'react';
import type {
  ActivityKind,
  CardState,
  ConversationLog,
  ConversationReview,
  DailyLog,
  DailyPlan,
  FinalAssessmentResult,
  LearnerLevel,
  LearnerState,
  MasteryLevel,
  ScenarioId,
  Settings,
} from '../types';
import { toDateKey, daysBetween } from '../engine/calendar';
import { markUsed, newCard, reviewCard, type ReviewOutcome } from '../engine/srs';
import { ema } from '../engine/readiness';
import { buildDailyPlan } from '../engine/scheduler';
import { PHRASE_BY_ID, LESSON_BY_KEY } from '../data';
import { normalize } from '../engine/text';

const STORAGE_KEY = 'tenerife-spanish:v1';
export const DEPARTURE_DEFAULT = '2026-12-15';

export function defaultState(): LearnerState {
  return {
    version: 1,
    onboarded: false,
    settings: {
      name: '',
      departureDate: DEPARTURE_DEFAULT,
      startDate: toDateKey(new Date()),
      level: 'complete-beginner',
      defaultMinutes: 45,
      ttsRate: 0.85,
      about: { from: '', work: '', hobbies: '', whyTenerife: '' },
    },
    cards: {},
    completedLessons: [],
    completedListening: [],
    completedChallenges: [],
    plans: {},
    logs: {},
    conversations: [],
    mistakes: [],
    skills: { listening: 0.3, speaking: 0.3, vocabulary: 0.2, conversation: 0.25 },
    scenarioScores: {},
    streak: 0,
  };
}

function load(): LearnerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as LearnerState;
    return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings } };
  } catch {
    return defaultState();
  }
}

let state: LearnerState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
}

export function getState(): LearnerState {
  return state;
}

export function setState(updater: (s: LearnerState) => LearnerState): void {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function useStore(): LearnerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function today(): string {
  return toDateKey(new Date());
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function completeOnboarding(settings: Partial<Settings>, level: LearnerLevel, knownPhraseIds: string[]): void {
  const now = new Date();
  setState((s) => {
    const cards = { ...s.cards };
    for (const id of knownPhraseIds) {
      if (!PHRASE_BY_ID[id]) continue;
      const c = newCard(id, now);
      c.mastery = 2;
      c.streak = 1;
      c.successes = 1;
      c.nextReview = new Date(now.getTime() + 86_400_000).toISOString();
      cards[id] = c;
    }
    const skillBoost = level === 'complete-beginner' ? 0 : level === 'some-basics' ? 0.1 : 0.2;
    return {
      ...s,
      onboarded: true,
      settings: { ...s.settings, ...settings, level, startDate: today() },
      cards,
      skills: {
        listening: 0.3 + skillBoost,
        speaking: 0.3 + skillBoost,
        vocabulary: 0.2 + skillBoost,
        conversation: 0.25 + skillBoost,
      },
    };
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Get today's plan, creating it with the given budget if it does not exist. */
export function ensurePlan(budget?: number): DailyPlan {
  const key = today();
  const existing = state.plans[key];
  if (existing && (budget === undefined || existing.timeBudget === budget)) return existing;
  const plan = buildDailyPlan(state, key, budget ?? existing?.timeBudget ?? state.settings.defaultMinutes);
  if (existing) {
    // Keep completion state of matching activities when the budget changes.
    for (const a of plan.activities) {
      const prev = existing.activities.find((p) => p.kind === a.kind && p.ref === a.ref);
      if (prev?.done) a.done = true;
    }
  }
  setState((s) => ({ ...s, plans: { ...s.plans, [key]: plan } }));
  return plan;
}

export function regeneratePlan(budget: number): DailyPlan {
  const key = today();
  const plan = buildDailyPlan(state, key, budget);
  const existing = state.plans[key];
  if (existing) {
    for (const a of plan.activities) {
      const prev = existing.activities.find((p) => p.kind === a.kind && p.ref === a.ref);
      if (prev?.done) a.done = true;
    }
  }
  setState((s) => ({ ...s, plans: { ...s.plans, [key]: plan } }));
  return plan;
}

function touchLog(s: LearnerState, patch: (l: DailyLog) => DailyLog): LearnerState {
  const key = today();
  const log: DailyLog = s.logs[key] ?? {
    date: key,
    minutesSpoken: 0,
    minutesListened: 0,
    cardsReviewed: 0,
    cardsCorrect: 0,
    phrasesLearned: 0,
    conversations: 0,
    completed: false,
  };
  const updated = patch(log);
  // Streak: consecutive days with any activity.
  let streak = s.streak;
  let lastActiveDate = s.lastActiveDate;
  if (lastActiveDate !== key) {
    const gap = lastActiveDate ? daysBetween(lastActiveDate, key) : 99;
    streak = gap === 1 ? s.streak + 1 : 1;
    lastActiveDate = key;
  }
  return { ...s, logs: { ...s.logs, [key]: updated }, streak, lastActiveDate };
}

export function markActivityDone(kind: ActivityKind, ref?: string): void {
  const key = today();
  setState((s) => {
    const plan = s.plans[key];
    if (!plan) return touchLog(s, (l) => l);
    const activities = plan.activities.map((a) => (a.kind === kind && (ref === undefined || a.ref === ref || a.ref === undefined) && !a.done ? { ...a, done: true } : a));
    const allDone = activities.every((a) => a.done);
    const next = { ...s, plans: { ...s.plans, [key]: { ...plan, activities } } };
    return touchLog(next, (l) => ({ ...l, completed: allDone || l.completed }));
  });
}

export function recordFlashcardReview(phraseId: string, outcome: ReviewOutcome, helpLevel: 0 | 1 | 2 | 3 = 0, cap: MasteryLevel = 3): CardState {
  const now = new Date();
  let updated: CardState | undefined;
  setState((s) => {
    const card = s.cards[phraseId] ?? newCard(phraseId, now);
    updated = reviewCard(card, outcome, now, { helpLevel, cap });
    const correct = outcome !== 'wrong' ? 1 : 0;
    const next = { ...s, cards: { ...s.cards, [phraseId]: updated } };
    const sample = outcome === 'wrong' ? 0 : outcome === 'hard' ? 0.6 : 1;
    return touchLog(
      { ...next, skills: { ...next.skills, vocabulary: ema(next.skills.vocabulary, sample, 0.05) } },
      (l) => ({ ...l, cardsReviewed: l.cardsReviewed + 1, cardsCorrect: l.cardsCorrect + correct }),
    );
  });
  return updated!;
}

/** After the learner has met a new phrase (meaning, audio, repeat, recall, use). */
export function recordPhraseLearned(phraseId: string, recallOk: boolean, usedInSentence: boolean): void {
  const now = new Date();
  setState((s) => {
    let card = s.cards[phraseId] ?? newCard(phraseId, now);
    if (card.mastery === 0) {
      card = { ...card, mastery: 1, streak: 0, lastReviewed: now.toISOString(), nextReview: now.toISOString() };
    }
    card = reviewCard(card, recallOk ? 'good' : 'wrong', now, { cap: 3 });
    if (usedInSentence && recallOk) card = markUsed(card, now, 4);
    const next = { ...s, cards: { ...s.cards, [phraseId]: card } };
    return touchLog(next, (l) => ({ ...l, phrasesLearned: l.phrasesLearned + 1 }));
  });
}

export function completeLesson(lessonKey: string): void {
  if (!LESSON_BY_KEY[lessonKey]) return;
  setState((s) => (s.completedLessons.includes(lessonKey) ? s : { ...s, completedLessons: [...s.completedLessons, lessonKey] }));
}

export function recordListening(exerciseId: string, score: number, minutes: number): void {
  setState((s) => {
    const next = {
      ...s,
      completedListening: s.completedListening.includes(exerciseId) ? s.completedListening : [...s.completedListening, exerciseId],
      skills: { ...s.skills, listening: ema(s.skills.listening, score, 0.25) },
    };
    return touchLog(next, (l) => ({
      ...l,
      minutesListened: l.minutesListened + minutes,
      listeningScore: l.listeningScore === undefined ? score : (l.listeningScore + score) / 2,
    }));
  });
}

export function recordSpeaking(minutes: number, quality: number, usedPhraseIds: string[] = []): void {
  const now = new Date();
  setState((s) => {
    const cards = { ...s.cards };
    for (const id of usedPhraseIds) {
      const c = cards[id];
      if (c) cards[id] = markUsed(c, now, 4);
    }
    const next = { ...s, cards, skills: { ...s.skills, speaking: ema(s.skills.speaking, quality, 0.2) } };
    return touchLog(next, (l) => ({ ...l, minutesSpoken: l.minutesSpoken + minutes }));
  });
}

export function recordListeningMinutes(minutes: number): void {
  setState((s) => touchLog(s, (l) => ({ ...l, minutesListened: l.minutesListened + minutes })));
}

export interface ConversationCompletion {
  scenarioId: ScenarioId;
  startedAt: string;
  minutes: number;
  learnerTurns: number;
  hintsUsed: number;
  review: ConversationReview;
  mode: 'ai' | 'scripted';
  corrections: { original: string; better: string; note: string }[];
  learnerTexts: string[];
}

export function recordConversation(c: ConversationCompletion): ConversationLog {
  const now = new Date();
  const log: ConversationLog = {
    id: `c${now.getTime()}`,
    scenarioId: c.scenarioId,
    startedAt: c.startedAt,
    endedAt: now.toISOString(),
    learnerTurns: c.learnerTurns,
    minutes: c.minutes,
    hintsUsed: c.hintsUsed,
    review: c.review,
    mode: c.mode,
  };
  const sc = c.review.scores;
  const perf = (sc.communication + sc.vocabulary + sc.understanding + sc.confidence) / 4;

  setState((s) => {
    const cards = { ...s.cards };
    // Phrases the learner actually used in conversation reach level 5.
    const spoken = c.learnerTexts.map(normalize).join(' | ');
    for (const card of Object.values(cards)) {
      const p = PHRASE_BY_ID[card.phraseId];
      const es = p?.es ?? card.custom?.es;
      if (!es || card.mastery < 3) continue;
      const key = normalize(es);
      if (key.length >= 6 && spoken.includes(key)) cards[card.phraseId] = markUsed(card, now, 5);
    }
    // New cards from the review.
    for (const nc of c.review.newCards) {
      const id = `custom:${normalize(nc.es).replace(/\s+/g, '_').slice(0, 40)}`;
      if (cards[id]) continue;
      // Skip if an identical curriculum phrase exists; boost that instead.
      const existing = Object.values(PHRASE_BY_ID).find((p) => normalize(p.es) === normalize(nc.es));
      if (existing) {
        if (!cards[existing.id]) cards[existing.id] = { ...newCard(existing.id, now), mastery: 1 };
        continue;
      }
      cards[id] = { ...newCard(id, now, { es: nc.es, en: nc.en, situation: nc.situation, source: c.scenarioId }), mastery: 1 };
    }
    // Mistakes memory.
    const mistakes = [...s.mistakes];
    for (const corr of c.corrections) {
      const k = normalize(corr.better);
      const found = mistakes.find((m) => normalize(m.better) === k);
      if (found) {
        found.count += 1;
        found.at = now.toISOString();
        found.resolved = false;
      } else {
        mistakes.push({ id: `m${now.getTime()}${mistakes.length}`, at: now.toISOString(), original: corr.original, better: corr.better, note: corr.note, count: 1, resolved: false });
      }
    }
    const hist = [...(s.scenarioScores[c.scenarioId] ?? []), perf].slice(-5);
    const next: LearnerState = {
      ...s,
      cards,
      mistakes: mistakes.slice(-60),
      conversations: [...s.conversations, log],
      scenarioScores: { ...s.scenarioScores, [c.scenarioId]: hist },
      skills: {
        ...s.skills,
        conversation: ema(s.skills.conversation, perf, 0.25),
        speaking: ema(s.skills.speaking, (sc.communication + sc.confidence) / 2, 0.15),
        listening: ema(s.skills.listening, sc.understanding, 0.1),
      },
    };
    return touchLog(next, (l) => ({ ...l, conversations: l.conversations + 1, minutesSpoken: l.minutesSpoken + c.minutes }));
  });
  return log;
}

export function completeChallenge(week: number): void {
  setState((s) => (s.completedChallenges.includes(week) ? s : { ...s, completedChallenges: [...s.completedChallenges, week] }));
}

export function resolveMistake(id: string): void {
  setState((s) => ({ ...s, mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, resolved: true } : m)) }));
}

export function saveFinalAssessment(r: FinalAssessmentResult): void {
  setState((s) => ({ ...s, finalAssessment: r }));
}

export function exportState(): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as LearnerState;
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) return false;
    setState(() => ({ ...defaultState(), ...parsed }));
    return true;
  } catch {
    return false;
  }
}

export function resetAll(): void {
  setState(() => defaultState());
}

/** Total minutes spoken / listened across all days. */
export function totals(s: LearnerState) {
  let spoken = 0;
  let listened = 0;
  let days = 0;
  for (const l of Object.values(s.logs)) {
    spoken += l.minutesSpoken;
    listened += l.minutesListened;
    if (l.completed) days++;
  }
  return { spoken, listened, completedDays: days };
}
