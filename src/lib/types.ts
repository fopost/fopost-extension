// Mirrors the API response shapes the extension consumes. Public ids are
// opaque strings on every OwlStack resource.

export interface ExtensionMedia {
  url: string;
  type: string;
  alt: string | null;
}

export interface ExtensionItemContent {
  title: string | null;
  body: string;
  media: ExtensionMedia[];
}

export interface ExtensionItem {
  id: string;
  post_id: string;
  platform: string;
  platform_name: string;
  account: { id: string; name: string; username: string };
  status: string;
  scheduled_at: string | null;
  due: boolean;
  content: ExtensionItemContent;
}

export interface Settings {
  apiKey: string;
  baseUrl: string;
}

// ─── Composer ─────────────────────────────────────────────────────

export interface Account {
  id: string;
  workspaceId: string;
  platform: string;
  username: string | null;
  name: string | null;
  avatar: string | null;
  isPrimary: boolean;
  active: boolean;
}

export interface PlatformInfo {
  name: string;
  displayName: string;
  constraints: {
    maxTextLength: number;
    maxMediaCount: number;
    supportedMediaTypes: string[];
    maxImageSize: number;
  };
}

export interface UploadedMedia {
  id?: string;
  type: 'image' | 'video' | 'gif' | 'document';
  name: string;
  url: string;
  size: number;
}

export interface CreditBalance {
  creditsRemaining: number;
  creditsUsed: number;
  creditsTotal: number;
}

/**
 * What the on-demand extractor pulls out of the page. `imageUrl` is whichever
 * image the capture is about: the one right-clicked, else the page's og:image.
 */
export interface PageCapture {
  /** Which context menu produced this — drives the prefilled caption. */
  source: 'page' | 'selection' | 'image' | 'link';
  title: string;
  /** Canonical URL when the page declares one, else the tab URL. */
  url: string;
  description: string;
  selection: string;
  imageUrl: string | null;
  /** Trimmed visible body text, used as the AI caption's source material. */
  pageText: string;
  siteName: string;
  capturedAt: string;
}
