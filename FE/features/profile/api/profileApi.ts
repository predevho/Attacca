import { deleteBff, getBff, putBff, putBffForm, type BffResult } from '@/lib/api';
import type { Me } from '@/lib/feed/types';
import type { Profile, ProfileOption } from '@/features/profile/model/profile';

type ProfileOptionsResponse = { instruments: ProfileOption[] };

export function loadProfilePageData() {
  return Promise.all([
    getBff<Profile>('/api/bff/me'),
    getBff<ProfileOptionsResponse>('/api/bff/profile-options'),
    getBff<Me>('/api/bff/me/identity'),
  ]);
}

export function saveProfile(profile: Pick<Profile, 'instruments' | 'bio'>): Promise<BffResult<Profile>> {
  return putBff<Profile>('/api/bff/me/profile', profile);
}

export function uploadProfileImage(form: FormData): Promise<BffResult<{ profileImageUrl: string }>> {
  return putBffForm<{ profileImageUrl: string }>('/api/bff/me/profile/image', form);
}

export function changePassword(body: { currentPassword: string; newPassword: string }): Promise<BffResult> {
  return putBff('/api/bff/members/me/password', body);
}

export function withdrawMember(): Promise<BffResult> {
  return deleteBff('/api/bff/members/me');
}
