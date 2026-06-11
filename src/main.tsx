import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initApiBase } from './lib/api-base';
import './index.css';
import App from './App.tsx';

async function boot() {
  try {
    await initApiBase();
  } catch (err) {
    document.getElementById('root')!.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#f88"><h2>Startup error</h2><p>${String(err)}</p></div>`;
    return;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
