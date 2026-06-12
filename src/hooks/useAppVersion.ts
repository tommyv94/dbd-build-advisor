import { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/app-version';
import { isDesktopApp } from '../lib/api-base';

function readDesktopVersion(): string | undefined {
  if (!isDesktopApp()) return undefined;
  return window.electronAPI?.appVersion ?? undefined;
}

/** Desktop: version from packaged package.json (sync). Web/dev: Vite build constant. */
export function useAppVersion(): string {
  const [version, setVersion] = useState(() => readDesktopVersion() ?? APP_VERSION);

  useEffect(() => {
    const sync = readDesktopVersion();
    if (sync) {
      setVersion(sync);
      return;
    }
    if (!isDesktopApp() || !window.electronAPI?.getAppVersion) return;
    void window.electronAPI.getAppVersion().then((v) => {
      if (v) setVersion(v);
    });
  }, []);

  return version;
}
