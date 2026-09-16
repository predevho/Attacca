import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push, patchBff } = vi.hoisted(() => ({ push: vi.fn(), patchBff: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({ patchBff }));

import { NicknameForm } from '@/app/(auth)/signup/nickname/NicknameForm';

describe('닉네임 설정 페이지', () => {
  it('닉네임을 PATCH하고 next 경로로 이동한다', async () => {
    patchBff.mockResolvedValue({ ok: true, data: null, message: null });
    const user = userEvent.setup();
    render(<NicknameForm next="/chat" />);

    await user.type(screen.getByLabelText('닉네임'), ' 새 닉네임 ');
    await user.click(screen.getByRole('button', { name: '닉네임 저장' }));

    expect(patchBff).toHaveBeenCalledWith('/api/bff/members/me', { nickname: '새 닉네임' });
    expect(push).toHaveBeenCalledWith('/chat');
  });
});
