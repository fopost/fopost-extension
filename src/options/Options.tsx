import SettingsView from '../sidepanel/SettingsView.js';

/**
 * The browser's own "Extension options" entry. Settings normally live in the
 * side panel; this renders the same screen so the two cannot drift.
 */
export default function Options() {
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="px-4 pb-2 text-sm font-semibold tracking-tight">OwlStack Publisher</h1>
      <SettingsView />
    </div>
  );
}
