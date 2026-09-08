import type { Nav } from '../App';
import { totals, useStore, today } from '../state/store';
import { readiness, pct } from '../engine/readiness';
import { masteredCount } from '../engine/srs';
import { Bar, Score } from '../components/common';
import { DOMAINS, DOMAIN_LABELS } from '../types';
import { calendarInfo } from '../engine/calendar';
import { WEEKS } from '../data/curriculum';

export function Progress({ nav }: { nav: Nav }) {
  const state = useStore();
  const ready = readiness(state);
  const t = totals(state);
  const mastered = masteredCount(state.cards, 3);
  const fluent = masteredCount(state.cards, 5);
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, today());
  const target = 0.85;
  const last14 = Object.values(state.logs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Progress</h1>
        <button type="button" className="btn sm" onClick={() => nav.go('settings')}>
          ⚙️
        </button>
      </div>

      <div className="card accent">
        <div className="row between">
          <div>
            <div className="small muted">🌴 Tenerife readiness</div>
            <div className="big-number">{pct(ready.overall)}</div>
            <div className="small muted">Goal: {pct(target)} before {state.settings.departureDate}</div>
          </div>
          <div className="center">
            <div className="big-number" style={{ fontSize: 28 }}>
              {cal.daysRemaining}
            </div>
            <div className="small muted">days left</div>
          </div>
        </div>
        <Bar value={ready.overall / target} />
      </div>

      <div className="grid2">
        <div className="stat">
          <div className="v">🔥 {state.streak}</div>
          <div className="k">Day streak</div>
        </div>
        <div className="stat">
          <div className="v">🗣 {Math.round(t.spoken)}</div>
          <div className="k">Minutes spoken</div>
        </div>
        <div className="stat">
          <div className="v">🎧 {Math.round(t.listened)}</div>
          <div className="k">Minutes listened</div>
        </div>
        <div className="stat">
          <div className="v">🧠 {mastered}</div>
          <div className="k">Phrases mastered · {fluent} used in conversation</div>
        </div>
        <div className="stat">
          <div className="v">💬 {state.conversations.length}</div>
          <div className="k">Conversations completed</div>
        </div>
        <div className="stat">
          <div className="v">📅 {t.completedDays}</div>
          <div className="k">Full days completed</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Readiness by situation</h3>
        {DOMAINS.map((d) => (
          <Score key={d} label={DOMAIN_LABELS[d]} value={ready.domains[d]} />
        ))}
        <p className="small muted" style={{ marginTop: 10 }}>
          Half from phrase mastery, half from how your last conversations in that situation went. Situations you have never role-played cap at 60%.
        </p>
      </div>

      <div className="card">
        <h3>Skills</h3>
        <Score label="Listening" value={state.skills.listening} />
        <Score label="Speaking" value={state.skills.speaking} />
        <Score label="Vocabulary" value={state.skills.vocabulary} />
        <Score label="Conversation" value={state.skills.conversation} />
      </div>

      {last14.length > 0 && (
        <div className="card">
          <h3>Last two weeks</h3>
          <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 70 }}>
            {last14.map((l) => {
              const m = l.minutesSpoken + l.minutesListened;
              const h = Math.min(60, Math.max(4, m * 1.2));
              return (
                <div key={l.date} title={`${l.date}: ${Math.round(m)} min`} style={{ flex: 1, height: h, background: l.completed ? 'var(--accent)' : 'var(--line)', borderRadius: 4 }} />
              );
            })}
          </div>
          <div className="small muted">Bars show minutes of speaking and listening. Teal means the full plan was done.</div>
        </div>
      )}

      <div className="card">
        <h3>Weekly challenges</h3>
        <div className="row wrap" style={{ gap: 6 }}>
          {WEEKS.map((w) => (
            <span key={w.number} className={`chip ${state.completedChallenges.includes(w.number) ? 'good' : ''}`}>
              {state.completedChallenges.includes(w.number) ? '🏆' : '·'} W{w.number}
            </span>
          ))}
        </div>
      </div>

      {state.finalAssessment && (
        <div className="card" style={{ background: 'var(--sun-soft)' }}>
          <h3>Your Tenerife readiness report</h3>
          <div className="big-number">{pct(state.finalAssessment.overall)}</div>
          <div className="small muted">{new Date(state.finalAssessment.at).toLocaleDateString()}</div>
          <div className="divider" />
          <b className="small">Top weaknesses</b>
          <ul className="small" style={{ paddingLeft: 18, margin: '4px 0 8px' }}>
            {state.finalAssessment.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <b className="small">Final revision plan</b>
          <ol className="small" style={{ paddingLeft: 18, margin: '4px 0' }}>
            {state.finalAssessment.plan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      <button type="button" className="btn sun block" onClick={() => nav.start({ kind: 'final' })}>
        {state.finalAssessment ? 'Repeat the final simulation' : 'Run the final Tenerife simulation'}
      </button>
    </div>
  );
}
