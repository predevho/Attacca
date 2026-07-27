package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** STOMP 전송 페이로드. */
public record SendMessageRequest(@NotBlank @Size(max = 2000) String content) {
}
