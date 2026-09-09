'use client';

import { MemberSearchInput } from '@/components/chat/MemberSearchInput';
import type { NewChatFormValues } from '@/lib/chat/types';

/**
 * 새 1:1 대화 시작. 닉네임으로 상대를 찾아 고른다.
 *
 * <p>예전에는 **회원 id를 숫자로 입력**받았다. 사용자가 알 수 있는 값이 아니라
 * 사실상 대화를 시작할 방법이 없었다. (DOMAIN-MEMBER-STATUTE §3.2.1)
 */
export function NewChatForm({ submitting, onStart }: { submitting: boolean; onStart: (v: NewChatFormValues) => void }) {
  return (
    <div role="group" aria-label="새 대화 시작" className="flex flex-col gap-2 rounded-lg border border-line p-4">
      <h2 className="text-sm font-medium text-ink-muted">새 대화 시작</h2>
      <MemberSearchInput disabled={submitting} onPick={(m) => onStart({ memberId: String(m.id) })} />
    </div>
  );
}
