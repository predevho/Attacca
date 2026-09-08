package com.back.domain.feed.repository;

import com.back.domain.feed.entity.Post;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

    Optional<Post> findByIdAndDeletedAtIsNull(Long id);

    /** 전역 타임라인: 미삭제 글을 id 내림차순 keyset 으로. cursor=null 이면 최신부터. */
    @Query("select p from Post p "
            + "where p.deletedAt is null and (:cursor is null or p.id < :cursor) "
            + "order by p.id desc")
    List<Post> findTimeline(@Param("cursor") Long cursor, Pageable pageable);

    /**
     * 공개 최신글: 미삭제, id 내림차순 오프셋 페이징.
     * 커서가 아닌 오프셋인 이유는 홈 위젯이 앞쪽 한 페이지만 쓰기 때문이다 —
     * 무한 스크롤은 인증 경로의 커서 타임라인({@link #findTimeline})이 그대로 담당한다.
     */
    Page<Post> findByDeletedAtIsNullOrderByIdDesc(Pageable pageable);

    /**
     * 공개 인기글: (좋아요 수 + 댓글 수)가 큰 순, 동률이면 최신 순.
     *
     * <p>{@code since}로 기간 창을 받는 이유는, 창이 없으면 한 번 터진 옛 글이 영구히 상단을 차지해
     * "인기글"이 사실상 "역대 1위 고정"이 되기 때문이다. 커서 페이징을 쓰지 않는 것도 의도적이다 —
     * 정렬 키가 id가 아니라 집계값이라 keyset이 성립하지 않는다.
     */
    @Query(value = "select p from Post p "
            + "where p.deletedAt is null and p.createdAt >= :since "
            + "order by ("
            + "  (select count(pl) from PostLike pl where pl.postId = p.id) "
            + "+ (select count(c) from Comment c where c.postId = p.id and c.deletedAt is null)"
            + ") desc, p.id desc",
            countQuery = "select count(p) from Post p "
                    + "where p.deletedAt is null and p.createdAt >= :since")
    Page<Post> findPopular(@Param("since") LocalDateTime since, Pageable pageable);
}
