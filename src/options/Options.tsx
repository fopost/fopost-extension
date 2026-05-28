import { useEffect, useState } from 'react';
import { DEFAULT_BASE_URL, getSettings, saveSettings } from '../lib/storage.js';

export default function Options() {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setApiKey(s.apiKey);
      setBaseUrl(s.baseUrl);
    });
  }, []);

  const save = async () => {
    await saveSettings({ apiKey, baseUrl });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app" style={{ width: 440 }}>
      <header className="header">
        <span className="brand">OwlStack Publisher Settings</span>
      </header>

      <p className="muted">
        Create an API key in OwlStack (Settings &rarr; API keys) with the <code>extension</code>{' '}
        scope, then paste it below. The extension only reads your queued content and marks it
        published. It never sees your Substack account.
      </p>

      <label className="field">
        <span>API key</span>
        <input
          type="password"
          value={apiKey}
          placeholder="osk_..."
          onChange={(e) => setApiKey(e.target.value)}
        />
      </label>

      <label className="field">
        <span>API base URL</span>
        <input
          type="text"
          value={baseUrl}
          placeholder={DEFAULT_BASE_URL}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </label>

      <div className="actions footer-actions">
        <button className="primary" onClick={() => void save()}>
          Save
        </button>
        {saved && <span className="flash">Saved</span>}
      </div>
    </div>
  );
}
