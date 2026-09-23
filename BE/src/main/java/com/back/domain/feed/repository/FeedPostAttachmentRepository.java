package com.back.domain.feed.repository;

import com.back.domain.feed.entity.FeedPostAttachment;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedPostAttachmentRepository extends JpaRepository<FeedPostAttachment, Long> {

    @EntityGraph(attributePaths = "fileMetadata")
    List<FeedPostAttachment> findByPostIdOrderByDisplayOrder(Long postId);

    @EntityGraph(attributePaths = "fileMetadata")
    List<FeedPostAttachment> findByPostIdInOrderByPostIdAscDisplayOrderAsc(Collection<Long> postIds);
}
