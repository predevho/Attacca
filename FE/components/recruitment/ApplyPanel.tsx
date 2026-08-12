'use client';

import { useState } from 'react';

export function ApplyPanel({
  submitting, applied, onApply,
}: {
  submitting: boolean;
  applied: boolean;
  onApply: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (applied) {
    return <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">지원 완료</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded bg-black px-4 py-2 text-sm text-white">지원하기</button>
    );
  }

  function submit() {
    if (!message.trim()) { setError('지원 메시지를 입력해 주세요.'); return; }
    if (message.length > 1000) { setError('지원 메시지는 1000자를 넘을 수 없습니다.'); return; }
    setError(null);
    onApply(message);
  }

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <textarea aria-label="지원 메시지" value={message} maxLength={1000}
        onChange={(e) => setMessage(e.target.value)} placeholder="지원 메시지를 입력하세요"
        className="h-24 rounded border px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">
          {submitting ? '처리 중...' : '제출'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}
          className="rounded border px-4 py-2 text-sm">취소</button>
      </div>
    </div>
  );
}
