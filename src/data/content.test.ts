import { describe, expect, it } from 'vitest';
import { LESSONS, LISTENING, PHRASES, PHRASE_BY_ID, lessonsForWeek, listeningForWeek } from './index';
import { LESSONS_PER_WEEK, WEEKS } from './curriculum';
import { PRONUNCIATION_RULES } from './pronunciation';
import { SCENARIOS, SCENARIO_BY_ID, FINAL_ASSESSMENT_STATIONS } from './scenarios';
import { DOMAINS } from '../types';
import { normalize } from '../engine/text';

describe('curriculum content', () => {
  it('has unique phrase ids that match their lesson', () => {
    const ids = new Set<string>();
    for (const p of PHRASES) {
      expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(p.id).toMatch(/^w\d{2}d\d+p\d+$/);
      expect(p.es.trim().length).toBeGreaterThan(1);
      expect(p.en.trim().length).toBeGreaterThan(1);
      expect(p.situation.trim().length).toBeGreaterThan(5);
      for (const d of p.domains) expect(DOMAINS).toContain(d);
      if (p.cloze) {
        expect(p.cloze.text.split('___').length, `cloze in ${p.id}`).toBe(2);
        expect(normalize(p.cloze.text.replace('___', p.cloze.answer))).toBe(normalize(p.es));
      }
    }
  });

  it('has the expected number of lessons per week, each with 5-8 phrases and a speaking task', () => {
    for (const w of WEEKS) {
      const lessons = lessonsForWeek(w.number);
      expect(lessons.length, `week ${w.number}`).toBe(LESSONS_PER_WEEK[w.number]);
      for (const l of lessons) {
        expect(l.phraseIds.length).toBeGreaterThanOrEqual(5);
        expect(l.phraseIds.length).toBeLessThanOrEqual(8);
        for (const id of l.phraseIds) {
          const p = PHRASE_BY_ID[id];
          expect(p, `missing ${id}`).toBeDefined();
          expect(p.week).toBe(l.week);
          expect(p.day).toBe(l.day);
        }
        expect(l.speakingTask.instruction.length).toBeGreaterThan(5);
        if (l.pronunciationRuleId) expect(PRONUNCIATION_RULES.some((r) => r.id === l.pronunciationRuleId), l.pronunciationRuleId).toBe(true);
      }
      expect(listeningForWeek(w.number).length).toBeGreaterThanOrEqual(2);
    }
    expect(LESSONS.length).toBe(Object.values(LESSONS_PER_WEEK).reduce((a, b) => a + b, 0));
    expect(PHRASES.length).toBeGreaterThan(400);
  });

  it('listening exercises are internally consistent', () => {
    const ids = new Set<string>();
    for (const ex of LISTENING) {
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
      expect(ex.lines.length).toBeGreaterThanOrEqual(4);
      expect(ex.gistOptions.length).toBeGreaterThanOrEqual(3);
      expect(ex.gistAnswer).toBeLessThan(ex.gistOptions.length);
      expect(ex.questions.length).toBeGreaterThanOrEqual(3);
      for (const q of ex.questions) expect(q.answer).toBeLessThan(q.options.length);
      expect(ex.rate).toBeGreaterThanOrEqual(0.6);
      expect(ex.rate).toBeLessThanOrEqual(1);
      const text = ex.lines.map((l) => l.es).join('\n');
      for (const k of ex.keyPhrases) expect(text.includes(k), `${ex.id}: "${k}"`).toBe(true);
    }
  });

  it('scenarios cover every domain and the final assessment stations exist', () => {
    const covered = new Set(SCENARIOS.flatMap((s) => s.domains));
    for (const d of DOMAINS.filter((d) => d !== 'listening')) expect(covered.has(d), d).toBe(true);
    for (const id of FINAL_ASSESSMENT_STATIONS) expect(SCENARIO_BY_ID[id]).toBeDefined();
    for (const s of SCENARIOS) {
      if (s.id === 'surprise') continue;
      expect(s.scripted.length).toBeGreaterThanOrEqual(5);
      for (const t of s.scripted) {
        expect(t.expectAny.length).toBeGreaterThan(0);
        expect(t.hint.full.length).toBeGreaterThan(3);
        if (t.goalIndex !== undefined) expect(t.goalIndex).toBeLessThan(s.goals.length);
      }
      const goalsCovered = new Set(s.scripted.map((t) => t.goalIndex).filter((g) => g !== undefined));
      expect(goalsCovered.size, `${s.id} goals`).toBeGreaterThanOrEqual(Math.min(3, s.goals.length));
    }
    for (const w of WEEKS) if (w.challenge.scenarioId) expect(SCENARIO_BY_ID[w.challenge.scenarioId]).toBeDefined();
  });

  it('every readiness domain has phrases feeding it', () => {
    for (const d of DOMAINS.filter((d) => d !== 'listening')) {
      expect(PHRASES.filter((p) => p.domains.includes(d)).length, d).toBeGreaterThanOrEqual(10);
    }
  });
});
