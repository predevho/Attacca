import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { instrumentText, toLabelMap } from '@/lib/recruitment/instruments';
import { withCommentDelta } from '@/lib/feed/logic';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import type { CursorPage, Post } from '@/lib/feed/types';

describe('악기 라벨', () => {
  const labels = toLabelMap([
    { code: 'PIANO', label: '피아노' },
    { code: 'CELLO', label: '첼로' },
  ]);

  it('enum명을 한글 라벨로 바꾼다', () => {
    expect(instrumentText(['PIANO', 'CELLO'], labels)).toBe('피아노, 첼로');
  });

  it('아직 모르는 코드는 코드 그대로 보여준다 — 빈칸이 되면 안 된다', () => {
    // BE에 악기가 추가됐는데 옵션을 못 받아온 경우. 지우는 것보다 코드라도 보이는 편이 낫다.
    expect(instrumentText(['PIANO', 'THEREMIN'], labels)).toBe('피아노, THEREMIN');
  });

  it('라벨을 아직 못 받았으면 코드로 버틴다', () => {
    expect(instrumentText(['PIANO'], {})).toBe('PIANO');
  });

  it('빈 목록은 빈 문자열', () => {
    expect(instrumentText([], labels)).toBe('');
  });
});

describe('댓글 수 낙관적 반영', () => {
  const post = { id: 1, commentCount: 2 } as Post;

  it('댓글을 달면 게시글의 댓글 수가 함께 오른다', () => {
    expect(withCommentDelta(post, 1).commentCount).toBe(3);
  });

  it('댓글을 지우면 내려간다', () => {
    expect(withCommentDelta(post, -1).commentCount).toBe(1);
  });

  it('0 아래로는 내려가지 않는다', () => {
    expect(withCommentDelta({ ...post, commentCount: 0 }, -1).commentCount).toBe(0);
  });
});

describe('useInfiniteList의 loaded', () => {
  function Harness({ fetchPage }: { fetchPage: (c: number | null) => Promise<CursorPage<{ id: number }> | null> }) {
    const { items, loaded } = useInfiniteList<{ id: number }>(fetchPage);
    return (
      <div>
        <span>loaded:{String(loaded)}</span>
        {loaded && items.length === 0 && <p>등록된 것이 없습니다</p>}
      </div>
    );
  }

  it('첫 페이지가 오기 전에는 빈 상태를 보여주지 않는다', async () => {
    // 예전에는 첫 렌더에서 "없습니다"가 한 프레임 번쩍였다.
    let resolve!: (p: CursorPage<{ id: number }>) => void;
    const fetchPage = vi.fn(() => new Promise<CursorPage<{ id: number }> | null>((r) => { resolve = r; }));
    render(<Harness fetchPage={fetchPage} />);

    expect(screen.getByText('loaded:false')).toBeInTheDocument();
    expect(screen.queryByText('등록된 것이 없습니다')).not.toBeInTheDocument();

    resolve({ items: [], nextCursor: null });
    await waitFor(() => expect(screen.getByText('loaded:true')).toBeInTheDocument());
    expect(screen.getByText('등록된 것이 없습니다')).toBeInTheDocument();
  });
});
