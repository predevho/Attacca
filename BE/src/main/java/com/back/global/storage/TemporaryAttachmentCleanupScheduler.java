package com.back.global.storage;

import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 만료된 임시 첨부 파일을 주기적으로 정리한다. */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemporaryAttachmentCleanupScheduler {

    private final FileService fileService;
    private final TemporaryAttachmentCleanupProperties properties;
    private final Clock clock;

    @Scheduled(cron = "${storage.temporary-cleanup.cron}",
            zone = "${storage.temporary-cleanup.zone}")
    public void cleanExpiredTemporaryFiles() {
        LocalDateTime cutoff = LocalDateTime.now(clock).minus(properties.retention());
        int deletedCount = fileService.deleteExpiredTemporaryFiles(cutoff);
        if (deletedCount > 0) {
            log.info("만료 임시 첨부를 정리했습니다. count={}", deletedCount);
        }
    }
}
