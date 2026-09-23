package com.back.domain.feed.dto;

import com.back.domain.member.dto.MemberDisplay;
import com.back.global.storage.AttachmentResponse;
import java.time.LocalDateTime;
import java.util.List;

public record PostResponse(
        Long id,
        MemberDisplay author,
        String content,
        long likeCount,
        long commentCount,
        boolean likedByMe,
        List<AttachmentResponse> attachments,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
