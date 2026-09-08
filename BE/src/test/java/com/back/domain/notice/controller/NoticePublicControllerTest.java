package com.back.domain.notice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.repository.NoticeRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공지 공개 조회. 이 도메인이 처음으로 비인증 조회를 여는 만큼,
 * "인증 없이 200"과 "공개 응답에 회원 식별자가 없음"이 이 클래스의 핵심 회귀다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class NoticePublicControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired NoticeRepository noticeRepository;

    private static final Long AUTHOR_ID = 4242L;

    private Notice save(NoticeType type, String title, LocalDateTime scheduledAt, boolean pinned) {
        return noticeRepository.save(
                Notice.create(AUTHOR_ID, type, title, "본문", scheduledAt, null, pinned));
    }

    @Test
    void 인증_없이_목록을_볼_수_있다() throws Exception {
        save(NoticeType.NOTICE, "점검 안내", null, false);

        mockMvc.perform(get("/api/public/notices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("점검 안내"));
    }

    @Test
    void 인증_없이_단건을_볼_수_있다() throws Exception {
        Long id = save(NoticeType.NOTICE, "점검 안내", null, false).getId();

        mockMvc.perform(get("/api/public/notices/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("점검 안내"));
    }

    @Test
    void 공개_응답에는_작성자와_회원식별자가_없다() throws Exception {
        Long id = save(NoticeType.NOTICE, "점검 안내", null, false).getId();

        String json = mockMvc.perform(get("/api/public/notices/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.author").doesNotExist())
                .andExpect(jsonPath("$.data.authorId").doesNotExist())
                .andExpect(jsonPath("$.data.pinned").doesNotExist())
                .andExpect(jsonPath("$.data.updatedAt").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        // 필드명이 바뀌어도 값 자체가 새지 않는지 본다.
        assertThat(json).doesNotContain(String.valueOf(AUTHOR_ID));
    }

    @Test
    void 삭제되거나_없는_공지는_404_12() throws Exception {
        Notice removed = save(NoticeType.NOTICE, "삭제됨", null, false);
        removed.delete();
        noticeRepository.saveAndFlush(removed);

        mockMvc.perform(get("/api/public/notices/" + removed.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-12"));

        mockMvc.perform(get("/api/public/notices/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-12"));
    }

    @Test
    void PINNED는_고정된_것만_주고_최대_5건으로_잘린다() throws Exception {
        for (int i = 0; i < 7; i++) {
            save(NoticeType.NOTICE, "고정" + i, null, true);
        }
        save(NoticeType.NOTICE, "보통", null, false);

        mockMvc.perform(get("/api/public/notices").param("scope", "PINNED").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(5))
                .andExpect(jsonPath("$.data.content.length()").value(5))
                .andExpect(jsonPath("$.data.totalElements").value(7));
    }

    @Test
    void SCHEDULED는_범위_안의_일정만_이른순으로_준다() throws Exception {
        save(NoticeType.EVENT, "중순", LocalDateTime.of(2026, 9, 16, 10, 0), false);
        save(NoticeType.EVENT, "초순", LocalDateTime.of(2026, 9, 2, 10, 0), false);
        save(NoticeType.EVENT, "다음달", LocalDateTime.of(2026, 10, 2, 10, 0), false);
        save(NoticeType.NOTICE, "날짜없음", null, false);

        mockMvc.perform(get("/api/public/notices")
                        .param("scope", "SCHEDULED")
                        .param("from", "2026-09-01T00:00:00")
                        .param("to", "2026-10-01T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].title").value("초순"))
                .andExpect(jsonPath("$.data.content[1].title").value("중순"))
                .andExpect(jsonPath("$.data.totalElements").value(2));
    }

    @Test
    void SCHEDULED인데_범위가_없으면_400_01() throws Exception {
        mockMvc.perform(get("/api/public/notices").param("scope", "SCHEDULED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void scope를_소문자로_보내면_400_01() throws Exception {
        // 쿼리 파라미터 enum은 상수명 그대로 대문자다(기존 도메인과 동일 계약).
        mockMvc.perform(get("/api/public/notices").param("scope", "pinned"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 공개_경로에는_쓰기가_없다() throws Exception {
        // /api/public/** 는 permitAll 이므로, 쓰기 핸들러가 실수로 생기면 무인증으로 뚫린다.
        // 지금은 매핑 자체가 없어 405(메서드 불가)로 막힌다.
        mockMvc.perform(post("/api/public/notices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"NOTICE\",\"title\":\"x\",\"content\":\"y\"}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.resultCode").value("405-01"));
    }
}
