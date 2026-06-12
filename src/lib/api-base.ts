/** Desktop app API — calls go directly to the advisor engine via Electron IPC (no network). */

export type UpdateStatusPayload =
  | { status: 'checking' }
  | { status: 'idle' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'installing' }
  | { status: 'error'; message: string };

export async function initApiBase(): Promise<void> {
  if (window.location.protocol === 'file:' && !window.electronAPI?.fetchApi) {
    throw new Error('Desktop API bridge failed to load. Try restarting the app.');
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (window.electronAPI?.fetchApi) {
    const headers =
      init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : init?.headers && typeof init.headers === 'object'
          ? (init.headers as Record<string, string>)
          : undefined;

    const result = await window.electronAPI.fetchApi(path, {
      method: init?.method,
      headers,
      body: typeof init?.body === 'string' ? init.body : init?.body ? JSON.stringify(init.body) : undefined,
    });
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  }

  if (window.location.protocol === 'file:') {
    throw new Error('Desktop API bridge not available.');
  }

  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetch(`/api${suffix}`, init);
}

export function isDesktopApp(): boolean {
  return Boolean(window.electronAPI?.isDesktop);
}

export function isMacDesktop(): boolean {
  return window.electronAPI?.platform === 'darwin';
}

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      platform?: string;
      fetchApi: (
        path: string,
        init?: { method?: string; headers?: Record<string, string>; body?: string },
      ) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        body: string;
        headers: Record<string, string>;
      }>;
      exportProfiles: (json: string, defaultName: string) => Promise<boolean>;
      importProfiles: () => Promise<string | null>;
      windowControls?: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
      };
      onUpdateStatus?: (callback: (payload: UpdateStatusPayload) => void) => () => void;
      getAppVersion?: () => Promise<string>;
      checkForUpdates?: () => Promise<{
        ok?: boolean;
        skipped?: boolean;
        reason?: string;
        currentVersion?: string;
        latestVersion?: string;
        updateAvailable?: boolean;
        version?: string | null;
        message?: string;
      }>;
      downloadUpdate?: () => Promise<{ ok?: boolean; skipped?: boolean }>;
      installUpdate?: () => Promise<void>;
      openReleasePage?: () => Promise<void>;
    };
  }
}
