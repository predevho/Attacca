package com.back.domain.notice.entity;

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

/**
 * 운영자가 올리는 공지·소식·운영 일정. 작성자는 원시 authorId(Long)로만 참조한다. 삭제는 soft delete.
 *
 * <p>공지/소식/일정을 하나의 엔티티로 두는 이유: 셋은 작성 주체·필드 구성·수명주기가 같고
 * 홈이 이들을 한 번의 조회로 모아 보여준다. 쪼개면 캐러셀과 달력이 세 방향으로 조회하게 되고
 * 공통 규칙(권한·soft delete·커버 이미지)이 세 벌로 복제된다.
 */
@Entity
@Table(name = "notice", indexes = {
        // 달력 범위 조회 / 캐러셀 조회에 각각 대응한다.
        @Index(name = "idx_notice_scheduled", columnList = "deleted_at, scheduled_at"),
        @Index(name = "idx_notice_pinned", columnList = "deleted_at, pinned, created_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notice extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long authorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NoticeType type;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 5000)
    private String content;

    /**
     * 일정 시각. null이면 달력에 뜨지 않는다.
     * 별도의 "달력에 표시" 플래그를 두지 않는 이유는 그런 플래그가 있으면
     * "날짜는 있는데 달력엔 없음" 같은 모순 상태가 만들어지기 때문이다(CONSTITUTION §2).
     */
    private LocalDateTime scheduledAt;

    @Column(length = 200)
    private String place;

    /** 홈 캐러셀 노출 여부. 달력과는 독립된 축이다. */
    @Column(nullable = false)
    private boolean pinned;

    @Column(name = "cover_image_key")
    private String coverImageKey;

    private LocalDateTime deletedAt;

    private Notice(Long authorId, NoticeType type, String title, String content,
            LocalDateTime scheduledAt, String place, boolean pinned) {
        this.authorId = authorId;
        this.type = type;
        this.title = title;
        this.content = content;
        this.scheduledAt = scheduledAt;
        this.place = place;
        this.pinned = pinned;
    }

    public static Notice create(Long authorId, NoticeType type, String title, String content,
            LocalDateTime scheduledAt, String place, boolean pinned) {
        return new Notice(authorId, type, title, content, scheduledAt, place, pinned);
    }

    /** 본문 필드를 전체 교체한다(PUT 시맨틱). 작성자·커버·삭제상태는 바꾸지 않는다. */
    public void edit(NoticeType type, String title, String content, LocalDateTime scheduledAt,
            String place, boolean pinned) {
        this.type = type;
        this.title = title;
        this.content = content;
        this.scheduledAt = scheduledAt;
        this.place = place;
        this.pinned = pinned;
    }

    public void changeCover(String newKey) {
        this.coverImageKey = newKey;
    }

    public void pin() {
        this.pinned = true;
    }

    public void unpin() {
        this.pinned = false;
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    /** 달력에 노출되는가. 곧 scheduledAt의 유무다(STATUTE §5). */
    public boolean isScheduled() {
        return scheduledAt != null;
    }
}
