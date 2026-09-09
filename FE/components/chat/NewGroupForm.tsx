'use client';

import { useState } from 'react';
import { MemberSearchInput } from '@/components/chat/MemberSearchInput';
import { validateGroup } from '@/lib/chat/logic';
import type { GroupFormValues, MemberHit } from '@/lib/chat/types';

/**
 * 그룹 방 만들기. 여러 명을 담고 이름을 붙여 만든다.
 *
 * <p>BE는 나 혼자인 방도 허용하지만(나중에 초대, STATUTE §124) 화면은 한 명 이상을 요구한다 —
 * 아무도 없는 방을 만들면 사용자가 다음에 뭘 해야 할지 알 수 없다.
 */
export function NewGroupForm({
  submitting, onCreate,
}: {
  submitting: boolean;
  onCreate: (v: GroupFormValues) => void;
}) {
  const [picked, setPicked] = useState<MemberHit[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add(m: MemberHit) {
    // 같은 사람을 두 번 담지 않는다.
    setPicked((cur) => (cur.some((p) => p.id === m.id) ? cur : [...cur, m]));
    setError(null);
  }

  function submit() {
    const values: GroupFormValues = { memberIds: picked.map((p) => p.id), title };
    const err = validateGroup(values);
    if (err) { setError(err); return; }
    setError(null);
    onCreate(values);
  }

  return (
    <div role="group" aria-label="그룹 만들기" className="flex flex-col gap-2 rounded-lg border border-line p-4">
      <h2 className="text-sm font-medium text-ink-muted">그룹 만들기</h2>

      <MemberSearchInput disabled={submitting} onPick={add} clearOnPick />

      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                aria-label={`${m.nickname} 제외`}
                onClick={() => setPicked((cur) => cur.filter((p) => p.id !== m.id))}
                className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
              >
                {m.nickname} ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex flex-col gap-1 text-sm">
        그룹 이름 (선택)
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="비우면 참여자 이름으로 표시됩니다"
          className="rounded border border-line px-3 py-2 text-sm" />
      </label>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting}
        className="w-fit rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-40">
        그룹 만들기
      </button>
    </div>
  );
}
