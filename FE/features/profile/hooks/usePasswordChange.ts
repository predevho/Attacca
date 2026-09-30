import { useState, type FormEvent } from 'react';
import { changePassword } from '@/features/profile/api/profileApi';
import {
  hasError,
  validatePasswordChange,
  type PasswordChangeForm,
} from '@/lib/auth/passwordChangeValidation';

const EMPTY_FORM: PasswordChangeForm = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
};

export function usePasswordChange() {
  const [form, setForm] = useState<PasswordChangeForm>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof PasswordChangeForm, boolean>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const errors = validatePasswordChange(form);

  function setField(key: keyof PasswordChangeForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDone(false);
  }

  function touch(key: keyof PasswordChangeForm) {
    setTouched((current) => ({ ...current, [key]: true }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (hasError(errors)) {
      setTouched({ currentPassword: true, newPassword: true, newPasswordConfirm: true });
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      if (response.ok) {
        setForm(EMPTY_FORM);
        setTouched({});
        setDone(true);
      } else {
        setError(response.message ?? '비밀번호를 바꾸지 못했습니다.');
      }
    } catch {
      setError('비밀번호를 바꾸지 못했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return { form, errors, touched, pending, error, done, setField, touch, submit };
}
