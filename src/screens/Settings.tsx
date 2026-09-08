import { useState } from 'react';
import type { Nav } from '../App';
import { exportState, importState, resetAll, updateSettings, useStore } from '../state/store';
import { testApiKey, MODEL } from '../engine/tutor';
import { speak, hasSpanishVoice, sttAvailable } from '../engine/speech';

export function SettingsScreen({ nav }: { nav: Nav }) {
  const state = useStore();
  const s = state.settings;
  const [key, setKey] = useState(s.apiKey ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importText, setImportText] = useState('');

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Settings</h1>
        <button type="button" className="btn sm" onClick={() => nav.go('today')}>
          Done
        </button>
      </div>

      <div className="card">
        <h3>AI conversation partner</h3>
        <p className="small muted">
          Conversations use the Claude model <code>{MODEL}</code> through your own Anthropic API key. The key stays in this browser's storage and is sent only to api.anthropic.com. Without a key, conversations follow a scripted path.
        </p>
        <label className="field">
          <span>Anthropic API key</span>
          <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
        </label>
        <div className="row">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              updateSettings({ apiKey: key.trim() || undefined });
              setTestResult(key.trim() ? 'Saved.' : 'Key removed. Scripted partner active.');
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="btn"
            disabled={!key.trim() || testing}
            onClick={async () => {
              setTesting(true);
              setTestResult(null);
              try {
                const r = await testApiKey(key);
                setTestResult(`Connected: ${r}`);
              } catch (e) {
                setTestResult(`Failed: ${(e as Error).message}`);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? <span className="spinner" /> : 'Test'}
          </button>
        </div>
        {testResult && <p className="small" style={{ marginTop: 8 }}>{testResult}</p>}
      </div>

      <div className="card">
        <h3>Audio</h3>
        <div className="row between small">
          <span>Spanish voice</span>
          <span className={`chip ${hasSpanishVoice() ? 'good' : 'warn'}`}>{hasSpanishVoice() ? 'Found' : 'Default voice'}</span>
        </div>
        <div className="row between small" style={{ marginTop: 6 }}>
          <span>Speech recognition</span>
          <span className={`chip ${sttAvailable() ? 'good' : 'warn'}`}>{sttAvailable() ? 'Available' : 'Typing fallback'}</span>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Speaking speed: {Math.round(s.ttsRate * 100)}%</span>
          <input type="range" min={0.6} max={1.1} step={0.05} value={s.ttsRate} onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
        <button type="button" className="btn sm" onClick={() => void speak('Hola, buenos días. ¿Qué tal estás?', s.ttsRate)}>
          🔊 Test voice
        </button>
      </div>

      <div className="card">
        <h3>Plan</h3>
        <label className="field">
          <span>Name</span>
          <input className="input" value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Departure date</span>
          <input className="input" type="date" value={s.departureDate} onChange={(e) => updateSettings({ departureDate: e.target.value })} />
        </label>
        <label className="field">
          <span>Default daily minutes</span>
          <select className="input" value={s.defaultMinutes} onChange={(e) => updateSettings({ defaultMinutes: Number(e.target.value) })}>
            {[10, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Where you are from</span>
          <input className="input" value={s.about.from} onChange={(e) => updateSettings({ about: { ...s.about, from: e.target.value } })} />
        </label>
        <label className="field">
          <span>Work</span>
          <input className="input" value={s.about.work} onChange={(e) => updateSettings({ about: { ...s.about, work: e.target.value } })} />
        </label>
        <label className="field">
          <span>Hobbies</span>
          <input className="input" value={s.about.hobbies} onChange={(e) => updateSettings({ about: { ...s.about, hobbies: e.target.value } })} />
        </label>
        <label className="field">
          <span>Why Tenerife</span>
          <input className="input" value={s.about.whyTenerife} onChange={(e) => updateSettings({ about: { ...s.about, whyTenerife: e.target.value } })} />
        </label>
      </div>

      <div className="card">
        <h3>Backup</h3>
        <p className="small muted">All progress lives in this browser. Export a backup to move it to another device.</p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const blob = new Blob([exportState()], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tenerife-spanish-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(exportState());
                setTestResult('Copied backup to clipboard.');
              } catch {
                setTestResult('Could not access the clipboard.');
              }
            }}
          >
            Copy
          </button>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Import (paste backup JSON)</span>
          <textarea className="input" rows={3} value={importText} onChange={(e) => setImportText(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!importText.trim()}
          onClick={() => {
            const ok = importState(importText);
            setTestResult(ok ? 'Imported.' : 'That did not look like a backup.');
            if (ok) setImportText('');
          }}
        >
          Import
        </button>
      </div>

      <div className="card flat">
        <h3>Reset</h3>
        {!confirmReset ? (
          <button type="button" className="btn bad" onClick={() => setConfirmReset(true)}>
            Delete all progress
          </button>
        ) : (
          <div className="row">
            <button
              type="button"
              className="btn bad"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
              }}
            >
              Yes, delete everything
            </button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
