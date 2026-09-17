package com.back.domain.imports.entity;

import com.back.global.common.BaseEntity;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "imported_item",
        uniqueConstraints = @UniqueConstraint(name = "uk_imported_item_source_key",
                columnNames = {"source", "source_key"}),
        indexes = {
            @Index(name = "idx_imported_item_status_created",
                    columnList = "status,created_at,id"),
            @Index(name = "idx_imported_item_source_created",
                    columnList = "source,created_at,id")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ImportedItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportSource source;

    @Column(name = "source_key", nullable = false, length = 200)
    private String sourceKey;

    @Column(name = "source_name", nullable = false, length = 200)
    private String sourceName;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "starts_at")
    private LocalDate startsAt;

    @Column(name = "ends_at")
    private LocalDate endsAt;

    @Column(name = "posted_at")
    private LocalDate postedAt;

    @Column(length = 200)
    private String place;

    @Column(length = 2000)
    private String summary;

    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportStatus status;

    @Column(name = "notice_id")
    private Long noticeId;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    private ImportedItem(ImportSource source, String sourceKey, String sourceName,
            String sourceUrl, String title, LocalDate startsAt, LocalDate endsAt,
            LocalDate postedAt, String place, String summary, String posterUrl,
            LocalDateTime lastSeenAt) {
        this.source = source;
        this.sourceKey = sourceKey;
        this.sourceName = sourceName;
        this.sourceUrl = sourceUrl;
        this.title = title;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.postedAt = postedAt;
        this.place = place;
        this.summary = summary;
        this.posterUrl = posterUrl;
        this.status = ImportStatus.NEW;
        this.lastSeenAt = lastSeenAt;
    }

    public static ImportedItem newItem(ImportSource source, String sourceKey, String sourceName,
            String sourceUrl, String title, LocalDate startsAt, LocalDate endsAt,
            LocalDate postedAt, String place, String summary, String posterUrl,
            LocalDateTime lastSeenAt) {
        return new ImportedItem(source, sourceKey, sourceName, sourceUrl, title, startsAt, endsAt,
                postedAt, place, summary, posterUrl, lastSeenAt);
    }

    public void approve(long noticeId) {
        transitionFromNew();
        if (noticeId <= 0) {
            throw new IllegalArgumentException("noticeId must be positive");
        }
        this.status = ImportStatus.APPROVED;
        this.noticeId = noticeId;
    }

    public void reject() {
        transitionFromNew();
        this.status = ImportStatus.REJECTED;
    }

    public void seenAt(LocalDateTime seenAt) {
        this.lastSeenAt = Objects.requireNonNull(seenAt, "seenAt must not be null");
    }

    private void transitionFromNew() {
        if (status != ImportStatus.NEW) {
            throw new BusinessException(ErrorCode.IMPORT_ITEM_ALREADY_HANDLED);
        }
    }
}
