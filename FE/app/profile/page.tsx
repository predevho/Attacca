'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { PasswordChangeForm } from '@/features/profile/components/PasswordChangeForm';
import { ProfileEditForm } from '@/features/profile/components/ProfileEditForm';
import { ProfileImageControl } from '@/features/profile/components/ProfileImageControl';
import { WithdrawSection } from '@/features/profile/components/WithdrawSection';
import { useProfileEditor } from '@/features/profile/hooks/useProfileEditor';

export default function ProfilePage() {
  const router = useRouter();
  const {
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
    cancelEdit,
  } = useProfileEditor();

  if (!profile) {
    return (
      <main className="mx-auto mt-24 max-w-md px-4">
        {loadError
          ? <p role="alert" className="text-sm text-danger">{loadError}</p>
          : <p role="status" aria-live="polite">불러오는 중...</p>}
      </main>
    );
  }

  function labelOf(code: string) {
    return options.find((option) => option.code === code)?.label ?? code;
  }

  const controlClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <main className="mx-auto mt-10 max-w-md px-4 pb-10 sm:mt-16">
      <h1 className="mb-2 text-2xl font-bold">내 프로필</h1>
      {me && (
        <p className="mb-6 text-sm">
          <AuthorBadge author={{ id: me.id, nickname: me.nickname, verified: me.verified }} />
        </p>
      )}

      <ProfileImageControl profileImageUrl={profile.profileImageUrl} uploading={uploading} onChange={onImageChange} />
      {error && !editing && <p className="mb-4 text-sm text-danger">{error}</p>}

      {!editing ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-muted">악기</h2>
            {profile.instruments.length > 0
              ? <div className="flex flex-wrap gap-2">{profile.instruments.map((code) => (
                  <span key={code} className="rounded-full bg-brand px-3 py-1 text-sm text-on-brand">{labelOf(code)}</span>))}</div>
              : <p className="text-sm text-ink-faint">등록된 악기가 없습니다.</p>}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-muted">자기소개</h2>
            <p className="whitespace-pre-wrap text-sm">{profile.bio || <span className="text-ink-faint">자기소개가 없습니다.</span>}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={startEdit} className={`min-h-11 rounded bg-brand px-4 text-on-brand ${controlClass}`}>수정</button>
            <Link href="/recruitments/applications/me" className={`inline-flex min-h-11 items-center justify-center rounded border border-line px-4 text-center ${controlClass}`}>내 지원 현황</Link>
            <button onClick={() => router.push('/verified-performer')} className={`min-h-11 rounded border border-line px-4 text-center ${controlClass}`}>인증 연주자</button>
          </div>
        </section>
      ) : (
        <ProfileEditForm
          options={options}
          draftInstruments={draftInstruments}
          draftBio={draftBio}
          error={error}
          saving={saving}
          onToggleInstrument={toggleInstrument}
          onBioChange={(event) => setDraftBio(event.target.value)}
          onSave={save}
          onCancel={cancelEdit}
        />
      )}

      <PasswordChangeForm />
      <WithdrawSection />
    </main>
  );
}
