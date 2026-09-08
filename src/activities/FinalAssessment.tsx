import { useState } from 'react';
import { ActivityShell, Score } from '../components/common';
import { FINAL_ASSESSMENT_STATIONS, SCENARIO_BY_ID } from '../data/scenarios';
import { getState, saveFinalAssessment } from '../state/store';
import { readiness } from '../engine/readiness';
import { masteredCount } from '../engine/srs';
import { DOMAIN_LABELS, type ConversationLog, type FinalAssessmentResult, type ScenarioId } from '../types';
import { PHRASES } from '../data';
import { Conversation } from './Conversation';

const TRAVEL: ScenarioId[] = ['airport', 'taxi', 'hotel', 'cafe', 'restaurant', 'directions', 'recommendations'];
const CONVO: ScenarioId[] = ['locals', 'yesterday', 'tomorrow'];

export function FinalAssessment({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<{ scenarioId: ScenarioId; log: ConversationLog | null }[]>([]);
  const [report, setReport] = useState<FinalAssessmentResult | null>(null);

  const stations = FINAL_ASSESSMENT_STATIONS;

  const finish = (all: { scenarioId: ScenarioId; log: ConversationLog | null }[]) => {
    const s = getState();
    const ready = readiness(s);
    const stationResults = all.map((r) => ({
      scenarioId: r.scenarioId,
      score: r.log ? Object.values(r.log.review.scores).reduce((a, b) => a + b, 0) / 4 : 0,
    }));
    const avgOf = (ids: ScenarioId[], key?: keyof ConversationLog['review']['scores']) => {
      const logs = all.filter((r) => ids.includes(r.scenarioId));
      if (!logs.length) return 0;
      return logs.reduce((acc, r) => acc + (r.log ? (key ? r.log.review.scores[key] : Object.values(r.log.review.scores).reduce((a, b) => a + b, 0) / 4) : 0), 0) / logs.length;
    };
    const allIds = stations;
    const hints = all.reduce((a, r) => a + (r.log?.hintsUsed ?? 0), 0);
    const speaking = clamp(0.5 * avgOf(allIds, 'communication') + 0.5 * avgOf(allIds, 'confidence'));
    const listening = clamp(0.6 * avgOf(allIds, 'understanding') + 0.4 * s.skills.listening);
    const vocabulary = clamp(0.6 * avgOf(allIds, 'vocabulary') + 0.4 * (masteredCount(s.cards, 3) / Math.max(1, PHRASES.length * 0.6)));
    const conversation = clamp(avgOf(CONVO));
    const travel = clamp(avgOf(TRAVEL));
    const confidence = clamp(avgOf(allIds, 'confidence') - Math.min(0.3, hints * 0.02));
    const overall = clamp((speaking * 1.2 + listening * 1.1 + vocabulary + conversation * 1.3 + travel * 1.2 + confidence) / 6.8);

    const candidates: { label: string; score: number; plan: string }[] = [
      { label: 'Speaking', score: speaking, plan: 'Two speaking tasks a day: repeat-after-me for clarity, then a two-minute free talk about your day.' },
      { label: 'Listening', score: listening, plan: 'One natural-speed listening dialogue a day with full shadowing of every line.' },
      { label: 'Vocabulary', score: vocabulary, plan: 'Fifteen minutes of flashcards a day, situation cards only, no multiple choice.' },
      { label: 'Conversation', score: conversation, plan: 'One "Meeting a local" conversation a day, at least ten minutes, Spanish only.' },
      { label: 'Travel situations', score: travel, plan: 'Rotate the weakest travel scenario daily: restaurant, hotel, taxi, directions.' },
      { label: 'Confidence', score: confidence, plan: 'Use Help less: try three sentences before tapping it, and finish every conversation without ending early.' },
    ];
    for (const r of stationResults) {
      const sc = SCENARIO_BY_ID[r.scenarioId];
      candidates.push({ label: `${sc.title} scenario`, score: r.score, plan: `Repeat the ${sc.title.toLowerCase()} scenario twice before departure and reach 70%.` });
    }
    for (const d of ['restaurant', 'hotel', 'taxi', 'directions', 'smalltalk', 'problems'] as const) {
      candidates.push({ label: DOMAIN_LABELS[d], score: ready.domains[d], plan: `Review every ${DOMAIN_LABELS[d].toLowerCase()} phrase and role-play it once more.` });
    }
    candidates.sort((a, b) => a.score - b.score);
    const seen = new Set<string>();
    const weakest = candidates.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true))).slice(0, 3);

    const r: FinalAssessmentResult = {
      at: new Date().toISOString(),
      scores: { speaking, listening, vocabulary, conversation, travel, confidence },
      overall,
      weaknesses: weakest.map((w) => `${w.label}: ${Math.round(w.score * 100)}%`),
      plan: [
        ...weakest.map((w) => w.plan),
        'Every day until departure: 15 min review, 20 min listening, 20-30 min speaking.',
        'On the plane: say your ten key phrases aloud from memory. Then go and talk to someone.',
      ],
      stationResults,
    };
    saveFinalAssessment(r);
    setReport(r);
  };

  if (report) {
    return (
      <ActivityShell title="Tenerife readiness report" onClose={onClose}>
        <div className="card accent">
          <div className="small muted">YOUR TENERIFE READINESS REPORT</div>
          <div className="big-number">{Math.round(report.overall * 100)}%</div>
          <div className="small muted">{report.overall >= 0.8 ? 'Tenerife ready. Go and talk to people.' : report.overall >= 0.6 ? 'Nearly there. Follow the revision plan.' : 'Keep going: the plan below is your priority.'}</div>
        </div>
        <div className="card">
          <h3>Scores</h3>
          <Score label="Speaking" value={report.scores.speaking} />
          <Score label="Listening" value={report.scores.listening} />
          <Score label="Vocabulary" value={report.scores.vocabulary} />
          <Score label="Conversation" value={report.scores.conversation} />
          <Score label="Travel situations" value={report.scores.travel} />
          <Score label="Confidence" value={report.scores.confidence} />
        </div>
        <div className="card">
          <h3>Stations</h3>
          {report.stationResults.map((r) => (
            <Score key={r.scenarioId} label={SCENARIO_BY_ID[r.scenarioId].title} value={r.score} />
          ))}
        </div>
        <div className="card" style={{ background: 'var(--sun-soft)' }}>
          <h3>Top 3 weaknesses</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {report.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h3>Your final revision plan</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {report.plan.map((p) => (
              <li key={p} style={{ marginBottom: 6 }}>
                {p}
              </li>
            ))}
          </ol>
        </div>
        <button type="button" className="btn primary block lg" onClick={onClose}>
          Done
        </button>
      </ActivityShell>
    );
  }

  if (!started) {
    return (
      <ActivityShell title="Final Tenerife simulation" onClose={onClose}>
        <span className="chip sun">🌴 Final assessment</span>
        <h1 style={{ marginTop: 8 }}>The full Tenerife simulation</h1>
        <p className="muted">Ten stations, back to back, like the first day of the trip. Spanish only. Take breaks between stations if you need them. Expect 45 to 60 minutes.</p>
        <div className="card">
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {stations.map((id) => (
              <li key={id} style={{ marginBottom: 4 }}>
                {SCENARIO_BY_ID[id].emoji} {SCENARIO_BY_ID[id].title}
              </li>
            ))}
          </ol>
        </div>
        <div className="card soft small">At the end you get your Tenerife Readiness Report: six scores, your top three weaknesses, and a personalised revision plan for the remaining days.</div>
        <button type="button" className="btn sun block lg" onClick={() => setStarted(true)}>
          Begin at the airport
        </button>
      </ActivityShell>
    );
  }

  const current = stations[idx];
  return (
    <Conversation
      key={current + idx}
      scenarioId={current}
      spanishOnly
      planKind="conversation"
      onClose={onClose}
      embedded={{
        station: idx + 1,
        total: stations.length,
        onComplete: (log) => {
          const all = [...results, { scenarioId: current, log }];
          setResults(all);
          if (idx + 1 < stations.length) setIdx(idx + 1);
          else finish(all);
        },
        onSkip: () => {
          const all = [...results, { scenarioId: current, log: null }];
          setResults(all);
          if (idx + 1 < stations.length) setIdx(idx + 1);
          else finish(all);
        },
      }}
    />
  );
}

function clamp(x: number): number {
  return Math.max(0, Math.min(1, isFinite(x) ? x : 0));
}
