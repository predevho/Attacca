import { formatTime } from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

export function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && <span className="mb-0.5 text-xs text-ink-muted">{message.sender.nickname}</span>}
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand text-on-brand' : 'bg-surface-muted text-ink'}`}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <span className="mt-0.5 text-[10px] text-ink-faint">{formatTime(message.createdAt)}</span>
    </div>
  );
}
