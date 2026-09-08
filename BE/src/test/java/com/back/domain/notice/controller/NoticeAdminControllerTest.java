package com.back.domain.notice.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 공지 관리 API. 권한은 경로(/api/admin/**)에서 Security가 막는다 — 그 사실을 여기서 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class NoticeAdminControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired JwtProvider jwtProvider;

    private String adminBearer;
    private String userBearer;

    private static final String NOTICE_BODY = "{\"type\":\"NOTICE\",\"title\":\"점검 안내\","
            + "\"content\":\"본문\",\"pinned\":true}";
    private static final String EVENT_BODY = "{\"type\":\"EVENT\",\"title\":\"심사 발표\","
            + "\"content\":\"본문\",\"scheduledAt\":\"2026-09-16T10:00:00\",\"place\":\"온라인\","
            + "\"pinned\":false}";

    @BeforeEach
    void setUp() {
        Member admin = memberRepository.save(
                Member.createLocal("noticeadmin", "pw", "noticeadmin@x.com", "운영자"));
        adminBearer = "Bearer " + jwtProvider.createAccessToken(admin.getId(), Role.ADMIN);

        Member user = memberRepository.save(
                Member.createLocal("noticeuser", "pw", "noticeuser@x.com", "일반회원"));
        userBearer = "Bearer " + jwtProvider.createAccessToken(user.getId(), Role.USER);
    }

    private String register(String body) throws Exception {
        String json = mockMvc.perform(post("/api/admin/notices").header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        // author.id(중첩)와 섞이지 않도록 첫 번째 "id"(최상위 공지 id)만 지연 매칭한다.
        return json.replaceAll(".*?\"id\":(\\d+).*", "$1");
    }

    @Test
    void 토큰_없이_등록은_401() throws Exception {
        mockMvc.perform(post("/api/admin/notices")
                        .contentType(MediaType.APPLICATION_JSON).content(NOTICE_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 일반_회원은_등록할_수_없다() throws Exception {
        mockMvc.perform(post("/api/admin/notices").header("Authorization", userBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(NOTICE_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void 일반_회원은_어드민_목록도_볼_수_없다() throws Exception {
        mockMvc.perform(get("/api/admin/notices").header("Authorization", userBearer))
                .andExpect(status().isForbidden());
    }

    @Test
    void 어드민은_등록하고_목록에서_작성자와_함께_본다() throws Exception {
        register(NOTICE_BODY);

        mockMvc.perform(get("/api/admin/notices").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("점검 안내"))
                .andExpect(jsonPath("$.data.content[0].pinned").value(true))
                .andExpect(jsonPath("$.data.content[0].author.nickname").value("운영자"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void 종류로_거를_수_있다() throws Exception {
        register(NOTICE_BODY);
        register(EVENT_BODY);

        mockMvc.perform(get("/api/admin/notices").header("Authorization", adminBearer)
                        .param("type", "EVENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].title").value("심사 발표"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void 일정인데_날짜가_없으면_400_01() throws Exception {
        String body = "{\"type\":\"EVENT\",\"title\":\"일정\",\"content\":\"본문\",\"pinned\":false}";

        mockMvc.perform(post("/api/admin/notices").header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 제목이_비면_400_01() throws Exception {
        String body = "{\"type\":\"NOTICE\",\"title\":\"\",\"content\":\"본문\",\"pinned\":false}";

        mockMvc.perform(post("/api/admin/notices").header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    void 수정과_삭제가_동작하고_삭제_후_조회는_404_12() throws Exception {
        String id = register(NOTICE_BODY);

        mockMvc.perform(put("/api/admin/notices/" + id).header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(EVENT_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("심사 발표"))
                .andExpect(jsonPath("$.data.type").value("EVENT"));

        mockMvc.perform(delete("/api/admin/notices/" + id).header("Authorization", adminBearer))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/notices/" + id).header("Authorization", adminBearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-12"));
    }
}
