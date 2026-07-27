package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import java.time.LocalDateTime;
import java.util.List;

/** 방 생성·상세 응답. title 은 GROUP 만, participants 는 활성 참여자. */
public record ChatRoomResponse(Long id, RoomType type, String title,
        List<ParticipantView> participants, LocalDateTime createdAt) {
}
