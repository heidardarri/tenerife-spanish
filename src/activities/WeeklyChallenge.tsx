import { useState } from 'react';
import type { Activity } from '../App';
import { ActivityShell } from '../components/common';
import { WEEKS } from '../data/curriculum';
import { lessonsForWeek, phrasesForLesson } from '../data';
import { completeChallenge, markActivityDone, recordSpeaking } from '../state/store';
import { SpeakingTaskView, type SpeakingResult } from './SpeakingSession';

export function WeeklyChallenge({ week, onClose, start }: { week: number; onClose: () => void; start: (a: Activity) => void }) {
  const w = WEEKS[week - 1];
  const [result, setResult] = useState<SpeakingResult | null>(null);
  const [running, setRunning] = useState(false);

  if (!w) {
    return (
      <ActivityShell title="Challenge" onClose={onClose}>
        <p>Week not found.</p>
      </ActivityShell>
    );
  }
  const c = w.challenge;
  const phrases = lessonsForWeek(week).flatMap((l) => phrasesForLesson(l));

  if (c.kind !== 'free-speaking') {
    return (
      <ActivityShell title={`Week ${week} challenge`} onClose={onClose}>
        <span className="chip sun">🏆 Weekly challenge</span>
        <h1 style={{ marginTop: 8 }}>{c.title}</h1>
        <p>{c.description}</p>
        <div className="card soft small">
          This is a real conversation, not a quiz. It passes when you keep going for at least {Math.round(c.targetMinutes * 0.8)} minutes with a score over 45%. {week >= 13 ? 'Spanish only: no translations.' : ''}
        </div>
        <button
          type="button"
          className="btn sun block lg"
          onClick={() => start({ kind: 'conversation', ref: c.scenarioId!, challengeWeek: week, targetMinutes: c.targetMinutes, spanishOnly: week >= 13 })}
        >
          Start the challenge
        </button>
      </ActivityShell>
    );
  }

  if (result) {
    const passed = result.seconds >= c.targetMinutes * 60 * 0.75 && result.quality >= 0.45;
    return (
      <ActivityShell title={`Week ${week} challenge`} onClose={onClose}>
        <div className="card center">
          <div style={{ fontSize: 48 }}>{passed ? '🏆' : '💪'}</div>
          <h2>{passed ? 'Challenge passed' : 'Not yet'}</h2>
          <p className="muted">
            {Math.round(result.seconds / 60 * 10) / 10} minutes · {Math.round(result.quality * 100)}% quality.
            {!passed && ` Aim for ${c.targetMinutes} minutes of continuous speaking. Try again tomorrow.`}
          </p>
          <button type="button" className="btn primary block" onClick={onClose}>
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  if (!running) {
    return (
      <ActivityShell title={`Week ${week} challenge`} onClose={onClose}>
        <span className="chip sun">🏆 Weekly challenge</span>
        <h1 style={{ marginTop: 8 }}>{c.title}</h1>
        <p>{c.description}</p>
        <div className="card">
          <h3>Phrases you could use</h3>
          <div className="small">{phrases.slice(0, 10).map((p) => p.es).join(' · ')}</div>
        </div>
        <button type="button" className="btn sun block lg" onClick={() => setRunning(true)}>
          Start speaking ({c.targetMinutes} min)
        </button>
      </ActivityShell>
    );
  }

  return (
    <ActivityShell title={`Week ${week} challenge`} onClose={onClose}>
      <SpeakingTaskView
        task={{ kind: 'free', instruction: c.description, targetSeconds: c.targetMinutes * 60, starters: phrases.slice(0, 6).map((p) => p.es) }}
        lessonPhrases={phrases}
        onDone={(r) => {
          recordSpeaking(r.seconds / 60, r.quality);
          markActivityDone('challenge', String(week));
          if (r.seconds >= c.targetMinutes * 60 * 0.75 && r.quality >= 0.45) completeChallenge(week);
          setResult(r);
        }}
      />
    </ActivityShell>
  );
}
