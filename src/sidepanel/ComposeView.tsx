import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createPost,
  fetchAccounts,
  fetchCredits,
  fetchPlatforms,
  generateCaption,
  publishPost,
  uploadMedia,
} from '../lib/api.js';
import { CalendarClock, Check, Sparkles, X } from 'lucide-react';
import { dataUrlToBlob, fetchImageFromTab, seedCaption } from '../lib/capture.js';
import PlatformIcon from '../components/PlatformIcon.js';
import { Button } from '../components/ui/button.js';
import { Field, Textarea } from '../components/ui/field.js';
import { DateTimePicker } from '../components/ui/date-time-picker.js';
import { toLocalValue } from '../lib/datetime.js';
import { cn } from '../lib/utils.js';
import type { Account, PageCapture, PlatformInfo, UploadedMedia } from '../lib/types.js';

/** Starting points, so the field is not an empty box with no hint of its use. */
const AI_PROMPT_EXAMPLES = ['Make it shorter', 'More formal', 'Add a hook'];

/** Matches AI_FEATURES.ai_caption.defaultCredits on the API. */
const CAPTION_CREDIT_COST = 1;

interface Props {
  capture: PageCapture;
  tabId: number;
  onDiscard: () => void;
}

interface CapturedImage {
  dataUrl: string;
  type: string;
  name: string;
}

/** Default schedule: one hour out, in the picker's local format. */
function defaultScheduleValue(): string {
  return toLocalValue(new Date(Date.now() + 60 * 60 * 1000));
}

