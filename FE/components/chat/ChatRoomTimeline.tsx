import type { RefObject } from 'react';
import { DateSeparator } from '@/components/chat/DateSeparator';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { groupMessagesByDate } from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

type ChatRoomTimelineProps = {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  viewerId: number | null;
  olderCursor: number | null;
  loadingOlder: boolean;
  onLoadOlder: () => void;
};

export function ChatRoomTimeline({
  scrollRef,
  messages,
  viewerId,
  olderCursor,
  loadingOlder,
  onLoadOlder,
}: ChatRoomTimelineProps) {
  const messageGroups = groupMessagesByDate(messages);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {olderCursor != null && (
        <div className="flex justify-center py-2">
          <button type="button" onClick={onLoadOlder} disabled={loadingOlder}
            className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-50">
            {loadingOlder ? '불러오는 중...' : '이전 메시지 더 보기'}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 py-2">
        {messageGroups.map((group) => (
          <div key={group.dateKey} className="flex flex-col gap-3">
            <DateSeparator label={group.label} />
            {group.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                mine={viewerId != null && message.sender.id === viewerId}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
