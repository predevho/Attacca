'use client';

import { useEffect, useState } from 'react';
import { getBff } from '@/lib/api';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { MIN_SEARCH_LENGTH, searchUrl } from '@/lib/chat/logic';
import type { MemberHit, NewChatFormValues } from '@/lib/chat/types';

/** 타이핑이 멈췄다고 볼 시간. 글자마다 요청을 보내지 않기 위한 값. */
const DEBOUNCE_MS = 300;

/**
 * 새 대화 시작. 닉네임으로 상대를 찾아 고른다.
 *
 * <p>예전에는 **회원 id를 숫자로 입력**받았다. 사용자가 알 수 있는 값이 아니라
 * 사실상 대화를 시작할 방법이 없었다. (DOMAIN-MEMBER-STATUTE §3.2.1)
 */
export function NewChatForm({ submitting, onStart }: { submitting: boolean; onStart: (v: NewChatFormValues) => void }) {
  const [query, setQuery] = useState('');
  // **어떤 질의의 결과인지**를 함께 들고 있는다. 결과만 저장하면 "찾는 중"을 알기 위해
  // 이펙트에서 곧바로 setState를 해야 하는데, 그건 렌더를 연쇄시킨다(eslint가 막는다).
  // 질의를 같이 두면 `result.q !== q`가 곧 "아직 안 온 상태"다.
  const [result, setResult] = useState<{ q: string; hits: MemberHit[] } | null>(null);

  const q = query.trim();
  const tooShort = q.length < MIN_SEARCH_LENGTH;
  const hits = result != null && result.q === q ? result.hits : null;
  const searching = !tooShort && hits === null;

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) return;

    // 타이핑이 멈춘 뒤에 한 번만 부른다. 정리 함수가 이전 타이머를 지운다.
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await getBff<MemberHit[]>(searchUrl(term));
      if (!cancelled) setResult({ q: term, hits: r.ok ? (r.data as MemberHit[]) : [] });
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-4">
      <h2 className="text-sm font-medium text-ink-muted">새 대화 시작</h2>
      <input
        type="search"
        aria-label="닉네임으로 회원 찾기"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="닉네임을 입력하세요"
        className="w-full rounded border border-line px-3 py-2 text-sm"
      />

      {searching && <p className="text-sm text-ink-faint">찾는 중...</p>}

      {hits !== null && hits.length === 0 && (
        <p className="text-sm text-ink-faint">해당하는 회원을 찾지 못했습니다.</p>
      )}

      {hits !== null && hits.length > 0 && (
        <ul className="flex flex-col">
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => onStart({ memberId: String(m.id) })}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted disabled:opacity-40"
              >
                <AuthorBadge author={{ id: m.id, nickname: m.nickname, verified: m.verified }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
