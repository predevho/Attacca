package com.back.domain.chat.service;

import com.back.domain.chat.dto.ChatMessageResponse;
import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.entity.ChatRoom;
import com.back.domain.chat.repository.ChatMessageRepository;
import com.back.domain.chat.repository.ChatRoomRepository;
import com.back.domain.feed.dto.CursorPage;
import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 메시지 전송(영속화)·이력 조회. 인가는 ChatRoomService.assertActiveParticipant 재사용. */
@Service
@RequiredArgsConstructor
public class ChatMessageService {

    private final ChatMessageRepository messageRepository;
    private final ChatRoomRepository roomRepository;
    private final ChatRoomService roomService;
    private final MemberQueryService memberQueryService;

    /** 메시지 영속화 + 방 lastMessageAt 갱신. 브로드캐스트는 호출측(STOMP 컨트롤러)이 한다. */
    @Transactional
    public ChatMessageResponse send(Long senderId, Long roomId, String content) {
        ChatRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND));
        roomService.assertActiveParticipant(roomId, senderId);
        ChatMessage saved = messageRepository.save(ChatMessage.create(roomId, senderId, content));
        room.updateLastMessageAt(LocalDateTime.now());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CursorPage<ChatMessageResponse> history(Long memberId, Long roomId, Long cursor,
            int size) {
        if (!roomRepository.existsById(roomId)) {
            throw new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND);
        }
        roomService.assertActiveParticipant(roomId, memberId);
        List<ChatMessage> rows = messageRepository.findHistory(roomId, cursor,
                PageRequest.of(0, size + 1));
        boolean hasNext = rows.size() > size;
        List<ChatMessage> page = hasNext ? rows.subList(0, size) : rows;
        if (page.isEmpty()) {
            return new CursorPage<>(List.of(), null);
        }
        Set<Long> senderIds = page.stream().map(ChatMessage::getSenderId)
                .collect(Collectors.toSet());
        Map<Long, MemberDisplay> senders = memberQueryService.findDisplaysByIds(senderIds);
        List<ChatMessageResponse> items = page.stream()
                .map(m -> toResponse(m, senders.get(m.getSenderId()))).toList();
        Long nextCursor = hasNext ? page.get(page.size() - 1).getId() : null;
        return new CursorPage<>(items, nextCursor);
    }

    private ChatMessageResponse toResponse(ChatMessage m) {
        MemberDisplay sender = memberQueryService.findDisplaysByIds(Set.of(m.getSenderId()))
                .get(m.getSenderId());
        return toResponse(m, sender);
    }

    private ChatMessageResponse toResponse(ChatMessage m, MemberDisplay sender) {
        return new ChatMessageResponse(m.getId(), m.getRoomId(), sender, m.getContent(),
                m.getCreatedAt());
    }
}
