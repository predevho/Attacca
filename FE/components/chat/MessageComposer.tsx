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
    // 한글 IME 조합 중 Enter는 마지막 글자를 확정하는 키다. 이때 전송하면
    // 확정된 마지막 글자가 입력창에 남아 다음 전송에서 따로 보내질 수 있다.
    if (e.nativeEvent.isComposing || e.key === 'Process') return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <footer role="contentinfo" className="flex shrink-0 gap-2 border-t border-line px-2 pt-2 pb-[env(safe-area-inset-bottom)]">
      <textarea aria-label="메시지 입력" value={content} maxLength={2000} rows={1} disabled={disabled}
        onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown}
        placeholder={disabled ? '연결 중…' : '메시지를 입력하세요 (Enter 전송)'}
        className="flex-1 resize-none rounded border border-line px-3 py-2 text-sm disabled:bg-surface-muted" />
      <button type="button" onClick={send} disabled={disabled}
        className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-40">전송</button>
    </footer>
  );
}
