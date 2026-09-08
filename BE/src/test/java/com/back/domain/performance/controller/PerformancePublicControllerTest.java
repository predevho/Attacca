package com.back.domain.performance.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.performance.entity.Performance;
import com.back.domain.performance.repository.PerformanceRepository;
import com.back.domain.verifiedperformer.dto.GrantRequest;
import com.back.domain.verifiedperformer.service.VerifiedPerformerService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 공연 공개 조회. "인증 없이 200"과 "회원 id 미노출"이 핵심 회귀다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class PerformancePublicControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired PerformanceRepository performanceRepository;
    @Autowired VerifiedPerformerService verifiedPerformerService;

    private Long organizerId;

    @BeforeEach
    void setUp() {
        Member organizer = memberRepository.save(
                Member.createLocal("pubperf", "pw", "pubperf@x.com", "공개주최자"));
        organizerId = organizer.getId();
        verifiedPerformerService.grant(new GrantRequest(organizerId, "지정"), 99L);
    }

    private Performance save(String title, LocalDateTime when) {
        return performanceRepository.save(Performance.create(organizerId, title, "소개", when,
                "한강아트홀", "베토벤", "3만원", null));
    }

    @Test
    void 인증_없이_목록을_볼_수_있다() throws Exception {
        save("다가오는 연주회", LocalDateTime.now().plusDays(3));

        mockMvc.perform(get("/api/public/performances"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("다가오는 연주회"));
    }

    @Test
    void 공개_응답은_주최자_닉네임과_뱃지를_주되_회원id는_주지_않는다() throws Exception {
        Long id = save("연주회", LocalDateTime.now().plusDays(3)).getId();

        String json = mockMvc.perform(get("/api/public/performances/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.organizer.nickname").value("공개주최자"))
                .andExpect(jsonPath("$.data.organizer.verified").value(true))
                .andExpect(jsonPath("$.data.organizer.id").doesNotExist())
                .andExpect(jsonPath("$.data.updatedAt").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        // 필드명이 바뀌어도 회원 id 값 자체가 새지 않는지 본다.
        assertThat(json).doesNotContain("\"" + organizerId + "\"");
        assertThat(json).doesNotContain(":" + organizerId + ",");
    }

    @Test
    void SCHEDULED는_범위_안의_공연만_이른순으로_준다() throws Exception {
        save("중순", LocalDateTime.of(2026, 9, 16, 19, 0));
        save("초순", LocalDateTime.of(2026, 9, 2, 19, 0));
        save("다음달", LocalDateTime.of(2026, 10, 2, 19, 0));

        mockMvc.perform(get("/api/public/performances")
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
        mockMvc.perform(get("/api/public/performances").param("scope", "SCHEDULED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 삭제되거나_없는_공연은_404_07() throws Exception {
        Performance removed = save("삭제됨", LocalDateTime.now().plusDays(1));
        removed.delete();
        performanceRepository.saveAndFlush(removed);

        mockMvc.perform(get("/api/public/performances/" + removed.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-07"));
    }

    @Test
    void scope를_소문자로_보내면_400_01() throws Exception {
        mockMvc.perform(get("/api/public/performances").param("scope", "upcoming"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 공개_경로에는_쓰기가_없다() throws Exception {
        mockMvc.perform(post("/api/public/performances")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.resultCode").value("405-01"));
    }
}
