import type { Me } from '@/lib/feed/types';
import type { RoomDetail } from '@/lib/chat/types';

type ChatRoomHeaderProps = {
  room: RoomDetail | null;
  me: Me | null;
  onBack: () => void;
  onToggleInvite: () => void;
  onLeave: () => void;
};

export function ChatRoomHeader({ room, me, onBack, onToggleInvite, onLeave }: ChatRoomHeaderProps) {
  const isGroup = room?.type === 'GROUP';
  const headerName = room?.title
    ?? room?.participants.filter((participant) => participant.id !== me?.id).map((participant) => participant.nickname).join(', ')
    ?? '';

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <button type="button" aria-label="채팅 목록으로 돌아가기" onClick={onBack}
          className="shrink-0 px-1 py-2 text-sm text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span aria-hidden="true">←</span><span className="ml-1">채팅</span>
        </button>
        <h1 className="font-semibold">{headerName}</h1>
        {isGroup && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onToggleInvite} className="text-xs text-ink-faint">초대</button>
            <button type="button" onClick={onLeave} className="text-xs text-ink-faint">나가기</button>
          </div>
        )}
      </div>

      {isGroup && room && (
        <div role="group" aria-label="참여자" className="mb-2 flex flex-wrap gap-1.5">
          {room.participants.map((participant) => (
            <span key={participant.id} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
              {participant.nickname}{participant.id === me?.id ? ' (나)' : ''}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
