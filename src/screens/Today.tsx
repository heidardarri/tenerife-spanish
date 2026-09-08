import { useState } from 'react';
import type { Nav } from '../App';
import { ensurePlan, regeneratePlan, today, useStore } from '../state/store';
import { calendarInfo } from '../engine/calendar';
import { readiness, pct } from '../engine/readiness';
import { Bar } from '../components/common';
import { WEEKS } from '../data/curriculum';
import type { PlannedActivity, ScenarioId } from '../types';

const BUDGETS = [10, 20, 30, 45, 60];

export function Today({ nav }: { nav: Nav }) {
  const state = useStore();
  const key = today();
  const plan = state.plans[key];
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, key);
  const ready = readiness(state);
  const [changing, setChanging] = useState(false);

  if (!plan || changing) {
    return (
      <div className="screen">
        <Header name={state.settings.name} cal={cal} streak={state.streak} />
        <div className="card">
          <h2>How much time do you have today?</h2>
          <p className="muted small">The plan adapts to fit. Even ten minutes keeps you moving and keeps your streak.</p>
          <div className="grid2" style={{ marginTop: 12 }}>
            {BUDGETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`btn ${m === state.settings.defaultMinutes ? 'primary' : ''}`}
                onClick={() => {
                  changing ? regeneratePlan(m) : ensurePlan(m);
                  setChanging(false);
                }}
              >
                {m === 60 ? '60+ min' : `${m} min`}
              </button>
            ))}
          </div>
          {changing && (
            <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setChanging(false)}>
              Keep today's plan
            </button>
          )}
        </div>
        {cal.immersion && !cal.departed && <ImmersionBanner days={cal.daysRemaining} />}
      </div>
    );
  }

  const done = plan.activities.filter((a) => a.done).length;
  const progress = plan.activities.length ? done / plan.activities.length : 0;
  const weekInfo = WEEKS[plan.week - 1];
  const next = plan.activities.find((a) => !a.done);
  const allDone = !next;

  return (
    <div className="screen">
      <Header name={state.settings.name} cal={cal} streak={state.streak} />

      {cal.immersion && !cal.departed && <ImmersionBanner days={cal.daysRemaining} />}

      <div className="card accent">
        <div className="row between">
          <div>
            <div className="small muted">
              Day {plan.dayNumber} · Week {plan.week}: {weekInfo.title}
            </div>
            <h2 style={{ color: '#fff', marginTop: 4 }}>{plan.focus}</h2>
          </div>
          <div className="center">
            <div className="big-number" style={{ fontSize: 30 }}>
              {Math.round(progress * 100)}%
            </div>
          </div>
        </div>
        <Bar value={progress} />
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="small muted">{plan.timeBudget} minutes planned</span>
          <button type="button" className="btn sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => setChanging(true)}>
            Change time
          </button>
        </div>
      </div>

      <p className="small muted" style={{ margin: '0 4px 10px' }}>
        {plan.reason}
      </p>

      <div className="list">
        {plan.activities.map((a, i) => (
          <ActivityRow key={`${a.kind}-${a.ref ?? i}`} a={a} index={i} isNext={a === next} onStart={() => startActivity(nav, a)} />
        ))}
      </div>

      {allDone && (
        <div className="card good" style={{ marginTop: 14, background: 'var(--good-soft)' }}>
          <h3>Done for today 🎉</h3>
          <p className="small">
            Tenerife readiness is now <b>{pct(ready.overall)}</b>. Come back tomorrow; the plan will be waiting.
          </p>
          <button type="button" className="btn good" onClick={() => nav.go('progress')}>
            See progress
          </button>
        </div>
      )}

      {!allDone && next && (
        <button type="button" className="btn primary block lg" style={{ marginTop: 16 }} onClick={() => startActivity(nav, next)}>
          {done === 0 ? 'Start today' : 'Continue'}: {next.title}
        </button>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>🌴 Tenerife readiness</h3>
          <span className="chip sun">{pct(ready.overall)}</span>
        </div>
        <Bar value={ready.overall} className="sun" />
        <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => nav.go('progress')}>
          Details
        </button>
      </div>

      {cal.daysRemaining <= 10 && !cal.departed && (
        <div className="card flat">
          <h3>Final Tenerife simulation</h3>
          <p className="small muted">Ten stations, from the airport to meeting a local. Produces your readiness report and a final revision plan.</p>
          <button type="button" className="btn sun block" onClick={() => nav.start({ kind: 'final' })}>
            {state.finalAssessment ? 'Run it again' : 'Start the simulation'}
          </button>
        </div>
      )}
    </div>
  );
}

function Header({ name, cal, streak }: { name: string; cal: ReturnType<typeof calendarInfo>; streak: number }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  return (
    <div className="screen-header">
      <div>
        <div className="muted small">{greet}, {name}</div>
        <h1>Today's Spanish</h1>
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
        <span className="chip sun">🔥 {streak} day{streak === 1 ? '' : 's'}</span>
        <span className="chip accent">{cal.departed ? 'You are there! 🌴' : `${cal.daysRemaining} days to Tenerife`}</span>
      </div>
    </div>
  );
}

function ImmersionBanner({ days }: { days: number }) {
  return (
    <div className="card" style={{ background: 'var(--sun-soft)' }}>
      <h3>🌋 Tenerife immersion mode</h3>
      <p className="small" style={{ margin: 0 }}>
        {days} day{days === 1 ? '' : 's'} to go. No new grammar or vocabulary. Every session is review, listening and speaking.
      </p>
    </div>
  );
}

const ICONS: Record<PlannedActivity['kind'], string> = {
  flashcards: '🃏',
  phrases: '✨',
  listening: '🎧',
  shadowing: '🔁',
  speaking: '🎙️',
  scenario: '🌴',
  conversation: '💬',
  challenge: '🏆',
  recap: '📝',
};

function ActivityRow({ a, index, isNext, onStart }: { a: PlannedActivity; index: number; isNext: boolean; onStart: () => void }) {
  return (
    <button type="button" className={`item ${a.done ? 'done' : ''}`} onClick={onStart} style={isNext ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="num">{a.done ? '✓' : index + 1}</div>
      <div className="body">
        <div className="title">
          {ICONS[a.kind]} {a.title}
        </div>
        <div className="small muted">{a.detail}</div>
      </div>
      <div className="mins">{a.minutes} min</div>
    </button>
  );
}

export function startActivity(nav: Nav, a: PlannedActivity) {
  switch (a.kind) {
    case 'flashcards':
      return nav.start({ kind: 'flashcards', mode: 'due' });
    case 'phrases':
      return nav.start({ kind: 'phrases', ref: a.ref! });
    case 'listening':
      return nav.start({ kind: 'listening', ref: a.ref! });
    case 'shadowing':
      return nav.start({ kind: 'shadowing', ref: a.ref! });
    case 'speaking':
      return nav.start({ kind: 'speaking', ref: a.ref! });
    case 'scenario':
      return nav.start({ kind: 'scenario', ref: a.ref as ScenarioId });
    case 'conversation':
      return nav.start({ kind: 'conversation', ref: a.ref as ScenarioId });
    case 'challenge':
      return nav.start({ kind: 'challenge', ref: a.ref! });
    case 'recap':
      return nav.start({ kind: 'recap' });
  }
}
