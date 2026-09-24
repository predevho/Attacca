package com.back.domain.imports.service;

import com.back.domain.imports.collector.ImportCollector;
import com.back.domain.imports.collector.ImportCollector.ImportCollectionResult;
import com.back.domain.imports.entity.ImportRun;
import com.back.domain.imports.entity.ImportRunResult;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportTrigger;
import com.back.domain.imports.repository.ImportRunRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.stereotype.Service;

@Service
public class ImportRunService {

    private static final int MAX_MESSAGE_LENGTH = 1000;
    private static final String TRUNCATION_SUFFIX = "...";

    private final Map<ImportSource, ImportCollector> collectors;
    private final ImportIngestionService ingestionService;
    private final ImportRunRepository importRunRepository;
    private final ConcurrentHashMap<ImportSource, AtomicBoolean> running = new ConcurrentHashMap<>();

    public ImportRunService(List<ImportCollector> collectors, ImportIngestionService ingestionService,
            ImportRunRepository importRunRepository) {
        this.collectors = new EnumMap<>(ImportSource.class);
        for (ImportCollector collector : collectors) {
            this.collectors.put(collector.source(), collector);
        }
        this.ingestionService = ingestionService;
        this.importRunRepository = importRunRepository;
    }

    public ImportRun run(ImportSource source, ImportTrigger trigger) {
        AtomicBoolean flag = running.computeIfAbsent(source, ignored -> new AtomicBoolean(false));
        if (!flag.compareAndSet(false, true)) {
            throw new BusinessException(ErrorCode.IMPORT_ALREADY_RUNNING);
        }

        LocalDateTime startedAt = LocalDateTime.now();
        try {
            return doRun(source, trigger, startedAt);
        } finally {
            flag.set(false);
        }
    }

    public void assertNotRunning(ImportSource source) {
        AtomicBoolean flag = running.computeIfAbsent(source, ignored -> new AtomicBoolean(false));
        if (flag.get()) {
            throw new BusinessException(ErrorCode.IMPORT_ALREADY_RUNNING);
        }
    }

    private ImportRun doRun(ImportSource source, ImportTrigger trigger, LocalDateTime startedAt) {
        ImportRunResult result;
        int newCount = 0;
        String message = null;
        try {
            ImportCollectionResult collectionResult = collectorFor(source).collect();
            newCount = ingestionService.save(source, collectionResult.items(), LocalDateTime.now());
            message = collectionResult.message();
            result = collectionResult.items().isEmpty()
                    ? ImportRunResult.SKIPPED
                    : message == null ? ImportRunResult.SUCCESS : ImportRunResult.PARTIAL;
        } catch (RuntimeException e) {
            result = ImportRunResult.FAILED;
            message = e.getMessage();
        }
        return importRunRepository.save(ImportRun.record(source, trigger, startedAt,
                LocalDateTime.now(), result, newCount, summarizeMessage(message)));
    }

    private String summarizeMessage(String message) {
        if (message == null || message.length() <= MAX_MESSAGE_LENGTH) {
            return message;
        }
        return message.substring(0, MAX_MESSAGE_LENGTH - TRUNCATION_SUFFIX.length()) + TRUNCATION_SUFFIX;
    }

    private ImportCollector collectorFor(ImportSource source) {
        ImportCollector collector = collectors.get(source);
        if (collector == null) {
            throw new IllegalArgumentException("No import collector for source " + source);
        }
        return collector;
    }
}
