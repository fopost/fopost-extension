import { ArrowRight, ExternalLink, ListChecks, MousePointerClick } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '../components/ui/button.js';
import { API_KEYS_URL, SIGNUP_URL } from '../lib/urls.js';

const WHAT_IT_DOES: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] =
  [
    {
      icon: MousePointerClick,
      title: 'Turn any page into a post',
      body: 'Right-click an article, image, or link and the composer opens with a caption drafted from the page and the image already attached.',
    },
    {
      icon: ListChecks,
      title: 'Publish what has no API',
      body: 'Substack has no publishing API, so OwlStack hands you the finished post here and you press publish yourself. Nothing is automated on your behalf.',
    },
  ];

/**
 * What a new install sees. Without an API key nothing else in the panel can
 * work, and an empty queue with a "connect" line explains neither what the
 * extension is nor how to get going. This does both, and links out to the two
 * pages that actually issue a key.
 */
export default function WelcomeView({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="space-y-5 px-4 py-5">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Welcome to OwlStack Publisher</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          It connects this browser to your OwlStack account. Two things it does:
        </p>
      </div>

      <ul className="space-y-3">
        {WHAT_IT_DOES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <Icon className="size-3.5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-700">Three steps to start</p>

        <ol className="space-y-3">
          <Step
            n={1}
            title="Create an OwlStack account"
            body="The extension needs an account to post from. There is a free trial."
          >
            <Button variant="secondary" size="sm" asChild>
              <a href={SIGNUP_URL} target="_blank" rel="noreferrer noopener">
                Create an account
                <ExternalLink />
              </a>
            </Button>
          </Step>

          <Step
            n={2}
            title="Make an API key"
            body="In OwlStack, go to Settings → API keys. Give it the posts, accounts, and extension permissions, plus ai if you want AI captions."
          >
            <Button variant="secondary" size="sm" asChild>
              <a href={API_KEYS_URL} target="_blank" rel="noreferrer noopener">
                Open API keys
                <ExternalLink />
              </a>
            </Button>
          </Step>

          <Step n={3} title="Paste it here" body="The key is stored on this device only.">
            <Button size="sm" onClick={onOpenSettings}>
              Add your key
              <ArrowRight />
            </Button>
          </Step>
        </ol>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
        {n}
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-medium text-slate-800">{title}</p>
        <p className="text-xs leading-relaxed text-slate-500">{body}</p>
        {children}
      </div>
    </li>
  );
}
