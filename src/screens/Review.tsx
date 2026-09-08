import type { Nav } from '../App';
import { resolveMistake, useStore } from '../state/store';
import { dueCards, weakCards, MASTERY_LABELS } from '../engine/srs';
import { PHRASE_BY_ID, LESSONS, phrasesForLesson } from '../data';
import { AudioButton } from '../components/common';
import type { CardState } from '../types';

export function cardText(c: CardState): { es: string; en: string; situation: string } {
  const p = PHRASE_BY_ID[c.phraseId];
  if (p) return { es: p.es, en: p.en, situation: p.situation };
  return { es: c.custom?.es ?? '?', en: c.custom?.en ?? '?', situation: c.custom?.situation ?? '' };
}

export function Review({ nav }: { nav: Nav }) {
  const state = useStore();
  const now = new Date();
  const due = dueCards(state.cards, now);
  const weak = weakCards(state.cards);
  const mistakes = state.mistakes.filter((m) => !m.resolved).sort((a, b) => b.count - a.count).slice(0, 8);
  const custom = Object.values(state.cards).filter((c) => c.custom);
  const total = Object.values(state.cards).filter((c) => c.mastery > 0).length;

  // Grammar patterns from completed lessons whose phrases are weak.
  const weakIds = new Set(weak.map((w) => w.phraseId));
  const grammar = LESSONS.filter((l) => l.grammar && state.completedLessons.includes(`w${l.week}d${l.day}`) && phrasesForLesson(l).some((p) => weakIds.has(p.id)))
    .slice(0, 3)
    .map((l) => l.grammar!);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Review</h1>
        <span className="chip">{total} phrases learned</span>
      </div>

      <div className="card accent">
        <div className="row between">
          <div>
            <div className="big-number">{due.length}</div>
            <div className="small muted">flashcards due now</div>
          </div>
          <button type="button" className="btn sun" disabled={due.length === 0} onClick={() => nav.start({ kind: 'flashcards', mode: 'due' })}>
            Review
          </button>
        </div>
      </div>

      <div className="grid2">
        <button type="button" className="stat" onClick={() => nav.start({ kind: 'flashcards', mode: 'weak' })} disabled={!weak.length} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="v">{weak.length}</div>
          <div className="k">Weak phrases · practise</div>
        </button>
        <button type="button" className="stat" onClick={() => nav.start({ kind: 'flashcards', mode: 'mistakes' })} disabled={!custom.length} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="v">{custom.length}</div>
          <div className="k">From conversations · practise</div>
        </button>
      </div>

      {mistakes.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Mistakes from conversations</h3>
          <div className="stack">
            {mistakes.map((m) => (
              <div key={m.id} className="card flat" style={{ marginBottom: 0 }}>
                <div className="row between">
                  <div style={{ flex: 1 }}>
                    <div className="small muted" style={{ textDecoration: 'line-through' }}>
                      {m.original}
                    </div>
                    <div style={{ fontWeight: 600 }}>{m.better}</div>
                    <div className="small muted">{m.note}</div>
                  </div>
                  <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
                    {m.count > 1 && <span className="chip bad">×{m.count}</span>}
                    <AudioButton text={m.better} size="sm" />
                  </div>
                </div>
                <button type="button" className="btn ghost sm" onClick={() => resolveMistake(m.id)}>
                  Got it now
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {weak.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Frequently missed</h3>
          <div className="card">
            {weak.slice(0, 8).map((c) => {
              const t = cardText(c);
              return (
                <div key={c.phraseId} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{t.es}</div>
                    <div className="small muted">
                      {t.en} · {MASTERY_LABELS[c.mastery]} · {c.mistakes} miss{c.mistakes === 1 ? '' : 'es'}
                    </div>
                  </div>
                  <AudioButton text={t.es} size="sm" />
                </div>
              );
            })}
          </div>
        </>
      )}

      {grammar.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Patterns to practise</h3>
          {grammar.map((g) => (
            <div key={g.title} className="card">
              <h3>{g.title}</h3>
              <p className="small muted">{g.explanation}</p>
              {g.patterns.map((p) => (
                <div key={p.es} className="pattern row between">
                  <div>
                    <div className="es">{p.es}</div>
                    <div className="small muted">{p.en}</div>
                  </div>
                  <AudioButton text={p.es} size="sm" />
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {total === 0 && (
        <div className="card soft">
          <p className="small" style={{ margin: 0 }}>
            Nothing to review yet. Learn your first phrases from Today's plan and they will appear here on their review dates.
          </p>
        </div>
      )}

      <h3 style={{ marginTop: 18 }}>Personalised session</h3>
      <div className="card flat">
        <p className="small muted">Mixes due cards, weak phrases and conversation mistakes into one active-recall session with speaking.</p>
        <button type="button" className="btn primary block" disabled={total === 0} onClick={() => nav.start({ kind: 'flashcards', mode: 'all' })}>
          Start mixed review
        </button>
      </div>
    </div>
  );
}
