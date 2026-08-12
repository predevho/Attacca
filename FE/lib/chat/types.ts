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

export type NewChatFormValues = { memberId: string };
