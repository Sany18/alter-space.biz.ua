import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { WsService } from '../../services/ws/ws.service';
import { PointerLockService } from '../../services/pointer-lock/pointer-lock.service';
import './Chat.scss';

interface ChatMessage {
  socketId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function Chat() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  // openRef mirrors `open` state but is updated synchronously so keyboard handlers
  // can read the current value without waiting for a useEffect/paint cycle.
  const openRef = React.useRef(false);
  const [unread, setUnread] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);


  React.useEffect(() => {
    WsService.on('chat_history', (msg: any) => {
      setMessages(msg.messages ?? []);
    });

    WsService.on('chat_message', (msg: any) => {
      setMessages(prev => [...prev, msg as ChatMessage]);
      setUnread(prev => prev + 1);
    });

    return () => {
      WsService.off('chat_history');
      WsService.off('chat_message');
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Clear unread count and focus input when opening
  React.useEffect(() => {
    if (open) {
      setUnread(0);
      // Small delay so the element is rendered before we focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const closeChat = React.useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  // T = toggle chat (priority 0); Escape = close chat (priority 100, beats MainMenu's priority 10)
  // React.useEffect(() => {
  //   const unsubEscape = KeyboardService.on('Escape', () => {
  //     if (!openRef.current) return; // not open — don't consume, let lower handlers run
  //     if (document.pointerLockElement) {
  //       PointerLockService.suppressNextUnlock = true;
  //     }
  //     openRef.current = false;
  //     setOpen(false);
  //     return true; // consume — prevent MainMenu from seeing this Escape
  //   }, 100);

  //   const unsubT = KeyboardService.on('KeyT', (e) => {
  //     if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  //     e.preventDefault();
  //     const next = !openRef.current;
  //     openRef.current = next;
  //     setOpen(next);
  //   }, 0);

  //   return () => { unsubEscape(); unsubT(); };
  // }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    WsService.sendChat(trimmed);
    setInput('');
    closeChat();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className={`chat${open ? ' chat--open' : ''}`}>
      <button
        className="chat__toggle"
        onClick={() => open ? closeChat() : setOpen(true)}
        title={open ? 'Close chat  [T]' : 'Chat  [T]'}
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span className="chat__badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="chat__window">
          <div className="chat__messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chat__empty">No messages yet</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="chat__message">
                <span className="chat__time">{formatTime(m.timestamp)}</span>
                <span className="chat__name">{m.playerName}</span>
                <span className="chat__text">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="chat__input-row">
            <input
              ref={inputRef}
              className="chat__input"
              type="text"
              placeholder="Type a message…"
              value={input}
              maxLength={300}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="chat__send" onClick={handleSend} disabled={!input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

let _root: ReactDOM.Root | null = null;

export function mountChat() {
  const el = document.getElementById('chat')!;
  _root = ReactDOM.createRoot(el);
  _root.render(<Chat />);
}

export function unmountChat() {
  _root?.unmount();
  _root = null;
}
