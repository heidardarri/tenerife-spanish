import { useState } from 'react';
import { ASSESSMENT, scoreAssessment, type AssessmentResult } from '../engine/assessment';
import { AudioButton, MicInput } from '../components/common';
import { completeOnboarding, DEPARTURE_DEFAULT } from '../state/store';
import { daysBetween, toDateKey } from '../engine/calendar';
import { hasSpanishVoice, sttAvailable, ttsAvailable } from '../engine/speech';

type Step = 'welcome' | 'about' | 'assess' | 'result';

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [departure, setDeparture] = useState(DEPARTURE_DEFAULT);
  const [minutes, setMinutes] = useState(45);
  const [about, setAbout] = useState({ from: '', work: '', hobbies: '', whyTenerife: '' });
  const [answers, setAnswers] = useState<(number | string)[]>([]);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const days = daysBetween(toDateKey(new Date()), departure);

  if (step === 'welcome') {
    return (
      <div className="screen" style={{ paddingTop: 40 }}>
        <div className="center" style={{ fontSize: 64 }}>
          🌴
        </div>
        <h1 className="center">Tenerife Spanish</h1>
        <p className="center muted">Your personal Spanish coach from today until you land. One clear plan every day. Real speaking every day.</p>
        <div className="card" style={{ marginTop: 24 }}>
          <label className="field">
            <span>Your first name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anna" autoFocus />
          </label>
          <label className="field">
            <span>Departure date</span>
            <input className="input" type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </label>
          <p className="small muted">{days > 0 ? `${days} days to prepare. The 15-week course will be fitted to that.` : 'Pick a date in the future.'}</p>
          <label className="field">
            <span>Usual daily study time</span>
            <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[10, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes{m === 45 ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card soft small">
          <div className="row between">
            <span>Spanish audio</span>
            <span className={`chip ${ttsAvailable() ? 'good' : 'bad'}`}>{ttsAvailable() ? (hasSpanishVoice() ? 'Spanish voice ready' : 'Available') : 'Not available'}</span>
          </div>
          <div className="row between" style={{ marginTop: 6 }}>
            <span>Speech recognition</span>
            <span className={`chip ${sttAvailable() ? 'good' : 'warn'}`}>{sttAvailable() ? 'Ready' : 'Typing fallback'}</span>
          </div>
          {!sttAvailable() && <p className="muted" style={{ marginTop: 8 }}>For speaking exercises, use Chrome, Edge or Safari so the app can hear you.</p>}
        </div>
        <button type="button" className="btn primary block lg" disabled={!name.trim() || days <= 0} onClick={() => setStep('about')}>
          Continue
        </button>
      </div>
    );
  }

  if (step === 'about') {
    return (
      <div className="screen" style={{ paddingTop: 30 }}>
        <h1>About you</h1>
        <p className="muted">Your conversation partner will use this to ask you real questions. Short answers in English are fine.</p>
        <div className="card">
          <label className="field">
            <span>Where are you from?</span>
            <input className="input" value={about.from} onChange={(e) => setAbout({ ...about, from: e.target.value })} placeholder="Reykjavík, Iceland" />
          </label>
          <label className="field">
            <span>What do you do for work or study?</span>
            <input className="input" value={about.work} onChange={(e) => setAbout({ ...about, work: e.target.value })} placeholder="Software developer" />
          </label>
          <label className="field">
            <span>Hobbies</span>
            <input className="input" value={about.hobbies} onChange={(e) => setAbout({ ...about, hobbies: e.target.value })} placeholder="Hiking, cooking, football" />
          </label>
          <label className="field">
            <span>Why Tenerife?</span>
            <input className="input" value={about.whyTenerife} onChange={(e) => setAbout({ ...about, whyTenerife: e.target.value })} placeholder="Winter sun, the Teide, good food" />
          </label>
        </div>
        <button type="button" className="btn primary block lg" onClick={() => setStep('assess')}>
          Quick level check (2 min)
        </button>
      </div>
    );
  }

  if (step === 'assess') {
    const item = ASSESSMENT[idx];
    const answer = (a: number | string) => {
      const next = [...answers];
      next[idx] = a;
      setAnswers(next);
      if (idx + 1 < ASSESSMENT.length) setIdx(idx + 1);
      else {
        setResult(scoreAssessment(next));
        setStep('result');
      }
    };
    return (
      <div className="screen" style={{ paddingTop: 30 }}>
        <div className="row between">
          <h2>Level check</h2>
          <span className="chip">
            {idx + 1} / {ASSESSMENT.length}
          </span>
        </div>
        <p className="muted small">Guess if you are unsure. There is no pass mark; this only sets the starting point.</p>
        <div className="flashcard">
          {item.kind === 'recognise' && (
            <>
              <div className="kind">What does this mean?</div>
              <div className="es big">{item.es}</div>
            </>
          )}
          {item.kind === 'listen' && (
            <>
              <div className="kind">Listen. What did you hear?</div>
              <AudioButton text={item.es} label="Play" rate={0.8} size="lg" />
            </>
          )}
          {item.kind === 'produce' && (
            <>
              <div className="kind">Say it in Spanish</div>
              <div className="es">{item.en}</div>
            </>
          )}
        </div>
        {item.kind !== 'produce' ? (
          <div className="options">
            {item.options.map((o, i) => (
              <button key={o} type="button" className="option" onClick={() => answer(i)}>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <>
            <MicInput onResult={(t) => answer(t)} hint="Say it in Spanish, or type it" />
            <button type="button" className="btn ghost block" onClick={() => answer('')}>
              I don't know yet
            </button>
          </>
        )}
      </div>
    );
  }

  const r = result!;
  return (
    <div className="screen" style={{ paddingTop: 40 }}>
      <div className="center" style={{ fontSize: 56 }}>
        {r.level === 'complete-beginner' ? '🌱' : r.level === 'some-basics' ? '🌿' : '🌳'}
      </div>
      <h1 className="center">{r.level === 'complete-beginner' ? 'Complete beginner' : r.level === 'some-basics' ? 'Some basics' : 'Beginner plus'}</h1>
      <p className="center muted">{r.summary}</p>
      <div className="card">
        <h3>Your goal</h3>
        <p>
          By <b>{departure}</b>, hold a simple 10 to 30 minute conversation with a local in Tenerife: introduce yourself, order food, get around, check in, handle a problem, talk about your day and your plans.
        </p>
        <p className="muted small">Perfect grammar is not the goal. Being understood is.</p>
      </div>
      <button
        type="button"
        className="btn primary block lg"
        onClick={() =>
          completeOnboarding({ name: name.trim(), departureDate: departure, defaultMinutes: minutes, about }, r.level, r.knownPhraseIds)
        }
      >
        Start day 1
      </button>
    </div>
  );
}
