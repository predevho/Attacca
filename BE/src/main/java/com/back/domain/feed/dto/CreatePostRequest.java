package com.back.domain.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreatePostRequest(
        @NotBlank(message = "내용을 입력해 주세요.")
        @Size(max = 2000, message = "게시글은 2000자를 넘을 수 없습니다.") String content,
        @Size(max = 5, message = "첨부 파일은 최대 5개까지 추가할 수 있습니다.")
        List<Long> attachmentIds) {

    public CreatePostRequest(String content) {
        this(content, List.of());
    }
}
