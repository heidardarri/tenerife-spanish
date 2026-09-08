import { useMemo, useState } from 'react';
import { ActivityShell, AudioButton, MicInput } from '../components/common';
import { LESSON_BY_KEY, phrasesForLesson } from '../data';
import { getState, markActivityDone, recordFlashcardReview, recordSpeaking, today } from '../state/store';
import { grade } from '../engine/text';
import type { Phrase } from '../types';

/** End-of-day recap: say today's phrases from memory, English cue only. */
export function Recap({ onClose }: { onClose: () => void }) {
  const phrases = useMemo<Phrase[]>(() => {
    const s = getState();
    const plan = s.plans[today()];
    const ref = plan?.activities.find((a) => a.kind === 'phrases')?.ref;
    const lesson = ref ? LESSON_BY_KEY[ref] : undefined;
    if (lesson) return phrasesForLesson(lesson).slice(0, 6);
    // No lesson today (immersion): recap the six most recently reviewed cards.
    const recent = Object.values(s.cards)
      .filter((c) => c.lastReviewed)
      .sort((a, b) => (b.lastReviewed! > a.lastReviewed! ? 1 : -1))
      .slice(0, 6);
    return recent.map((c) => {
      const p = c.custom ? ({ id: c.phraseId, es: c.custom.es, en: c.custom.en, situation: c.custom.situation } as Phrase) : undefined;
      return p ?? (LESSON_BY_KEY && (Object.values(LESSON_BY_KEY).flatMap(phrasesForLesson).find((x) => x.id === c.phraseId) as Phrase));
    }).filter(Boolean) as Phrase[];
  }, []);
  const [i, setI] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [ok, setOk] = useState(0);

  if (!phrases.length) {
    return (
      <ActivityShell title="Recap" onClose={onClose}>
        <div className="card center">
          <p>Nothing to recap yet today.</p>
          <button type="button" className="btn primary" onClick={() => { markActivityDone('recap'); onClose(); }}>
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  if (i >= phrases.length) {
    return (
      <ActivityShell title="Recap" progress={1} onClose={onClose}>
        <div className="card center">
          <div style={{ fontSize: 48 }}>📝</div>
          <h2>
            {ok} of {phrases.length} from memory
          </h2>
          <p className="muted">That is the day. See you tomorrow.</p>
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              recordSpeaking(phrases.length * 0.12, ok / phrases.length);
              markActivityDone('recap');
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  const p = phrases[i];
  return (
    <ActivityShell title={`Recap · ${i + 1}/${phrases.length}`} progress={i / phrases.length} onClose={onClose}>
      <div className="flashcard">
        <div className="kind">From memory</div>
        <div style={{ fontSize: 20 }}>{p.en}</div>
        {fb && (
          <div className="reveal">
            <div className={`chip ${fb.ok ? 'good' : 'bad'}`}>{fb.text}</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <div className="es">{p.es}</div>
              <AudioButton text={p.es} size="sm" />
            </div>
          </div>
        )}
      </div>
      {!fb ? (
        <MicInput
          key={i}
          onResult={(t) => {
            const g = grade(t, p.es);
            const good = g.grade !== 'wrong';
            if (good) setOk((n) => n + 1);
            recordFlashcardReview(p.id, g.grade === 'correct' ? 'good' : g.grade === 'close' ? 'hard' : 'wrong');
            setFb({ ok: good, text: g.grade === 'correct' ? 'Yes' : g.grade === 'close' ? `Close: "${t}"` : `Not yet: "${t}"` });
          }}
          hint="Say it in Spanish"
        />
      ) : (
        <button
          type="button"
          className="btn primary block lg"
          onClick={() => {
            setFb(null);
            setI(i + 1);
          }}
        >
          Next
        </button>
      )}
    </ActivityShell>
  );
}
