import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ postBff: vi.fn() }));

import SignupPage from '@/app/(auth)/signup/page';

describe('회원가입 화면', () => {
  it('아이디와 비밀번호 입력은 20자로 제한한다', () => {
    render(<SignupPage />);

    const [loginId] = screen.getAllByRole('textbox');
    const password = screen.getAllByDisplayValue('')
      .find((element) => element.getAttribute('type') === 'password');
    expect(loginId).toHaveAttribute('maxLength', '20');
    expect(password).toHaveAttribute('maxLength', '20');
  });

  it('비밀번호 확인 입력 중 일치 여부를 안내한다', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    const [password, passwordConfirm] = screen.getAllByDisplayValue('')
      .filter((element) => element.getAttribute('type') === 'password');
    await user.type(password, 'validpass1');
    await user.type(passwordConfirm, 'different1');
    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();

    await user.clear(passwordConfirm);
    await user.type(passwordConfirm, 'validpass1');
    expect(screen.getByText('비밀번호가 일치합니다.')).toBeInTheDocument();
  });
});
