interface AmbientMuteButtonProps {
  muted: boolean;
  onToggle: () => void;
  className?: string;
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M4 9v6h4l5 4V5L8 9H4zm12.5 3c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
      />
    </svg>
  );
}

export function AmbientMuteButton({ muted, onToggle, className = '' }: AmbientMuteButtonProps) {
  return (
    <button
      type="button"
      className={`ambient-mute-btn ${muted ? 'ambient-mute-btn-muted' : ''} ${className}`.trim()}
      onClick={onToggle}
      aria-label={muted ? 'Unmute fog ambience' : 'Mute fog ambience'}
      title={muted ? 'Unmute fog ambience' : 'Mute fog ambience'}
    >
      {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
    </button>
  );
}
