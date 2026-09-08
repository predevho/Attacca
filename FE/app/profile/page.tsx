'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBff, putBff, putBffForm, deleteBff } from '@/lib/api';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import type { Me } from '@/lib/feed/types';

type Option = { code: string; label: string };
type Profile = { instruments: string[]; bio: string | null; profileImageUrl: string | null };

const MAX_INSTRUMENTS = 10;

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [draftInstruments, setDraftInstruments] = useState<string[]>([]);
  const [draftBio, setDraftBio] = useState('');

  useEffect(() => {
    Promise.all([
      getBff('/api/bff/me'),
      getBff('/api/bff/profile-options'),
      getBff('/api/bff/me/identity'),
    ]).then(([profileRes, optionRes, identityRes]) => {
      if (!profileRes.ok) { router.push('/login'); return; }
      setProfile(profileRes.data as Profile);
      if (optionRes.ok) setOptions((optionRes.data as { instruments: Option[] }).instruments);
      if (identityRes.ok) setMe(identityRes.data as Me);
    });
  }, [router]);

  function labelOf(code: string) {
    return options.find((o) => o.code === code)?.label ?? code;
  }

  function startEdit() {
    if (!profile) return;
    setDraftInstruments(profile.instruments);
    setDraftBio(profile.bio ?? '');
    setError(null);
    setEditing(true);
  }

  function toggleInstrument(code: string) {
    setDraftInstruments((cur) => {
      if (cur.includes(code)) { setError(null); return cur.filter((c) => c !== code); }
      if (cur.length >= MAX_INSTRUMENTS) { setError(`악기는 최대 ${MAX_INSTRUMENTS}개까지 선택할 수 있습니다.`); return cur; }
      setError(null);
      return [...cur, code];
    });
  }

  async function save() {
    setError(null);
    const res = await putBff<Profile>('/api/bff/me/profile', { instruments: draftInstruments, bio: draftBio });
    if (res.ok) { setProfile(res.data as Profile); setEditing(false); }
    else setError(res.message ?? '저장에 실패했습니다.');
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await putBffForm<{ profileImageUrl: string }>('/api/bff/me/profile/image', fd);
    setUploading(false);
    if (res.ok && profile) setProfile({ ...profile, profileImageUrl: (res.data as { profileImageUrl: string }).profileImageUrl });
    else setError(res.message ?? '이미지 업로드에 실패했습니다.');
  }

  if (!profile) return <main className="mx-auto mt-24 max-w-md px-4">불러오는 중...</main>;

  // 확인 문구를 그대로 입력해야 눌린다. 되돌릴 수 없는 동작이라
  // 실수로 누르는 경로를 만들지 않는다.
  async function withdraw() {
    setWithdrawPending(true);
    setWithdrawError(null);
    const res = await deleteBff('/api/bff/members/me');
    setWithdrawPending(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setWithdrawError(res.message ?? '탈퇴에 실패했습니다.');
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md px-4">
      <h1 className="mb-2 text-2xl font-bold">내 프로필</h1>
      {me && (
        <p className="mb-6 text-sm">
          <AuthorBadge author={{ id: me.id, nickname: me.nickname, verified: me.verified }} />
        </p>
      )}

      <div className="mb-6 flex items-center gap-4">
        {profile.profileImageUrl
          ? <img src={profile.profileImageUrl} alt="프로필" className="h-20 w-20 rounded-full object-cover" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-muted text-xs text-ink-muted">사진 없음</div>}
        <label className="cursor-pointer rounded border border-line px-3 py-1.5 text-sm">
          {uploading ? '업로드 중...' : '이미지 변경'}
          <input type="file" accept="image/*" className="hidden" onChange={onImageChange} disabled={uploading} />
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {!editing ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-muted">악기</h2>
            {profile.instruments.length > 0
              ? <div className="flex flex-wrap gap-2">{profile.instruments.map((c) => (
                  <span key={c} className="rounded-full bg-brand px-3 py-1 text-sm text-on-brand">{labelOf(c)}</span>))}</div>
              : <p className="text-sm text-ink-faint">등록된 악기가 없습니다.</p>}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-muted">자기소개</h2>
            <p className="whitespace-pre-wrap text-sm">{profile.bio || <span className="text-ink-faint">자기소개가 없습니다.</span>}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={startEdit} className="rounded bg-brand px-4 py-2 text-on-brand">수정</button>
            <Link href="/recruitments/applications/me" className="rounded border border-line px-4 py-2 text-center">내 지원 현황</Link>
            <button onClick={() => router.push('/verified-performer')} className="rounded border border-line px-4 py-2 text-center">인증 연주자</button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-muted">악기 (최대 {MAX_INSTRUMENTS}개)</h2>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => {
                const on = draftInstruments.includes(o.code);
                return (
                  <button key={o.code} type="button" onClick={() => toggleInstrument(o.code)}
                    className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink-muted'}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink-muted">자기소개 ({draftBio.length}/500)</label>
            <textarea value={draftBio} maxLength={500} onChange={(e) => setDraftBio(e.target.value)}
              className="h-32 w-full rounded border border-line px-3 py-2 text-sm" />
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={save} className="rounded bg-brand px-4 py-2 text-on-brand">저장</button>
            <button onClick={() => { setEditing(false); setError(null); }} className="rounded border border-line px-4 py-2">취소</button>
          </div>
        </section>
      )}

      <section className="mt-16 border-t border-line pt-6">
        <h2 className="text-sm font-medium text-ink-muted">회원 탈퇴</h2>
        <p className="mt-2 text-sm">
          탈퇴하면 아이디·이메일·닉네임·프로필이 지워집니다. <b>되돌릴 수 없습니다.</b>
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          이미 올린 글과 댓글은 남고 작성자만 “탈퇴한 회원”으로 바뀝니다.
          다른 분들의 대화가 함께 무너지기 때문입니다. 글까지 지우려면 탈퇴 전에 직접 지워 주세요.
        </p>

        {!withdrawing ? (
          <button onClick={() => setWithdrawing(true)}
            className="mt-4 rounded border border-danger px-4 py-2 text-sm text-danger">탈퇴하기</button>
        ) : (
          <div className="mt-4 rounded border border-danger p-4">
            <label className="block text-sm">
              확인을 위해 <b>탈퇴합니다</b> 를 그대로 입력해 주세요.
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
            </label>
            {withdrawError && <p role="alert" className="mt-2 text-sm text-danger">{withdrawError}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={withdraw} disabled={confirmText !== '탈퇴합니다' || withdrawPending}
                className="rounded bg-danger px-4 py-2 text-sm text-on-brand disabled:opacity-50">
                영구 삭제
              </button>
              <button onClick={() => { setWithdrawing(false); setConfirmText(''); setWithdrawError(null); }}
                className="rounded border border-line px-4 py-2 text-sm">취소</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
