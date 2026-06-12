import { useEffect, useState } from 'react';
import { EntityMark } from './EntityMark';
import { AmbientMuteButton } from './AmbientMuteButton';
import { isDesktopApp } from '../lib/api-base';
import './LandingPage.css';

interface LandingPageProps {
  onEnter: () => void;
  ready?: boolean;
  ambientMuted?: boolean;
  onToggleAmbient?: () => void;
}

export function LandingPage({ onEnter, ready = true, ambientMuted, onToggleAmbient }: LandingPageProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnter]);

  return (
    <div className={`landing ${revealed ? 'landing-revealed' : ''}`}>
      {!isDesktopApp() && onToggleAmbient != null && ambientMuted != null && (
        <AmbientMuteButton
          muted={ambientMuted}
          onToggle={onToggleAmbient}
          className="landing-mute"
        />
      )}
      <div className="landing-fog landing-fog-a" aria-hidden />
      <div className="landing-fog landing-fog-b" aria-hidden />
      <div className="landing-fog landing-fog-c" aria-hidden />
      <div className="landing-vignette" aria-hidden />
      <div className="landing-scan" aria-hidden />

      <div className="landing-embers" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="landing-ember" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <div className="landing-content">
        <EntityMark size="lg" />

        <p className="landing-dbd-title">Dead by Daylight</p>
        <h1 className="landing-advisor-title">Build Advisor</h1>
        <p className="landing-tagline">Perk builds matched to your inventory — Killer powers included.</p>

        <button type="button" className="landing-enter dbd-btn-primary" onClick={onEnter} disabled={!ready}>
          {ready ? 'Enter the Fog' : 'Loading…'}
        </button>
        {ready && (
          <p className="landing-press-hint" aria-hidden>
            Press Enter or Space to enter the fog
          </p>
        )}
      </div>

      <footer className="landing-footer">
        <span>Fan tool · Not affiliated with Behaviour Interactive</span>
      </footer>
    </div>
  );
}
