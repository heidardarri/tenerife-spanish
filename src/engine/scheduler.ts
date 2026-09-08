import type { DailyPlan, LearnerState, PlannedActivity, Scenario } from '../types';
import { LESSONS, LESSON_BY_KEY, lessonKey, lessonsForWeek, listeningForWeek } from '../data';
import { WEEKS } from '../data/curriculum';
import { SCENARIOS } from '../data/scenarios';
import { dueCards, weakCards } from './srs';
import { calendarInfo } from './calendar';
import { readiness } from './readiness';

/**
 * Builds today's plan from: cards due, weak vocabulary, weak skills, the
 * current week's objectives, days remaining and the time budget.
 */
export function buildDailyPlan(state: LearnerState, today: string, timeBudget: number): DailyPlan {
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, today);
  const now = new Date();
  const due = dueCards(state.cards, now).length;
  const weak = weakCards(state.cards).length;
  const skills = state.skills;
  const ready = readiness(state);

  const nextLesson = pickNextLesson(state, cal.calendarWeek);
  const week = nextLesson ? nextLesson.week : cal.calendarWeek;
  const weekInfo = WEEKS[Math.min(WEEKS.length, week) - 1];
  const nextListening = pickNextListening(state, week);
  const scenario = pickScenario(state, week, ready.domains);
  const challengeWeek = pickChallengeWeek(state, week, cal.calendarWeek);
  const challengeDue = challengeWeek !== null;
  const challengeInfo = challengeWeek !== null ? WEEKS[challengeWeek - 1] : weekInfo;

  // Weakest skill drives the emphasis.
  const skillEntries: [keyof typeof skills, number][] = [
    ['listening', skills.listening],
    ['speaking', skills.speaking],
    ['vocabulary', skills.vocabulary],
    ['conversation', skills.conversation],
  ];
  skillEntries.sort((a, b) => a[1] - b[1]);
  const weakest = skillEntries[0][0];
  const hasHistory = Object.keys(state.logs).length >= 3;

  // Base weights (fractions of the time budget).
  let w = { flashcards: 0.15, phrases: 0.22, listening: 0.2, speaking: 0.18, scenario: 0.25 };
  let reason = `Week ${week}: ${weekInfo.title}.`;

  if (cal.immersion) {
    w = { flashcards: 0.22, phrases: 0, listening: 0.3, speaking: 0.13, scenario: 0.35 };
    reason = `Tenerife immersion mode: ${cal.daysRemaining} day${cal.daysRemaining === 1 ? '' : 's'} to go. No new grammar, all conversation, listening and review.`;
  } else if (hasHistory && weakest === 'listening' && skills.listening < 0.55) {
    w = { flashcards: 0.15, phrases: 0.15, listening: 0.35, speaking: 0.15, scenario: 0.2 };
    reason += ' Listening is your weakest skill right now, so today is listening-heavy.';
  } else if (hasHistory && weakest === 'speaking' && skills.speaking < 0.55) {
    w = { flashcards: 0.1, phrases: 0.15, listening: 0.15, speaking: 0.25, scenario: 0.35 };
    reason += ' Speaking needs the most work, so today is speaking-heavy.';
  } else if (hasHistory && weakest === 'conversation' && skills.conversation < 0.55) {
    w = { flashcards: 0.1, phrases: 0.15, listening: 0.15, speaking: 0.15, scenario: 0.45 };
    reason += ' Conversations are the weak spot, so most of today is role-play.';
  } else if (due > 25 || weak > 12) {
    w = { flashcards: 0.28, phrases: 0.15, listening: 0.17, speaking: 0.15, scenario: 0.25 };
    reason += ` You have ${due} cards due and ${weak} weak phrases, so review comes first.`;
  }
  if (!nextLesson) {
    w.scenario += w.phrases;
    w.phrases = 0;
  }
  if (due === 0 && Object.keys(state.cards).length === 0) {
    // Nothing to review yet: give that time to new phrases, or to listening in immersion mode.
    if (cal.immersion) w.listening += w.flashcards;
    else w.phrases += w.flashcards;
    w.flashcards = 0;
  }

  const activities: PlannedActivity[] = [];
  const minutes = (frac: number, min: number) => Math.max(min, Math.round(timeBudget * frac));

  if (timeBudget <= 10) {
    // Ten-minute day: review, listen, speak. Streak survives.
    if (due > 0 || Object.keys(state.cards).length > 0) {
      activities.push(act('flashcards', 3, 'Flashcard review', `${Math.min(due, 8)} cards due`));
    } else if (nextLesson) {
      activities.push(act('phrases', 4, `Learn: ${nextLesson.title}`, `${Math.min(4, nextLesson.phraseIds.length)} new phrases`, lessonKey(nextLesson.week, nextLesson.day)));
    }
    if (nextListening) activities.push(act('shadowing', 3, 'Shadowing', 'Repeat 4 sentences aloud', nextListening.id));
    activities.push(act('speaking', 4, 'Speaking', speakingDetail(state, week), lessonKey(week, nextLesson?.day ?? 1)));
  } else {
    if (w.flashcards > 0) {
      activities.push(act('flashcards', minutes(w.flashcards, 3), 'Flashcard review', due > 0 ? `${due} cards due, ${weak} weak` : 'Warm-up review'));
    }
    if (w.phrases > 0 && nextLesson) {
      const n = timeBudget >= 45 ? nextLesson.phraseIds.length : Math.min(nextLesson.phraseIds.length, timeBudget >= 30 ? 6 : 5);
      activities.push(act('phrases', minutes(w.phrases, 5), `Learn: ${nextLesson.title}`, `${n} new phrases`, lessonKey(nextLesson.week, nextLesson.day)));
    }
    if (nextListening) {
      activities.push(act('listening', minutes(w.listening, 4), `Listening: ${nextListening.title}`, cal.immersion ? 'Natural speed, with shadowing' : 'Three stages, then shadowing', nextListening.id));
    }
    activities.push(act('speaking', minutes(w.speaking, 4), 'Speaking practice', speakingDetail(state, week), lessonKey(week, nextLesson?.day ?? 1)));
    if (challengeDue) {
      activities.push(act('challenge', Math.max(challengeInfo.challenge.targetMinutes, minutes(w.scenario, 5)), `Weekly challenge: ${challengeInfo.challenge.title}`, challengeInfo.challenge.description, String(challengeWeek)));
    } else {
      activities.push(act('scenario', minutes(w.scenario, 5), `Tenerife scenario: ${scenario.title}`, scenario.description, scenario.id));
    }
    if (timeBudget >= 45) activities.push(act('recap', 3, 'Recap', 'Say today\'s six phrases from memory'));
  }

  // Normalise to the budget.
  const total = activities.reduce((s, a) => s + a.minutes, 0);
  if (total !== timeBudget && total > 0) {
    const scale = timeBudget / total;
    let acc = 0;
    activities.forEach((a, i) => {
      a.minutes = i === activities.length - 1 ? Math.max(2, timeBudget - acc) : Math.max(2, Math.round(a.minutes * scale));
      acc += a.minutes;
    });
  }

  const focus = cal.immersion
    ? `Immersion: ${scenario.title}`
    : nextLesson
      ? nextLesson.title
      : weekInfo.title;

  return {
    date: today,
    dayNumber: cal.dayNumber,
    week,
    timeBudget,
    focus,
    reason,
    activities,
    immersion: cal.immersion,
  };
}

