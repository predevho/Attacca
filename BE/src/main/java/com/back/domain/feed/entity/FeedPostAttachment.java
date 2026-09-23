package com.back.domain.feed.entity;

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

/** 피드 게시글과 업로드 파일의 귀속 관계. */
@Entity
@Table(name = "feed_post_attachment", uniqueConstraints = {
        @UniqueConstraint(name = "uk_feed_post_attachment_file", columnNames = "file_metadata_id"),
        @UniqueConstraint(name = "uk_feed_post_attachment_order", columnNames = {"post_id", "display_order"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FeedPostAttachment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "file_metadata_id", nullable = false)
    private FileMetadata fileMetadata;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    private FeedPostAttachment(Post post, FileMetadata fileMetadata, int displayOrder) {
        this.post = post;
        this.fileMetadata = fileMetadata;
        this.displayOrder = displayOrder;
    }

    public static FeedPostAttachment create(Post post, FileMetadata fileMetadata, int displayOrder) {
        return new FeedPostAttachment(post, fileMetadata, displayOrder);
    }
}
