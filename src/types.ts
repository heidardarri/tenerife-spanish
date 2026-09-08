// ---------------------------------------------------------------------------
// Shared types for Tenerife Spanish.
// Content files (src/data/*) and the engine (src/engine/*) both depend on these.
// ---------------------------------------------------------------------------

/** Readiness domains. Every phrase and scenario feeds one or more of these. */
export type Domain =
  | 'intro' // introductions, greetings, small talk basics
  | 'cafe'
  | 'restaurant'
  | 'hotel'
  | 'taxi' // taxis and buses
  | 'directions'
  | 'recommendations'
  | 'problems' // emergencies, complaints, asking to repeat / slow down
  | 'smalltalk' // hobbies, work, food, travel, meeting locals
  | 'past' // talking about yesterday / past experiences
  | 'future' // plans
  | 'listening';

export const DOMAINS: Domain[] = [
  'intro',
  'cafe',
  'restaurant',
  'hotel',
  'taxi',
  'directions',
  'recommendations',
  'problems',
  'smalltalk',
  'past',
  'future',
  'listening',
];

export const DOMAIN_LABELS: Record<Domain, string> = {
  intro: 'Introductions',
  cafe: 'Café',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  taxi: 'Taxi & bus',
  directions: 'Directions',
  recommendations: 'Recommendations',
  problems: 'Problems',
  smalltalk: 'Small talk',
  past: 'Talking about the past',
  future: 'Future plans',
  listening: 'Listening',
};

/** One learnable phrase. Phrases, not words, are the unit of learning. */
export interface Phrase {
  /** Stable id, e.g. "w03d2p4" (week 3, lesson day 2, phrase 4). */
  id: string;
  es: string;
  en: string;
  week: number; // 1..15
  day: number; // lesson day within the week, 1..5
  /** Short topic label, e.g. "greetings", "ordering", "numbers". */
  topic: string;
  domains: Domain[];
  /**
   * Situation prompt for scenario recall (card type 3).
   * "You are in a restaurant and want to ask for the bill."
   */
  situation: string;
  /** Sentence completion (card type 4). `text` contains "___" once. */
  cloze?: { text: string; answer: string };
  /** Optional example of the phrase inside a longer exchange. */
  example?: { es: string; en: string };
  /** One-line note: usage, grammar pattern, or pronunciation tip. Keep short. */
  note?: string;
  difficulty: 1 | 2 | 3;
}

export interface GrammarPattern {
  title: string; // "Quiero + action"
  explanation: string; // 1-3 short sentences. No theory.
  patterns: { es: string; en: string }[]; // 3-5 model sentences
}

export interface Lesson {
  week: number;
  day: number;
  title: string; // "Ordering at a café"
  phraseIds: string[]; // 5-8 ids, all belonging to this week/day
  grammar?: GrammarPattern;
  /** Pronunciation focus for this lesson, referencing a rule id from pronunciation.ts */
  pronunciationRuleId?: string;
  /** A short speaking task for the end of the lesson. */
  speakingTask: SpeakingTask;
}

export type SpeakingTaskKind = 'repeat' | 'answer' | 'describe' | 'roleplay' | 'free';

export interface SpeakingTask {
  kind: SpeakingTaskKind;
  /** English instruction shown to the learner. */
  instruction: string;
  /** For 'answer': the Spanish question the AI asks. For 'repeat': the phrase. */
  promptEs?: string;
  promptEn?: string;
  /** Sentence starters offered as help. */
  starters?: string[];
  /** Target speaking seconds for describe/free tasks. */
  targetSeconds?: number;
  /** Keywords that count as a successful attempt (normalised, accent-insensitive). */
  expectAny?: string[];
}

export interface WeeklyChallenge {
  title: string;
  description: string;
  /** How the challenge is run. */
  kind: 'free-speaking' | 'scenario' | 'conversation';
  /** For 'scenario' and 'conversation': which scenario to launch. */
  scenarioId?: ScenarioId;
  /** Minimum speaking/conversation minutes to pass. */
  targetMinutes: number;
}

export interface Week {
  number: number;
  title: string; // "Introductions"
  theme: string; // one sentence
  objectives: string[]; // 3-5 "I can ..." statements
  domains: Domain[]; // readiness domains this week mainly feeds
  challenge: WeeklyChallenge;
}

export interface ListeningLine {
  speaker: string; // "Camarero", "Tú", "Ana"...
  es: string;
  en: string;
}

export interface ListeningQuestion {
  q: string; // English question
  options: string[]; // 3-4 options, English
  answer: number; // index into options
}

export interface ListeningExercise {
  id: string; // "L03-2"
  week: number;
  title: string;
  /** TTS rate 0.6 (very slow) .. 1.0 (natural). */
  rate: number;
  /** One-sentence English description of the situation shown before listening. */
  context: string;
  lines: ListeningLine[];
  /** Stage 1 answer: what is happening, in one English sentence. */
  gist: string;
  /** Stage 1 multiple-choice on the gist. */
  gistOptions: string[];
  gistAnswer: number;
  /** Stage 2 detail questions. */
  questions: ListeningQuestion[];
  /** Spanish phrases worth highlighting in the transcript (exact substrings of lines). */
  keyPhrases: string[];
  domains: Domain[];
}

export interface PronunciationRule {
  id: string; // "vowels", "h", "j", "r", "rr", "n-tilde", "ll-y", "c-z", "g", "qu", "stress"
  title: string;
  rule: string; // simple explanation
  examples: { es: string; hint: string }[]; // "playa" -> "PLAH-yah"
  introducedWeek: number;
}

