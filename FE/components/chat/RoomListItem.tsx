import type { RoomSummary } from '@/lib/chat/types';

export function RoomListItem({ room, onOpen }: { room: RoomSummary; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`${room.displayName} 대화 열기`}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{room.displayName}</h3>
        <p className="truncate text-sm text-ink-muted">{room.lastMessage?.content ?? '대화를 시작해 보세요.'}</p>
      </div>
      {room.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs text-on-brand">
          {room.unreadCount}
        </span>
      )}
    </button>
  );
}
