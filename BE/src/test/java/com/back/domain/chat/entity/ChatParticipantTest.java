package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatParticipantTest {

    @Test
    void join하면_활성상태이고_읽음커서는_null이다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        assertThat(p.isActive()).isTrue();
        assertThat(p.getLeftAt()).isNull();
        assertThat(p.getLastReadMessageId()).isNull();
    }

    @Test
    void leave하면_비활성_rejoin하면_다시_활성이다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        p.leave();
        assertThat(p.isActive()).isFalse();
        assertThat(p.getLeftAt()).isNotNull();

        p.rejoin();
        assertThat(p.isActive()).isTrue();
        assertThat(p.getLeftAt()).isNull();
    }

    @Test
    void updateLastRead는_더_큰_값으로만_전진한다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        p.updateLastRead(5L);
        assertThat(p.getLastReadMessageId()).isEqualTo(5L);

        p.updateLastRead(3L); // 뒤로 안 감
        assertThat(p.getLastReadMessageId()).isEqualTo(5L);

        p.updateLastRead(9L);
        assertThat(p.getLastReadMessageId()).isEqualTo(9L);
    }
}
