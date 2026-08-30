import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { Field, Input } from '../components/ui/field.js';
import { requestApiPermission } from '../lib/permissions.js';
import { getSettings, saveSettings } from '../lib/storage.js';
import { API_KEYS_URL } from '../lib/urls.js';

const SCOPES = [
  { name: 'posts', why: 'Create and publish the captured post' },
  { name: 'accounts', why: 'List the accounts in the picker' },
  { name: 'extension', why: 'Read and update the queue' },
  { name: 'ai', why: 'Write with AI (optional)' },
];

/**
 * Settings is a screen in the panel rather than a separate options page, so
 * the API key is two clicks away instead of hidden behind a gear glyph. The
 * standalone options page still renders the same fields for the browser's own
 * "Extension options" menu.
 */
export default function SettingsView() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => setApiKey(s.apiKey));
  }, []);

  // Saving is the one user gesture the Firefox host-permission prompt can hang
  // off. On Chrome this resolves true without prompting.
  const save = async () => {
    setDenied(false);
    if (!(await requestApiPermission())) {
      setDenied(true);
      return;
    }
    await saveSettings({ apiKey });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="flex items-start gap-2.5 rounded-lg bg-accent-soft p-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="text-xs leading-relaxed text-slate-600">
          Create an API key in FoPost under{' '}
          <span className="font-medium text-slate-800">Settings → API keys</span>. It is stored on
          this device only, and the extension talks to no server other than FoPost.
        </p>
      </div>

      <Field label="API key" htmlFor="api-key">
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          placeholder="fp_…"
          onChange={(e) => setApiKey(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()}>Save</Button>
        <Button variant="secondary" asChild>
          <a href={API_KEYS_URL} target="_blank" rel="noreferrer noopener">
            Get a key
            <ExternalLink />
          </a>
        </Button>
        {saved && (
          <span className="ml-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>

      {denied && (
        <p className="text-xs leading-relaxed text-red-600">
          FoPost needs permission to reach its own API before it can save a key. Press Save again
          and choose Allow.
        </p>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-700">Permissions the key needs</p>
        <ul className="space-y-1.5">
          {SCOPES.map((scope) => (
            <li key={scope.name} className="flex items-baseline gap-2 text-xs">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                {scope.name}
              </code>
              <span className="text-slate-500">{scope.why}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
