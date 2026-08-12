'use client';

import { useState } from 'react';

export function MessageComposer({ onSend }: { onSend: (content: string) => void }) {
  const [content, setContent] = useState('');

  function send() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex gap-2 border-t p-2">
      <textarea aria-label="메시지 입력" value={content} maxLength={2000} rows={1}
        onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown}
        placeholder="메시지를 입력하세요 (Enter 전송)"
        className="flex-1 resize-none rounded border px-3 py-2 text-sm" />
      <button type="button" onClick={send} className="rounded bg-black px-4 py-2 text-sm text-white">전송</button>
    </div>
  );
}
