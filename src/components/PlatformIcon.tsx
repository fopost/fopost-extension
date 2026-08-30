import { useState } from 'react';
import browser from '../lib/browser.js';
import { cn } from '../lib/utils.js';

/**
 * Platform marks ship as files rather than an icon font, matching the rule the
 * FoPost apps follow. Most map to `<platform>.svg`; these are the ones whose
 * file name does not match the platform key the API returns.
 */
const FILE_OVERRIDES: Record<string, string> = {
  lemmy: 'Lemmy.svg',
  'google-business': 'google-my-business.svg',
  'instagram-business': 'instagram.svg',
};

function iconPath(platform: string): string {
  const file = FILE_OVERRIDES[platform] ?? `${platform}.svg`;
  return browser.runtime.getURL(`images/platforms/${file}`);
}

export default function PlatformIcon({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const size = cn('size-5 shrink-0', className);

  // A platform we have no mark for yet falls back to a letter tile rather than
  // a broken-image glyph.
  if (broken) {
    return (
      <span
        aria-hidden
        className={cn(
          size,
          'flex items-center justify-center rounded-full bg-slate-200',
          'text-[10px] font-semibold text-slate-600 uppercase',
        )}
      >
        {platform.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={iconPath(platform)}
      alt=""
      aria-hidden
      className={cn(size, 'object-contain')}
      onError={() => setBroken(true)}
    />
  );
}
