import type { Nav } from '../App';
import { useStore, today } from '../state/store';
import { SCENARIOS } from '../data/scenarios';
import { calendarInfo } from '../engine/calendar';
import { sttAvailable } from '../engine/speech';
import type { ScenarioId } from '../types';

const ORDER: ScenarioId[] = ['free', 'beginner', 'restaurant', 'cafe', 'hotel', 'taxi', 'bus', 'directions', 'locals', 'recommendations', 'emergency', 'airport', 'yesterday', 'tomorrow', 'surprise'];

export function Speak({ nav }: { nav: Nav }) {
  const state = useStore();
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, today());
  const hasKey = !!state.settings.apiKey;
  const recent = state.conversations.slice(-3).reverse();

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Speak</h1>
        <span className="chip accent">{state.conversations.length} conversations</span>
      </div>

      <div className={`card ${hasKey ? 'soft' : ''}`} style={hasKey ? undefined : { background: 'var(--sun-soft)' }}>
        <div className="small">
          {hasKey ? (
            <>
              <b>AI partner on.</b> Your partner speaks Spanish, adapts to your level, and reviews every conversation.
            </>
          ) : (
            <>
              <b>Scripted partner.</b> Conversations follow a fixed path. Add an Anthropic API key in Settings for a live partner that understands anything you say.
            </>
          )}
          {!sttAvailable() && ' Your browser cannot hear you, so you will type your lines; say them aloud anyway.'}
        </div>
        {!hasKey && (
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => nav.go('settings')}>
            Settings
          </button>
        )}
      </div>

      <h3>Start conversation</h3>
      <div className="list">
        {ORDER.map((id) => {
          const s = SCENARIOS.find((x) => x.id === id)!;
          const locked = s.minWeek > cal.calendarWeek + 1;
          const hist = state.scenarioScores[s.id] ?? [];
          const last = hist.length ? hist[hist.length - 1] : null;
          return (
            <button key={s.id} type="button" className="item" disabled={locked} style={locked ? { opacity: 0.5 } : undefined} onClick={() => nav.start({ kind: 'conversation', ref: s.id })}>
              <div className="num" style={{ fontSize: 18, background: 'var(--surface-2)' }}>
                {s.emoji}
              </div>
              <div className="body">
                <div className="title">{s.title}</div>
                <div className="small muted">{locked ? `Unlocks in week ${s.minWeek}` : s.description}</div>
              </div>
              <div className="mins">{last !== null ? `${Math.round(last * 100)}%` : `${s.targetMinutes} min`}</div>
            </button>
          );
        })}
      </div>

      {recent.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Recent</h3>
          {recent.map((c) => {
            const s = SCENARIOS.find((x) => x.id === c.scenarioId)!;
            const avg = Object.values(c.review.scores).reduce((a, b) => a + b, 0) / 4;
            return (
              <div key={c.id} className="card flat">
                <div className="row between">
                  <b>
                    {s.emoji} {s.title}
                  </b>
                  <span className="chip">{Math.round(avg * 100)}%</span>
                </div>
                <div className="small muted">
                  {c.minutes.toFixed(1)} min · {c.learnerTurns} turns · {c.mode === 'ai' ? 'AI' : 'scripted'} · {new Date(c.endedAt).toLocaleDateString()}
                </div>
                {c.review.practiceNext[0] && <div className="small">Next: {c.review.practiceNext[0]}</div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
