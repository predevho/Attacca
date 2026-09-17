package com.back.domain.imports.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.back.domain.imports.repository.ImportRunRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.Executor;
import org.junit.jupiter.api.Test;

class ImportScheduleServiceTest {
    private final ImportScheduleService service = new ImportScheduleService(mock(ImportRunService.class),
            mock(ImportRunRepository.class), Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneId.of("Asia/Seoul")),
            Runnable::run);

    @Test
    void 집중기간의_시작과_끝은_포함하고_그_밖은_제외한다() {
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2026, 7, 1))).isTrue();
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2026, 9, 20))).isTrue();
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2026, 9, 21))).isFalse();
    }

    @Test
    void 연말을_넘는_집중기간을_지원한다() {
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2026, 12, 26))).isTrue();
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2027, 1, 31))).isTrue();
        assertThat(service.isUniversityFocusDate(java.time.LocalDate.of(2027, 2, 1))).isFalse();
    }
}