export type ScenarioId =
  | 'free'
  | 'beginner'
  | 'restaurant'
  | 'cafe'
  | 'hotel'
  | 'taxi'
  | 'bus'
  | 'directions'
  | 'locals'
  | 'recommendations'
  | 'emergency'
  | 'airport'
  | 'yesterday'
  | 'tomorrow'
  | 'surprise';

/**
 * A scripted turn used when no AI key is configured, and as the source of
 * hint text. The scripted partner walks through these in order.
 */
export interface ScriptedTurn {
  /** What the partner says. */
  es: string;
  en: string;
  /** Any of these (normalised) substrings in the learner's reply count as success. */
  expectAny: string[];
  /** Three help levels. */
  hint: { keyword: string; structure: string; full: string };
  /** Partner's reaction when the learner misses; then the partner repeats the question. */
  onMiss: { es: string; en: string };
  /** Which goal this turn checks off. */
  goalIndex?: number;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  emoji: string;
  description: string; // one sentence, English
  /** Learner goals shown as a checklist. */
  goals: string[];
  domains: Domain[];
  /** Who the AI plays. */
  aiRole: string;
  /** Setting, in English, given to the AI. */
  setting: string;
  /** The partner's first line. */
  opening: { es: string; en: string };
  /** Extra instructions for the AI partner specific to this scenario. */
  aiNotes: string;
  scripted: ScriptedTurn[];
  /** Suggested minimum minutes for the conversation. */
  targetMinutes: number;
  /** Minimum recommended week before this scenario is unlocked in Speak. */
  minWeek: number;
}

// ---------------------------------------------------------------------------
// Learner state
// ---------------------------------------------------------------------------

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface CardState {
  phraseId: string;
  mastery: MasteryLevel;
  /** Consecutive correct recalls. Drives the interval ladder. */
  streak: number;
  successes: number;
  mistakes: number;
  /** ISO timestamps. */
  lastReviewed?: string;
  nextReview: string;
  /** Ease multiplier, 1.3 .. 2.5. Adapts intervals to actual performance. */
  ease: number;
  /** Number of times help was used on this card. */
  helpUsed: number;
  /** Cards generated from conversations carry their own text. */
  custom?: { es: string; en: string; situation: string; source: string };
}

export type ActivityKind =
  | 'flashcards'
  | 'phrases'
  | 'listening'
  | 'shadowing'
  | 'speaking'
  | 'scenario'
  | 'conversation'
  | 'challenge'
  | 'recap';

export interface PlannedActivity {
  kind: ActivityKind;
  minutes: number;
  title: string;
  detail: string;
  /** Optional reference: lesson key "w3d2", listening id, scenario id. */
  ref?: string;
  done: boolean;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  dayNumber: number; // days since start, 1-based
  week: number;
  timeBudget: number; // minutes
  focus: string; // "Ordering at a café"
  reason: string; // why the plan looks like this
  activities: PlannedActivity[];
  immersion: boolean;
}

export interface ConversationTurn {
  role: 'ai' | 'learner';
  es: string;
  en?: string;
  correction?: { original: string; better: string; note: string };
  hintLevel?: 0 | 1 | 2 | 3;
  at: string;
}

export interface ConversationReview {
  didWell: string[];
  practiceNext: string[];
  newCards: { es: string; en: string; situation: string }[];
  scores: { communication: number; vocabulary: number; understanding: number; confidence: number };
  goalsHit: number;
  goalsTotal: number;
}

export interface ConversationLog {
  id: string;
  scenarioId: ScenarioId;
  startedAt: string;
  endedAt: string;
  learnerTurns: number;
  minutes: number;
  hintsUsed: number;
  review: ConversationReview;
  mode: 'ai' | 'scripted';
}

export interface MistakeRecord {
  id: string;
  at: string;
  original: string;
  better: string;
  note: string;
  /** How many times this pattern was seen. */
  count: number;
  resolved: boolean;
}

export interface DailyLog {
  date: string;
  minutesSpoken: number;
  minutesListened: number;
  cardsReviewed: number;
  cardsCorrect: number;
  phrasesLearned: number;
  conversations: number;
  completed: boolean; // daily plan finished
  listeningScore?: number; // 0..1 average for the day
}

export interface SkillScores {
  /** Rolling 0..1 estimates. */
  listening: number;
  speaking: number;
  vocabulary: number;
  conversation: number;
}

export interface FinalAssessmentResult {
  at: string;
  scores: {
    speaking: number;
    listening: number;
    vocabulary: number;
    conversation: number;
    travel: number;
    confidence: number;
  };
  overall: number;
  weaknesses: string[];
  plan: string[];
  stationResults: { scenarioId: ScenarioId; score: number }[];
}

export type LearnerLevel = 'complete-beginner' | 'some-basics' | 'beginner-plus';

export interface Settings {
  name: string;
  departureDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  level: LearnerLevel;
  defaultMinutes: number;
  /** Anthropic API key, kept only in this browser's localStorage. */
  apiKey?: string;
  ttsRate: number; // 0.6..1
  /** Learner's own answers used to personalise conversations. */
  about: {
    from: string;
    work: string;
    hobbies: string;
    whyTenerife: string;
  };
}

export interface LearnerState {
  version: number;
  onboarded: boolean;
  settings: Settings;
  cards: Record<string, CardState>;
  completedLessons: string[]; // "w1d1"
  completedListening: string[];
  completedChallenges: number[]; // week numbers
  plans: Record<string, DailyPlan>; // by date
  logs: Record<string, DailyLog>;
  conversations: ConversationLog[];
  mistakes: MistakeRecord[];
  skills: SkillScores;
  /** Scenario performance history: scenarioId -> last scores (0..1). */
  scenarioScores: Partial<Record<ScenarioId, number[]>>;
  finalAssessment?: FinalAssessmentResult;
  streak: number;
  lastActiveDate?: string;
}
