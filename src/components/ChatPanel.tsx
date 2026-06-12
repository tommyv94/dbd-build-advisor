import { parseMarkdown } from '../lib/api';
import type { BuildSuggestion, CharacterLoadout, ChatMessage } from '../types';
import { BuildCard } from './BuildCard';

interface ChatPanelProps {
  messages: ChatMessage[];
  characters: Record<string, CharacterLoadout>;
  loading: boolean;
  onSend: (text: string) => void;
  quickPrompts: string[];
  onSaveBuild?: (build: BuildSuggestion) => void;
  onQuickSaveBuild?: (build: BuildSuggestion, defaultName?: string) => void;
  onNewChat?: () => void;
}

export function ChatPanel({
  messages,
  characters,
  loading,
  onSend,
  quickPrompts,
  onSaveBuild,
  onQuickSaveBuild,
  onNewChat,
}: ChatPanelProps) {
  return (
    <div className="chat-panel">
      {onNewChat && (
        <div className="chat-toolbar">
          <span className="chat-toolbar-label">Advisor chat</span>
          <button type="button" className="chat-new-btn" onClick={onNewChat} disabled={loading}>
            New chat
          </button>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-${msg.role}`}>
            {msg.role === 'assistant' && <span className="chat-avatar">☽</span>}
            <div className="chat-bubble-inner">
              <div
                className="chat-content"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
              />
              {msg.build && (
                <BuildCard
                  build={msg.build}
                  characters={characters}
                  adjustments={msg.adjustments}
                  onSave={onSaveBuild}
                  onQuickSave={
                    onQuickSaveBuild
                      ? (b) => onQuickSaveBuild(b, b.title || 'Advisor build')
                      : undefined
                  }
                />
              )}
              <time className="chat-time">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-assistant">
            <span className="chat-avatar">☽</span>
            <div className="chat-bubble-inner">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="quick-prompts">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" className="quick-prompt" onClick={() => onSend(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}

function ChatInput({ onSend, disabled }: { onSend: (t: string) => void; disabled: boolean }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('message') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = '';
  }

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <input
        name="message"
        type="text"
        placeholder="e.g. Nurse build — or say which perks you're missing..."
        disabled={disabled}
        autoComplete="off"
      />
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
