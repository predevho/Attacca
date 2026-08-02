import type { CursorPage, Likeable, Me } from '@/lib/feed/types';

/** 다음 커서 페이지를 기존 목록 뒤에 붙인다. id 기준 중복은 제거(경합·재요청 방어). */
export function mergeCursorPage<T extends { id: number }>(prev: CursorPage<T>, page: CursorPage<T>): CursorPage<T> {
  const seen = new Set(prev.items.map((i) => i.id));
  const merged = [...prev.items];
  for (const item of page.items) {
    if (!seen.has(item.id)) merged.push(item);
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

export function canEdit(me: Me | null, authorId: number): boolean {
  return me != null && me.id === authorId;
}

export function canDelete(me: Me | null, authorId: number): boolean {
  return me != null && (me.id === authorId || me.role === 'ADMIN');
}
