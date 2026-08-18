'use client';

import { useState } from 'react';

export function MessageComposer({ onSend, disabled = false }: { onSend: (content: string) => void; disabled?: boolean }) {
  const [content, setContent] = useState('');

  function send() {
    if (disabled) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex gap-2 border-t border-line p-2">
      <textarea aria-label="메시지 입력" value={content} maxLength={2000} rows={1} disabled={disabled}
        onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown}
        placeholder={disabled ? '연결 중…' : '메시지를 입력하세요 (Enter 전송)'}
        className="flex-1 resize-none rounded border border-line px-3 py-2 text-sm disabled:bg-surface-muted" />
      <button type="button" onClick={send} disabled={disabled}
        className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-40">전송</button>
    </div>
  );
}
