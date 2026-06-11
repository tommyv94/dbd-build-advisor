import { useEffect, useId, useRef } from 'react';

export interface PromptDialogConfig {
  kind: 'prompt';
  title: string;
  label?: string;
  defaultValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
}

export interface ConfirmDialogConfig {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export type AppDialogConfig = PromptDialogConfig | ConfirmDialogConfig;

interface AppDialogProps {
  config: AppDialogConfig | null;
  onClose: () => void;
}

export function AppDialog({ config, onClose }: AppDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (config?.kind !== 'prompt') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [config]);

  if (!config) return null;

  function handlePromptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (config?.kind !== 'prompt') return;
    const value = inputRef.current?.value.trim() ?? '';
    if (!value) return;
    config.onSubmit(value);
    onClose();
  }

  return (
    <div className="app-dialog-backdrop" onClick={onClose}>
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="app-dialog-title">
          {config.title}
        </h2>

        {config.kind === 'confirm' && <p className="app-dialog-message">{config.message}</p>}

        {config.kind === 'prompt' && (
          <form onSubmit={handlePromptSubmit}>
            {config.label && <label className="app-dialog-label">{config.label}</label>}
            <input
              ref={inputRef}
              className="app-dialog-input"
              type="text"
              defaultValue={config.defaultValue ?? ''}
              autoComplete="off"
            />
            <div className="app-dialog-actions">
              <button type="button" className="app-dialog-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="app-dialog-submit">
                {config.submitLabel ?? 'OK'}
              </button>
            </div>
          </form>
        )}

        {config.kind === 'confirm' && (
          <div className="app-dialog-actions">
            <button type="button" className="app-dialog-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={config.destructive ? 'app-dialog-submit app-dialog-destructive' : 'app-dialog-submit'}
              onClick={() => {
                config.onConfirm();
                onClose();
              }}
            >
              {config.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
