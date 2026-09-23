package com.back.domain.recruitment.repository;

import com.back.domain.recruitment.entity.RecruitmentPostingAttachment;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruitmentPostingAttachmentRepository
        extends JpaRepository<RecruitmentPostingAttachment, Long> {

    @EntityGraph(attributePaths = "fileMetadata")
    List<RecruitmentPostingAttachment> findByPostingIdOrderByDisplayOrder(Long postingId);

    @EntityGraph(attributePaths = "fileMetadata")
    List<RecruitmentPostingAttachment> findByPostingIdInOrderByPostingIdAscDisplayOrderAsc(
            Collection<Long> postingIds);
}
