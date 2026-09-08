import { useEffect, useRef, useState, type ReactNode } from 'react';
import { listen, speak, sttAvailable, stopSpeaking } from '../engine/speech';
import { getState } from '../state/store';

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={`bar ${className}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AudioButton({ text, rate, label, className = '', size = 'md' }: { text: string; rate?: number; label?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [playing, setPlaying] = useState(false);
  const r = rate ?? getState().settings.ttsRate;
  return (
    <button
      type="button"
      className={`btn ${size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''} ${label ? '' : 'icon'} ${className}`}
      onClick={async () => {
        if (playing) {
          stopSpeaking();
          setPlaying(false);
          return;
        }
        setPlaying(true);
        await speak(text, r);
        setPlaying(false);
      }}
      aria-label={label ?? 'Play audio'}
    >
      <span>{playing ? '◼' : '🔊'}</span>
      {label && <span>{label}</span>}
    </button>
  );
}

/** Speak the text automatically once when mounted (or when text changes). */
export function useAutoSpeak(text: string | null | undefined, rate?: number, enabled = true) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !text || last.current === text) return;
    last.current = text;
    const r = rate ?? getState().settings.ttsRate;
    const t = setTimeout(() => void speak(text, r), 250);
    return () => clearTimeout(t);
  }, [text, rate, enabled]);
}

/** Remembered across remounts so a learner who chose typing keeps typing. */
let preferTyping: boolean | null = null;

export interface MicInputProps {
  /** Called with the final text (spoken or typed). */
  onResult: (text: string, via: 'voice' | 'typed') => void;
  placeholder?: string;
  disabled?: boolean;
  /** Keep listening across pauses (long speaking tasks). */
  continuous?: boolean;
  maxMs?: number;
  /** Show the typed fallback even when speech recognition exists. */
  allowTyping?: boolean;
  /** Label under the button. */
  hint?: string;
  autoStart?: boolean;
  /** Called on each interim transcript while listening. */
  onInterim?: (text: string) => void;
}

/**
 * Microphone input with a typed fallback. Speech recognition is preferred;
 * typing is offered when the browser has no recognition, or on request.
 */
export function MicInput({ onResult, placeholder, disabled, continuous, maxMs, allowTyping = true, hint, autoStart, onInterim }: MicInputProps) {
  const has = sttAvailable();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [typing, setTypingState] = useState(preferTyping ?? !has);
  const setTyping = (v: boolean) => {
    preferTyping = v;
    setTypingState(v);
  };
  const [typed, setTyped] = useState('');
  const handle = useRef<ReturnType<typeof listen> | null>(null);
  const started = useRef(false);

  const start = async () => {
    if (listening || disabled) return;
    stopSpeaking();
    setInterim('');
    setListening(true);
    const h = listen({
      continuous,
      maxMs: maxMs ?? (continuous ? 180_000 : 12_000),
      onInterim: (t) => {
        setInterim(t);
        onInterim?.(t);
      },
    });
    handle.current = h;
    const text = await h.result;
    handle.current = null;
    setListening(false);
    setInterim('');
    if (text) onResult(text, 'voice');
  };

  const stop = () => handle.current?.stop();

  useEffect(() => {
    if (autoStart && has && !started.current && !disabled) {
      started.current = true;
      void start();
    }
    return () => handle.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, disabled]);

  if (typing) {
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!typed.trim()) return;
          onResult(typed.trim(), 'typed');
          setTyped('');
        }}
      >
        {!has && <p className="small muted center">Your browser has no speech recognition. Say it aloud, then type what you said. Chrome or Safari enable the microphone.</p>}
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={placeholder ?? 'Escribe en español…'} autoFocus disabled={disabled} />
        <div className="row">
          <button type="submit" className="btn primary" disabled={disabled || !typed.trim()}>
            Send
          </button>
          {has && (
            <button type="button" className="btn ghost" onClick={() => setTyping(false)}>
              Use microphone
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="mic">
      <div className={`transcript ${interim ? '' : 'empty'}`}>{interim || (listening ? 'Listening… speak in Spanish' : hint ?? 'Tap the microphone and speak')}</div>
      <button type="button" className={`mic-btn ${listening ? 'listening' : ''}`} onClick={listening ? stop : start} disabled={disabled} aria-label={listening ? 'Stop' : 'Speak'}>
        {listening ? '■' : '🎙️'}
      </button>
      <div className="row">
        <span className="small muted">{listening ? 'Tap to stop' : 'Tap to speak'}</span>
        {allowTyping && (
          <button type="button" className="btn ghost sm" onClick={() => setTyping(true)}>
            Type instead
          </button>
        )}
      </div>
    </div>
  );
}

export function ActivityShell({ title, progress, onClose, children, footer }: { title: string; progress?: number; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      stopSpeaking();
    };
  }, []);
  return (
    <div className="activity">
      <div className="activity-top">
        <button type="button" className="btn icon sm" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div style={{ flex: 1 }}>
          <div className="small" style={{ fontWeight: 700 }}>
            {title}
          </div>
          {progress !== undefined && <Bar value={progress} className="thin" />}
        </div>
      </div>
      <div className="activity-body">{children}</div>
      {footer && <div className="activity-foot">{footer}</div>}
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="toast">{text}</div>;
}

export function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return seconds;
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="ready-row">
      <div className="label">{label}</div>
      <Bar value={value} className={value >= 0.8 ? 'primary' : value >= 0.5 ? '' : 'sun'} />
      <div className="pct">{Math.round(value * 100)}%</div>
    </div>
  );
}
