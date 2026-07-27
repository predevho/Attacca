package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatMessageTest {

    @Test
    void create는_필드를_보관한다() {
        ChatMessage m = ChatMessage.create(10L, 1L, "안녕하세요");

        assertThat(m.getRoomId()).isEqualTo(10L);
        assertThat(m.getSenderId()).isEqualTo(1L);
        assertThat(m.getContent()).isEqualTo("안녕하세요");
    }
}
