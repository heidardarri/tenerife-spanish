import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { ConversationReview, ConversationTurn, Scenario, Settings } from '../types';
import { containsAny, normalize, wordCount } from './text';

export const MODEL = 'claude-opus-5';

export type TutorLevel = 'beginner' | 'elementary' | 'intermediate';

export interface TutorContext {
  scenario: Scenario;
  level: TutorLevel;
  week: number;
  learner: Pick<Settings, 'name' | 'about'>;
  /** Spanish phrases the learner is weak on; the partner should create chances to use them. */
  weakPhrases: string[];
  /** Phrases learned this week, to be reused in the conversation. */
  recentPhrases: string[];
  recurringMistakes: { original: string; better: string }[];
  spanishOnly: boolean;
  targetMinutes: number;
}

export interface TutorReply {
  es: string;
  en: string;
  correction?: { original: string; better: string; note: string };
  /** Indices of scenario goals now completed. */
  goalsHit: number[];
  ended: boolean;
}

export interface Hint {
  keyword: string;
  structure: string;
  full: string;
}

export interface Tutor {
  mode: 'ai' | 'scripted';
  opening(): TutorReply;
  respond(learnerText: string): Promise<TutorReply>;
  hint(): Promise<Hint>;
  review(turns: ConversationTurn[], hintsUsed: number, minutes: number): Promise<ConversationReview>;
}

// ---------------------------------------------------------------------------
// Scripted partner (no API key)
// ---------------------------------------------------------------------------

export class ScriptedTutor implements Tutor {
  mode = 'scripted' as const;
  private idx = 0;
  private misses = 0;
  private hits = new Set<number>();
  private learnerTexts: string[] = [];
  private missedTurns = 0;

  constructor(private ctx: TutorContext) {}

  private turn() {
    return this.ctx.scenario.scripted[this.idx];
  }

  opening(): TutorReply {
    const t = this.turn();
    if (!t) return { es: this.ctx.scenario.opening.es, en: this.ctx.scenario.opening.en, goalsHit: [], ended: false };
    return { es: t.es, en: t.en, goalsHit: [], ended: false };
  }

  async respond(learnerText: string): Promise<TutorReply> {
    const t = this.turn();
    this.learnerTexts.push(learnerText);
    if (!t) return { es: '¡Muy bien! Hemos terminado. ¡Hasta luego!', en: 'Very good! We are done. See you!', goalsHit: [], ended: true };

    const ok = containsAny(learnerText, t.expectAny) || (t.expectAny.includes('?') && /\?|donde|que|como|cuando|cual|cuanto/.test(normalize(learnerText)));
    const goalsHit: number[] = [];
    let correction: TutorReply['correction'];

    if (ok || this.misses >= 2) {
      if (t.goalIndex !== undefined && ok) {
        this.hits.add(t.goalIndex);
        goalsHit.push(t.goalIndex);
      }
      if (!ok) {
        correction = { original: learnerText, better: t.hint.full, note: 'A natural way to say it. Try to reuse it.' };
        this.missedTurns++;
      }
      this.idx++;
      this.misses = 0;
      const next = this.turn();
      if (!next) {
        return { es: '¡Muy bien! Hemos terminado. ¡Hasta luego!', en: 'Very good! We are done. See you!', correction, goalsHit, ended: true };
      }
      const praise = ok && wordCount(learnerText) >= 3 ? '¡Muy bien! ' : ok ? 'Vale. ' : '';
      return { es: praise + next.es, en: (praise ? 'Very good! ' : '') + next.en, correction, goalsHit, ended: false };
    }

    this.misses++;
    return { es: t.onMiss.es, en: t.onMiss.en, goalsHit, ended: false };
  }

  async hint(): Promise<Hint> {
    const t = this.turn();
    if (!t) return { keyword: 'Say goodbye', structure: 'Hasta ...', full: '¡Hasta luego!' };
    return t.hint;
  }

