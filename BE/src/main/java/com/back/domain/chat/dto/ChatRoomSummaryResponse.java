package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import java.time.LocalDateTime;

/** 방 목록 항목. displayName 은 DIRECT=상대 닉네임 / GROUP=title. lastMessage 는 없으면 null. */
public record ChatRoomSummaryResponse(Long id, RoomType type, String displayName,
        LastMessage lastMessage, long unreadCount, LocalDateTime lastMessageAt) {

    public record LastMessage(String content, Long senderId, LocalDateTime createdAt) {
    }
}
