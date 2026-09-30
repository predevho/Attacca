import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getBff, putBff, putBffForm, deleteBff } = vi.hoisted(() => ({
  getBff: vi.fn(),
  putBff: vi.fn(),
  putBffForm: vi.fn(),
  deleteBff: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getBff,
  putBff,
  putBffForm,
  deleteBff,
}));

import {
  loadProfilePageData,
  saveProfile,
  uploadProfileImage,
  changePassword,
  withdrawMember,
} from '@/features/profile/api/profileApi';

describe('profileApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('프로필 화면 데이터를 기존 BFF 경로에서 병렬로 조회한다', async () => {
    getBff.mockResolvedValue({ ok: true, data: {}, message: null });

    await loadProfilePageData();

    expect(getBff).toHaveBeenCalledTimes(3);
    expect(getBff).toHaveBeenCalledWith('/api/bff/me');
    expect(getBff).toHaveBeenCalledWith('/api/bff/profile-options');
    expect(getBff).toHaveBeenCalledWith('/api/bff/me/identity');
  });

  it('프로필 저장은 악기와 소개만 보낸다', async () => {
    await saveProfile({ instruments: ['VIOLIN'], bio: '소개' });

    expect(putBff).toHaveBeenCalledWith('/api/bff/me/profile', {
      instruments: ['VIOLIN'],
      bio: '소개',
    });
  });

  it('이미지 업로드는 기존 multipart BFF 경로를 사용한다', async () => {
    const form = new FormData();

    await uploadProfileImage(form);

    expect(putBffForm).toHaveBeenCalledWith('/api/bff/me/profile/image', form);
  });

  it('비밀번호 변경 요청에는 확인란을 포함하지 않는다', async () => {
    await changePassword({ currentPassword: 'old', newPassword: 'new-password' });

    expect(putBff).toHaveBeenCalledWith('/api/bff/members/me/password', {
      currentPassword: 'old',
      newPassword: 'new-password',
    });
  });

  it('회원 탈퇴는 기존 DELETE BFF 경로를 사용한다', async () => {
    await withdrawMember();

    expect(deleteBff).toHaveBeenCalledWith('/api/bff/members/me');
  });
});