export default function ComposeView({ capture, tabId, onDiscard }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState(() => seedCaption(capture));
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue);
  const [showSchedule, setShowSchedule] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'ai' | 'now' | 'schedule'>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountList, platformList] = await Promise.all([fetchAccounts(), fetchPlatforms()]);
        if (cancelled) return;
        setAccounts(accountList);
        setPlatforms(platformList);
        const primary = accountList.find((a) => a.isPrimary) ?? accountList[0];
        if (primary) setSelected([primary.id]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load accounts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Balance is informational; a key without the 'ai' scope simply hides it.
  useEffect(() => {
    void fetchCredits()
      .then((b) => setCredits(b.creditsRemaining))
      .catch(() => setCredits(null));
  }, []);

  // Pull the image bytes through the page that already loaded them, so no
  // host permission is needed for the image's CDN.
  useEffect(() => {
    if (!capture.imageUrl) return;
    let cancelled = false;
    void fetchImageFromTab(tabId, capture.imageUrl)
      .then((result) => {
        if (cancelled) return;
        if ('error' in result) setImageNote(result.error);
        else setImage(result);
      })
      .catch(() => {
        if (!cancelled) setImageNote('This image could not be read from the page.');
      });
    return () => {
      cancelled = true;
    };
  }, [capture.imageUrl, tabId]);

  const platformLimits = useMemo(() => {
    const map = new Map<string, { displayName: string; maxTextLength: number }>();
    for (const p of platforms) {
      map.set(p.name, { displayName: p.displayName, maxTextLength: p.constraints.maxTextLength });
    }
    return map;
  }, [platforms]);

  // Every selected account must share one workspace — a post belongs to one.
  const activeWorkspace = useMemo(() => {
    const first = accounts.find((a) => a.id === selected[0]);
    return first?.workspaceId ?? null;
  }, [accounts, selected]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selected.includes(a.id)),
    [accounts, selected],
  );

  const overLimit = useMemo(
    () =>
      selectedAccounts.filter((a) => {
        const limit = platformLimits.get(a.platform)?.maxTextLength;
        return limit !== undefined && caption.length > limit;
      }),
    [selectedAccounts, platformLimits, caption],
  );

  const toggleAccount = (account: Account) => {
    setSelected((prev) =>
      prev.includes(account.id) ? prev.filter((id) => id !== account.id) : [...prev, account.id],
    );
  };

  const runAiCaption = useCallback(async () => {
    if (!activeWorkspace) return;
    setBusy('ai');
    setError(null);
    try {
      // Labelled so the model treats the article as source material to write
      // *about*, not as a draft caption to lightly edit.
      const source = [
        `Source page: ${capture.title}`,
        capture.url && `URL: ${capture.url}`,
        capture.selection && `Highlighted by the user:\n${capture.selection}`,
        capture.pageText && `Page content:\n${capture.pageText}`,
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000);
      const tightest = selectedAccounts.reduce<number | undefined>((min, a) => {
        const limit = platformLimits.get(a.platform)?.maxTextLength;
        if (limit === undefined) return min;
        return min === undefined ? limit : Math.min(min, limit);
      }, undefined);

      const result = await generateCaption({
        current_caption: source,
        platforms: [...new Set(selectedAccounts.map((a) => a.platform))],
        char_limit: tightest,
        workspace_id: activeWorkspace,
        instructions: aiPrompt.trim() || undefined,
      });
      setCaption(result.caption);
      setCredits(result.remaining);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [activeWorkspace, capture, selectedAccounts, platformLimits, aiPrompt]);

  const submit = useCallback(
    async (mode: 'now' | 'schedule') => {
      if (!activeWorkspace || selected.length === 0) return;
      setBusy(mode);
      setError(null);
      try {
        let media: UploadedMedia[] | undefined;
        if (image) {
          const uploaded = await uploadMedia(
            dataUrlToBlob(image.dataUrl),
            image.name,
            activeWorkspace,
          );
          media = [uploaded];
        }

        const post = await createPost({
          workspace_id: activeWorkspace,
          accounts: selected,
          content: [{ text: caption, media }],
          status: mode === 'schedule' ? 'scheduled' : 'draft',
          schedule_at: mode === 'schedule' ? new Date(scheduleAt).toISOString() : undefined,
          title: capture.title ? capture.title.slice(0, 255) : undefined,
        });

        if (mode === 'now') await publishPost(post.id);

        setDone(
          mode === 'now'
            ? 'Sent to your accounts.'
            : `Scheduled for ${new Date(scheduleAt).toLocaleString()}.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the post.');
      } finally {
        setBusy(null);
      }
    },
    [activeWorkspace, selected, image, caption, scheduleAt, capture.title],
  );

  // The tightest limit across the selected accounts is the one that matters;
  // per-platform detail only appears when something is actually over.
  const tightestLimit = selectedAccounts.reduce<number | null>((min, a) => {
    const limit = platformLimits.get(a.platform)?.maxTextLength;
    if (limit === undefined) return min;
    return min === null ? limit : Math.min(min, limit);
  }, null);

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-emerald-50">
          <Check className="size-5 text-emerald-600" />
        </div>
        <p className="text-sm font-medium">{done}</p>
        <Button variant="secondary" onClick={onDiscard}>
          Capture something else
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="px-4 py-6 text-sm text-slate-500">Loading your accounts…</p>;
  }

  if (accounts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium">No connected accounts</p>
        <p className="text-xs leading-relaxed text-slate-500">
          This API key returned no accounts. It needs the <code>accounts</code> and{' '}
          <code>posts</code> permissions.
        </p>
        <Button variant="secondary" onClick={onDiscard}>
          Back
        </Button>
      </div>
    );
  }

  const canSubmit =
    busy === null && selected.length > 0 && caption.trim().length > 0 && overLimit.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 px-4 py-4">
        {/* Source */}
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          {image ? (
            <img src={image.dataUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-200 text-[10px] font-medium text-slate-500">
              No image
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-800">{capture.title}</p>
            <p className="truncate text-[11px] text-slate-500">{capture.siteName}</p>
            {!image && imageNote && (
              <p className="mt-0.5 text-[11px] text-slate-400">{imageNote}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Discard this capture"
            onClick={onDiscard}
            className="-mt-0.5 -mr-0.5"
          >
            <X />
          </Button>
        </div>

        {/* Caption */}
        <Field
          label="Caption"
          htmlFor="caption"
          hint={
            tightestLimit !== null && (
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  overLimit.length > 0 ? 'font-semibold text-red-600' : 'text-slate-400',
                )}
              >
                {caption.length}/{tightestLimit}
              </span>
            )
          }
        >
          <Textarea
            id="caption"
            rows={7}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null || selected.length === 0}
              onClick={() => void runAiCaption()}
            >
              <Sparkles className="text-accent" />
              {busy === 'ai' ? 'Writing…' : 'Write with AI'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showAiPrompt}
              onClick={() => setShowAiPrompt((v) => !v)}
              className={cn(showAiPrompt && 'text-accent')}
            >
              {aiPrompt.trim() ? 'Edit instruction' : 'Add instruction'}
            </Button>
            <span className="ml-auto text-[11px] text-slate-400">
              {CAPTION_CREDIT_COST} credit{credits !== null ? ` · ${credits} left` : ''}
            </span>
          </div>

          {showAiPrompt && (
            <div className="space-y-1.5">
              <Textarea
                aria-label="Instruction for the AI"
                rows={2}
                value={aiPrompt}
                placeholder="Tell the AI what you want."
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {AI_PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setAiPrompt(example)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Kept for the next rewrite, so you can run it again after editing.
              </p>
            </div>
          )}
        </div>

        {/* Destinations */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">Post to</span>
            {selected.length > 0 && (
              <span className="text-[11px] text-slate-400">{selected.length} selected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {accounts.map((account) => {
              const otherWorkspace =
                activeWorkspace !== null && account.workspaceId !== activeWorkspace;
              const active = selected.includes(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={otherWorkspace}
                  aria-pressed={active}
                  title={platformLimits.get(account.platform)?.displayName ?? account.platform}
                  onClick={() => toggleAccount(account)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5 text-xs transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    active
                      ? 'border-accent bg-accent-soft font-medium text-accent'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    otherWorkspace && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <PlatformIcon platform={account.platform} className="size-4" />
                  <span className="max-w-28 truncate">{account.username ?? account.name}</span>
                  {active && <Check className="size-3" />}
                </button>
              );
            })}
          </div>
          {accounts.some((a) => activeWorkspace && a.workspaceId !== activeWorkspace) && (
            <p className="text-[11px] text-slate-400">
              One post targets one workspace. Clear your selection to pick accounts from another.
            </p>
          )}
        </div>

        {/* Schedule */}
        {showSchedule ? (
          <Field label="Publish at">
            <DateTimePicker value={scheduleAt} onChange={setScheduleAt} />
          </Field>
        ) : (
          <Button variant="link" size="sm" className="px-0" onClick={() => setShowSchedule(true)}>
            <CalendarClock />
            Schedule for later
          </Button>
        )}

        {overLimit.length > 0 && (
          <p className="text-xs text-red-600">
            Too long for{' '}
            {overLimit.map((a) => platformLimits.get(a.platform)?.displayName).join(', ')}.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Pinned above the nav, so the primary action never scrolls away. */}
      <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Button className="flex-1" disabled={!canSubmit} onClick={() => void submit('now')}>
          {busy === 'now' ? 'Posting…' : 'Post now'}
        </Button>
        {showSchedule && (
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => void submit('schedule')}
          >
            {busy === 'schedule' ? 'Scheduling…' : 'Confirm schedule'}
          </Button>
        )}
      </div>
    </div>
  );
}

function aiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'insufficient_credits') return 'You are out of AI credits.';
    if (err.status === 403) {
      return "This API key can't use AI. Add the 'ai' permission to it in FoPost settings.";
    }
  }
  return err instanceof Error ? err.message : 'AI caption failed.';
}
