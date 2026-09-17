import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push, patchBff } = vi.hoisted(() => ({ push: vi.fn(), patchBff: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({ patchBff }));

import { NicknameForm } from '@/app/(auth)/signup/nickname/NicknameForm';

beforeEach(() => vi.clearAllMocks());

describe('닉네임 설정 페이지', () => {
  it('신규 소셜 회원은 닉네임과 필수 동의를 PATCH하고 next 경로로 이동한다', async () => {
    patchBff.mockResolvedValue({ ok: true, data: null, message: null });
    const user = userEvent.setup();
    render(<NicknameForm next="/chat" />);

    await user.type(screen.getByLabelText('닉네임'), ' 새 닉네임 ');
    await user.click(screen.getByLabelText(/이용약관/));
    await user.click(screen.getByLabelText(/개인정보 수집/));
    await user.click(screen.getByRole('button', { name: '닉네임 저장' }));

    expect(patchBff).toHaveBeenCalledWith('/api/bff/members/me', {
      nickname: '새 닉네임', agreedTerms: true, agreedPrivacy: true,
    });
    expect(push).toHaveBeenCalledWith('/chat');
  });

  it('필수 동의가 없으면 저장 요청을 보내지 않는다', async () => {
    const user = userEvent.setup();
    render(<NicknameForm />);

    await user.type(screen.getByLabelText('닉네임'), '새 닉네임');
    await user.click(screen.getByRole('button', { name: '닉네임 저장' }));

    expect(patchBff).not.toHaveBeenCalled();
    expect(screen.getByText('필수 약관에 동의해 주세요.')).toBeInTheDocument();
  });
});
