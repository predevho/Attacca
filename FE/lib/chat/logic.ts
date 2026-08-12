import type { CursorPage } from '@/lib/feed/types';
import type { ChatMessage, NewChatFormValues, RoomSummary, SpringPage } from '@/lib/chat/types';

/** 방 목록 Spring Page(오프셋)를 커서 페이지로 변환 → useInfiniteList 재사용. */
export function toRoomCursorPage(page: SpringPage<RoomSummary>): CursorPage<RoomSummary> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** id 오름차순 정렬(원본 불변). 이력 응답은 최신→과거(desc)라 표시 전 뒤집는다. */
export function sortByIdAsc(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => a.id - b.id);
}

/** 기존 목록에 새 메시지들을 id 중복 없이 합쳐 오름차순 유지(자기 전송분 브로드캐스트 재수신도 중복 제거). */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<number, ChatMessage>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.id - b.id);
}

/** ISO LocalDateTime → "HH:mm"(타임존 없이 문자열 파싱). */
export function formatTime(iso: string): string {
  const t = iso.split('T')[1] ?? '';
  const [hh = '00', mm = '00'] = t.split(':');
  return `${hh}:${mm}`;
}

/** 새 대화 폼 검증(회원 id 양의 정수). */
export function validateNewChat(v: NewChatFormValues): string | null {
  const n = Number(v.memberId);
  if (v.memberId.trim() === '' || !Number.isInteger(n) || n < 1) return '회원 id를 입력해 주세요.';
  return null;
}

/** 폼 값 → DIRECT 방 생성 요청. */
export function toCreateDirectRequest(v: NewChatFormValues) {
  return { type: 'DIRECT' as const, participantIds: [Number(v.memberId)] };
}
