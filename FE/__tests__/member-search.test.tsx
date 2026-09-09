import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p) }));

import { NewChatForm } from '@/components/chat/NewChatForm';

/**
 * 1:1 대화 시작은 **회원 id를 숫자로 입력**받고 있었다. 사용자가 알 수 있는 값이 아니다.
 * 닉네임으로 찾아서 고르는 방식으로 바꾼다. (DOMAIN-MEMBER-STATUTE §3.2.1)
 */
const results = [
  { id: 7, nickname: '정하윤', verified: true },
  { id: 9, nickname: '김하윤', verified: false },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getBff.mockReset();
  getBff.mockResolvedValue({ ok: true, data: results });
});
afterEach(() => vi.useRealTimers());

function type(value: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: '닉네임으로 회원 찾기' }), { target: { value } });
}

describe('NewChatForm 회원 검색', () => {
  it('닉네임을 입력하면 후보를 보여준다', async () => {
    render(<NewChatForm submitting={false} onStart={vi.fn()} />);
    type('하윤');
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(await screen.findByRole('button', { name: /정하윤/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /김하윤/ })).toBeInTheDocument();
  });

  it('후보를 고르면 그 회원 id로 대화를 시작한다', async () => {
    const onStart = vi.fn();
    render(<NewChatForm submitting={false} onStart={onStart} />);
    type('하윤');
    await act(async () => { vi.advanceTimersByTime(400); });
    fireEvent.click(await screen.findByRole('button', { name: /정하윤/ }));
    expect(onStart).toHaveBeenCalledWith({ memberId: '7' });
  });

  it('두 글자 미만이면 서버를 부르지 않는다', async () => {
    // BE도 빈 목록을 주지만, 매 글자마다 요청을 보낼 이유가 없다.
    render(<NewChatForm submitting={false} onStart={vi.fn()} />);
    type('하');
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(getBff).not.toHaveBeenCalled();
  });

  it('타이핑이 멈춘 뒤에 한 번만 부른다', async () => {
    // 글자마다 요청하면 "하","하윤","하윤이"로 세 번 나간다.
    render(<NewChatForm submitting={false} onStart={vi.fn()} />);
    type('하윤');
    type('하윤이');
    type('하윤이가');
    await act(async () => { vi.advanceTimersByTime(400); });
    await waitFor(() => expect(getBff).toHaveBeenCalledTimes(1));
    expect(getBff).toHaveBeenCalledWith('/api/bff/members/search?q=%ED%95%98%EC%9C%A4%EC%9D%B4%EA%B0%80');
  });

  it('결과가 없으면 그렇게 알린다', async () => {
    getBff.mockResolvedValue({ ok: true, data: [] });
    render(<NewChatForm submitting={false} onStart={vi.fn()} />);
    type('없는사람');
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(await screen.findByText(/찾지 못했습니다/)).toBeInTheDocument();
  });

  it('인증 연주자는 뱃지로 구분된다', async () => {
    render(<NewChatForm submitting={false} onStart={vi.fn()} />);
    type('하윤');
    await act(async () => { vi.advanceTimersByTime(400); });
    const verified = await screen.findByRole('button', { name: /정하윤/ });
    expect(verified.textContent).toContain('인증');
  });
});