  async review(turns: ConversationTurn[], hintsUsed: number, minutes: number): Promise<ConversationReview> {
    const learnerTurns = turns.filter((t) => t.role === 'learner');
    const goalsTotal = this.ctx.scenario.goals.length;
    const goalsHit = this.hits.size;
    const words = learnerTurns.reduce((s, t) => s + wordCount(t.es), 0);
    const avgWords = learnerTurns.length ? words / learnerTurns.length : 0;
    const communication = clamp01(goalsTotal ? goalsHit / goalsTotal : learnerTurns.length / 6);
    const vocabulary = clamp01(0.4 + Math.min(0.6, avgWords / 8));
    const understanding = clamp01(1 - this.missedTurns / Math.max(1, learnerTurns.length) - hintsUsed * 0.05);
    const confidence = clamp01(0.5 + Math.min(0.5, minutes / Math.max(1, this.ctx.scenario.targetMinutes)) - hintsUsed * 0.06);

    const didWell: string[] = [];
    if (goalsHit) didWell.push(`Completed ${goalsHit} of ${goalsTotal} goals: ${this.ctx.scenario.goals.filter((_, i) => this.hits.has(i)).join(', ')}`);
    if (learnerTurns.some((t) => /\?/.test(t.es) || /\b(donde|que|como|cuanto|cuando)\b/.test(normalize(t.es)))) didWell.push('Asked questions');
    if (avgWords >= 4) didWell.push('Used full sentences');
    if (hintsUsed === 0 && learnerTurns.length >= 3) didWell.push('No help needed');
    if (!didWell.length) didWell.push('You kept going and finished the conversation');

    const practiceNext = this.ctx.scenario.goals.filter((_, i) => !this.hits.has(i)).map((g) => g);
    const missed = this.ctx.scenario.scripted.filter((t, i) => i < this.idx && t.goalIndex !== undefined && !this.hits.has(t.goalIndex));
    const newCards = missed.slice(0, 5).map((t) => ({ es: t.hint.full, en: englishForHint(t), situation: t.hint.keyword }));
    if (newCards.length < 3) {
      for (const t of this.ctx.scenario.scripted) {
        if (newCards.length >= 3) break;
        if (!newCards.some((c) => c.es === t.hint.full)) newCards.push({ es: t.hint.full, en: englishForHint(t), situation: t.hint.keyword });
      }
    }

    return {
      didWell,
      practiceNext: practiceNext.length ? practiceNext : ['Keep the conversation going for longer next time'],
      newCards,
      scores: { communication, vocabulary, understanding, confidence },
      goalsHit,
      goalsTotal,
    };
  }
}

function englishForHint(t: Scenario['scripted'][number]): string {
  // The hint's full phrase is the learner's line; the keyword describes it in English,
  // often ending in a quoted model ("I am from...").
  const k = t.hint.keyword;
  const quoted = k.match(/"([^"]+)"/);
  const base = quoted ? quoted[1] : k.replace(/^(You want to |Say |Ask |Tell |Give |Order |Report |Confirm |Thank |Hand it over: |Accept and |Suggest |List |Pay and |Repeat |React and )/i, '');
  const cleaned = base.replace(/^(say|ask|that)\s+/i, '').replace(/[:.]\s*$/, '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, isFinite(x) ? x : 0));
}

// ---------------------------------------------------------------------------
// AI partner (Anthropic API, called directly from the browser with the learner's own key)
// ---------------------------------------------------------------------------

const ReplySchema = z.object({
  reply_es: z.string().describe('What you say next, in Spanish. Short. End with a question or an invitation to continue unless the conversation is ending.'),
  reply_en: z.string().describe('Faithful English translation of reply_es, shown only if the learner taps "translate".'),
  correction: z
    .object({
      original: z.string(),
      better: z.string(),
      note_en: z.string().describe('One short English sentence explaining the fix.'),
    })
    .nullable()
    .describe('At most one correction, only for the most important mistake. Null if nothing worth correcting.'),
  goals_completed: z.array(z.number().int()).describe('Zero-based indices of learner goals completed by the learner\'s latest message.'),
  ended: z.boolean().describe('True only if the learner clearly said goodbye or the scenario naturally concluded.'),
});

const HintSchema = z.object({
  keyword: z.string().describe('Level 1 hint in English: what the learner probably wants to say, plus one Spanish keyword. e.g. "You want to ask where something is: dónde..."'),
  structure: z.string().describe('Level 2: the sentence skeleton in Spanish with a gap, e.g. "¿Dónde está ...?"'),
  full: z.string().describe('Level 3: one complete natural Spanish sentence the learner could say right now.'),
});

