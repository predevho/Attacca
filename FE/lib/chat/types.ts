export type RoomType = 'DIRECT' | 'GROUP';

export type ParticipantView = { id: number; nickname: string; verified: boolean; online: boolean };

export type LastMessage = { content: string; senderId: number; createdAt: string };

export type RoomSummary = {
  id: number;
  type: RoomType;
  displayName: string;
  lastMessage: LastMessage | null;
  unreadCount: number;
  lastMessageAt: string | null;
};

export type RoomDetail = {
  id: number;
  type: RoomType;
  title: string | null;
  participants: ParticipantView[];
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  sender: { id: number; nickname: string; verified: boolean };
  content: string;
  createdAt: string;
};

/** 방 목록은 Spring 오프셋 페이지. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };

/** 회원 검색 결과 한 건. BE MemberDisplay 와 1:1. */
export type MemberHit = { id: number; nickname: string; verified: boolean };

export type NewChatFormValues = { memberId: string };

/** 그룹 만들기 폼 값. title 은 비어도 된다(참여자 이름으로 표시). */
export type GroupFormValues = { memberIds: number[]; title: string };
