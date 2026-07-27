package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ChatRoomTest {

    @Test
    void directKey는_순서에_무관하게_같은_쌍이면_동일하다() {
        assertThat(ChatRoom.directKey(3L, 7L)).isEqualTo("3:7");
        assertThat(ChatRoom.directKey(7L, 3L)).isEqualTo("3:7");
    }

    @Test
    void createDirect는_정렬된_directKey와_DIRECT타입을_갖는다() {
        ChatRoom room = ChatRoom.createDirect(7L, 3L);

        assertThat(room.getType()).isEqualTo(RoomType.DIRECT);
        assertThat(room.getDirectKey()).isEqualTo("3:7");
        assertThat(room.getCreatedBy()).isEqualTo(7L);
        assertThat(room.getTitle()).isNull();
        assertThat(room.getLastMessageAt()).isNotNull(); // 생성 시각으로 초기화
    }

    @Test
    void 자기자신과의_DIRECT는_거절한다() {
        assertThatThrownBy(() -> ChatRoom.createDirect(5L, 5L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_INVALID_PARTICIPANTS);
    }

    @Test
    void createGroup은_directKey가_null이고_title을_갖는다() {
        ChatRoom room = ChatRoom.createGroup(1L, "합주팀");

        assertThat(room.getType()).isEqualTo(RoomType.GROUP);
        assertThat(room.getDirectKey()).isNull();
        assertThat(room.getTitle()).isEqualTo("합주팀");
        assertThat(room.getLastMessageAt()).isNotNull();
    }

    @Test
    void updateLastMessageAt은_시각을_갱신한다() {
        ChatRoom room = ChatRoom.createGroup(1L, "t");
        LocalDateTime later = LocalDateTime.of(2030, 1, 1, 0, 0);

        room.updateLastMessageAt(later);

        assertThat(room.getLastMessageAt()).isEqualTo(later);
    }
}
