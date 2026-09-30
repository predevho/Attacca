package com.back.domain.chat.dto.request;

import jakarta.validation.constraints.NotNull;

public record ReadRequest(@NotNull Long lastReadMessageId) {
}
