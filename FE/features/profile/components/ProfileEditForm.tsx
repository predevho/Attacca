import type { ChangeEvent } from 'react';
import { MAX_INSTRUMENTS, type ProfileOption } from '@/features/profile/model/profile';

type ProfileEditFormProps = {
  options: ProfileOption[];
  draftInstruments: string[];
  draftBio: string;
  error: string | null;
  saving: boolean;
  onToggleInstrument: (code: string) => void;
  onBioChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ProfileEditForm({
  options,
  draftInstruments,
  draftBio,
  error,
  saving,
  onToggleInstrument,
  onBioChange,
  onSave,
  onCancel,
}: ProfileEditFormProps) {
  const controlClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">악기 (최대 {MAX_INSTRUMENTS}개)</h2>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = draftInstruments.includes(option.code);
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onToggleInstrument(option.code)}
                className={`min-h-11 rounded-full px-3 text-sm ${controlClass} ${selected ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink-muted'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-ink-muted">자기소개 ({draftBio.length}/500)</label>
        <textarea value={draftBio} maxLength={500} onChange={onBioChange} className="h-32 w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button onClick={onSave} disabled={saving} aria-busy={saving} className={`min-h-11 rounded bg-brand px-4 text-on-brand disabled:opacity-50 ${controlClass}`}>
          {saving ? '저장 중' : '저장'}
        </button>
        <button onClick={onCancel} disabled={saving} className={`min-h-11 rounded border border-line px-4 ${controlClass}`}>취소</button>
      </div>
    </section>
  );
}
