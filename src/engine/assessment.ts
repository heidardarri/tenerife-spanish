import type { LearnerLevel } from '../types';
import { PHRASES } from '../data';
import { normalize, similarity } from './text';

/**
 * Quick placement at onboarding: eight items mixing recognition, listening and
 * production. Result decides the tutor's starting level and pre-seeds cards
 * for phrases the learner already knows.
 */
export type AssessmentItem =
  | { kind: 'recognise'; es: string; options: string[]; answer: number }
  | { kind: 'listen'; es: string; options: string[]; answer: number }
  | { kind: 'produce'; en: string; es: string; alt?: string[] };

export const ASSESSMENT: AssessmentItem[] = [
  { kind: 'recognise', es: 'Buenos días.', options: ['Good morning.', 'Good night.', 'Goodbye.'], answer: 0 },
  { kind: 'recognise', es: '¿Cómo te llamas?', options: ['How are you?', 'What is your name?', 'Where are you from?'], answer: 1 },
  { kind: 'listen', es: '¿Dónde está el baño?', options: ['Where is the bathroom?', 'Where is the beach?', 'How much is it?'], answer: 0 },
  { kind: 'listen', es: 'La cuenta, por favor.', options: ['A table, please.', 'The bill, please.', 'The menu, please.'], answer: 1 },
  { kind: 'produce', en: 'Thank you very much.', es: 'Muchas gracias.', alt: ['gracias'] },
  { kind: 'produce', en: 'I would like a coffee.', es: 'Quiero un café.', alt: ['me gustaría un café', 'un café, por favor', 'quisiera un café'] },
  { kind: 'listen', es: 'Ayer fui a la playa y comí pescado.', options: ['Tomorrow I am going to the beach.', 'Yesterday I went to the beach and ate fish.', 'I like the beach and fish.'], answer: 1 },
  { kind: 'produce', en: 'Can you speak more slowly, please?', es: '¿Puedes hablar más despacio, por favor?', alt: ['más despacio, por favor', 'más despacio'] },
];

export interface AssessmentResult {
  level: LearnerLevel;
  score: number; // 0..1
  knownPhraseIds: string[];
  summary: string;
}

export function scoreAssessment(answers: (number | string)[]): AssessmentResult {
  let points = 0;
  const knownEs: string[] = [];
  ASSESSMENT.forEach((item, i) => {
    const a = answers[i];
    if (item.kind === 'produce') {
      const text = typeof a === 'string' ? a : '';
      const best = Math.max(similarity(text, item.es), ...(item.alt ?? []).map((x) => similarity(text, x)));
      if (best >= 0.75) {
        points += 1.5;
        knownEs.push(item.es);
      } else if (best >= 0.5) points += 0.75;
    } else if (a === item.answer) {
      points += 1;
      knownEs.push(item.es);
    }
  });
  const max = ASSESSMENT.reduce((s, it) => s + (it.kind === 'produce' ? 1.5 : 1), 0);
  const score = points / max;
  const level: LearnerLevel = score < 0.35 ? 'complete-beginner' : score < 0.7 ? 'some-basics' : 'beginner-plus';
  const knownPhraseIds = PHRASES.filter((p) => knownEs.some((k) => normalize(k) === normalize(p.es))).map((p) => p.id);
  const summary = {
    'complete-beginner': 'You are starting from the beginning. Perfect: the course is built for exactly that.',
    'some-basics': 'You already recognise some basics. We will move a little faster through week one.',
    'beginner-plus': 'You know more than you think. Expect the conversation partner to stretch you sooner.',
  }[level];
  return { level, score, knownPhraseIds, summary };
}
