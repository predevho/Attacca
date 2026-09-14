package com.back.domain.imports.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.imports.entity.ImportRun;
import com.back.domain.imports.entity.ImportRunResult;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportTrigger;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class ImportRunRepositoryTest {

    @Autowired
    private ImportRunRepository repository;

    @Test
    void 원천별_가장_최근에_시작한_실행을_조회한다() {
        ImportRun oldKopis = repository.save(run(ImportSource.KOPIS, 9));
        ImportRun latestKopis = repository.save(run(ImportSource.KOPIS, 11));
        repository.save(run(ImportSource.UNIV_NOTICE, 12));

        ImportRun latest = repository
                .findTopBySourceOrderByStartedAtDescIdDesc(ImportSource.KOPIS)
                .orElseThrow();

        assertThat(latest.getId()).isEqualTo(latestKopis.getId()).isNotEqualTo(oldKopis.getId());
    }

    @Test
    void 종료_시각이_cutoff보다_이른_실행만_삭제한다() {
        LocalDateTime cutoff = LocalDateTime.of(2026, 9, 13, 0, 0);
        ImportRun expired = repository.save(runFinishedAt(cutoff.minusSeconds(1)));
        ImportRun onBoundary = repository.save(runFinishedAt(cutoff));
        ImportRun recent = repository.save(runFinishedAt(cutoff.plusDays(1)));
        repository.flush();

        long deleted = repository.deleteByFinishedAtBefore(cutoff);
        repository.flush();

        assertThat(deleted).isEqualTo(1);
        assertThat(repository.findById(expired.getId())).isEmpty();
        assertThat(repository.findById(onBoundary.getId())).isPresent();
        assertThat(repository.findById(recent.getId())).isPresent();
    }

    private ImportRun run(ImportSource source, int hour) {
        LocalDateTime startedAt = LocalDateTime.of(2026, 9, 13, hour, 0);
        return ImportRun.record(source, ImportTrigger.SCHEDULED, startedAt,
                startedAt.plusMinutes(1), ImportRunResult.SUCCESS, 1, null);
    }

    private ImportRun runFinishedAt(LocalDateTime finishedAt) {
        return ImportRun.record(ImportSource.KOPIS, ImportTrigger.SCHEDULED,
                finishedAt.minusMinutes(1), finishedAt, ImportRunResult.SUCCESS, 1, null);
    }
}
