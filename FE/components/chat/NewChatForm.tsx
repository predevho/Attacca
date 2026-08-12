'use client';

import { useState } from 'react';
import { validateNewChat } from '@/lib/chat/logic';
import type { NewChatFormValues } from '@/lib/chat/types';

export function NewChatForm({ submitting, onStart }: { submitting: boolean; onStart: (v: NewChatFormValues) => void }) {
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v = { memberId };
    const err = validateNewChat(v);
    if (err) { setError(err); return; }
    setError(null);
    onStart(v);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-gray-500">새 대화 시작</h2>
      <div className="flex gap-2">
        <input aria-label="회원 id" type="number" min={1} value={memberId}
          onChange={(e) => setMemberId(e.target.value)} placeholder="상대 회원 id"
          className="w-40 rounded border px-3 py-2 text-sm" />
        <button type="button" onClick={submit} disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">대화 시작</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
