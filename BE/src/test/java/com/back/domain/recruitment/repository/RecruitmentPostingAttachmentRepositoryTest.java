package com.back.domain.recruitment.repository;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.member.entity.Instrument;
import com.back.domain.recruitment.entity.RecruitmentPosting;
import com.back.domain.recruitment.entity.RecruitmentPostingAttachment;
import com.back.global.storage.FileMetadata;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

@DataJpaTest
class RecruitmentPostingAttachmentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void 같은_파일은_구인_공고에_두번_연결할_수_없다() {
        FileMetadata file = entityManager.persist(FileMetadata.createAttached(
                "recruitment/2026/09/22/a.pdf", "a.pdf", "application/pdf", 10L, 7L));
        RecruitmentPosting first = entityManager.persist(RecruitmentPosting.create(
                7L, "첫 공고", "설명", Set.of(Instrument.VIOLIN), 1, "서울", "협의", null));
        RecruitmentPosting second = entityManager.persist(RecruitmentPosting.create(
                7L, "둘째 공고", "설명", Set.of(Instrument.VIOLIN), 1, "서울", "협의", null));
        entityManager.persist(RecruitmentPostingAttachment.create(first, file, 0));
        entityManager.flush();

        assertThatThrownBy(() -> {
            entityManager.persist(RecruitmentPostingAttachment.create(second, file, 0));
            entityManager.flush();
        })
                .isInstanceOf(ConstraintViolationException.class);
    }
}
