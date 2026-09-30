import { useState } from 'react';
import { withdrawMember } from '@/features/profile/api/profileApi';

export const WITHDRAW_CONFIRMATION = '탈퇴합니다';

export function useMemberWithdrawal() {
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    try {
      const response = await withdrawMember();
      if (response.ok) {
        window.location.assign('/');
      } else {
        setError(response.message ?? '탈퇴에 실패했습니다.');
      }
    } catch {
      setError('탈퇴에 실패했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }

  function cancel() {
    setWithdrawing(false);
    setConfirmText('');
    setError(null);
  }

  return {
    withdrawing,
    confirmText,
    pending,
    error,
    setWithdrawing,
    setConfirmText,
    withdraw,
    cancel,
  };
}
