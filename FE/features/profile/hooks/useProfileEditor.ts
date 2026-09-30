import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadProfilePageData,
  saveProfile as saveProfileRequest,
  uploadProfileImage,
} from '@/features/profile/api/profileApi';
import { MAX_INSTRUMENTS, type Profile, type ProfileOption } from '@/features/profile/model/profile';
import type { Me } from '@/lib/feed/types';

export function useProfileEditor() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [options, setOptions] = useState<ProfileOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftInstruments, setDraftInstruments] = useState<string[]>([]);
  const [draftBio, setDraftBio] = useState('');

  useEffect(() => {
    let active = true;

    loadProfilePageData().then(([profileRes, optionRes, identityRes]) => {
      if (!active) return;
      if (!profileRes.ok) {
        router.push('/login');
        return;
      }
      setProfile(profileRes.data as Profile);
      if (optionRes.ok) setOptions((optionRes.data as { instruments: ProfileOption[] }).instruments);
      if (identityRes.ok) setMe(identityRes.data as Me);
    }).catch(() => {
      if (active) setLoadError('프로필을 불러오지 못했습니다.');
    });

    return () => { active = false; };
  }, [router]);

  function startEdit() {
    if (!profile) return;
    setDraftInstruments(profile.instruments);
    setDraftBio(profile.bio ?? '');
    setError(null);
    setEditing(true);
  }

  function toggleInstrument(code: string) {
    setDraftInstruments((current) => {
      if (current.includes(code)) {
        setError(null);
        return current.filter((item) => item !== code);
      }
      if (current.length >= MAX_INSTRUMENTS) {
        setError(`악기는 최대 ${MAX_INSTRUMENTS}개까지 선택할 수 있습니다.`);
        return current;
      }
      setError(null);
      return [...current, code];
    });
  }

  async function save() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const response = await saveProfileRequest({ instruments: draftInstruments, bio: draftBio });
      if (response.ok) {
        setProfile(response.data as Profile);
        setEditing(false);
      } else {
        setError(response.message ?? '저장에 실패했습니다.');
      }
    } catch {
      setError('저장에 실패했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await uploadProfileImage(form);
      if (response.ok && response.data) {
        setProfile((current) => current ? { ...current, profileImageUrl: response.data!.profileImageUrl } : current);
      } else {
        setError(response.message ?? '이미지 업로드에 실패했습니다.');
      }
    } catch {
      setError('이미지 업로드에 실패했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setUploading(false);
    }
  }

  return {
    profile,
    me,
    options,
    editing,
    error,
    loadError,
    uploading,
    saving,
    draftInstruments,
    draftBio,
    setDraftBio,
    startEdit,
    toggleInstrument,
    save,
    onImageChange,
    cancelEdit: () => { setEditing(false); setError(null); },
  };
}
