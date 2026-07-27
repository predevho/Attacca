package com.back.domain.chat.dto;

import com.back.domain.member.dto.MemberDisplay;
import java.time.LocalDateTime;

/** 메시지 응답. sender 는 MEMBER 협력으로 파생한 표시정보. */
public record ChatMessageResponse(Long id, Long roomId, MemberDisplay sender, String content,
        LocalDateTime createdAt) {
}
