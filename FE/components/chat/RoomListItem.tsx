import type { RoomSummary } from '@/lib/chat/types';

export function RoomListItem({ room, onOpen }: { room: RoomSummary; onOpen: () => void }) {
  return (
    <article onClick={onOpen} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{room.displayName}</h3>
        <p className="truncate text-sm text-gray-500">{room.lastMessage?.content ?? '대화를 시작해 보세요.'}</p>
      </div>
      {room.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs text-white">
          {room.unreadCount}
        </span>
      )}
    </article>
  );
}
