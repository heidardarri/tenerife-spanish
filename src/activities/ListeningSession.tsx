import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityShell, AudioButton, MicInput } from '../components/common';
import { LISTENING_BY_ID } from '../data';
import { getState, markActivityDone, recordListening, recordSpeaking } from '../state/store';
import { speak, stopSpeaking } from '../engine/speech';
import { grade } from '../engine/text';

type Stage = 'intro' | 'gist' | 'questions' | 'transcript' | 'shadow' | 'done';

export function ListeningSession({ exerciseId, shadowOnly, onClose }: { exerciseId: string; shadowOnly?: boolean; onClose: () => void }) {
  const ex = LISTENING_BY_ID[exerciseId];
  const immersion = useMemo(() => {
    const s = getState();
    const [y, m, d] = s.settings.departureDate.split('-').map(Number);
    return (new Date(y, m - 1, d).getTime() - Date.now()) / 86_400_000 <= 7;
  }, []);
  const rate = Math.min(1, (ex?.rate ?? 0.8) + (immersion ? 0.05 : 0));
  const [stage, setStage] = useState<Stage>(shadowOnly ? 'shadow' : 'intro');
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [gistChoice, setGistChoice] = useState<number | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [qChoice, setQChoice] = useState<number | null>(null);
  const [qCorrect, setQCorrect] = useState(0);
  const [shadowIdx, setShadowIdx] = useState(0);
  const [shadowScores, setShadowScores] = useState<number[]>([]);
  const [shadowFb, setShadowFb] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
      stopSpeaking();
    },
    [],
  );

  if (!ex) {
    return (
      <ActivityShell title="Listening" onClose={onClose}>
        <p>Exercise not found.</p>
      </ActivityShell>
    );
  }

  const playAll = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      setActiveLine(null);
      return;
    }
    setPlaying(true);
    setPlays((p) => p + 1);
    for (let i = 0; i < ex.lines.length; i++) {
      if (cancelled.current) break;
      setActiveLine(i);
      await speak(ex.lines[i].es, rate);
      await new Promise((r) => setTimeout(r, 350));
    }
    setActiveLine(null);
    setPlaying(false);
  };

  const shadowLines = ex.lines.slice(0, Math.min(ex.lines.length, immersion ? 8 : 6));
  const minutes = () => (Date.now() - startedAt.current) / 60000;

  const finishShadow = (scores: number[]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    recordSpeaking(scores.length * 0.15, avg);
    if (shadowOnly) {
      recordListening(ex.id, Math.max(0.5, avg), minutes());
      markActivityDone('shadowing', ex.id);
    } else {
      markActivityDone('listening', ex.id);
    }
    setStage('done');
  };

  const PlayButton = () => (
    <button type="button" className={`btn ${playing ? 'bad' : 'primary'} lg block`} onClick={playAll}>
      {playing ? '◼ Stop' : plays === 0 ? '▶ Play' : '▶ Play again'}
    </button>
  );

  if (stage === 'intro') {
    return (
      <ActivityShell title={`Listening · ${ex.title}`} progress={0} onClose={onClose}>
        <span className="chip accent">Stage 1 · Listen for meaning</span>
        <h1 style={{ marginTop: 8 }}>{ex.title}</h1>
        <p className="muted">{ex.context}</p>
        <div className="card soft small">
          Listen without reading. Do not try to catch every word. Just work out what is happening. Speed: {Math.round(rate * 100)}%.
        </div>
        <PlayButton />
        {activeLine !== null && <p className="center small muted" style={{ marginTop: 10 }}>Line {activeLine + 1} of {ex.lines.length}</p>}
        <button type="button" className="btn block" style={{ marginTop: 10 }} disabled={plays === 0 || playing} onClick={() => setStage('gist')}>
          I have an idea what is happening
        </button>
      </ActivityShell>
    );
  }

  if (stage === 'gist') {
    return (
      <ActivityShell title={`Listening · ${ex.title}`} progress={0.2} onClose={onClose}>
        <span className="chip accent">Stage 1 · What is happening?</span>
        <div className="options" style={{ marginTop: 12 }}>
          {ex.gistOptions.map((o, i) => (
            <button
              key={o}
              type="button"
              className={`option ${gistChoice === null ? '' : i === ex.gistAnswer ? 'correct' : gistChoice === i ? 'wrong' : ''}`}
              disabled={gistChoice !== null}
              onClick={() => setGistChoice(i)}
            >
              {o}
            </button>
          ))}
        </div>
        {gistChoice !== null && (
          <>
            <p className="small muted" style={{ marginTop: 10 }}>
              {gistChoice === ex.gistAnswer ? 'Right. ' : 'Not quite. '}
              {ex.gist}
            </p>
            <button type="button" className="btn primary block" onClick={() => setStage('questions')}>
              Listen again for details
            </button>
          </>
        )}
      </ActivityShell>
    );
  }

  if (stage === 'questions') {
    const q = ex.questions[qIdx];
    return (
      <ActivityShell title={`Listening · ${ex.title}`} progress={0.4} onClose={onClose}>
        <span className="chip accent">Stage 2 · Listen again</span>
        <div style={{ margin: '12px 0' }}>
          <PlayButton />
        </div>
        <div className="card">
          <div className="small muted">
            Question {qIdx + 1} of {ex.questions.length}
          </div>
          <h3>{q.q}</h3>
          <div className="options">
            {q.options.map((o, i) => (
              <button
                key={o}
                type="button"
                className={`option ${qChoice === null ? '' : i === q.answer ? 'correct' : qChoice === i ? 'wrong' : ''}`}
                disabled={qChoice !== null}
                onClick={() => {
                  setQChoice(i);
                  if (i === q.answer) setQCorrect((c) => c + 1);
                }}
              >
                {o}
              </button>
            ))}
          </div>
          {qChoice !== null && (
            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 10 }}
              onClick={() => {
                setQChoice(null);
                if (qIdx + 1 < ex.questions.length) setQIdx(qIdx + 1);
                else setStage('transcript');
              }}
            >
              {qIdx + 1 < ex.questions.length ? 'Next question' : 'See the transcript'}
            </button>
          )}
        </div>
      </ActivityShell>
    );
  }

  if (stage === 'transcript') {
    const score = ((gistChoice === ex.gistAnswer ? 1 : 0) + qCorrect) / (1 + ex.questions.length);
    return (
      <ActivityShell title={`Listening · ${ex.title}`} progress={0.6} onClose={onClose}>
        <span className="chip accent">Stage 3 · Listen with the transcript</span>
        <p className="small muted" style={{ marginTop: 8 }}>
          You understood {Math.round(score * 100)}%. Key phrases are highlighted. Play again and follow along.
        </p>
        <PlayButton />
        <div className="card" style={{ marginTop: 12 }}>
          {ex.lines.map((l, i) => (
            <div key={i} className={`transcript-line ${activeLine === i ? 'active' : ''}`}>
              <div className="who">{l.speaker}</div>
              <div style={{ fontSize: 17 }}>{highlight(l.es, ex.keyPhrases)}</div>
              <div className="small muted">{l.en}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn primary block lg"
          disabled={playing}
          onClick={() => {
            recordListening(ex.id, score, minutes());
            setStage('shadow');
          }}
        >
          Shadowing
        </button>
      </ActivityShell>
    );
  }

  if (stage === 'shadow') {
    const line = shadowLines[shadowIdx];
    return (
      <ActivityShell title={`Shadowing · ${shadowIdx + 1}/${shadowLines.length}`} progress={0.6 + (0.4 * shadowIdx) / shadowLines.length} onClose={onClose}>
        <span className="chip accent">Stage 4 · Shadow</span>
        <p className="small muted" style={{ marginTop: 8 }}>
          Play the sentence, then repeat it aloud straight away, copying the rhythm.
        </p>
        <div className="flashcard">
          <div className="who small muted">{line.speaker}</div>
          <div className="es">{line.es}</div>
          <div className="small muted">{line.en}</div>
          <AudioButton text={line.es} rate={rate} label="Play" />
        </div>
        {shadowFb && <div className="chip sun" style={{ display: 'block', textAlign: 'center', marginBottom: 10 }}>{shadowFb}</div>}
        <MicInput
          key={shadowIdx}
          onResult={(t) => {
            const g = grade(t, line.es);
            const scores = [...shadowScores, g.score];
            setShadowScores(scores);
            setShadowFb(g.grade === 'correct' ? 'Clear' : g.grade === 'close' ? `Close: "${t}"` : `Heard: "${t}"`);
            setTimeout(() => {
              setShadowFb(null);
              if (shadowIdx + 1 < shadowLines.length) setShadowIdx(shadowIdx + 1);
              else finishShadow(scores);
            }, 900);
          }}
          hint="Repeat the sentence"
        />
      </ActivityShell>
    );
  }

  const avg = shadowScores.reduce((a, b) => a + b, 0) / Math.max(1, shadowScores.length);
  return (
    <ActivityShell title={ex.title} progress={1} onClose={onClose}>
      <div className="card center">
        <div style={{ fontSize: 48 }}>🎧</div>
        <h2>Listening complete</h2>
        <p className="muted">
          {minutes().toFixed(1)} minutes · shadowing clarity {Math.round(avg * 100)}%
        </p>
        <button type="button" className="btn primary block" onClick={onClose}>
          Done
        </button>
      </div>
    </ActivityShell>
  );
}

function highlight(text: string, keys: string[]) {
  const hits = keys.filter((k) => k && text.includes(k)).sort((a, b) => b.length - a.length);
  if (!hits.length) return text;
  const parts: (string | JSX.Element)[] = [];
  let rest = text;
  let n = 0;
  while (rest.length) {
    let best: { k: string; at: number } | null = null;
    for (const k of hits) {
      const at = rest.indexOf(k);
      if (at >= 0 && (best === null || at < best.at)) best = { k, at };
    }
    if (!best) {
      parts.push(rest);
      break;
    }
    if (best.at > 0) parts.push(rest.slice(0, best.at));
    parts.push(<mark key={n++}>{best.k}</mark>);
    rest = rest.slice(best.at + best.k.length);
  }
  return <>{parts}</>;
}
