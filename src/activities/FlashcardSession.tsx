import { useMemo, useState } from 'react';
import { ActivityShell, AudioButton, MicInput, useAutoSpeak } from '../components/common';
import { getState, markActivityDone, recordFlashcardReview, recordSpeaking } from '../state/store';
import { dueCards, weakCards } from '../engine/srs';
import { grade, normalize } from '../engine/text';
import { PHRASES, PHRASE_BY_ID } from '../data';
import type { CardState, Phrase } from '../types';
import { cardText } from '../screens/Review';

type CardKind = 'produce' | 'listen' | 'situation' | 'cloze' | 'reverse';

interface Item {
  card: CardState;
  kind: CardKind;
  es: string;
  en: string;
  situation: string;
  phrase?: Phrase;
}

function pickKind(card: CardState, phrase: Phrase | undefined, i: number): CardKind {
  const m = card.mastery;
  if (m <= 1) return i % 2 === 0 ? 'listen' : 'reverse';
  if (m === 2) return phrase?.cloze && i % 2 === 0 ? 'cloze' : 'produce';
  return i % 3 === 0 ? 'produce' : i % 3 === 1 ? 'situation' : phrase?.cloze ? 'cloze' : 'listen';
}

export function phraseHints(es: string): { keyword: string; structure: string; full: string } {
  const words = es.replace(/[¿¡?!.,]/g, '').split(/\s+/).filter(Boolean);
  const content = words.find((w) => w.length > 3) ?? words[0] ?? '';
  const structure = words.map((w, i) => (i === 0 || i === words.length - 1 || w.length <= 2 ? w : '___')).join(' ');
  return { keyword: `Starts with "${words[0] ?? ''}" and uses "${content}"`, structure, full: es };
}

function distractors(en: string, n: number): string[] {
  const pool = PHRASES.map((p) => p.en).filter((x) => x !== en);
  const out: string[] = [];
  const seed = normalize(en).length;
  for (let i = 0; out.length < n && i < pool.length; i++) {
    const pick = pool[(seed * 7 + i * 13) % pool.length];
    if (!out.includes(pick)) out.push(pick);
  }
  return out;
}

