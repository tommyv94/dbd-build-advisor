import { useEffect, useState } from 'react';
import App from './App';
import { WarmupSplash } from './components/WarmupSplash';
import { runAppWarmup, type AppWarmupResult } from './lib/app-warmup';

export function AppRoot() {
  const [warmup, setWarmup] = useState<AppWarmupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Entering the Fog…');

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const result = await runAppWarmup((message) => setStatus(message));
        if (cancelled) return;
        setWarmup(result);
        await window.electronAPI?.warmupComplete?.();
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="app-startup-error">
        <h2>Startup error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!warmup) {
    return <WarmupSplash status={status} />;
  }

  return <App warmup={warmup} />;
}
