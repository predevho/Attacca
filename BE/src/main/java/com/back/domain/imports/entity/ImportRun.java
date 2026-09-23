package com.back.domain.imports.entity;

import com.back.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "import_run", indexes = {
    @Index(name = "idx_import_run_source_started", columnList = "source,started_at,id"),
    @Index(name = "idx_import_run_finished_at", columnList = "finished_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ImportRun extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "run_trigger", nullable = false, length = 20)
    private ImportTrigger trigger;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at", nullable = false)
    private LocalDateTime finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportRunResult result;

    @Column(name = "new_count", nullable = false)
    private int newCount;

    @Column(length = 1000)
    private String message;

    private ImportRun(ImportSource source, ImportTrigger trigger, LocalDateTime startedAt,
            LocalDateTime finishedAt, ImportRunResult result, int newCount, String message) {
        this.source = source;
        this.trigger = trigger;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.result = result;
        this.newCount = newCount;
        this.message = message;
    }

    public static ImportRun record(ImportSource source, ImportTrigger trigger,
            LocalDateTime startedAt, LocalDateTime finishedAt, ImportRunResult result,
            int newCount, String message) {
        return new ImportRun(source, trigger, startedAt, finishedAt, result, newCount, message);
    }
}
