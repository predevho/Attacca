package com.back.domain.imports.dto;

import com.back.domain.notice.dto.NoticeRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ImportApproveRequest(@NotNull @Valid NoticeRequest notice) {}
