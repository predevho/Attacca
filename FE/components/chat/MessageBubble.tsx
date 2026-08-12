import { formatTime } from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

export function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && <span className="mb-0.5 text-xs text-gray-500">{message.sender.nickname}</span>}
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <span className="mt-0.5 text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
    </div>
  );
}
