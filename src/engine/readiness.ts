import type { Domain, LearnerState } from '../types';
import { DOMAINS } from '../types';
import { PHRASES } from '../data';
import { SCENARIOS } from '../data/scenarios';

export interface Readiness {
  domains: Record<Domain, number>; // 0..1
  overall: number; // 0..1
}

/**
 * Tenerife readiness per domain:
 *  - 50% phrase mastery for the phrases tagged with the domain (unseen = 0)
 *  - 50% recent scenario performance for scenarios feeding the domain
 * If no scenario has been attempted for a domain, mastery counts 100%,
 * scaled down so that readiness cannot exceed 60% without real conversations.
 * Listening readiness is the rolling listening skill score.
 */
export function readiness(state: LearnerState): Readiness {
  const domains = {} as Record<Domain, number>;
  const cards = state.cards;

  for (const d of DOMAINS) {
    if (d === 'listening') {
      domains[d] = clamp(state.skills.listening);
      continue;
    }
    const phrases = PHRASES.filter((p) => p.domains.includes(d));
    const masterySum = phrases.reduce((s, p) => s + (cards[p.id]?.mastery ?? 0), 0);
    const mastery = phrases.length ? masterySum / (5 * phrases.length) : 0;

    const scenarioIds = SCENARIOS.filter((s) => s.domains.includes(d)).map((s) => s.id);
    const scores: number[] = [];
    for (const id of scenarioIds) {
      const hist = state.scenarioScores[id] ?? [];
      scores.push(...hist.slice(-3));
    }
    if (scores.length === 0) {
      domains[d] = clamp(mastery * 0.6);
    } else {
      const perf = scores.reduce((a, b) => a + b, 0) / scores.length;
      domains[d] = clamp(0.5 * mastery + 0.5 * perf);
    }
  }

  const weights: Partial<Record<Domain, number>> = {
    intro: 1,
    cafe: 1,
    restaurant: 1.2,
    hotel: 1,
    taxi: 1,
    directions: 1,
    recommendations: 0.8,
    problems: 1,
    smalltalk: 1.3,
    past: 0.7,
    future: 0.7,
    listening: 1.2,
  };
  let sum = 0;
  let wsum = 0;
  for (const d of DOMAINS) {
    const w = weights[d] ?? 1;
    sum += domains[d] * w;
    wsum += w;
  }
  return { domains, overall: clamp(sum / wsum) };
}

function clamp(x: number): number {
  return Math.max(0, Math.min(1, isFinite(x) ? x : 0));
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Exponential moving update for a rolling skill score. */
export function ema(prev: number, sample: number, alpha = 0.3): number {
  return clamp(prev * (1 - alpha) + sample * alpha);
}
