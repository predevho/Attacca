import type { ChangeEvent } from 'react';

type ProfileImageControlProps = {
  profileImageUrl: string | null;
  uploading: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ProfileImageControl({ profileImageUrl, uploading, onChange }: ProfileImageControlProps) {
  const controlClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const label = uploading ? '이미지 업로드 중' : '이미지 변경';

  return (
    <div className="mb-6 flex items-center gap-4">
      {profileImageUrl
        ? <img src={profileImageUrl} alt="프로필" className="h-20 w-20 rounded-full object-cover" />
        : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-muted text-xs text-ink-muted">사진 없음</div>}
      <label aria-label={label} className={`inline-flex min-h-11 cursor-pointer items-center rounded border border-line px-3 text-sm ${controlClass}`}>
        {uploading ? '업로드 중...' : '이미지 변경'}
        <input aria-label={label} type="file" accept="image/*" className="hidden" onChange={onChange} disabled={uploading} />
      </label>
    </div>
  );
}