function act(kind: PlannedActivity['kind'], minutes: number, title: string, detail: string, ref?: string): PlannedActivity {
  return { kind, minutes, title, detail, ref, done: false };
}

function speakingDetail(state: LearnerState, week: number): string {
  const lesson = lessonsForWeek(week).find((l) => !state.completedLessons.includes(lessonKey(l.week, l.day))) ?? lessonsForWeek(week)[0];
  if (!lesson) return 'Answer questions and describe your day';
  const t = lesson.speakingTask;
  return { repeat: 'Repeat after me', answer: 'Answer the question', describe: 'Describe something', roleplay: 'Guided role-play', free: 'Free speaking' }[t.kind];
}

/** The next lesson: first incomplete lesson in the calendar week, then catch-up, then ahead. */
export function pickNextLesson(state: LearnerState, calendarWeek: number) {
  const done = new Set(state.completedLessons);
  const inWeek = lessonsForWeek(calendarWeek).find((l) => !done.has(lessonKey(l.week, l.day)));
  if (inWeek) return inWeek;
  // Catch up on the most recent unfinished lesson from earlier weeks, but at most
  // one week behind so the learner keeps pace with the trip.
  const behind = LESSONS.filter((l) => l.week < calendarWeek && l.week >= calendarWeek - 1 && !done.has(lessonKey(l.week, l.day)));
  if (behind.length) return behind[0];
  const ahead = LESSONS.find((l) => l.week > calendarWeek && !done.has(lessonKey(l.week, l.day)));
  return ahead ?? null;
}

export function pickNextListening(state: LearnerState, week: number) {
  const done = new Set(state.completedListening);
  for (let w = week; w >= 1; w--) {
    const ex = listeningForWeek(w).find((l) => !done.has(l.id));
    if (ex) return ex;
  }
  for (let w = week + 1; w <= WEEKS.length; w++) {
    const ex = listeningForWeek(w).find((l) => !done.has(l.id));
    if (ex) return ex;
  }
  // Everything done: repeat the least recently done from the current week.
  return listeningForWeek(week)[0] ?? null;
}

/** Pick the scenario for today: weakest readiness domain among unlocked scenarios, weighted to the week's focus. */
export function pickScenario(state: LearnerState, week: number, domains: Record<string, number>): Scenario {
  const weekInfo = WEEKS[week - 1];
  const unlocked = SCENARIOS.filter((s) => s.minWeek <= week && s.id !== 'surprise' && s.id !== 'free');
  const recent = state.conversations.slice(-3).map((c) => c.scenarioId);
  let best: Scenario = unlocked[0] ?? SCENARIOS[0];
  let bestScore = Infinity;
  for (const s of unlocked) {
    const domainScore = s.domains.length ? s.domains.reduce((a, d) => a + (domains[d] ?? 0), 0) / s.domains.length : 0.5;
    const focusBonus = s.domains.some((d) => weekInfo.domains.includes(d)) ? -0.15 : 0;
    const recencyPenalty = recent.includes(s.id) ? 0.2 : 0;
    const score = domainScore + focusBonus + recencyPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** The earliest week (up to the current one) whose challenge is due and not yet passed. */
export function pickChallengeWeek(state: LearnerState, week: number, calendarWeek: number): number | null {
  for (let w = 1; w <= Math.min(WEEKS.length, week); w++) {
    if (isChallengeDue(state, w, calendarWeek)) return w;
  }
  return null;
}

export function isChallengeDue(state: LearnerState, week: number, calendarWeek: number): boolean {
  if (state.completedChallenges.includes(week)) return false;
  const lessons = lessonsForWeek(week);
  const allDone = lessons.every((l) => state.completedLessons.includes(lessonKey(l.week, l.day)));
  // Due when the week's lessons are done, or when the calendar has moved past this week.
  return allDone || calendarWeek > week;
}

export function lessonByKey(key: string) {
  return LESSON_BY_KEY[key];
}
