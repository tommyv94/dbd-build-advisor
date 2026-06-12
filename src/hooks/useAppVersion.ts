import { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/app-version';
import { isDesktopApp } from '../lib/api-base';

/** Desktop: version from the installed app (package.json in asar). Web/dev: Vite build constant. */
export function useAppVersion(): string {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    if (!isDesktopApp() || !window.electronAPI?.getAppVersion) return;
    void window.electronAPI.getAppVersion().then((v) => {
      if (v) setVersion(v);
    });
  }, []);

  return version;
}
