import { useState } from 'react';
import type { Nav } from '../App';
import { useStore, today } from '../state/store';
import { WEEKS } from '../data/curriculum';
import { lessonKey, lessonsForWeek, listeningForWeek, phrasesForLesson } from '../data';
import { calendarInfo } from '../engine/calendar';
import { AudioButton } from '../components/common';
import { PRONUNCIATION_RULES } from '../data/pronunciation';
import { DOMAIN_LABELS } from '../types';

export function Learn({ nav }: { nav: Nav }) {
  const state = useStore();
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, today());
  const [open, setOpen] = useState<number | null>(null);
  const [showPron, setShowPron] = useState(false);

  if (showPron) {
    const rules = PRONUNCIATION_RULES.filter((r) => r.introducedWeek <= cal.calendarWeek + 1);
    return (
      <div className="screen">
        <div className="screen-header">
          <h1>Pronunciation</h1>
          <button type="button" className="btn sm" onClick={() => setShowPron(false)}>
            Back
          </button>
        </div>
        <p className="muted small">Introduced one rule at a time. Goal: be understood, not sound native.</p>
        {rules.map((r) => (
          <div key={r.id} className="card">
            <h3>{r.title}</h3>
            <p className="small">{r.rule}</p>
            <div className="stack">
              {r.examples.map((e) => (
                <div key={e.es} className="row between">
                  <div>
                    <span className="es" style={{ fontSize: 18 }}>
                      {e.es}
                    </span>
                    <span className="muted small"> · {e.hint}</span>
                  </div>
                  <AudioButton text={e.es} size="sm" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (open !== null) {
    const w = WEEKS[open - 1];
    const lessons = lessonsForWeek(open);
    const listening = listeningForWeek(open);
    return (
      <div className="screen">
        <div className="screen-header">
          <div>
            <div className="muted small">Week {w.number}</div>
            <h1>{w.title}</h1>
          </div>
          <button type="button" className="btn sm" onClick={() => setOpen(null)}>
            Back
          </button>
        </div>
        <p className="muted">{w.theme}</p>
        <div className="card soft">
          <h3>By the end of this week</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {w.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
            {w.domains.map((d) => (
              <span key={d} className="chip primary">
                {DOMAIN_LABELS[d]}
              </span>
            ))}
          </div>
        </div>

        <h3>Lessons</h3>
        <div className="list">
          {lessons.map((l) => {
            const k = lessonKey(l.week, l.day);
            const done = state.completedLessons.includes(k);
            const phrases = phrasesForLesson(l);
            return (
              <button key={k} type="button" className={`item ${done ? 'done' : ''}`} onClick={() => nav.start({ kind: 'phrases', ref: k })}>
                <div className="num">{done ? '✓' : l.day}</div>
                <div className="body">
                  <div className="title">{l.title}</div>
                  <div className="small muted">
                    {phrases.length} phrases{l.grammar ? ` · ${l.grammar.title}` : ''}
                  </div>
                </div>
                <div className="mins">{done ? 'Review' : 'Start'}</div>
              </button>
            );
          })}
        </div>

        <h3 style={{ marginTop: 16 }}>Listening</h3>
        <div className="list">
          {listening.map((ex) => {
            const done = state.completedListening.includes(ex.id);
            return (
              <button key={ex.id} type="button" className={`item ${done ? 'done' : ''}`} onClick={() => nav.start({ kind: 'listening', ref: ex.id })}>
                <div className="num">{done ? '✓' : '🎧'}</div>
                <div className="body">
                  <div className="title">{ex.title}</div>
                  <div className="small muted">{ex.context}</div>
                </div>
                <div className="mins">{Math.round(ex.rate * 100)}% speed</div>
              </button>
            );
          })}
        </div>

        <h3 style={{ marginTop: 16 }}>Weekly challenge</h3>
        <div className="card">
          <div className="row between">
            <h3 style={{ margin: 0 }}>🏆 {w.challenge.title}</h3>
            {state.completedChallenges.includes(w.number) && <span className="chip good">Done</span>}
          </div>
          <p className="small muted">{w.challenge.description}</p>
          <button type="button" className="btn sun" onClick={() => nav.start({ kind: 'challenge', ref: String(w.number) })}>
            {state.completedChallenges.includes(w.number) ? 'Try again' : 'Take the challenge'}
          </button>
        </div>

        <h3 style={{ marginTop: 16 }}>All phrases this week</h3>
        <div className="card">
          {lessons.flatMap((l) => phrasesForLesson(l)).map((p) => (
            <div key={p.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.es}</div>
                <div className="small muted">{p.en}</div>
              </div>
              <span className={`chip ${(state.cards[p.id]?.mastery ?? 0) >= 3 ? 'good' : ''}`}>L{state.cards[p.id]?.mastery ?? 0}</span>
              <AudioButton text={p.es} size="sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Learn</h1>
        <button type="button" className="btn sm" onClick={() => setShowPron(true)}>
          🔤 Pronunciation
        </button>
      </div>
      <p className="muted small">Fifteen weeks fitted to your {cal.totalDays} days. Every lesson ends with you speaking.</p>
      <div className="stack">
        {WEEKS.map((w) => {
          const lessons = lessonsForWeek(w.number);
          const done = lessons.filter((l) => state.completedLessons.includes(lessonKey(l.week, l.day))).length;
          const locked = w.number > cal.calendarWeek + 1;
          const current = w.number === cal.calendarWeek;
          return (
            <button key={w.number} type="button" className={`week-pill ${current ? 'current' : ''} ${locked ? 'locked' : ''}`} onClick={() => setOpen(w.number)}>
              <div className="n">{w.number}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{w.title}</div>
                <div className="small muted">
                  {done}/{lessons.length} lessons{current ? ' · this week' : locked ? ' · ahead' : ''}
                </div>
              </div>
              <span className={`chip ${done === lessons.length && lessons.length ? 'good' : state.completedChallenges.includes(w.number) ? 'sun' : ''}`}>
                {done === lessons.length && lessons.length ? '✓' : state.completedChallenges.includes(w.number) ? '🏆' : '›'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
