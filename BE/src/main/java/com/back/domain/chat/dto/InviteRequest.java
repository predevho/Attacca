package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record InviteRequest(@NotEmpty List<Long> memberIds) {
}
