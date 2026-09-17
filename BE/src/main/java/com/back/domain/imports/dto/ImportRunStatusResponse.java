package com.back.domain.imports.dto;

import com.back.domain.imports.entity.ImportRun;
import java.time.LocalDateTime;

public record ImportRunStatusResponse(Long id, String source, String trigger, String result,
        LocalDateTime startedAt, LocalDateTime finishedAt, int newCount, String message) {
    public static ImportRunStatusResponse from(ImportRun run) {
        return new ImportRunStatusResponse(run.getId(), run.getSource().name(), run.getTrigger().name(),
                run.getResult().name(), run.getStartedAt(), run.getFinishedAt(), run.getNewCount(), run.getMessage());
    }
}
