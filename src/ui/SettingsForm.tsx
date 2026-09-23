import type { Settings } from './settings';

export function SettingsForm({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const slider = (k: 'master' | 'music' | 'sfx' | 'ambience', label: string) => (
    <label className="spread">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </label>
  );
  return (
    <div className="col" style={{ gap: 8, minWidth: 320 }}>
      <h3>Audio</h3>
      {slider('master', 'Master volume')}
      {slider('music', 'Music volume')}
      {slider('sfx', 'Effects volume')}
      {slider('ambience', 'Ambience volume')}
      <h3>Interface</h3>
      <label className="spread">
        <span>Enable touch controls</span>
        <input type="checkbox" checked={settings.touchControls} onChange={(e) => set('touchControls', e.target.checked)} />
      </label>
      <label className="spread">
        <span>UI scale</span>
        <select value={settings.uiScale} onChange={(e) => set('uiScale', Number(e.target.value))}>
          {[0.85, 1, 1.15, 1.3, 1.5].map((v) => (
            <option key={v} value={v}>
              {Math.round(v * 100)}%
            </option>
          ))}
        </select>
      </label>
      <label className="spread">
        <span>Show names on hover</span>
        <input type="checkbox" checked={settings.showNames} onChange={(e) => set('showNames', e.target.checked)} />
      </label>
      <h3>Performance</h3>
      <label className="spread">
        <span>Low resolution (saves battery)</span>
        <input type="checkbox" checked={settings.lowResolution} onChange={(e) => set('lowResolution', e.target.checked)} />
      </label>
      <label className="spread">
        <span>Reduced effects</span>
        <input type="checkbox" checked={settings.reducedEffects} onChange={(e) => set('reducedEffects', e.target.checked)} />
      </label>
      <label className="spread">
        <span>Autosave every</span>
        <select value={settings.autosaveMinutes} onChange={(e) => set('autosaveMinutes', Number(e.target.value))}>
          {[2, 4, 8, 15].map((v) => (
            <option key={v} value={v}>
              {v} minutes
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
