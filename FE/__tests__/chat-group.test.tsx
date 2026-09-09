import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p) }));

import { NewGroupForm } from '@/components/chat/NewGroupForm';
import { toCreateGroupRequest, validateGroup } from '@/lib/chat/logic';

/**
 * 그룹 방은 BE에 이미 다 있는데 화면이 통째로 없었다.
 * (DOMAIN-CHAT-STATUTE §120·§124 — 방장 없는 평평한 모델, 참여자 누구나 초대)
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getBff.mockReset();
  getBff.mockResolvedValue({ ok: true, data: [
    { id: 7, nickname: '정하윤', verified: true },
    { id: 9, nickname: '김하윤', verified: false },
  ] });
});
afterEach(() => vi.useRealTimers());

/** 검색 결과에서 한 명 고른다. 담긴 칩도 이름이 겹치므로 결과 목록 안으로 범위를 좁힌다. */
async function pick(name: RegExp) {
  fireEvent.change(screen.getByRole('searchbox', { name: '닉네임으로 회원 찾기' }), { target: { value: '하윤' } });
  await act(async () => { vi.advanceTimersByTime(400); });
  const results = await screen.findByRole('list', { name: '검색 결과' });
  fireEvent.click(within(results).getByRole('button', { name }));
}

describe('그룹 방 만들기 폼', () => {
  it('고른 사람이 목록에 쌓인다', async () => {
    render(<NewGroupForm submitting={false} onCreate={vi.fn()} />);
    await pick(/정하윤/);
    await pick(/김하윤/);
    expect(screen.getByRole('button', { name: '정하윤 제외' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '김하윤 제외' })).toBeInTheDocument();
  });

  it('같은 사람을 두 번 골라도 한 번만 담긴다', async () => {
    render(<NewGroupForm submitting={false} onCreate={vi.fn()} />);
    await pick(/정하윤/);
    await pick(/정하윤/);
    expect(screen.getAllByRole('button', { name: '정하윤 제외' })).toHaveLength(1);
  });

  it('담은 사람을 뺄 수 있다', async () => {
    render(<NewGroupForm submitting={false} onCreate={vi.fn()} />);
    await pick(/정하윤/);
    fireEvent.click(screen.getByRole('button', { name: '정하윤 제외' }));
    expect(screen.queryByRole('button', { name: '정하윤 제외' })).not.toBeInTheDocument();
  });

  it('아무도 안 담으면 만들 수 없다', async () => {
    // BE는 나 혼자인 방도 허용하지만(나중에 초대), 화면이 그걸 만들 이유는 없다.
    const onCreate = vi.fn();
    render(<NewGroupForm submitting={false} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: '그룹 만들기' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/한 명 이상/);
  });

  it('고른 사람들과 제목으로 만든다', async () => {
    const onCreate = vi.fn();
    render(<NewGroupForm submitting={false} onCreate={onCreate} />);
    await pick(/정하윤/);
    fireEvent.change(screen.getByLabelText('그룹 이름 (선택)'), { target: { value: '가을 연주회 팀' } });
    fireEvent.click(screen.getByRole('button', { name: '그룹 만들기' }));
    expect(onCreate).toHaveBeenCalledWith({ memberIds: [7], title: '가을 연주회 팀' });
  });
});

describe('그룹 생성 요청 변환', () => {
  it('제목이 비면 보내지 않는다', () => {
    // 빈 문자열을 보내면 "이름 없는 방"이 아니라 "이름이 빈 방"이 된다.
    expect(toCreateGroupRequest({ memberIds: [7], title: '  ' }))
      .toEqual({ type: 'GROUP', participantIds: [7] });
  });

  it('제목이 있으면 함께 보낸다', () => {
    expect(toCreateGroupRequest({ memberIds: [7, 9], title: '앙상블' }))
      .toEqual({ type: 'GROUP', participantIds: [7, 9], title: '앙상블' });
  });

  it('참여자가 없으면 거절한다', () => {
    expect(validateGroup({ memberIds: [], title: '' })).toMatch(/한 명 이상/);
  });

  it('참여자가 있으면 통과한다', () => {
    expect(validateGroup({ memberIds: [7], title: '' })).toBeNull();
  });
});
