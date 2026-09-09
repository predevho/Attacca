import type { AdminNotice, NoticeFormValues } from '@/lib/notice/types';

export const EMPTY_NOTICE_FORM: NoticeFormValues = {
  type: 'NOTICE',
  title: '',
  content: '',
  scheduledAt: '',
  place: '',
  pinned: false,
};

/** BE `NoticeRequest` 로 보낼 모양. */
export type NoticeRequest = {
  type: NoticeFormValues['type'];
  title: string;
  content: string;
  scheduledAt: string | null;
  place: string | null;
  pinned: boolean;
};

/**
 * 폼 값 → 요청 본문.
 *
 * 빈 칸은 `null` 로 보낸다 — 빈 문자열을 그대로 보내면 "장소가 빈 문자열인 공지"가 생긴다.
 * `datetime-local` 은 초를 주지 않으므로 붙여 보낸다(BE는 `LocalDateTime`).
 */
export function toNoticeRequest(form: NoticeFormValues): NoticeRequest {
  const scheduledAt = form.scheduledAt.trim();
  const place = form.place.trim();
  return {
    type: form.type,
    title: form.title.trim(),
    content: form.content.trim(),
    scheduledAt: scheduledAt ? `${scheduledAt}:00` : null,
    place: place || null,
    pinned: form.pinned,
  };
}

/** 수정 폼에 실을 수 있게 되돌린다. `datetime-local` 은 초를 받지 않는다. */
export function toFormValues(notice: AdminNotice): NoticeFormValues {
  return {
    type: notice.type,
    title: notice.title,
    content: notice.content,
    scheduledAt: notice.scheduledAt ? notice.scheduledAt.slice(0, 16) : '',
    place: notice.place ?? '',
    pinned: notice.pinned,
  };
}

export type NoticeErrors = Partial<Record<keyof NoticeFormValues, string>>;

/**
 * 길이 제한은 BE `NoticeRequest` 와 **같게** 유지한다 —
 * 규칙이 갈리면 화면이 통과시킨 값을 서버가 거절한다.
 */
export function validateNotice(form: NoticeFormValues): NoticeErrors {
  const e: NoticeErrors = {};
  const title = form.title.trim();
  const content = form.content.trim();
  const place = form.place.trim();

  if (!title) e.title = '제목을 입력해 주세요.';
  else if (title.length > 100) e.title = '제목은 100자를 넘을 수 없습니다.';

  if (!content) e.content = '본문을 입력해 주세요.';
  else if (content.length > 5000) e.content = '본문은 5000자를 넘을 수 없습니다.';

  if (place.length > 200) e.place = '장소는 200자를 넘을 수 없습니다.';

  // 일시가 없으면 달력에 뜨지 않는다(STATUTE: scheduledAt 이 달력 노출의 유일한 상태).
  // 일정으로 올렸는데 달력에 안 뜨면 올린 뜻이 사라지므로 여기서 막는다.
  if (form.type === 'EVENT' && !form.scheduledAt.trim()) {
    e.scheduledAt = '일정은 일시를 입력해야 달력에 표시됩니다.';
  }

  return e;
}

export function hasError(errors: NoticeErrors): boolean {
  return Object.keys(errors).length > 0;
}
