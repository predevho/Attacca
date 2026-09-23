package com.back.domain.feed.repository;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.feed.entity.FeedPostAttachment;
import com.back.domain.feed.entity.Post;
import com.back.global.storage.FileMetadata;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.beans.factory.annotation.Autowired;

@DataJpaTest
class FeedPostAttachmentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void 같은_파일은_피드에_두번_연결할_수_없다() {
        FileMetadata file = entityManager.persist(FileMetadata.createAttached(
                "feed/2026/09/22/a.png", "a.png", "image/png", 10L, 7L));
        Post first = entityManager.persist(Post.create(7L, "첫 글"));
        Post second = entityManager.persist(Post.create(7L, "둘째 글"));
        entityManager.persist(FeedPostAttachment.create(first, file, 0));
        entityManager.flush();

        assertThatThrownBy(() -> {
            entityManager.persist(FeedPostAttachment.create(second, file, 0));
            entityManager.flush();
        })
                .isInstanceOf(ConstraintViolationException.class);
    }
}
