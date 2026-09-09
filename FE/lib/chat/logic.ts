import type { CursorPage } from '@/lib/feed/types';
import type { ChatMessage, GroupFormValues, NewChatFormValues, RoomSummary, SpringPage } from '@/lib/chat/types';

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

/** 검색어 최소 길이. BE(STATUTE §3.2.1)와 같은 값 — 미만이면 아예 요청하지 않는다. */
export const MIN_SEARCH_LENGTH = 2;

/** 회원 검색 URL. 닉네임에 공백·특수문자가 들어갈 수 있어 반드시 인코딩한다. */
export function searchUrl(query: string): string {
  return `/api/bff/members/search?q=${encodeURIComponent(query.trim())}`;
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

/**
 * 과거 메시지를 목록 앞에 붙인다. BE 이력은 최신→과거 순이므로 그대로 붙이면 순서가 뒤집힌다.
 * 커서 경계에서 같은 메시지가 겹쳐 올 수 있어 id 기준으로 한 번만 남긴다.
 */
export function prependOlder(current: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
  if (older.length === 0) return current;
  const byId = new Map<number, ChatMessage>();
  for (const m of [...older, ...current]) byId.set(m.id, m);
  return sortByIdAsc([...byId.values()]);
}

/**
 * 새 메시지가 왔을 때 바닥으로 따라 내려갈지.
 *
 * 이전 대화를 읽고 있는 중에 화면이 튀면 방해가 되므로, **이미 바닥 근처일 때만** 따라간다.
 * 스크롤 값이 픽셀 단위로 딱 떨어지지 않아 여유(threshold)를 둔다.
 */
export function shouldStickToBottom(
  el: { scrollTop: number; clientHeight: number; scrollHeight: number },
  threshold = 80,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * 그룹 폼 검증. BE는 나 혼자인 방도 허용하지만(STATUTE §124) 화면은 한 명 이상을 요구한다 —
 * 아무도 없는 방을 만들면 다음에 뭘 해야 할지 알 수 없다.
 */
export function validateGroup(v: GroupFormValues): string | null {
  if (v.memberIds.length === 0) return '한 명 이상 담아 주세요.';
  return null;
}

/**
 * 폼 값 → GROUP 방 생성 요청.
 * 제목이 공백뿐이면 아예 빼서 보낸다 — 빈 문자열을 보내면 "이름 없는 방"이 아니라 "이름이 빈 방"이 된다.
 */
export function toCreateGroupRequest(v: GroupFormValues) {
  const title = v.title.trim();
  return title
    ? { type: 'GROUP' as const, participantIds: v.memberIds, title }
    : { type: 'GROUP' as const, participantIds: v.memberIds };
}
