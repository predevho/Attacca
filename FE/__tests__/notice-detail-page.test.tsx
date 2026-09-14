import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '3' }) }));
const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (path: string) => getBff(path) }));

import PublicNoticePage from '@/app/notices/[id]/page';

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockResolvedValue({ ok: true, data: {
    id: 3, type: 'NEWS', title: '공개 소식', content: '내용', scheduledAt: null,
    place: null, pinned: false, sourceName: '공연예술통합전산망', sourceUrl: 'https://example.com/source',
  } });
});

describe('PublicNoticePage', () => {
  it('출처가 있으면 안전한 원문 링크와 상세 내용을 보여준다', async () => {
    render(<PublicNoticePage />);
    expect(await screen.findByRole('heading', { name: '공개 소식' })).toBeInTheDocument();
    expect(screen.getByText(/공연예술통합전산망/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '원문 보기' })).toHaveAttribute('href', 'https://example.com/source');
  });

  it('http(s)가 아닌 출처 URL은 링크로 렌더링하지 않는다', async () => {
    getBff.mockResolvedValue({ ok: true, data: {
      id: 3, type: 'NEWS', title: '공개 소식', content: '내용', scheduledAt: null,
      place: null, pinned: false, sourceName: '출처', sourceUrl: 'javascript:alert(1)',
    } });
    render(<PublicNoticePage />);
    await screen.findByRole('heading', { name: '공개 소식' });
    expect(screen.queryByRole('link', { name: '원문 보기' })).not.toBeInTheDocument();
  });
});
