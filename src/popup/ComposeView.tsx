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
import { dataUrlToBlob, fetchImageFromTab, seedCaption } from '../lib/capture.js';
import type { Account, PageCapture, PlatformInfo, UploadedMedia } from '../lib/types.js';

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

/** Local datetime string for <input type="datetime-local">, one hour out. */
function defaultScheduleValue(): string {
  const when = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
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
      });
      setCaption(result.caption);
      setCredits(result.remaining);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [activeWorkspace, capture, selectedAccounts, platformLimits]);

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

  if (done) {
    return (
      <div className="empty">
        <p className="success">{done}</p>
        <button className="primary" onClick={onDiscard}>
          Capture something else
        </button>
      </div>
    );
  }

  if (loading) return <p className="muted">Loading your accounts...</p>;

  if (!loading && accounts.length === 0) {
    return (
      <div className="empty">
        <p>No connected accounts found for this API key.</p>
        <p className="muted small">
          The key needs the <code>accounts</code> and <code>posts</code> permissions.
        </p>
        <button onClick={onDiscard}>Back</button>
      </div>
    );
  }

  return (
    <div className="compose">
      <div className="capture-head">
        <span className="muted small">{capture.siteName}</span>
        <button className="link-btn" onClick={onDiscard} title="Discard this capture">
          Discard
        </button>
      </div>

      {image && (
        <img
          className="media-preview"
          src={image.dataUrl}
          alt={capture.title || 'Captured image'}
        />
      )}
      {!image && imageNote && <p className="muted small">{imageNote}</p>}

      <label className="field">
        <span>Caption</span>
        <textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </label>

      <div className="counts">
        {selectedAccounts.map((a) => {
          const limit = platformLimits.get(a.platform);
          if (!limit) return null;
          const over = caption.length > limit.maxTextLength;
          return (
            <span key={a.id} className={over ? 'count over' : 'count'}>
              {limit.displayName} {caption.length}/{limit.maxTextLength}
            </span>
          );
        })}
      </div>

      <div className="ai-row">
        <button
          disabled={busy !== null || selected.length === 0}
          onClick={() => void runAiCaption()}
        >
          {busy === 'ai' ? 'Writing...' : 'Write with AI'}
        </button>
        <span className="muted small">
          {CAPTION_CREDIT_COST} credit
          {credits !== null ? ` · ${credits} left` : ''}
        </span>
      </div>

      <div className="field">
        <span>Post to</span>
        <ul className="accounts">
          {accounts.map((account) => {
            const otherWorkspace =
              activeWorkspace !== null && account.workspaceId !== activeWorkspace;
            return (
              <li key={account.id}>
                <label className={otherWorkspace ? 'account disabled' : 'account'}>
                  <input
                    type="checkbox"
                    checked={selected.includes(account.id)}
                    disabled={otherWorkspace}
                    onChange={() => toggleAccount(account)}
                  />
                  <span className="platform">
                    {platformLimits.get(account.platform)?.displayName ?? account.platform}
                  </span>
                  <span className="muted small">{account.username ?? account.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {accounts.some((a) => activeWorkspace && a.workspaceId !== activeWorkspace) && (
          <span className="muted small">
            One post targets one workspace. Clear your selection to pick accounts from another.
          </span>
        )}
      </div>

      {showSchedule && (
        <label className="field">
          <span>Publish at</span>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
        </label>
      )}

      {overLimit.length > 0 && (
        <p className="error">
          Too long for{' '}
          {overLimit.map((a) => platformLimits.get(a.platform)?.displayName).join(', ')}.
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div className="actions footer-actions">
        <button
          className="primary"
          disabled={
            busy !== null || selected.length === 0 || !caption.trim() || overLimit.length > 0
          }
          onClick={() => void submit('now')}
        >
          {busy === 'now' ? 'Posting...' : 'Post now'}
        </button>
        {showSchedule ? (
          <button
            disabled={
              busy !== null || selected.length === 0 || !caption.trim() || overLimit.length > 0
            }
            onClick={() => void submit('schedule')}
          >
            {busy === 'schedule' ? 'Scheduling...' : 'Confirm schedule'}
          </button>
        ) : (
          <button onClick={() => setShowSchedule(true)}>Schedule</button>
        )}
      </div>
    </div>
  );
}

function aiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'insufficient_credits') return 'You are out of AI credits.';
    if (err.status === 403) {
      return "This API key can't use AI. Add the 'ai' permission to it in OwlStack settings.";
    }
  }
  return err instanceof Error ? err.message : 'AI caption failed.';
}
