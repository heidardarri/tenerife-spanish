import type { Lesson, ListeningExercise, Phrase } from '../types';
import * as w01 from './content/week01';
import * as w02 from './content/week02';
import * as w03 from './content/week03';
import * as w04 from './content/week04';
import * as w05 from './content/week05';
import * as w06 from './content/week06';
import * as w07 from './content/week07';
import * as w08 from './content/week08';
import * as w09 from './content/week09';
import * as w10 from './content/week10';
import * as w11 from './content/week11';
import * as w12 from './content/week12';
import * as w13 from './content/week13';
import * as w14 from './content/week14';
import * as w15 from './content/week15';

const modules = [w01, w02, w03, w04, w05, w06, w07, w08, w09, w10, w11, w12, w13, w14, w15];

export const PHRASES: Phrase[] = modules.flatMap((m) => m.phrases);
export const LESSONS: Lesson[] = modules
  .flatMap((m) => m.lessons)
  .sort((a, b) => a.week - b.week || a.day - b.day);
export const LISTENING: ListeningExercise[] = modules.flatMap((m) => m.listening);

export const PHRASE_BY_ID: Record<string, Phrase> = Object.fromEntries(PHRASES.map((p) => [p.id, p]));
export const LESSON_BY_KEY: Record<string, Lesson> = Object.fromEntries(
  LESSONS.map((l) => [lessonKey(l.week, l.day), l]),
);
export const LISTENING_BY_ID: Record<string, ListeningExercise> = Object.fromEntries(
  LISTENING.map((l) => [l.id, l]),
);

export function lessonKey(week: number, day: number): string {
  return `w${week}d${day}`;
}

export function lessonsForWeek(week: number): Lesson[] {
  return LESSONS.filter((l) => l.week === week);
}

export function listeningForWeek(week: number): ListeningExercise[] {
  return LISTENING.filter((l) => l.week === week);
}

export function phrasesForLesson(lesson: Lesson): Phrase[] {
  return lesson.phraseIds.map((id) => PHRASE_BY_ID[id]).filter(Boolean);
}
