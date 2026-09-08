import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityShell, AudioButton, MicInput, fmtTime, useTimer } from '../components/common';
import { resolveScenario } from '../data/scenarios';
import { PHRASE_BY_ID, lessonsForWeek, phrasesForLesson } from '../data';
import { calendarInfo } from '../engine/calendar';
import { speak, stopSpeaking } from '../engine/speech';
import { createTutor, levelForWeek, type Hint, type Tutor, type TutorContext } from '../engine/tutor';
import { weakCards } from '../engine/srs';
import { completeChallenge, getState, markActivityDone, recordConversation, today } from '../state/store';
import type { ConversationLog, ConversationReview, ConversationTurn, ScenarioId } from '../types';
import { cardText } from '../screens/Review';

export interface EmbeddedProps {
  station: number;
  total: number;
  onComplete: (log: ConversationLog) => void;
  onSkip: () => void;
}

interface Props {
  scenarioId: ScenarioId;
  spanishOnly?: boolean;
  targetMinutes?: number;
  challengeWeek?: number;
  planKind?: 'scenario' | 'conversation';
  onClose: () => void;
  embedded?: EmbeddedProps;
}

export function Conversation({ scenarioId, spanishOnly, targetMinutes, challengeWeek, planKind = 'conversation', onClose, embedded }: Props) {
  const state = getState();
  const cal = calendarInfo(state.settings.startDate, state.settings.departureDate, today());
  const scenario = useMemo(() => resolveScenario(scenarioId, cal.calendarWeek), [scenarioId, cal.calendarWeek]);
  const target = targetMinutes ?? scenario.targetMinutes;
  const spanishOnlyMode = spanishOnly ?? cal.immersion;

  const ctx = useMemo<TutorContext>(() => {
    const weak = weakCards(state.cards).slice(0, 10).map((c) => cardText(c).es);
    const recent = lessonsForWeek(cal.calendarWeek)
      .filter((l) => state.completedLessons.includes(`w${l.week}d${l.day}`))
      .flatMap((l) => phrasesForLesson(l))
      .map((p) => p.es)
      .slice(-12);
    const mistakes = state.mistakes.filter((m) => !m.resolved).sort((a, b) => b.count - a.count).slice(0, 5);
    return {
      scenario,
      level: levelForWeek(cal.calendarWeek, state.skills),
      week: cal.calendarWeek,
      learner: { name: state.settings.name, about: state.settings.about },
      weakPhrases: weak,
      recentPhrases: recent,
      recurringMistakes: mistakes.map((m) => ({ original: m.original, better: m.better })),
      spanishOnly: spanishOnlyMode,
      targetMinutes: target,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const tutor = useRef<Tutor | null>(null);
  const [phase, setPhase] = useState<'intro' | 'chat' | 'reviewing' | 'review'>(embedded ? 'chat' : 'intro');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [goals, setGoals] = useState<Set<number>>(new Set());
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shownEn, setShownEn] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ConversationReview | null>(null);
  const [log, setLog] = useState<ConversationLog | null>(null);
  const [ended, setEnded] = useState(false);
  const startedAt = useRef<string>(new Date().toISOString());
  const seconds = useTimer(phase === 'chat');
  const bottom = useRef<HTMLDivElement>(null);
  const rate = state.settings.ttsRate;

  const start = () => {
    tutor.current = createTutor(ctx, state.settings.apiKey);
    const o = tutor.current.opening();
    startedAt.current = new Date().toISOString();
    setTurns([{ role: 'ai', es: o.es, en: o.en, at: new Date().toISOString() }]);
    setPhase('chat');
    setTimeout(() => void speak(o.es, rate), 300);
  };

  useEffect(() => {
    if (embedded) start();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, thinking, hint]);

  const send = async (text: string) => {
    if (!tutor.current || thinking) return;
    setError(null);
    setHint(null);
    setHintLevel(0);
    const learnerTurn: ConversationTurn = { role: 'learner', es: text, hintLevel, at: new Date().toISOString() };
    setTurns((t) => [...t, learnerTurn]);
    setThinking(true);
    try {
      const r = await tutor.current.respond(text);
      const aiTurn: ConversationTurn = { role: 'ai', es: r.es, en: r.en, correction: r.correction, at: new Date().toISOString() };
      setTurns((t) => [...t, aiTurn]);
      if (r.goalsHit.length) setGoals((g) => new Set([...g, ...r.goalsHit]));
      void speak(r.es, rate);
      if (r.ended) setEnded(true);
    } catch (e) {
      setError((e as Error).message || 'Something went wrong. Try again.');
      setTurns((t) => t.slice(0, -1));
    } finally {
      setThinking(false);
    }
  };

  const askHelp = async () => {
    if (!tutor.current) return;
    const next = Math.min(3, hintLevel + 1) as 1 | 2 | 3;
    if (!hint) {
      try {
        setThinking(true);
        const h = await tutor.current.hint();
        setHint(h);
      } catch {
        setError('Could not fetch a hint.');
        return;
      } finally {
        setThinking(false);
      }
    }
    if (next === 1) setHintsUsed((n) => n + 1);
    setHintLevel(next);
  };

  const finish = async () => {
    if (!tutor.current) return;
    stopSpeaking();
    setPhase('reviewing');
    const minutes = Math.max(0.5, seconds / 60);
    let rev: ConversationReview;
    try {
      rev = await tutor.current.review(turns, hintsUsed, minutes);
    } catch (e) {
      // Fall back to a heuristic review if the AI review fails.
      const learnerTurns = turns.filter((t) => t.role === 'learner').length;
      rev = {
        didWell: [`Kept the conversation going for ${learnerTurns} turns`],
        practiceNext: scenario.goals.filter((_, i) => !goals.has(i)),
        newCards: [],
        scores: { communication: goals.size / Math.max(1, scenario.goals.length), vocabulary: 0.5, understanding: 0.5, confidence: Math.min(1, minutes / target) },
        goalsHit: goals.size,
        goalsTotal: scenario.goals.length,
      };
      setError(`Review used a simple fallback: ${(e as Error).message}`);
    }
    const corrections = turns.filter((t) => t.correction).map((t) => t.correction!);
    const learnerTexts = turns.filter((t) => t.role === 'learner').map((t) => t.es);
    const saved = recordConversation({
      scenarioId: scenario.id,
      startedAt: startedAt.current,
      minutes,
      learnerTurns: learnerTexts.length,
      hintsUsed,
      review: rev,
      mode: tutor.current.mode,
      corrections,
      learnerTexts,
    });
    markActivityDone(planKind, scenarioId);
    if (planKind === 'scenario') markActivityDone('conversation', scenarioId);
    if (challengeWeek !== undefined) {
      const avg = Object.values(rev.scores).reduce((a, b) => a + b, 0) / 4;
      if (minutes >= target * 0.8 && avg >= 0.45) completeChallenge(challengeWeek);
    }
    setReview(rev);
    setLog(saved);
    setPhase('review');
  };

  const title = embedded ? `Station ${embedded.station}/${embedded.total} · ${scenario.title}` : `${scenario.emoji} ${scenario.title}`;

  if (phase === 'intro') {
    return (
      <ActivityShell title={title} onClose={onClose}>
        <h1>
          {scenario.emoji} {scenario.title}
        </h1>
        <p className="muted">{scenario.description}</p>
        <div className="card">
          <div className="small muted">You will talk to</div>
          <b>{scenario.aiRole}</b>
          <div className="small muted" style={{ marginTop: 6 }}>
            {scenario.setting}
          </div>
        </div>
        <div className="card">
          <h3>Your goals</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {scenario.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
            <span className="chip">{target} min target</span>
            <span className={`chip ${state.settings.apiKey ? 'accent' : 'sun'}`}>{state.settings.apiKey ? 'AI partner' : 'Scripted partner'}</span>
            {spanishOnlyMode && <span className="chip bad">Spanish only</span>}
            {challengeWeek !== undefined && <span className="chip sun">Week {challengeWeek} challenge</span>}
          </div>
        </div>
        <div className="card soft small">
          Speak your replies. Tap <b>Help</b> when stuck: a keyword first, then the sentence shape, then the full phrase. Help never punishes you much. Ask <i>¿Puedes repetir?</i> or <i>más despacio, por favor</i> any time.
        </div>
        <button type="button" className="btn primary block lg" onClick={start}>
          START CONVERSATION
        </button>
      </ActivityShell>
    );
  }

  if (phase === 'reviewing') {
    return (
      <ActivityShell title={title} onClose={onClose}>
        <div className="card center">
          <span className="spinner" />
          <p className="muted" style={{ marginTop: 12 }}>
            Reviewing your conversation…
          </p>
        </div>
      </ActivityShell>
    );
  }

  if (phase === 'review' && review) {
    const avg = Object.values(review.scores).reduce((a, b) => a + b, 0) / 4;
    const passedChallenge = challengeWeek !== undefined && getState().completedChallenges.includes(challengeWeek);
    return (
      <ActivityShell title="Conversation review" onClose={onClose}>
        <div className="card accent">
          <div className="row between">
            <div>
              <div className="small muted">
                {scenario.emoji} {scenario.title}
              </div>
              <div className="big-number">{Math.round(avg * 100)}%</div>
              <div className="small muted">
                {fmtTime(seconds)} · {turns.filter((t) => t.role === 'learner').length} turns · {review.goalsHit}/{review.goalsTotal} goals · help ×{hintsUsed}
              </div>
            </div>
          </div>
        </div>
        {challengeWeek !== undefined && (
          <div className={`card ${passedChallenge ? '' : 'flat'}`} style={passedChallenge ? { background: 'var(--good-soft)' } : undefined}>
            <b>{passedChallenge ? '🏆 Weekly challenge passed' : 'Challenge not passed yet'}</b>
            <div className="small muted">{passedChallenge ? 'Nice work.' : `Reach ${Math.round(target * 0.8)} minutes with a score above 45% to pass.`}</div>
          </div>
        )}
        <div className="card">
          <h3>Scores</h3>
          {(['communication', 'vocabulary', 'understanding', 'confidence'] as const).map((k) => (
            <div key={k} className="ready-row">
              <div className="label" style={{ textTransform: 'capitalize' }}>
                {k}
              </div>
              <div className="bar">
                <span style={{ width: `${review.scores[k] * 100}%` }} />
              </div>
              <div className="pct">{Math.round(review.scores[k] * 100)}%</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>You did well</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {review.didWell.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Practice next</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {review.practiceNext.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        {review.newCards.length > 0 && (
          <div className="card">
            <h3>New flashcards</h3>
            <p className="small muted">Added to tomorrow's review.</p>
            {review.newCards.map((c) => (
              <div key={c.es} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.es}</div>
                  <div className="small muted">{c.en}</div>
                </div>
                <AudioButton text={c.es} size="sm" />
              </div>
            ))}
          </div>
        )}
        {error && <p className="small muted">{error}</p>}
        <button
          type="button"
          className="btn primary block lg"
          onClick={() => {
            if (embedded && log) embedded.onComplete(log);
            else onClose();
          }}
        >
          {embedded ? 'Next station' : 'Done'}
        </button>
      </ActivityShell>
    );
  }

  // chat
  const learnerTurns = turns.filter((t) => t.role === 'learner').length;
  return (
    <ActivityShell
      title={title}
      progress={Math.min(1, seconds / (target * 60))}
      onClose={() => {
        stopSpeaking();
        if (embedded) embedded.onSkip();
        else onClose();
      }}
      footer={
        <div className="stack" style={{ width: '100%' }}>
          {hint && hintLevel > 0 && (
            <div className="card soft small" style={{ margin: 0 }}>
              <div>💡 {hint.keyword}</div>
              {hintLevel >= 2 && <div style={{ marginTop: 4, fontWeight: 600 }}>{hint.structure}</div>}
              {hintLevel >= 3 && (
                <div className="row between" style={{ marginTop: 4 }}>
                  <span className="es" style={{ fontSize: 18 }}>
                    {hint.full}
                  </span>
                  <AudioButton text={hint.full} size="sm" />
                </div>
              )}
            </div>
          )}
          {error && <div className="chip bad">{error}</div>}
          <MicInput key={turns.length} onResult={(t) => void send(t)} disabled={thinking} hint="Your turn. Speak in Spanish." />
          <div className="row between">
            <button type="button" className="btn sm" disabled={thinking || hintLevel >= 3} onClick={askHelp}>
              💡 Help {hintLevel > 0 ? `${hintLevel}/3` : ''}
            </button>
            <span className="small muted">
              {fmtTime(seconds)} / {target}:00
            </span>
            <button type="button" className={`btn sm ${ended || seconds >= target * 60 ? 'primary' : ''}`} disabled={thinking || learnerTurns === 0} onClick={finish}>
              {ended ? 'Finish & review' : 'End'}
            </button>
          </div>
        </div>
      }
    >
      <div className="goals">
        {scenario.goals.map((g, i) => (
          <span key={g} className={`chip ${goals.has(i) ? 'good' : ''}`}>
            {goals.has(i) ? '✓ ' : ''}
            {g}
          </span>
        ))}
      </div>
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {t.correction && (
              <div className="correction">
                <b>Better:</b> {t.correction.better}
                <div className="small muted">{t.correction.note}</div>
              </div>
            )}
            <div className={`bubble ${t.role}`}>
              <div>{t.es}</div>
              {t.role === 'ai' && (
                <>
                  {shownEn.has(i) && !spanishOnlyMode && <div className="en">{t.en}</div>}
                  <div className="actions">
                    <button type="button" onClick={() => void speak(t.es, rate)}>
                      🔊 Repeat
                    </button>
                    <button type="button" onClick={() => void speak(t.es, Math.max(0.6, rate - 0.2))}>
                      🐢 Slower
                    </button>
                    {!spanishOnlyMode && !shownEn.has(i) && (
                      <button type="button" onClick={() => setShownEn(new Set(shownEn).add(i))}>
                        Translate
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="bubble ai">
            <span className="spinner" />
          </div>
        )}
        <div ref={bottom} />
      </div>
    </ActivityShell>
  );
}

export function phraseEs(id: string): string {
  return PHRASE_BY_ID[id]?.es ?? id;
}
