import { useEffect, useMemo, useState } from 'react';
import { ActivityShell, AudioButton, MicInput, fmtTime, useAutoSpeak, useTimer } from '../components/common';
import { LESSON_BY_KEY, phrasesForLesson } from '../data';
import { getState, markActivityDone, recordSpeaking } from '../state/store';
import { containsAny, grade, normalize, wordCount } from '../engine/text';
import type { Phrase, SpeakingTask } from '../types';

export interface SpeakingResult {
  seconds: number;
  quality: number; // 0..1
  transcript: string;
}

const FOLLOW_UPS = [
  { es: 'Vale. ¿Y qué más?', en: 'OK. And what else?' },
  { es: 'Muy bien. ¿Algo más?', en: 'Very good. Anything else?' },
  { es: 'Entiendo. ¿Por qué?', en: 'I see. Why?' },
];

/** One speaking task: repeat, answer, describe, role-play or free speaking. */
export function SpeakingTaskView({ task, lessonPhrases, onDone }: { task: SpeakingTask; lessonPhrases: Phrase[]; onDone: (r: SpeakingResult) => void }) {
  const [attempts, setAttempts] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [live, setLive] = useState('');
  const seconds = useTimer(running && !done);
  const [turn, setTurn] = useState(0);
  const target = task.targetSeconds ?? 60;
  const rate = getState().settings.ttsRate;

  const prompt = task.kind === 'repeat' ? task.promptEs : task.kind === 'answer' ? task.promptEs : task.kind === 'roleplay' && task.promptEs ? task.promptEs : null;
  useAutoSpeak(prompt, rate);

  useEffect(() => {
    if ((task.kind === 'describe' || task.kind === 'free') && !running) setRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.kind]);

  const words = wordCount(attempts.join(' ') + ' ' + live);

  const finishLong = () => {
    const transcript = attempts.join(' ');
    const w = wordCount(transcript);
    const quality = Math.min(1, 0.3 + w / Math.max(20, target / 2.5));
    setDone(true);
    onDone({ seconds: Math.max(seconds, w * 0.6), quality, transcript });
  };

  if (task.kind === 'repeat') {
    const target = task.promptEs ?? lessonPhrases[0]?.es ?? '';
    return (
      <div className="stack">
        <div className="flashcard">
          <div className="kind">Repeat after me</div>
          <div className="es">{target}</div>
          {task.promptEn && <div className="muted">{task.promptEn}</div>}
          <AudioButton text={target} rate={rate} label="Play" />
        </div>
        <p className="small muted center">{task.instruction}</p>
        {feedback && <div className={`chip ${feedback.ok ? 'good' : 'sun'}`} style={{ alignSelf: 'center' }}>{feedback.text}</div>}
        <MicInput
          key={attempts.length}
          onResult={(t) => {
            const g = grade(t, target);
            const next = [...attempts, t];
            setAttempts(next);
            if (g.grade === 'correct' || next.length >= 3) {
              setFeedback({ text: g.grade === 'correct' ? 'Clear and understandable' : `Close enough. You said: "${t}"`, ok: g.grade === 'correct' });
              onDone({ seconds: next.length * 6, quality: g.grade === 'correct' ? 1 : g.grade === 'close' ? 0.7 : 0.4, transcript: t });
            } else {
              setFeedback({ text: g.grade === 'close' ? `Close. Listen again and try once more. You said: "${t}"` : `Not quite. You said: "${t}". Listen and repeat.`, ok: false });
            }
          }}
          hint="Listen, then repeat the phrase aloud"
        />
      </div>
    );
  }

  if (task.kind === 'answer') {
    const ok = feedback?.ok;
    return (
      <div className="stack">
        <div className="flashcard">
          <div className="kind">Answer the question</div>
          <div className="es">{task.promptEs}</div>
          <AudioButton text={task.promptEs ?? ''} rate={rate} label="Play" />
          {attempts.length > 0 && task.promptEn && <div className="muted small">{task.promptEn}</div>}
        </div>
        <p className="small muted center">{task.instruction}</p>
        {task.starters && attempts.length > 0 && !ok && (
          <div className="card soft small">
            <b>Try starting with:</b> {task.starters.join(' · ')}
          </div>
        )}
        {feedback && <div className={`chip ${feedback.ok ? 'good' : 'sun'}`} style={{ alignSelf: 'center' }}>{feedback.text}</div>}
        {!ok && (
          <MicInput
            key={attempts.length}
            onResult={(t) => {
              const next = [...attempts, t];
              setAttempts(next);
              const hit = task.expectAny ? containsAny(t, task.expectAny) : wordCount(t) >= 2;
              const w = wordCount(t);
              if (hit || next.length >= 3) {
                setFeedback({ text: hit ? (w >= 4 ? 'Great, a full answer' : 'Good, understood') : `Moving on. You said: "${t}"`, ok: true });
                onDone({ seconds: next.length * 8, quality: hit ? Math.min(1, 0.7 + w / 20) : 0.4, transcript: t });
              } else {
                setFeedback({ text: `Try again with more detail. You said: "${t}"`, ok: false });
              }
            }}
            hint="Answer in Spanish"
          />
        )}
      </div>
    );
  }

  if (task.kind === 'roleplay') {
    const opening = task.promptEs ?? '¡Hola! ¿Qué tal?';
    const line = turn === 0 ? { es: opening, en: task.promptEn ?? '' } : FOLLOW_UPS[(turn - 1) % FOLLOW_UPS.length];
    return (
      <div className="stack">
        <div className="card soft small">{task.instruction}</div>
        <div className="flashcard" style={{ minHeight: 120 }}>
          <div className="kind">They say</div>
          <div className="es">{line.es}</div>
          {line.en && <div className="muted small">{line.en}</div>}
          <AudioButton text={line.es} rate={rate} label="Play" />
        </div>
        {task.starters && (
          <div className="card soft small">
            <b>Sentence starters:</b> {task.starters.join(' · ')}
          </div>
        )}
        <div className="small muted center">Turn {turn + 1} of 3</div>
        {!done && (
          <MicInput
            key={turn}
            onResult={(t) => {
              const next = [...attempts, t];
              setAttempts(next);
              if (turn + 1 >= 3) {
                setDone(true);
                const w = wordCount(next.join(' '));
                onDone({ seconds: next.length * 10, quality: Math.min(1, 0.4 + w / 25), transcript: next.join(' ') });
              } else setTurn(turn + 1);
            }}
            hint="Reply in Spanish"
          />
        )}
        {attempts.length > 0 && (
          <div className="card flat small">
            {attempts.map((a, i) => (
              <div key={i}>🗣 {a}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // describe / free
  const progress = Math.min(1, seconds / target);
  return (
    <div className="stack">
      <div className="card">
        <div className="kind small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {task.kind === 'describe' ? 'Describe' : 'Free speaking'}
        </div>
        <p style={{ fontSize: 17 }}>{task.instruction}</p>
        {task.starters && (
          <div className="card soft small" style={{ marginBottom: 0 }}>
            <b>Sentence starters:</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {task.starters.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="center">
        <div className="timer">{fmtTime(seconds)}</div>
        <div className="small muted">
          target {fmtTime(target)} · {words} words
        </div>
        <div className="bar thin" style={{ marginTop: 8 }}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {!done && (
        <MicInput
          key={attempts.length}
          continuous
          maxMs={Math.max(60_000, target * 1000 + 30_000)}
          onInterim={setLive}
          onResult={(t) => {
            setAttempts((a) => [...a, t]);
            setLive('');
          }}
          hint="Tap and keep talking. Tap again when you pause."
        />
      )}
      {attempts.length > 0 && (
        <div className="card flat small">
          {attempts.map((a, i) => (
            <div key={i}>🗣 {a}</div>
          ))}
        </div>
      )}
      {!done && (
        <button type="button" className="btn primary block" disabled={words < 5 && seconds < target * 0.5} onClick={finishLong}>
          {seconds >= target ? 'Finish' : 'Finish early'}
        </button>
      )}
    </div>
  );
}

export function SpeakingSession({ lessonKey, onClose }: { lessonKey: string; onClose: () => void }) {
  const lesson = LESSON_BY_KEY[lessonKey];
  const phrases = useMemo(() => (lesson ? phrasesForLesson(lesson) : []), [lesson]);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<SpeakingResult[]>([]);

  const tasks: SpeakingTask[] = useMemo(() => {
    if (!lesson) return [];
    const learned = getState().cards;
    const pick = [...phrases].sort((a, b) => (learned[a.id]?.mastery ?? 0) - (learned[b.id]?.mastery ?? 0)).slice(0, 2);
    const repeats: SpeakingTask[] = pick.map((p) => ({ kind: 'repeat', instruction: 'Listen and repeat. Aim for clear, not perfect.', promptEs: p.es, promptEn: p.en }));
    const withExample = phrases.find((p) => p.example);
    const answer: SpeakingTask | null = withExample?.example
      ? { kind: 'answer', instruction: 'Answer naturally in Spanish. Use a phrase from this lesson if you can.', promptEs: withExample.example.es.split('\n')[0], promptEn: withExample.example.en.split('\n')[0], starters: phrases.slice(0, 3).map((p) => p.es) }
      : null;
    return [...repeats, ...(answer ? [answer] : []), lesson.speakingTask];
  }, [lesson, phrases]);

  if (!lesson) {
    return (
      <ActivityShell title="Speaking" onClose={onClose}>
        <p>Lesson not found.</p>
      </ActivityShell>
    );
  }

  const finishAll = (all: SpeakingResult[]) => {
    const secs = all.reduce((s, r) => s + r.seconds, 0);
    const quality = all.reduce((s, r) => s + r.quality, 0) / Math.max(1, all.length);
    const transcript = normalize(all.map((r) => r.transcript).join(' '));
    const used = phrases.filter((p) => transcript.includes(normalize(p.es))).map((p) => p.id);
    recordSpeaking(secs / 60, quality, used);
    markActivityDone('speaking');
  };

  if (step >= tasks.length) {
    const secs = results.reduce((s, r) => s + r.seconds, 0);
    const quality = results.reduce((s, r) => s + r.quality, 0) / Math.max(1, results.length);
    return (
      <ActivityShell title="Speaking" onClose={onClose}>
        <div className="card center">
          <div style={{ fontSize: 48 }}>🎙️</div>
          <h2>{Math.round(secs / 60 * 10) / 10} minutes spoken</h2>
          <p className="muted">Quality {Math.round(quality * 100)}%. Speaking every day is what makes Tenerife easy.</p>
          <button type="button" className="btn primary block" onClick={onClose}>
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  const task = tasks[step];
  return (
    <ActivityShell title={`Speaking · ${step + 1}/${tasks.length}`} progress={step / tasks.length} onClose={onClose}>
      <SpeakingTaskView
        key={step}
        task={task}
        lessonPhrases={phrases}
        onDone={(r) => {
          const all = [...results, r];
          setResults(all);
          if (step + 1 >= tasks.length) finishAll(all);
          setTimeout(() => setStep(step + 1), 900);
        }}
      />
    </ActivityShell>
  );
}
