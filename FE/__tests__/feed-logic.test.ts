import { describe, it, expect } from 'vitest';
import { mergeCursorPage, shouldLoadMore, toggleLike, canEdit, canDelete } from '@/lib/feed/logic';
import type { Me } from '@/lib/feed/types';

describe('mergeCursorPage', () => {
  it('append하고 nextCursor를 갱신한다', () => {
    const prev = { items: [{ id: 3 }, { id: 2 }], nextCursor: 2 as number | null };
    const page = { items: [{ id: 1 }], nextCursor: null };
    expect(mergeCursorPage(prev, page)).toEqual({ items: [{ id: 3 }, { id: 2 }, { id: 1 }], nextCursor: null });
  });
  it('id 중복을 제거한다', () => {
    const prev = { items: [{ id: 2 }], nextCursor: 2 as number | null };
    const page = { items: [{ id: 2 }, { id: 1 }], nextCursor: null };
    expect(mergeCursorPage(prev, page).items).toEqual([{ id: 2 }, { id: 1 }]);
  });
});

describe('shouldLoadMore', () => {
  it('로딩 중이면 false', () => expect(shouldLoadMore({ isLoading: true, nextCursor: 5 })).toBe(false));
  it('끝(null)이면 false', () => expect(shouldLoadMore({ isLoading: false, nextCursor: null })).toBe(false));
  it('로딩 아님 + 다음 커서 있으면 true', () => expect(shouldLoadMore({ isLoading: false, nextCursor: 5 })).toBe(true));
});

describe('toggleLike', () => {
  it('안좋아요→좋아요: count+1', () => {
    expect(toggleLike({ id: 1, likeCount: 2, likedByMe: false })).toEqual({ id: 1, likeCount: 3, likedByMe: true });
  });
  it('두 번 적용하면 원상복구(롤백)', () => {
    const item = { id: 1, likeCount: 2, likedByMe: false };
    expect(toggleLike(toggleLike(item))).toEqual(item);
  });
});

describe('canEdit / canDelete', () => {
  const me: Me = { id: 10, nickname: 'a', role: 'USER', verified: false };
  const admin: Me = { id: 99, nickname: 'b', role: 'ADMIN', verified: false };
  it('작성자만 수정', () => {
    expect(canEdit(me, 10)).toBe(true);
    expect(canEdit(me, 11)).toBe(false);
    expect(canEdit(null, 10)).toBe(false);
  });
  it('작성자 또는 어드민 삭제', () => {
    expect(canDelete(me, 10)).toBe(true);
    expect(canDelete(me, 11)).toBe(false);
    expect(canDelete(admin, 11)).toBe(true);
    expect(canDelete(null, 11)).toBe(false);
  });
});
