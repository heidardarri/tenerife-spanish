/**
 * Thin wrappers over the Web Speech API.
 * TTS: speechSynthesis with a Spanish (ideally es-ES) voice.
 * STT: SpeechRecognition (Chrome, Edge, Safari). Falls back to typing when absent.
 */

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet, try again next time
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    let s = 0;
    if (lang === 'es-es') s += 10;
    else if (lang.startsWith('es')) s += 6;
    else return -1;
    if (/monica|mónica|jorge|elvira|alvaro|álvaro|lucia|lucía|paulina|conchita/i.test(v.name)) s += 3;
    if (/google|microsoft|apple|natural|premium|enhanced/i.test(v.name)) s += 2;
    if (v.localService) s += 1;
    return s;
  };
  const best = voices.map((v) => ({ v, s: score(v) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)[0];
  cachedVoice = best ? best.v : null;
  return cachedVoice;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = undefined;
  });
}

export function ttsAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function hasSpanishVoice(): boolean {
  return pickVoice() !== null;
}

let current: SpeechSynthesisUtterance | null = null;

export function speak(text: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'es-ES';
    u.rate = Math.max(0.5, Math.min(1.2, rate));
    u.pitch = 1;
    u.onend = () => {
      current = null;
      resolve();
    };
    u.onerror = () => {
      current = null;
      resolve();
    };
    current = u;
    speechSynthesis.speak(u);
    // Safari sometimes needs a nudge.
    if (speechSynthesis.paused) speechSynthesis.resume();
  });
}

export function stopSpeaking(): void {
  if (ttsAvailable()) speechSynthesis.cancel();
  current = null;
}

export function isSpeaking(): boolean {
  return current !== null;
}

// ---------------------------------------------------------------------------
// Speech recognition
// ---------------------------------------------------------------------------

type SR = typeof window extends { SpeechRecognition: infer T } ? T : any;

function getSR(): SR | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function sttAvailable(): boolean {
  return getSR() !== null;
}

export interface ListenOptions {
  lang?: string;
  /** Stop automatically after this many ms of total listening. */
  maxMs?: number;
  /** Called with interim results. */
  onInterim?: (text: string) => void;
  /** Keep listening across pauses (for long speaking tasks). */
  continuous?: boolean;
}

export interface ListenHandle {
  stop: () => void;
  result: Promise<string>;
}

/** Listen once and resolve with the transcript (empty string on no speech). */
export function listen(opts: ListenOptions = {}): ListenHandle {
  const Ctor = getSR();
  if (!Ctor) {
    return { stop: () => {}, result: Promise.resolve('') };
  }
  const rec = new Ctor();
  rec.lang = opts.lang ?? 'es-ES';
  rec.interimResults = true;
  rec.continuous = opts.continuous ?? false;
  rec.maxAlternatives = 1;
  let finalText = '';
  let stopped = false;
  let timer: any;

  const result = new Promise<string>((resolve) => {
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += (finalText ? ' ' : '') + r[0].transcript;
        else interim += r[0].transcript;
      }
      opts.onInterim?.((finalText + ' ' + interim).trim());
    };
    rec.onerror = () => {
      /* resolved by onend */
    };
    rec.onend = () => {
      clearTimeout(timer);
      resolve(finalText.trim());
    };
    try {
      rec.start();
    } catch {
      resolve('');
    }
    if (opts.maxMs) {
      timer = setTimeout(() => {
        if (!stopped) {
          stopped = true;
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
        }
      }, opts.maxMs);
    }
  });

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    result,
  };
}
