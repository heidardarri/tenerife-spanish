import { useMemo, useState } from 'react';
import { ActivityShell, AudioButton, MicInput, useAutoSpeak } from '../components/common';
import { LESSON_BY_KEY, phrasesForLesson } from '../data';
import { PRONUNCIATION_RULES } from '../data/pronunciation';
import { completeLesson, getState, markActivityDone, recordPhraseLearned, recordSpeaking } from '../state/store';
import { grade } from '../engine/text';
import { SpeakingTaskView, type SpeakingResult } from './SpeakingSession';
import type { Phrase } from '../types';

type Stage = 'intro' | 'grammar' | 'phrase' | 'pron' | 'speak' | 'done';
type Sub = 'meaning' | 'repeat' | 'recall' | 'use';

interface PhraseOutcome {
  recallOk: boolean;
  useOk: boolean;
}

export function PhraseLesson({ lessonKey, onClose }: { lessonKey: string; onClose: () => void }) {
  const lesson = LESSON_BY_KEY[lessonKey];
  const phrases = useMemo(() => (lesson ? phrasesForLesson(lesson) : []), [lesson]);
  const rule = lesson?.pronunciationRuleId ? PRONUNCIATION_RULES.find((r) => r.id === lesson.pronunciationRuleId) : undefined;
  const [stage, setStage] = useState<Stage>('intro');
  const [i, setI] = useState(0);
  const [sub, setSub] = useState<Sub>('meaning');
  const [tries, setTries] = useState<string[]>([]);
  const [fb, setFb] = useState<{ text: string; ok: boolean } | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, PhraseOutcome>>({});
  const [speakResult, setSpeakResult] = useState<SpeakingResult | null>(null);
  const rate = getState().settings.ttsRate;
  const phrase: Phrase | undefined = phrases[i];

  useAutoSpeak(stage === 'phrase' && phrase && (sub === 'meaning' || sub === 'repeat') ? phrase.es : null, rate);

  if (!lesson || !phrases.length) {
    return (
      <ActivityShell title="Lesson" onClose={onClose}>
        <p>Lesson not found.</p>
      </ActivityShell>
    );
  }

  const total = phrases.length;
  const progress = stage === 'intro' || stage === 'grammar' ? 0 : stage === 'phrase' ? (i + { meaning: 0, repeat: 0.25, recall: 0.5, use: 0.75 }[sub]) / (total + 1) : stage === 'done' ? 1 : total / (total + 1);

  const nextPhrase = (o: PhraseOutcome) => {
    if (phrase) {
      setOutcomes((prev) => ({ ...prev, [phrase.id]: o }));
      recordPhraseLearned(phrase.id, o.recallOk, o.useOk);
    }
    setTries([]);
    setFb(null);
    if (i + 1 < total) {
      setI(i + 1);
      setSub('meaning');
    } else {
      setStage(rule ? 'pron' : 'speak');
    }
  };

  const finishLesson = (r: SpeakingResult | null) => {
    completeLesson(lessonKey);
    markActivityDone('phrases', lessonKey);
    if (r) recordSpeaking(r.seconds / 60, r.quality);
    setStage('done');
  };

  // ---- Intro
  if (stage === 'intro') {
    return (
      <ActivityShell title={`Week ${lesson.week} · Lesson ${lesson.day}`} progress={0} onClose={onClose}>
        <h1>{lesson.title}</h1>
        <p className="muted">
          {total} new phrases. For each one: meaning, audio, repeat aloud, recall from English, then use it in an exchange. About {Math.round(total * 1.5)} minutes.
        </p>
        <div className="card">
          {phrases.map((p) => (
            <div key={p.id} className="row between" style={{ padding: '6px 0' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.es}</div>
                <div className="small muted">{p.en}</div>
              </div>
              <AudioButton text={p.es} size="sm" />
            </div>
          ))}
        </div>
        <button type="button" className="btn primary block lg" onClick={() => setStage(lesson.grammar ? 'grammar' : 'phrase')}>
          Start
        </button>
      </ActivityShell>
    );
  }

  // ---- Grammar pattern (short)
  if (stage === 'grammar' && lesson.grammar) {
    const g = lesson.grammar;
    return (
      <ActivityShell title={lesson.title} progress={0} onClose={onClose}>
        <span className="chip accent">Pattern</span>
        <h1 style={{ marginTop: 8 }}>{g.title}</h1>
        <p>{g.explanation}</p>
        <div className="stack">
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
        <p className="small muted" style={{ marginTop: 12 }}>
          Say each one aloud once. That is the whole grammar lesson.
        </p>
        <button type="button" className="btn primary block lg" onClick={() => setStage('phrase')}>
          On to the phrases
        </button>
      </ActivityShell>
    );
  }

  // ---- Phrase steps
  if (stage === 'phrase' && phrase) {
    const title = `${lesson.title} · ${i + 1}/${total}`;
    if (sub === 'meaning') {
      return (
        <ActivityShell title={title} progress={progress} onClose={onClose}>
          <div className="flashcard">
            <div className="kind">1 · Meaning</div>
            <div className="es big">{phrase.es}</div>
            <div style={{ fontSize: 18 }}>{phrase.en}</div>
            <AudioButton text={phrase.es} rate={rate} label="Play" />
            {phrase.note && <div className="small muted">💡 {phrase.note}</div>}
            {phrase.example && (
              <div className="card soft small" style={{ margin: 0, width: '100%', textAlign: 'left' }}>
                <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{phrase.example.es}</div>
                <div className="muted" style={{ whiteSpace: 'pre-line' }}>
                  {phrase.example.en}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="btn primary block lg" onClick={() => setSub('repeat')}>
            Now repeat it
          </button>
        </ActivityShell>
      );
    }
    if (sub === 'repeat') {
      return (
        <ActivityShell title={title} progress={progress} onClose={onClose}>
          <div className="flashcard">
            <div className="kind">2 · Repeat aloud</div>
            <div className="es big">{phrase.es}</div>
            <AudioButton text={phrase.es} rate={rate} label="Play again" />
          </div>
          {fb && <div className={`chip ${fb.ok ? 'good' : 'sun'}`} style={{ display: 'block', textAlign: 'center', marginBottom: 10 }}>{fb.text}</div>}
          <MicInput
            key={tries.length}
            onResult={(t) => {
              const g = grade(t, phrase.es);
              const next = [...tries, t];
              setTries(next);
              if (g.grade === 'correct') {
                setFb({ text: 'Understandable. Nice.', ok: true });
                setTimeout(() => {
                  setFb(null);
                  setTries([]);
                  setSub('recall');
                }, 800);
              } else if (next.length >= 2) {
                setFb({ text: `Good enough to be understood. You said: "${t}"`, ok: true });
                setTimeout(() => {
                  setFb(null);
                  setTries([]);
                  setSub('recall');
                }, 1000);
              } else {
                setFb({ text: g.grade === 'close' ? `Close. You said: "${t}". Once more.` : `Heard: "${t}". Listen again and repeat slowly.`, ok: false });
              }
            }}
            hint="Repeat the phrase"
          />
        </ActivityShell>
      );
    }
    if (sub === 'recall') {
      return (
        <ActivityShell title={title} progress={progress} onClose={onClose}>
          <div className="flashcard">
            <div className="kind">3 · Recall</div>
            <div style={{ fontSize: 20 }}>{phrase.en}</div>
            <div className="small muted">Say it in Spanish from memory</div>
          </div>
          {fb && (
            <div className="card soft" style={{ textAlign: 'center' }}>
              <div className={`chip ${fb.ok ? 'good' : 'bad'}`}>{fb.text}</div>
              <div className="es" style={{ marginTop: 8 }}>
                {phrase.es}
              </div>
            </div>
          )}
          {!fb ? (
            <>
              <MicInput
                key={tries.length}
                onResult={(t) => {
                  const g = grade(t, phrase.es);
                  setTries([...tries, t]);
                  setFb({ text: g.grade === 'correct' ? 'Recalled' : g.grade === 'close' ? `Close: "${t}"` : `Not yet: "${t}"`, ok: g.grade !== 'wrong' });
                }}
                hint="Say the Spanish"
              />
              <button type="button" className="btn ghost block" onClick={() => setFb({ text: 'Shown', ok: false })}>
                Show me
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary block lg"
              onClick={() => {
                setOutcomes((prev) => ({ ...prev, [phrase.id]: { recallOk: fb.ok, useOk: false } }));
                setFb(null);
                setTries([]);
                setSub('use');
              }}
            >
              Use it in a conversation
            </button>
          )}
        </ActivityShell>
      );
    }
    // use
    const cue = phrase.example ? phrase.example.es.split('\n').find((l) => !l.includes(phrase.es)) ?? phrase.situation : phrase.situation;
    const cueIsSpanish = !!phrase.example && cue !== phrase.situation;
    return (
      <ActivityShell title={title} progress={progress} onClose={onClose}>
        <div className="flashcard">
          <div className="kind">4 · Use it</div>
          {cueIsSpanish ? (
            <>
              <div className="small muted">They say:</div>
              <div className="es">{cue}</div>
              <AudioButton text={cue} rate={rate} label="Play" />
            </>
          ) : (
            <div style={{ fontSize: 18 }}>{cue}</div>
          )}
          <div className="small muted">Reply using the new phrase. Add anything else you can.</div>
        </div>
        {fb && <div className={`chip ${fb.ok ? 'good' : 'sun'}`} style={{ display: 'block', textAlign: 'center', marginBottom: 10 }}>{fb.text}</div>}
        {!fb ? (
          <MicInput
            key={tries.length}
            onResult={(t) => {
              const g = grade(t, phrase.es);
              const ok = g.score >= 0.55;
              setFb({ text: ok ? '¡Muy bien! Used it.' : `Heard: "${t}". The phrase was: ${phrase.es}`, ok });
              const prev = outcomes[phrase.id] ?? { recallOk: false, useOk: false };
              setTimeout(() => nextPhrase({ recallOk: prev.recallOk, useOk: ok }), 1200);
            }}
            hint="Reply in Spanish"
          />
        ) : (
          <div className="center">
            <span className="spinner" />
          </div>
        )}
      </ActivityShell>
    );
  }

  // ---- Pronunciation focus
  if (stage === 'pron' && rule) {
    return (
      <ActivityShell title="Pronunciation focus" progress={progress} onClose={onClose}>
        <span className="chip accent">Sound of the day</span>
        <h1 style={{ marginTop: 8 }}>{rule.title}</h1>
        <p>{rule.rule}</p>
        <div className="stack">
          {rule.examples.map((e) => (
            <div key={e.es} className="pattern row between">
              <div>
                <div className="es">{e.es}</div>
                <div className="small muted">{e.hint}</div>
              </div>
              <AudioButton text={e.es} rate={rate} size="sm" />
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Play each word and say it back. Being understood is the goal, not a native accent.
        </p>
        <button type="button" className="btn primary block lg" onClick={() => setStage('speak')}>
          Speaking task
        </button>
      </ActivityShell>
    );
  }

  // ---- Speaking task
  if (stage === 'speak') {
    return (
      <ActivityShell title="Speaking task" progress={progress} onClose={onClose}>
        <SpeakingTaskView
          task={lesson.speakingTask}
          lessonPhrases={phrases}
          onDone={(r) => {
            setSpeakResult(r);
            setTimeout(() => finishLesson(r), 900);
          }}
        />
        {!speakResult && (
          <button type="button" className="btn ghost block" style={{ marginTop: 12 }} onClick={() => finishLesson(null)}>
            Skip for now
          </button>
        )}
      </ActivityShell>
    );
  }

  // ---- Done
  const recalled = Object.values(outcomes).filter((o) => o.recallOk).length;
  const used = Object.values(outcomes).filter((o) => o.useOk).length;
  return (
    <ActivityShell title={lesson.title} progress={1} onClose={onClose}>
      <div className="card center">
        <div style={{ fontSize: 48 }}>✨</div>
        <h2>Lesson complete</h2>
        <p className="muted">
          {total} phrases met · {recalled} recalled from memory · {used} used in an exchange.
        </p>
        <p className="small muted">They are now in your flashcards and will come back tomorrow.</p>
        <button type="button" className="btn primary block" onClick={onClose}>
          Done
        </button>
      </div>
    </ActivityShell>
  );
}
