# Tenerife Spanish 🌴

A personal Spanish coach for one learner and one goal: **confidently talk to locals in Tenerife on 15 December 2026**. Not a generic language app. Every day it decides what to study, keeps the session to the time you have, and refuses to let you finish without speaking.

## What it does

| Area | What you get |
|---|---|
| **Today** | One plan per day, generated every morning from cards due, weak phrases, weak skills, the current week's objectives, days remaining, and how many minutes you have (10 / 20 / 30 / 45 / 60+). Progress bar, streak, days-to-Tenerife, readiness. |
| **Learn** | 15 curriculum weeks (Introductions → Daily life → Restaurants → Getting around → Questions → Past → Future → Hotels → Local food → Meeting locals → Descriptions → Natural listening → Conversation intensive → Tenerife simulations → Final preparation), 72 lessons, **453 phrases**, 35 listening dialogues, 14 progressive pronunciation rules, tiny pattern-based grammar. |
| **Speak** | AI conversation partner for 15 scenarios: free, beginner, restaurant, café, hotel, taxi, bus (guagua), directions, meeting locals, recommendations, emergency, airport, yesterday, tomorrow, surprise. Three-level help (keyword → structure → full phrase), repeat/slower/translate, goal checklist, automatic review with new flashcards. |
| **Review** | Adaptive spaced repetition on complete phrases, five card types (produce, listen, situation, cloze, reverse), weak phrases, mistakes from conversations, grammar patterns that need work. |
| **Progress** | Minutes spoken, minutes listened, phrases mastered, conversations, streak, readiness per situation (Restaurant 82%, Hotel 75% …) and overall Tenerife readiness, plus the final readiness report. |

Also built in: onboarding with a two-minute level check, weekly challenges (2-minute self-introduction … 30-minute Spanish-only conversation), **Tenerife immersion mode** for the last 7 days (no new material, all review/listening/speaking), and the **final ten-station simulation** (airport → taxi → hotel → café → restaurant → directions → recommendations → meeting a local → yesterday → tomorrow) that produces a readiness report with the top three weaknesses and a revision plan.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, open it on your phone via --host
```

Production build: `npm run build` (output in `dist/`, fully static; host anywhere). A GitHub Pages workflow is included at `.github/workflows/deploy.yml`; enable Pages with source "GitHub Actions" once and every push to `main` deploys. On the phone, "Add to Home Screen" gives an app-like full-screen experience.

**Browser:** use Chrome, Edge or Safari. Spanish text-to-speech uses the system voices (install a Spanish voice on your device for the best audio). Speech recognition uses the Web Speech API; where it is missing the app falls back to typing but still asks you to say everything aloud.

### AI conversation partner

Conversations run on Claude (`claude-opus-5`) through your own Anthropic API key, entered in **Settings**. The key is stored only in your browser's localStorage and sent only to `api.anthropic.com`. Without a key every scenario still works with a scripted partner (fixed path, keyword matching, heuristic review), so the whole course is usable offline; the AI partner is what makes conversations open-ended and adaptive.

The partner is instructed to: speak mostly Spanish, match your level (beginner / elementary / intermediate, derived from week and skill scores), ask follow-ups, correct only the single most important mistake and make you reuse it, help without translating everything, and never end the conversation itself. After each conversation it writes the review (did well / practise next / 3-5 new flashcards / four scores) that feeds the next day's plan.

## How the learning system works

- **Phrases, not words.** Every unit is a complete usable sentence with a situation prompt, an optional cloze, an example exchange and a one-line note.
- **Mastery 0-5.** Flashcards can lift a phrase to level 3 (independent recall). Level 4 needs use in a sentence (lesson "use it" step, speaking tasks); level 5 needs use in a real conversation (detected from your transcript).
- **Intervals** 1 → 3 → 7 → 14 → 30 → 60 days, scaled by an ease factor that adapts to your results. Wrong answers come back in 10 minutes. Help lowers the gain; showing the full answer does not count as a recall but is never punished as a mistake.
- **New phrases**: 5-7 a day, each through meaning → audio → repeat → recall → use.
- **Listening**: four stages (listen for meaning → detail questions → transcript with highlights → shadowing). Speed rises from 70% to natural across the course and shadowing grows in the final weeks.
- **Speaking every day**: repeat-after-me, answer-the-question, describe, role-play, free speaking with a timer. There is no click-through path: the lesson, speaking session, scenario and recap all require spoken (or, as a fallback, typed) Spanish.
- **Readiness** per situation = 50% phrase mastery for that situation + 50% recent scenario scores; situations never role-played cap at 60%.
- **Scheduling**: the 15 weeks are fitted to the days available. Lessons progress by completion, so a missed day does not skip content; the calendar only pulls you forward when you fall more than a week behind so you still reach simulations before departure.

## Project layout

```
src/
  data/curriculum.ts      15 weeks, objectives, weekly challenges
  data/content/weekNN.ts  phrases, lessons, listening per week
  data/scenarios.ts       role-play scenarios (AI notes + scripted fallback + hints)
  data/pronunciation.ts   progressive pronunciation rules
  engine/srs.ts           spaced repetition and mastery
  engine/scheduler.ts     daily plan generation
  engine/readiness.ts     Tenerife readiness scores
  engine/tutor.ts         AI partner (Anthropic SDK) and scripted partner
  engine/speech.ts        text-to-speech and speech recognition
  engine/text.ts          accent-insensitive fuzzy grading of answers
  engine/assessment.ts    onboarding level check
  state/store.ts          persisted learner state and all actions
  screens/                Today, Learn, Speak, Review, Progress, Settings, Onboarding
  activities/             flashcards, phrase lesson, listening, speaking, conversation,
                          weekly challenge, final assessment, recap
```

`npm test` runs the engine and content tests (SRS ladder, scheduler, readiness, fuzzy matching, and structural validation of all 453 phrases, lessons, dialogues and scenarios). `npm run smoke` drives the built app through onboarding, a lesson, a conversation and immersion mode in headless Chromium (needs `npm run preview` on port 4173).

All progress lives in the browser; use **Settings → Backup** to export/import it between devices.
