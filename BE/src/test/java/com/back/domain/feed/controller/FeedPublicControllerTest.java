package com.back.domain.feed.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.feed.entity.Comment;
import com.back.domain.feed.entity.Post;
import com.back.domain.feed.entity.PostLike;
import com.back.domain.feed.repository.CommentRepository;
import com.back.domain.feed.repository.PostLikeRepository;
import com.back.domain.feed.repository.PostRepository;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 게시글 공개 조회(홈 위젯). 인기순 집계와 회원 id 미노출이 핵심이다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class FeedPublicControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired PostRepository postRepository;
    @Autowired PostLikeRepository postLikeRepository;
    @Autowired CommentRepository commentRepository;

    private Long authorId;

    @BeforeEach
    void setUp() {
        Member author = memberRepository.save(
                Member.createLocal("pubfeed", "pw", "pubfeed@x.com", "글쓴이"));
        authorId = author.getId();
    }

    private Post savePost(String content) {
        return postRepository.save(Post.create(authorId, content));
    }

    private void like(Post post, long memberId) {
        postLikeRepository.save(PostLike.create(memberId, post.getId()));
    }

    private void comment(Post post, String content) {
        commentRepository.save(Comment.create(post.getId(), authorId, content));
    }

    @Test
    void 인증_없이_최신글을_볼_수_있다() throws Exception {
        savePost("첫 글");
        savePost("나중 글");

        mockMvc.perform(get("/api/public/feed/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].content").value("나중 글"))
                .andExpect(jsonPath("$.data.content[1].content").value("첫 글"));
    }

    @Test
    void 공개_응답에는_likedByMe와_회원id가_없다() throws Exception {
        Post p = savePost("글");
        like(p, 12345L);

        String json = mockMvc.perform(get("/api/public/feed/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].author.nickname").value("글쓴이"))
                .andExpect(jsonPath("$.data.content[0].author.verified").value(false))
                .andExpect(jsonPath("$.data.content[0].author.id").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].likedByMe").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].updatedAt").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        assertThat(json).doesNotContain(":" + authorId + ",");
    }

    @Test
    void 좋아요와_댓글_수가_실린다() throws Exception {
        Post p = savePost("글");
        like(p, 1001L);
        like(p, 1002L);
        comment(p, "댓글1");

        mockMvc.perform(get("/api/public/feed/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].likeCount").value(2))
                .andExpect(jsonPath("$.data.content[0].commentCount").value(1));
    }

    @Test
    void 인기순은_좋아요와_댓글_합이_큰_순이다() throws Exception {
        Post quiet = savePost("조용한 글");        // 0
        Post loud = savePost("인기 글");           // 좋아요 3 + 댓글 2 = 5
        Post middle = savePost("보통 글");         // 좋아요 1 + 댓글 1 = 2

        like(loud, 1L);
        like(loud, 2L);
        like(loud, 3L);
        comment(loud, "a");
        comment(loud, "b");
        like(middle, 4L);
        comment(middle, "c");

        mockMvc.perform(get("/api/public/feed/posts").param("sort", "POPULAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].content").value("인기 글"))
                .andExpect(jsonPath("$.data.content[1].content").value("보통 글"))
                .andExpect(jsonPath("$.data.content[2].content").value("조용한 글"))
                .andExpect(jsonPath("$.data.content[0].likeCount").value(3))
                .andExpect(jsonPath("$.data.content[0].commentCount").value(2));

        // 조용한 글도 목록에는 남는다 — 인기순은 필터가 아니라 정렬이다.
        assertThat(quiet.getId()).isNotNull();
    }

    @Test
    void 삭제된_글과_삭제된_댓글은_집계에서_빠진다() throws Exception {
        Post alive = savePost("살아있음");
        comment(alive, "댓글");
        Comment removedComment = commentRepository.save(
                Comment.create(alive.getId(), authorId, "지운 댓글"));
        removedComment.delete();
        commentRepository.saveAndFlush(removedComment);

        Post removed = savePost("삭제됨");
        removed.delete();
        postRepository.saveAndFlush(removed);

        mockMvc.perform(get("/api/public/feed/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].content").value("살아있음"))
                .andExpect(jsonPath("$.data.content[0].commentCount").value(1));
    }

    @Test
    void 글이_없어도_빈_목록을_준다() throws Exception {
        // 빈 id 목록으로 in () 을 던지면 일부 DB에서 문법 오류가 난다 — 그 회귀.
        mockMvc.perform(get("/api/public/feed/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(0))
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void sort를_소문자로_보내면_400_01() throws Exception {
        mockMvc.perform(get("/api/public/feed/posts").param("sort", "popular"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 공개_경로에는_쓰기가_없다() throws Exception {
        mockMvc.perform(post("/api/public/feed/posts")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.resultCode").value("405-01"));
    }
}
