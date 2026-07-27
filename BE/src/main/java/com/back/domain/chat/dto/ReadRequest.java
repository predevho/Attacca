package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotNull;

public record ReadRequest(@NotNull Long lastReadMessageId) {
}
