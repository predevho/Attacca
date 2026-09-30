import type { Me } from '@/lib/feed/types';

export type ProfileOption = { code: string; label: string };

export type Profile = {
  instruments: string[];
  bio: string | null;
  profileImageUrl: string | null;
};

export type ProfilePageData = {
  profile: Profile;
  options: ProfileOption[];
  me: Me | null;
};

export const MAX_INSTRUMENTS = 10;
