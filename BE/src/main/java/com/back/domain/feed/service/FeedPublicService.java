package com.back.domain.feed.service;

import com.back.domain.feed.dto.PostSort;
import com.back.domain.feed.dto.PublicPostSummary;
import com.back.domain.feed.entity.Post;
import com.back.domain.feed.repository.CommentRepository;
import com.back.domain.feed.repository.IdCount;
import com.back.domain.feed.repository.PostLikeRepository;
import com.back.domain.feed.repository.PostRepository;
import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.dto.PublicMemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.common.PageResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 게시글 공개 조회. 홈 위젯(최신글·인기글 탭)이 소비한다.
 *
 * <p>인증 경로의 {@link FeedPostService}와 분리한 이유는 응답 모양이 다르기 때문이다 —
 * 공개 응답에는 {@code likedByMe}가 없고(보는 사람을 모른다), 작성자도 회원 id 없이 나간다.
 */
@Service
@RequiredArgsConstructor
public class FeedPublicService {

    /**
     * 인기글 집계 기간(일). 창이 없으면 한 번 터진 옛 글이 영구히 상단을 차지해
     * "인기글"이 "역대 1위 고정"이 된다.
     */
    static final int POPULAR_WINDOW_DAYS = 30;

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final MemberQueryService memberQueryService;

    @Transactional(readOnly = true)
    public PageResponse<PublicPostSummary> getPublicPosts(PostSort sort, Pageable pageable) {
        Page<Post> page = switch (sort) {
            case LATEST -> postRepository.findByDeletedAtIsNullOrderByIdDesc(pageable);
            case POPULAR -> postRepository.findPopular(
                    LocalDateTime.now().minusDays(POPULAR_WINDOW_DAYS), pageable);
        };

        List<Post> posts = page.getContent();
        List<Long> postIds = posts.stream().map(Post::getId).toList();
        // 빈 목록에 in () 을 던지지 않는다 — 일부 DB에서 문법 오류가 된다.
        Map<Long, Long> likeCounts = postIds.isEmpty()
                ? Map.of() : toCountMap(postLikeRepository.countByPostIds(postIds));
        Map<Long, Long> commentCounts = postIds.isEmpty()
                ? Map.of() : toCountMap(commentRepository.countByPostIds(postIds));

        Set<Long> authorIds = posts.stream().map(Post::getAuthorId).collect(Collectors.toSet());
        Map<Long, MemberDisplay> authors = memberQueryService.findDisplaysByIds(authorIds);

        return PageResponse.from(page.map(p -> new PublicPostSummary(
                p.getId(),
                PublicMemberDisplay.from(authors.get(p.getAuthorId())),
                p.getContent(),
                likeCounts.getOrDefault(p.getId(), 0L),
                commentCounts.getOrDefault(p.getId(), 0L),
                p.getCreatedAt())));
    }

    private Map<Long, Long> toCountMap(List<IdCount> rows) {
        return rows.stream().collect(Collectors.toMap(IdCount::getId, IdCount::getCount));
    }
}
