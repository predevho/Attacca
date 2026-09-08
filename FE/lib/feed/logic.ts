import type { CursorPage, Likeable, Me } from '@/lib/feed/types';

/** 다음 커서 페이지를 기존 목록 뒤에 붙인다. id 기준 중복은 제거(경합·재요청 방어). */
export function mergeCursorPage<T extends { id: number }>(prev: CursorPage<T>, page: CursorPage<T>): CursorPage<T> {
  const seen = new Set(prev.items.map((i) => i.id));
  const merged = [...prev.items];
  for (const item of page.items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  return { items: merged, nextCursor: page.nextCursor };
}

/** 무한스크롤 추가 로드 트리거 판단. 로딩 중이거나 끝(null)이면 막는다. */
export function shouldLoadMore(state: { isLoading: boolean; nextCursor: number | null }): boolean {
  return !state.isLoading && state.nextCursor !== null;
}

/** 낙관적 좋아요 토글. 같은 값을 두 번 적용하면 원상복구된다(롤백에 재사용). */
export function toggleLike<T extends Likeable>(item: T): T {
  return { ...item, likedByMe: !item.likedByMe, likeCount: item.likeCount + (item.likedByMe ? -1 : 1) };
}

/**
 * `authorId` 가 undefined 일 수 있는 이유: 공개 응답에는 회원 id가 없다
 * (PublicMemberDisplay). 그 경우 누구도 수정할 수 없는 것이 맞다 —
 * 비로그인 화면에서 수정 버튼이 뜨지 않게 하는 것도 같은 규칙으로 처리된다.
 */
export function canEdit(me: Me | null, authorId: number | undefined): boolean {
  return me != null && authorId != null && me.id === authorId;
}

export function canDelete(me: Me | null, authorId: number | undefined): boolean {
  if (me == null) return false;
  // 어드민은 남의 글도 지울 수 있지만, 대상이 누구인지 모르면(공개 응답) 판단할 수 없다.
  if (authorId == null) return false;
  return me.id === authorId || me.role === 'ADMIN';
}
