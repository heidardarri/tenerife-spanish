import type { PronunciationRule } from '../types';

/** Introduced progressively. Goal: be understood, not sound native. */
export const PRONUNCIATION_RULES: PronunciationRule[] = [
  {
    id: 'vowels',
    title: 'The five vowels never change',
    rule: 'A = ah, E = eh, I = ee, O = oh, U = oo. Every vowel is short and clear, always the same sound.',
    examples: [
      { es: 'playa', hint: 'PLAH-yah' },
      { es: 'café', hint: 'kah-FEH' },
      { es: 'Tenerife', hint: 'teh-neh-REE-feh' },
      { es: 'uno', hint: 'OO-noh' },
    ],
    introducedWeek: 1,
  },
  {
    id: 'h',
    title: 'H is silent',
    rule: 'Never pronounce the letter H. "Hola" starts with the O sound.',
    examples: [
      { es: 'hola', hint: 'OH-lah' },
      { es: 'hotel', hint: 'oh-TEL' },
      { es: 'hasta luego', hint: 'AHS-tah LWEH-goh' },
    ],
    introducedWeek: 1,
  },
  {
    id: 'stress',
    title: 'Where the stress goes',
    rule: 'An accent mark tells you which syllable to stress. Without one, stress the second-to-last syllable if the word ends in a vowel, n or s; otherwise the last.',
    examples: [
      { es: 'gracias', hint: 'GRAH-thyas' },
      { es: 'está', hint: 'es-TAH' },
      { es: 'hablar', hint: 'ah-BLAR' },
    ],
    introducedWeek: 2,
  },
  {
    id: 'j-g',
    title: 'J (and G before E or I) is a breathy H',
    rule: 'Say J like the H in "hot", but stronger, from the back of the throat. In the Canaries it is softer than in Madrid.',
    examples: [
      { es: 'jamón', hint: 'hah-MON' },
      { es: 'gente', hint: 'HEN-teh' },
      { es: 'jugo', hint: 'HOO-goh' },
    ],
    introducedWeek: 2,
  },
  {
    id: 'n-tilde',
    title: 'Ñ is "ny"',
    rule: 'Ñ sounds like the "ny" in "canyon".',
    examples: [
      { es: 'mañana', hint: 'mah-NYAH-nah' },
      { es: 'español', hint: 'es-pah-NYOL' },
      { es: 'baño', hint: 'BAH-nyoh' },
    ],
    introducedWeek: 3,
  },
  {
    id: 'll-y',
    title: 'LL and Y sound the same',
    rule: 'Both sound like the Y in "yes".',
    examples: [
      { es: 'paella', hint: 'pah-EH-yah' },
      { es: 'calle', hint: 'KAH-yeh' },
      { es: 'playa', hint: 'PLAH-yah' },
    ],
    introducedWeek: 3,
  },
  {
    id: 'c-z',
    title: 'C, Z and S in the Canaries',
    rule: 'In Tenerife, Z and soft C (before E or I) sound like S, as in Latin America. "Gracias" is GRAH-syas. Mainland speakers use a "th" sound; both are understood.',
    examples: [
      { es: 'gracias', hint: 'GRAH-syas' },
      { es: 'cerveza', hint: 'ser-VEH-sah' },
      { es: 'plaza', hint: 'PLAH-sah' },
    ],
    introducedWeek: 4,
  },
  {
    id: 'r',
    title: 'Single R is a quick tap',
    rule: 'Tap the tip of your tongue once behind your top teeth, like the "tt" in the American "butter".',
    examples: [
      { es: 'pero', hint: 'PEH-roh' },
      { es: 'caro', hint: 'KAH-roh' },
      { es: 'para', hint: 'PAH-rah' },
    ],
    introducedWeek: 4,
  },
  {
    id: 'rr',
    title: 'RR (and R at the start) rolls',
    rule: 'Try to roll it. If you cannot, a strong single tap is fine. People will understand you.',
    examples: [
      { es: 'perro', hint: 'PEH-rroh (dog) vs pero (but)' },
      { es: 'arroz', hint: 'ah-RROS' },
      { es: 'restaurante', hint: 'rres-tow-RAHN-teh' },
    ],
    introducedWeek: 5,
  },
  {
    id: 'qu-gu',
    title: 'QU is K, GU before E/I is G',
    rule: 'The U is silent in "que", "qui", "gue", "gui".',
    examples: [
      { es: 'quiero', hint: 'KYEH-roh' },
      { es: 'queso', hint: 'KEH-soh' },
      { es: 'guagua', hint: 'GWAH-gwah (here the U is heard: gua)' },
    ],
    introducedWeek: 5,
  },
  {
    id: 'v-b',
    title: 'V sounds like B',
    rule: 'V and B are the same soft sound in Spanish. "Vino" is BEE-noh.',
    examples: [
      { es: 'vino', hint: 'BEE-noh' },
      { es: 'vale', hint: 'BAH-leh' },
      { es: 'bueno', hint: 'BWEH-noh' },
    ],
    introducedWeek: 6,
  },
  {
    id: 'd-soft',
    title: 'D between vowels is soft',
    rule: 'Between vowels D is like the "th" in "this". At the end of a word it almost disappears, especially in the Canaries.',
    examples: [
      { es: 'cansado', hint: 'kan-SAH-thoh' },
      { es: 'usted', hint: 'oos-TEH' },
      { es: 'nada', hint: 'NAH-thah' },
    ],
    introducedWeek: 7,
  },
  {
    id: 'canarian-s',
    title: 'The Canarian S',
    rule: 'Locals often soften the S at the end of syllables into a light H: "los dos" sounds like "loh doh". You do not need to copy it, just recognise it when listening.',
    examples: [
      { es: 'las papas', hint: 'lah PAH-pah' },
      { es: 'buenas', hint: 'BWEH-nah' },
      { es: 'gracias', hint: 'GRAH-syah' },
    ],
    introducedWeek: 9,
  },
  {
    id: 'linking',
    title: 'Words run together',
    rule: 'Spanish links words: "¿Cómo estás?" sounds like "co-moes-TAS". Shadowing whole sentences trains this better than any rule.',
    examples: [
      { es: '¿Cómo estás?', hint: 'KOH-moh-es-TAS' },
      { es: 'un momento', hint: 'oon-moh-MEN-toh' },
      { es: 'de acuerdo', hint: 'deh-ah-KWER-doh' },
    ],
    introducedWeek: 12,
  },
];
