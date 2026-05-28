// Mirrors the API response shape from GET /api/v1/extension/queue and /due.

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
  id: number;
  post_id: number;
  platform: string;
  platform_name: string;
  account: { id: number; name: string; username: string };
  status: string;
  scheduled_at: string | null;
  due: boolean;
  content: ExtensionItemContent;
}

export interface Settings {
  apiKey: string;
  baseUrl: string;
}
