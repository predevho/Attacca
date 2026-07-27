package com.back.domain.chat.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class ChatRoomControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired JwtProvider jwtProvider;

    private String aliceBearer;
    private String bobBearer;
    private Long bobId;

    @BeforeEach
    void setUp() {
        Member alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스"));
        aliceBearer = "Bearer " + jwtProvider.createAccessToken(alice.getId(), Role.USER);
        Member bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥"));
        bobId = bob.getId();
        bobBearer = "Bearer " + jwtProvider.createAccessToken(bob.getId(), Role.USER);
    }

    private String createDirect() throws Exception {
        String body = "{\"type\":\"DIRECT\",\"participantIds\":[" + bobId + "]}";
        String json = mockMvc.perform(post("/api/chat/rooms").header("Authorization", aliceBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.replaceAll(".*?\"id\":(\\d+).*", "$1");
    }

    @Test
    void 토큰_없이_방생성은_401() throws Exception {
        mockMvc.perform(post("/api/chat/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"DIRECT\",\"participantIds\":[1]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void DIRECT방_생성하고_목록에_보인다() throws Exception {
        createDirect();
        mockMvc.perform(get("/api/chat/rooms").header("Authorization", aliceBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].type").value("DIRECT"))
                .andExpect(jsonPath("$.data.content[0].displayName").value("밥"));
    }

    @Test
    void 비참여자_상세조회는_403() throws Exception {
        String id = createDirect();
        Member carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴"));
        String carolBearer = "Bearer " + jwtProvider.createAccessToken(carol.getId(), Role.USER);

        mockMvc.perform(get("/api/chat/rooms/" + id).header("Authorization", carolBearer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.resultCode").value("403-03"));
    }

    @Test
    void 없는_방_상세는_404() throws Exception {
        mockMvc.perform(get("/api/chat/rooms/99999").header("Authorization", aliceBearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-10"));
    }

    @Test
    void DIRECT_상대_여러명이면_400_03() throws Exception {
        Member carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴"));
        String body = "{\"type\":\"DIRECT\",\"participantIds\":[" + bobId + "," + carol.getId() + "]}";
        mockMvc.perform(post("/api/chat/rooms").header("Authorization", aliceBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-03"));
    }
}