export function FlashcardSession({ mode, onClose }: { mode: 'due' | 'weak' | 'mistakes' | 'all'; onClose: () => void }) {
  const items = useMemo<Item[]>(() => {
    const s = getState();
    const now = new Date();
    let cards: CardState[];
    if (mode === 'due') cards = dueCards(s.cards, now);
    else if (mode === 'weak') cards = weakCards(s.cards);
    else if (mode === 'mistakes') cards = Object.values(s.cards).filter((c) => c.custom);
    else {
      const seen = new Set<string>();
      cards = [...dueCards(s.cards, now), ...weakCards(s.cards), ...Object.values(s.cards).filter((c) => c.custom)].filter((c) => {
        if (seen.has(c.phraseId)) return false;
        seen.add(c.phraseId);
        return true;
      });
    }
    return cards.slice(0, 25).map((card, i) => {
      const phrase = PHRASE_BY_ID[card.phraseId];
      const t = cardText(card);
      return { card, kind: pickKind(card, phrase, i), ...t, phrase };
    });
  }, [mode]);

  const [queue, setQueue] = useState<Item[]>(items);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [helpLevel, setHelpLevel] = useState<0 | 1 | 2 | 3>(0);
  const [results, setResults] = useState<{ ok: number; total: number; voiceSecs: number }>({ ok: 0, total: 0, voiceSecs: 0 });
  const [relearned, setRelearned] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  const item = queue[idx];
  useAutoSpeak(item && item.kind === 'listen' && !revealed ? item.es : null);

  if (!items.length) {
    return (
      <ActivityShell title="Flashcards" onClose={onClose}>
        <div className="card center">
          <div style={{ fontSize: 48 }}>✅</div>
          <h2>Nothing to review right now</h2>
          <p className="muted">Cards come back on their review dates. Learn new phrases from today's plan.</p>
          <button type="button" className="btn primary" onClick={() => { markActivityDone('flashcards'); onClose(); }}>
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  if (finished || !item) {
    const minutes = (Date.now() - startedAt) / 60000;
    return (
      <ActivityShell title="Flashcards" onClose={onClose}>
        <div className="card center">
          <div style={{ fontSize: 48 }}>🃏</div>
          <h2>
            {results.ok} of {results.total} recalled
          </h2>
          <p className="muted">
            {minutes.toFixed(1)} minutes. Cards you missed come back in ten minutes and again tomorrow.
          </p>
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              markActivityDone('flashcards');
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </ActivityShell>
    );
  }

  const options = item.kind === 'listen' || item.kind === 'reverse' ? shuffle([item.en, ...distractors(item.en, 2)], item.es) : [];
  const graded = answer !== null ? grade(answer, item.kind === 'cloze' ? item.phrase!.cloze!.answer : item.es) : null;
  const mcCorrect = choice !== null ? options[choice] === item.en : null;
  const hints = phraseHints(item.es);

  const finish = (outcome: 'wrong' | 'hard' | 'good' | 'easy') => {
    recordFlashcardReview(item.card.phraseId, outcome, helpLevel, 3);
    const ok = outcome !== 'wrong';
    setResults((r) => ({ ...r, ok: r.ok + (ok ? 1 : 0), total: r.total + 1 }));
    let next = queue;
    if (!ok && !relearned.has(item.card.phraseId)) {
      // Re-queue once at the end of the session with a production task.
      next = [...queue, { ...item, kind: item.kind === 'listen' || item.kind === 'reverse' ? 'produce' : item.kind }];
      setQueue(next);
      setRelearned(new Set(relearned).add(item.card.phraseId));
    }
    setRevealed(false);
    setAnswer(null);
    setChoice(null);
    setHelpLevel(0);
    if (idx + 1 >= next.length) {
      if (results.voiceSecs > 0) recordSpeaking(results.voiceSecs / 60, results.ok / Math.max(1, results.total));
      setFinished(true);
    } else setIdx(idx + 1);
  };

  const KIND_LABEL: Record<CardKind, string> = {
    produce: 'Say it in Spanish',
    listen: 'Listen. What did you hear?',
    situation: 'What do you say?',
    cloze: 'Complete the sentence',
    reverse: 'What does this mean?',
  };

  return (
    <ActivityShell title={`Flashcards · ${idx + 1}/${queue.length}`} progress={idx / queue.length} onClose={onClose}>
      <div className="flashcard">
        <div className="kind">{KIND_LABEL[item.kind]}</div>
        {item.kind === 'produce' && <div className="es">{item.en}</div>}
        {item.kind === 'situation' && (
          <div>
            <div style={{ fontSize: 18 }}>{item.situation || item.en}</div>
          </div>
        )}
        {item.kind === 'cloze' && <div className="es">{item.phrase!.cloze!.text}</div>}
        {item.kind === 'reverse' && <div className="es">{item.es}</div>}
        {item.kind === 'listen' && <AudioButton text={item.es} label="Play again" size="lg" />}
        {item.card.custom && <span className="chip sun">From a conversation</span>}

        {helpLevel > 0 && !revealed && (
          <div className="card soft small" style={{ margin: 0, width: '100%', textAlign: 'left' }}>
            <div>💡 {hints.keyword}</div>
            {helpLevel >= 2 && <div style={{ marginTop: 4, fontWeight: 600 }}>{hints.structure}</div>}
            {helpLevel >= 3 && <div style={{ marginTop: 4 }} className="es">{hints.full}</div>}
          </div>
        )}

        {revealed && (
          <div className="reveal">
            <div className="row" style={{ justifyContent: 'center' }}>
              <div className="es">{item.es}</div>
              <AudioButton text={item.es} size="sm" />
            </div>
            <div className="muted">{item.en}</div>
            {item.phrase?.note && <div className="small muted" style={{ marginTop: 6 }}>{item.phrase.note}</div>}
            {answer !== null && (
              <div className={`chip ${graded!.grade === 'correct' ? 'good' : graded!.grade === 'close' ? 'sun' : 'bad'}`} style={{ marginTop: 8 }}>
                You said: “{answer}” · {graded!.grade === 'correct' ? 'correct' : graded!.grade === 'close' ? 'close' : 'not quite'}
              </div>
            )}
          </div>
        )}
      </div>

      {!revealed && (item.kind === 'produce' || item.kind === 'situation') && (
        <>
          <MicInput
            key={item.card.phraseId + idx}
            onResult={(t, via) => {
              setAnswer(t);
              setRevealed(true);
              if (via === 'voice') setResults((r) => ({ ...r, voiceSecs: r.voiceSecs + 8 }));
            }}
            hint="Say the Spanish phrase aloud"
          />
          <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button type="button" className="btn ghost sm" disabled={helpLevel >= 3} onClick={() => setHelpLevel((h) => Math.min(3, h + 1) as 0 | 1 | 2 | 3)}>
              💡 Help {helpLevel > 0 ? `(${helpLevel}/3)` : ''}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setRevealed(true)}>
              Show answer
            </button>
          </div>
        </>
      )}

      {!revealed && item.kind === 'cloze' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const v = (e.currentTarget.elements.namedItem('cloze') as HTMLInputElement).value;
            setAnswer(v);
            setRevealed(true);
          }}
        >
          <input className="input" name="cloze" placeholder="Missing word" autoFocus autoComplete="off" />
          <div className="row">
            <button type="submit" className="btn primary">
              Check
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setRevealed(true)}>
              Show answer
            </button>
          </div>
        </form>
      )}

      {!revealed && (item.kind === 'listen' || item.kind === 'reverse') && (
        <div className="options">
          {options.map((o, i) => (
            <button
              key={o}
              type="button"
              className="option"
              onClick={() => {
                setChoice(i);
                setRevealed(true);
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {revealed && (
        <div className="stack">
          {(item.kind === 'listen' || item.kind === 'reverse') && (
            <>
              <div className={`chip ${mcCorrect ? 'good' : 'bad'}`} style={{ alignSelf: 'center' }}>
                {mcCorrect ? 'Correct' : 'Not that one'}
              </div>
              <p className="small muted center">Now say it aloud once before moving on.</p>
              <div className="row">
                <button type="button" className="btn bad" style={{ flex: 1 }} onClick={() => finish('wrong')}>
                  Again
                </button>
                <button type="button" className="btn good" style={{ flex: 1 }} onClick={() => finish(mcCorrect ? 'good' : 'wrong')}>
                  {mcCorrect ? 'Got it' : 'Next'}
                </button>
              </div>
            </>
          )}
          {(item.kind === 'produce' || item.kind === 'situation' || item.kind === 'cloze') && (
            <div className="row">
              <button type="button" className="btn bad" style={{ flex: 1 }} onClick={() => finish('wrong')}>
                Missed it
              </button>
              <button type="button" className="btn warn" style={{ flex: 1 }} onClick={() => finish('hard')}>
                Hard
              </button>
              <button type="button" className="btn good" style={{ flex: 1 }} onClick={() => finish(graded?.grade === 'correct' && helpLevel === 0 ? 'easy' : 'good')}>
                Got it
              </button>
            </div>
          )}
        </div>
      )}
    </ActivityShell>
  );
}

function shuffle<T>(arr: T[], seedStr: string): T[] {
  const a = [...arr];
  let seed = seedStr.length * 31 + (seedStr.charCodeAt(0) || 0);
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
