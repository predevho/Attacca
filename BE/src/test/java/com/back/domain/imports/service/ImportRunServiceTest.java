package com.back.domain.imports.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.imports.collector.CollectedItem;
import com.back.domain.imports.collector.ImportCollector;
import com.back.domain.imports.entity.ImportRun;
import com.back.domain.imports.entity.ImportRunResult;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportTrigger;
import com.back.domain.imports.repository.ImportRunRepository;
import com.back.domain.imports.repository.ImportedItemRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class ImportRunServiceTest {

    @Autowired
    private ImportedItemRepository importedItemRepository;

    @Autowired
    private ImportRunRepository importRunRepository;

    private ImportIngestionService ingestionService;

    @BeforeEach
    void setUp() {
        ingestionService = new ImportIngestionService(importedItemRepository);
    }

    @Test
    void 수집과_저장이_성공하면_SUCCESS_실행_기록을_남긴다() {
        ImportRunService service = serviceWith(collector(result(List.of(collected("PF-1")), null)));

        ImportRun run = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);

        assertThat(run.getResult()).isEqualTo(ImportRunResult.SUCCESS);
        assertThat(run.getNewCount()).isEqualTo(1);
        assertThat(run.getMessage()).isNull();
        assertThat(importRunRepository.count()).isEqualTo(1);
    }

    @Test
    void 일부_실패_메시지가_있으면_PARTIAL_실행_기록을_남긴다() {
        ImportRunService service = serviceWith(collector(result(List.of(collected("PF-1")),
                "yonsei blocked by robots")));

        ImportRun run = service.run(ImportSource.KOPIS, ImportTrigger.SCHEDULED);

        assertThat(run.getResult()).isEqualTo(ImportRunResult.PARTIAL);
        assertThat(run.getNewCount()).isEqualTo(1);
        assertThat(run.getMessage()).isEqualTo("yonsei blocked by robots");
    }

    @Test
    void 수집한_키가_없으면_SKIPPED_실행_기록을_남긴다() {
        ImportRunService service = serviceWith(collector(result(List.of(), "KOPIS_SERVICE_KEY missing")));

        ImportRun run = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);

        assertThat(run.getResult()).isEqualTo(ImportRunResult.SKIPPED);
        assertThat(run.getNewCount()).isZero();
        assertThat(run.getMessage()).isEqualTo("KOPIS_SERVICE_KEY missing");
    }

    @Test
    void collector가_실패하면_FAILED_실행_기록을_남기고_예외를_삼킨다() {
        ImportRunService service = serviceWith(new ThrowingCollector(ImportSource.KOPIS,
                new IllegalStateException("api down")));

        ImportRun run = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);

        assertThat(run.getResult()).isEqualTo(ImportRunResult.FAILED);
        assertThat(run.getNewCount()).isZero();
        assertThat(run.getMessage()).contains("api down");
        assertThat(importRunRepository.findById(run.getId())).isPresent();
    }

    @Test
    void 너무_긴_실패_메시지는_실행_이력을_남길_수_있는_길이로_요약한다() {
        String longMessage = "x".repeat(1001);
        ImportRunService service = serviceWith(new ThrowingCollector(ImportSource.KOPIS,
                new IllegalStateException(longMessage)));

        ImportRun run = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);

        assertThat(run.getResult()).isEqualTo(ImportRunResult.FAILED);
        assertThat(run.getMessage()).hasSize(1000).endsWith("...");
        assertThat(importRunRepository.findById(run.getId())).isPresent();
    }

    @Test
    void 같은_원천이_실행_중이면_IMPORT_ALREADY_RUNNING을_던진다() throws Exception {
        BlockingCollector blockingCollector = new BlockingCollector(ImportSource.KOPIS);
        ImportRunService service = serviceWith(blockingCollector);
        AtomicReference<Throwable> backgroundFailure = new AtomicReference<>();
        Thread running = new Thread(() -> {
            try {
                service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);
            } catch (Throwable t) {
                backgroundFailure.set(t);
            }
        });
        running.start();
        assertThat(blockingCollector.started.await(2, TimeUnit.SECONDS)).isTrue();

        assertThatThrownBy(() -> service.run(ImportSource.KOPIS, ImportTrigger.SCHEDULED))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(ErrorCode.IMPORT_ALREADY_RUNNING);

        blockingCollector.release.countDown();
        running.join(2000);
        assertThat(backgroundFailure.get()).isNull();
    }

    @Test
    void 실패한_뒤에도_원천_잠금을_해제한다() {
        SwitchableCollector collector = new SwitchableCollector(ImportSource.KOPIS,
                new IllegalStateException("first fail"));
        ImportRunService service = serviceWith(collector);

        ImportRun failed = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);
        collector.nextResult(result(List.of(collected("PF-1")), null));
        ImportRun retried = service.run(ImportSource.KOPIS, ImportTrigger.MANUAL);

        assertThat(failed.getResult()).isEqualTo(ImportRunResult.FAILED);
        assertThat(retried.getResult()).isEqualTo(ImportRunResult.SUCCESS);
    }

    private ImportRunService serviceWith(ImportCollector... collectors) {
        return new ImportRunService(List.of(collectors), ingestionService, importRunRepository);
    }

    private FixedCollector collector(ImportCollector.ImportCollectionResult result) {
        return new FixedCollector(ImportSource.KOPIS, result);
    }

    private ImportCollector.ImportCollectionResult result(List<CollectedItem> items, String message) {
        return new ImportCollector.ImportCollectionResult(items, message);
    }

    private CollectedItem collected(String sourceKey) {
        return new CollectedItem(sourceKey, "KOPIS", "https://example.com/" + sourceKey, "공연",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null,
                "장소", "요약", "https://example.com/poster.jpg");
    }

    private record FixedCollector(ImportSource source,
                                  ImportCollector.ImportCollectionResult result)
            implements ImportCollector {

        @Override
        public ImportCollectionResult collect() {
            return result;
        }
    }

    private static class ThrowingCollector implements ImportCollector {
        private final ImportSource source;
        private final RuntimeException exception;

        ThrowingCollector(ImportSource source, RuntimeException exception) {
            this.source = source;
            this.exception = exception;
        }

        @Override
        public ImportSource source() {
            return source;
        }

        @Override
        public ImportCollectionResult collect() {
            throw exception;
        }
    }

    private static class BlockingCollector implements ImportCollector {
        private final ImportSource source;
        private final CountDownLatch started = new CountDownLatch(1);
        private final CountDownLatch release = new CountDownLatch(1);

        BlockingCollector(ImportSource source) {
            this.source = source;
        }

        @Override
        public ImportSource source() {
            return source;
        }

        @Override
        public ImportCollectionResult collect() {
            started.countDown();
            try {
                release.await(2, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("interrupted", e);
            }
            return new ImportCollectionResult(List.of(collectedStatic("PF-1")), null);
        }

        private static CollectedItem collectedStatic(String sourceKey) {
            return new CollectedItem(sourceKey, "KOPIS", "https://example.com/" + sourceKey, "공연",
                    LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), null,
                    "장소", "요약", "https://example.com/poster.jpg");
        }
    }

    private static class SwitchableCollector implements ImportCollector {
        private final ImportSource source;
        private RuntimeException exception;
        private ImportCollectionResult result;

        SwitchableCollector(ImportSource source, RuntimeException exception) {
            this.source = source;
            this.exception = exception;
        }

        void nextResult(ImportCollectionResult result) {
            this.exception = null;
            this.result = result;
        }

        @Override
        public ImportSource source() {
            return source;
        }

        @Override
        public ImportCollectionResult collect() {
            if (exception != null) {
                throw exception;
            }
            return result;
        }
    }
}
