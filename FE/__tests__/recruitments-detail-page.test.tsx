import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '7' }) }));
const getBff = vi.fn(); const postBff = vi.fn(); const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (p: string) => getBff(p),
  postBff: (p: string, b?: unknown) => postBff(p, b),
  deleteBff: (p: string) => deleteBff(p),
}));

import RecruitmentDetailPage from '@/app/recruitments/[id]/page';

const posting = { id: 7, author: { id: 9, nickname: '작성자', verified: false }, title: '피아노 반주자',
  description: '설명', instruments: ['PIANO'], recruitCount: 2, location: '서울', fee: '협의',
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' };

function mockGet(meId: number, extra: (p: string) => unknown = () => ({ ok: false, message: 'x' })) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: meId, nickname: 'X', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
    return Promise.resolve(extra(p));
  });
}

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); deleteBff.mockReset(); });

describe('RecruitmentDetailPage', () => {
  it('비작성자+미마감이면 지원하기 노출, 지원 성공 시 지원 완료', async () => {
    mockGet(2);
    postBff.mockResolvedValue({ ok: true, data: { id: 100 } });
    render(<RecruitmentDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: '지원합니다' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(await screen.findByText('지원 완료')).toBeInTheDocument();
    expect(postBff).toHaveBeenCalledWith('/api/bff/recruitments/7/applications', { message: '지원합니다' });
  });

  it('중복지원(409) 시 BE 메시지 노출', async () => {
    mockGet(2);
    postBff.mockResolvedValue({ ok: false, message: '이미 지원한 공고입니다.' });
    render(<RecruitmentDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: 'ㅁ' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(await screen.findByText('이미 지원한 공고입니다.')).toBeInTheDocument();
  });

  it('작성자면 지원자 목록 + 수정/마감/삭제 노출', async () => {
    mockGet(9, (p) => {
      if (p.startsWith('/api/bff/recruitments/7/applications')) {
        return { ok: true, data: { content: [{ id: 1, postingId: 7, applicant: { id: 2, nickname: '지원자1', verified: false }, message: 'hi', status: 'PENDING', createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true } };
      }
      return { ok: false, message: 'x' };
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('지원자1')).toBeInTheDocument();
    expect(screen.getByText('수정')).toBeInTheDocument();
    // '마감' 버튼 텍스트가 마감일 <dt>마감</dt> 라벨과 중복되어 getByText로는 모호함(2개 매치) → role 지정으로 소거.
    expect(screen.getByRole('button', { name: '마감' })).toBeInTheDocument();
    expect(screen.getByText('삭제')).toBeInTheDocument();
  });

  it('마감된 공고는 지원하기 대신 마감 안내', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'X', role: 'USER', verified: false } });
      if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: { ...posting, closed: true, status: 'CLOSED' } });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('마감된 공고입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지원하기' })).not.toBeInTheDocument();
  });

  it('신원 로드 전엔 공고가 먼저 와도 역할 UI를 렌더하지 않음(레이스 가드)', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return new Promise(() => {}); // 영원히 미해결(신원 지연)
      if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<RecruitmentDetailPage />);
    // 공고가 도착해도 me가 없으면 로딩 유지 — 작성자에게 지원 패널이 잠깐 노출되는 레이스 방지.
    expect(await screen.findByText('불러오는 중...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지원하기' })).not.toBeInTheDocument();
    expect(screen.queryByText('수정')).not.toBeInTheDocument();
  });

  it('없는 공고면 안내', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'X', role: 'USER', verified: false } });
      return Promise.resolve({ ok: false, message: 'not found' });
    });
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('삭제되었거나 없는 공고입니다.')).toBeInTheDocument();
  });

  it('모집 파트를 한글 라벨로 보여준다', async () => {
    mockGet(2);
    render(<RecruitmentDetailPage />);
    expect(await screen.findByText('피아노')).toBeInTheDocument();
    expect(screen.queryByText('PIANO')).not.toBeInTheDocument();
  });

  it('마감 버튼을 연타해도 요청은 한 번만 나간다', async () => {
    mockGet(9); // 작성자
    // 응답을 붙잡아 두고 그 사이에 다시 누른다 — 실제 연타가 일어나는 창이다.
    let release!: (v: unknown) => void;
    postBff.mockReturnValue(new Promise((r) => { release = r; }));
    render(<RecruitmentDetailPage />);
    const close = await screen.findByRole('button', { name: '마감' });
    fireEvent.click(close);
    const pendingBtn = await screen.findByRole('button', { name: '마감 중...' });
    fireEvent.click(pendingBtn);
    fireEvent.click(pendingBtn);
    expect(postBff).toHaveBeenCalledTimes(1);
    release({ ok: true, data: null });
  });
});
