package com.back.domain.recruitment.entity;

import com.back.global.common.BaseEntity;
import com.back.global.storage.FileMetadata;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 구인 공고와 업로드 파일의 귀속 관계. */
@Entity
@Table(name = "recruitment_posting_attachment", uniqueConstraints = {
        @UniqueConstraint(name = "uk_recruitment_posting_attachment_file", columnNames = "file_metadata_id"),
        @UniqueConstraint(name = "uk_recruitment_posting_attachment_order", columnNames = {"posting_id", "display_order"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecruitmentPostingAttachment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "posting_id", nullable = false)
    private RecruitmentPosting posting;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "file_metadata_id", nullable = false)
    private FileMetadata fileMetadata;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    private RecruitmentPostingAttachment(RecruitmentPosting posting, FileMetadata fileMetadata,
                                         int displayOrder) {
        this.posting = posting;
        this.fileMetadata = fileMetadata;
        this.displayOrder = displayOrder;
    }

    public static RecruitmentPostingAttachment create(RecruitmentPosting posting,
                                                        FileMetadata fileMetadata,
                                                        int displayOrder) {
        return new RecruitmentPostingAttachment(posting, fileMetadata, displayOrder);
    }
}