const ReviewSchema = z.object({
  did_well: z.array(z.string()).describe('2-4 specific things the learner did well, in English, quoting their Spanish where useful.'),
  practice_next: z.array(z.string()).describe('2-4 specific Spanish phrases or patterns to practise next.'),
  new_cards: z
    .array(
      z.object({
        es: z.string().describe('A natural Spanish phrase the learner needed but lacked or got wrong.'),
        en: z.string(),
        situation: z.string().describe('English situation prompt without giving the translation, e.g. "Ask the waiter if the dish is spicy."'),
      }),
    )
    .describe('3 to 5 flashcards generated from mistakes or missing vocabulary.'),
  scores: z.object({
    communication: z.number().min(0).max(1),
    vocabulary: z.number().min(0).max(1),
    understanding: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  goals_hit: z.number().int(),
});

export class AITutor implements Tutor {
  mode = 'ai' as const;
  private client: Anthropic;
  private history: Anthropic.Beta.Messages.BetaMessageParam[] = [];
  private goalsHit = new Set<number>();
  private system: string;

  constructor(
    private ctx: TutorContext,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 60_000 });
    this.system = buildSystemPrompt(ctx);
  }

  opening(): TutorReply {
    const o = this.ctx.scenario.opening;
    const es = o.es === '...' ? '¡Hola! ¿Qué tal?' : o.es;
    const en = o.en === '...' ? 'Hi! How are you?' : o.en;
    this.history.push({ role: 'assistant', content: JSON.stringify({ reply_es: es, reply_en: en, correction: null, goals_completed: [], ended: false }) });
    return { es, en, goalsHit: [], ended: false };
  }

  async respond(learnerText: string): Promise<TutorReply> {
    this.history.push({ role: 'user', content: learnerText });
    const res = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: this.system, cache_control: { type: 'ephemeral' } }],
      messages: this.history,
      output_config: { effort: 'low', format: betaZodOutputFormat(ReplySchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      this.history.pop();
      throw new Error('The conversation partner could not answer that. Try saying it differently.');
    }
    const out = res.parsed_output;
    this.history.push({ role: 'assistant', content: JSON.stringify(out) });
    const goalsHit = out.goals_completed.filter((g) => g >= 0 && g < this.ctx.scenario.goals.length && !this.goalsHit.has(g));
    goalsHit.forEach((g) => this.goalsHit.add(g));
    return {
      es: out.reply_es,
      en: out.reply_en,
      correction: out.correction ? { original: out.correction.original, better: out.correction.better, note: out.correction.note_en } : undefined,
      goalsHit,
      ended: out.ended,
    };
  }

  async hint(): Promise<Hint> {
    const res = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: this.system,
      messages: [
        ...this.history,
        {
          role: 'user',
          content:
            '[HELP REQUEST from the app, not the learner speaking] The learner is stuck and does not know how to reply to your last message. Give three help levels for what they could say next.',
        },
      ],
      output_config: { effort: 'low', format: betaZodOutputFormat(HintSchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (!res.parsed_output) throw new Error('No hint available');
    return res.parsed_output;
  }

  async review(turns: ConversationTurn[], hintsUsed: number, minutes: number): Promise<ConversationReview> {
    const transcript = turns.map((t) => `${t.role === 'ai' ? this.ctx.scenario.aiRole.split(',')[0] : 'Learner'}: ${t.es}`).join('\n');
    const res = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: REVIEW_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Scenario: ${this.ctx.scenario.title}. Learner goals (zero-based): ${this.ctx.scenario.goals.map((g, i) => `${i}. ${g}`).join('; ')}.\nLearner level: ${this.ctx.level}, course week ${this.ctx.week} of 15.\nHelp used ${hintsUsed} times. Conversation lasted ${minutes.toFixed(1)} minutes (target ${this.ctx.targetMinutes}).\nKnown weak phrases: ${this.ctx.weakPhrases.slice(0, 10).join(' | ') || 'none'}.\n\nTranscript:\n${transcript}`,
        },
      ],
      output_config: { effort: 'medium', format: betaZodOutputFormat(ReviewSchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (!res.parsed_output) throw new Error('No review available');
    const o = res.parsed_output;
    return {
      didWell: o.did_well,
      practiceNext: o.practice_next,
      newCards: o.new_cards.slice(0, 5),
      scores: o.scores,
      goalsHit: Math.max(this.goalsHit.size, Math.min(o.goals_hit, this.ctx.scenario.goals.length)),
      goalsTotal: this.ctx.scenario.goals.length,
    };
  }
}

const REVIEW_SYSTEM = `You are a supportive Spanish tutor reviewing a beginner's practice conversation for a trip to Tenerife. Judge communication, not perfection: did the learner get their meaning across and keep the conversation going? Be specific and kind. Scores are 0 to 1 where 0.5 means "got by with effort" and 0.9 means "handled it like a confident traveller". Flashcards must be complete useful phrases in natural Spain Spanish, never single words.`;

export function buildSystemPrompt(ctx: TutorContext): string {
  const { scenario, level, learner } = ctx;
  const levelGuide = {
    beginner:
      'Absolute beginner. Use very short sentences (3-8 words), the most common words only, present tense, one question at a time. Speak as a native would to a friendly foreigner who is just starting: slowly, simply, patiently.',
    elementary:
      'Elementary learner. Short, natural sentences. Present, "voy a" future and simple past (fui, comí, estuve) are fine. One idea per sentence. Introduce an occasional natural expression.',
    intermediate:
      'Low-intermediate learner. Natural everyday Spanish at near-normal speed, longer sentences, natural fillers (bueno, pues, mira), Canarian flavour (guagua, papas, chachi). Fewer explanations.',
  }[level];

  const about = [
    learner.name && `Their name is ${learner.name}.`,
    learner.about.from && `They are from ${learner.about.from}.`,
    learner.about.work && `Work: ${learner.about.work}.`,
    learner.about.hobbies && `Hobbies: ${learner.about.hobbies}.`,
    learner.about.whyTenerife && `Why Tenerife: ${learner.about.whyTenerife}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return `You are a Spanish conversation partner inside a language app. You are role-playing, in Spanish, with a learner who is preparing for a trip to Tenerife on 15 December 2026.

ROLE: You are ${scenario.aiRole}.
SETTING: ${scenario.setting}
LEARNER GOALS for this scenario (zero-based indices): ${scenario.goals.map((g, i) => `${i}. ${g}`).join('; ')}
SCENARIO NOTES: ${scenario.aiNotes}

LEARNER: ${about || 'No details given.'} ${levelGuide}
Weak phrases to create natural chances for them to use: ${ctx.weakPhrases.slice(0, 8).join(' | ') || 'none yet'}.
Phrases they learned recently, reuse them in your own lines so they hear them: ${ctx.recentPhrases.slice(0, 10).join(' | ') || 'none yet'}.
Recurring mistakes to watch for: ${ctx.recurringMistakes.slice(0, 5).map((m) => `"${m.original}" -> "${m.better}"`).join('; ') || 'none yet'}.

HOW TO BEHAVE
- Speak Spanish, as a real person in this situation would. ${ctx.spanishOnly ? 'Spanish only, never English, even if asked.' : 'Only use an English word if the learner is completely lost and asks in English; then give the Spanish and ask them to try it.'}
- Match the learner's level. If they answer in long confident sentences, stretch them a little. If they struggle, simplify.
- Ask natural follow-up questions and keep the conversation moving. Never let it stall; if they give a one-word answer, ask something easy that invites more.
- Do not interrupt or over-correct. Let them communicate. After their message, correct ONLY the single most important mistake, if any, briefly in the "correction" field. Then continue naturally and, when you can, ask something that makes them reuse the corrected phrase.
- If they ask you to repeat or slow down (¿puedes repetir?, más despacio), repeat the same idea more simply and slowly. That counts as good communication, not a mistake.
- If they say something unexpected, respond as a real person would and steer gently back to the scenario.
- Be warm and encouraging. Praise briefly and specifically ("¡Muy bien, perfecto!") without being sugary.
- Keep your reply short: usually one to three sentences.
- Do not translate everything. reply_en is a hidden translation the learner can reveal if stuck.
- goals_completed lists indices of goals the learner has just achieved with their latest message, judged generously (meaning across = achieved).
- Set ended=true only when the learner says goodbye or the scene is clearly over.`;
}

export function levelForWeek(week: number, skills: { speaking: number; conversation: number }): TutorLevel {
  const avg = (skills.speaking + skills.conversation) / 2;
  if (week <= 4 || avg < 0.35) return 'beginner';
  if (week <= 9 || avg < 0.6) return 'elementary';
  return 'intermediate';
}

export function createTutor(ctx: TutorContext, apiKey?: string): Tutor {
  if (apiKey && apiKey.trim().length > 10) return new AITutor(ctx, apiKey.trim());
  return new ScriptedTutor(ctx);
}

/** Quick connectivity/key test used by Settings. */
export async function testApiKey(apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 20_000 });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Reply with exactly: ¡Hola! Listo para practicar.' }],
  });
  const text = res.content.find((b) => b.type === 'text');
  return text && text.type === 'text' ? text.text : 'OK';
}
