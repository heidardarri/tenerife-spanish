import type { Week } from '../types';

/**
 * The 15-week course. Weeks are stretched or compressed over the days that
 * remain until departure (see engine/calendar.ts), so "week" here means a
 * curriculum unit rather than seven calendar days.
 */
export const WEEKS: Week[] = [
  {
    number: 1,
    title: 'Introductions',
    theme: 'Say hello, say who you are, and survive the first thirty seconds with anyone.',
    objectives: [
      'I can greet people at any time of day',
      'I can say my name, where I am from and why I am here',
      'I can say I do not understand and ask someone to repeat',
      'I can count to twenty and say thank you and please',
    ],
    domains: ['intro', 'problems'],
    challenge: {
      title: 'Introduce yourself for 2 minutes',
      description:
        'Speak for two minutes about yourself: name, where you are from, what you do, why you are going to Tenerife. Sentence starters are allowed, reading a script is not.',
      kind: 'free-speaking',
      targetMinutes: 2,
    },
  },
  {
    number: 2,
    title: 'Daily life',
    theme: 'Talk about your day, your work and what you like, using "quiero", "me gusta" and "tengo".',
    objectives: [
      'I can say what I like and do not like',
      'I can describe my daily routine in three or four sentences',
      'I can say what I want using "quiero"',
      'I can understand simple questions about my life',
    ],
    domains: ['smalltalk', 'intro'],
    challenge: {
      title: 'Describe your day',
      description: 'Describe a normal day in your life in Spanish for two minutes, then answer three follow-up questions.',
      kind: 'free-speaking',
      targetMinutes: 2,
    },
  },
  {
    number: 3,
    title: 'Restaurants and cafés',
    theme: 'Order food and drink, ask what things are, and get the bill.',
    objectives: [
      'I can order a drink and a meal politely',
      'I can ask what a dish is and ask for a recommendation',
      'I can ask for the bill and pay',
      'I can understand a waiter asking simple questions',
    ],
    domains: ['cafe', 'restaurant', 'recommendations'],
    challenge: {
      title: 'Complete a restaurant interaction',
      description: 'Greet, get a table, order, ask one question about the food, and pay. Spanish only.',
      kind: 'scenario',
      scenarioId: 'restaurant',
      targetMinutes: 5,
    },
  },
  {
    number: 4,
    title: 'Getting around',
    theme: 'Taxis, buses (guaguas), directions and places in town.',
    objectives: [
      'I can tell a taxi driver where I am going and ask the price',
      'I can ask which bus goes somewhere and where to get off',
      'I can ask where something is and understand left, right, straight on',
      'I can ask how long something takes',
    ],
    domains: ['taxi', 'directions'],
    challenge: {
      title: 'Get from the airport to the hotel',
      description: 'Find the taxi rank, tell the driver your hotel, ask the price and the time, and make small talk on the way.',
      kind: 'scenario',
      scenarioId: 'airport',
      targetMinutes: 5,
    },
  },
  {
    number: 5,
    title: 'Questions',
    theme: 'Ask for anything with the question words, and keep asking when you do not understand.',
    objectives: [
      'I can ask who, what, where, when, how and how much',
      'I can ask for help, for a repeat and for slower speech',
      'I can ask permission and ask if something is possible',
      'I can ask a local about their town',
    ],
    domains: ['problems', 'recommendations', 'smalltalk'],
    challenge: {
      title: 'Twenty questions',
      description: 'Have a conversation where you ask at least ten different questions and understand the answers.',
      kind: 'conversation',
      scenarioId: 'locals',
      targetMinutes: 8,
    },
  },
  {
    number: 6,
    title: 'Talking about the past',
    theme: 'Say what you did yesterday and what you have visited, with a handful of past-tense verbs.',
    objectives: [
      'I can say what I did yesterday and last weekend',
      'I can say where I went and what I ate',
      'I can say whether I liked something',
      'I can ask someone what they did',
    ],
    domains: ['past', 'smalltalk'],
    challenge: {
      title: 'Tell a story about yesterday',
      description: 'Tell the story of your day yesterday for two minutes: where you went, what you ate, what you liked.',
      kind: 'free-speaking',
      targetMinutes: 2,
    },
  },
  {
    number: 7,
    title: 'Future plans',
    theme: 'Talk about tomorrow and the trip with "voy a" and "quiero".',
    objectives: [
      'I can say what I am going to do tomorrow',
      'I can explain my plans for the trip',
      'I can make a plan with someone: when, where, at what time',
      'I can say what I hope to see',
    ],
    domains: ['future', 'smalltalk'],
    challenge: {
      title: 'Explain your Tenerife plans',
      description: 'Explain your plans for the trip to a local for three minutes and answer their questions about it.',
      kind: 'conversation',
      scenarioId: 'tomorrow',
      targetMinutes: 3,
    },
  },
  {
    number: 8,
    title: 'Hotels and accommodation',
    theme: 'Check in, ask about breakfast and wifi, and get problems fixed.',
    objectives: [
      'I can check in and give my name and reservation details',
      'I can ask about breakfast, wifi, towels and checkout',
      'I can report a problem with the room',
      'I can ask the reception for help and recommendations',
    ],
    domains: ['hotel', 'problems'],
    challenge: {
      title: 'Hotel check-in with a problem',
      description: 'Check in, ask about breakfast, and report a problem with the room until it is resolved.',
      kind: 'scenario',
      scenarioId: 'hotel',
      targetMinutes: 5,
    },
  },
  {
    number: 9,
    title: 'Local food',
    theme: 'Canarian dishes, markets and shops: papas arrugadas, mojo, gofio and more.',
    objectives: [
      'I can name Canarian dishes and ask what is in them',
      'I can buy things in a shop or market and understand prices',
      'I can say what I want to try and give an opinion on food',
      'I can handle allergies and preferences',
    ],
    domains: ['restaurant', 'recommendations', 'smalltalk'],
    challenge: {
      title: 'Order a full Canarian meal',
      description: 'In a restaurant, ask about three local dishes, order a full meal with drinks, and give your opinion at the end.',
      kind: 'scenario',
      scenarioId: 'restaurant',
      targetMinutes: 6,
    },
  },
  {
    number: 10,
    title: 'Meeting locals',
    theme: 'Start, keep and end a conversation with someone you just met.',
    objectives: [
      'I can start a conversation with a stranger politely',
      'I can react to what people say and ask follow-up questions',
      'I can talk about hobbies, work and travel for ten minutes',
      'I can end a conversation and say goodbye warmly',
    ],
    domains: ['smalltalk', 'intro'],
    challenge: {
      title: 'A 20-minute conversation',
      description: 'Keep a conversation with a local going for twenty minutes. Ask questions, react, and use help only when stuck.',
      kind: 'conversation',
      scenarioId: 'locals',
      targetMinutes: 20,
    },
  },
  {
    number: 11,
    title: 'Descriptions',
    theme: 'Describe places, people, weather and how you feel.',
    objectives: [
      'I can describe a place: big, beautiful, quiet, crowded',
      'I can say how I feel and how the weather is',
      'I can describe people and things I have lost',
      'I can compare two things',
    ],
    domains: ['smalltalk', 'problems', 'directions'],
    challenge: {
      title: 'Describe Tenerife',
      description: 'Describe three places you want to visit in Tenerife and compare them, speaking for three minutes.',
      kind: 'free-speaking',
      targetMinutes: 3,
    },
  },
  {
    number: 12,
    title: 'Natural listening',
    theme: 'Faster, more natural Spanish with Canarian flavour; shadowing becomes daily.',
    objectives: [
      'I can follow a conversation at near-natural speed',
      'I can recognise Canarian words like guagua and papas',
      'I can catch the key information in an announcement',
      'I can shadow a full sentence without reading it',
    ],
    domains: ['listening'],
    challenge: {
      title: 'Listen and respond',
      description: 'Complete a conversation where the partner speaks at natural speed, asking for a repeat no more than twice.',
      kind: 'conversation',
      scenarioId: 'surprise',
      targetMinutes: 8,
    },
  },
  {
    number: 13,
    title: 'Conversation intensive',
    theme: 'Long conversations. Fewer new phrases, far more speaking.',
    objectives: [
      'I can keep a conversation alive for thirty minutes',
      'I can recover when I make a mistake and keep going',
      'I can change topic and ask about the other person',
      'I can tell a short story with beginning, middle and end',
    ],
    domains: ['smalltalk', 'past', 'future'],
    challenge: {
      title: 'A 30-minute Spanish-only conversation',
      description: 'Thirty minutes of conversation, Spanish only, no translations shown.',
      kind: 'conversation',
      scenarioId: 'free',
      targetMinutes: 30,
    },
  },
  {
    number: 14,
    title: 'Tenerife simulations',
    theme: 'Every scenario, back to back, with unexpected twists.',
    objectives: [
      'I can handle every travel scenario without help',
      'I can deal with a problem in a shop, hotel or taxi',
      'I can ask for and understand recommendations',
      'I can react to the unexpected and still communicate',
    ],
    domains: ['restaurant', 'hotel', 'taxi', 'directions', 'problems', 'recommendations'],
    challenge: {
      title: 'Emergency and problems',
      description: 'Handle an unexpected problem from start to finish: explain it, understand the options, and resolve it.',
      kind: 'scenario',
      scenarioId: 'emergency',
      targetMinutes: 6,
    },
  },
  {
    number: 15,
    title: 'Final preparation',
    theme: 'Immersion mode. Review, listen, speak. Then the final Tenerife simulation.',
    objectives: [
      'I can start a conversation with anyone in Tenerife',
      'I can recall my key phrases automatically',
      'I can understand slower natural Spanish',
      'I keep communicating even when I make mistakes',
    ],
    domains: ['intro', 'cafe', 'restaurant', 'hotel', 'taxi', 'directions', 'smalltalk', 'past', 'future'],
    challenge: {
      title: 'Final Tenerife simulation',
      description: 'The full ten-station simulation, from airport to meeting a local. Produces your Tenerife Readiness Report.',
      kind: 'conversation',
      scenarioId: 'airport',
      targetMinutes: 30,
    },
  },
];

export const TOTAL_WEEKS = WEEKS.length;

/** Number of new-phrase lessons in each week. Later weeks shift to speaking and listening. */
export const LESSONS_PER_WEEK: Record<number, number> = {
  1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5, 12: 4, 13: 4, 14: 3, 15: 3,
};
