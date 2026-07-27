package com.back.domain.chat.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.entity.ChatRoom;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
class ChatRepositoryTest {

    @Autowired ChatRoomRepository roomRepository;
    @Autowired ChatParticipantRepository participantRepository;
    @Autowired ChatMessageRepository messageRepository;

    @Test
    void findByDirectKey로_1대1_방을_찾는다() {
        ChatRoom room = roomRepository.save(ChatRoom.createDirect(3L, 7L));

        Optional<ChatRoom> found = roomRepository.findByDirectKey(ChatRoom.directKey(7L, 3L));

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(room.getId());
    }

    @Test
    void findRoomsForMember는_활성참여방만_마지막메시지_최신순으로_준다() {
        ChatRoom older = roomRepository.save(ChatRoom.createGroup(1L, "old"));
        ChatRoom newer = roomRepository.save(ChatRoom.createGroup(1L, "new"));
        newer.updateLastMessageAt(older.getLastMessageAt().plusMinutes(5));
        roomRepository.save(newer);
        ChatRoom left = roomRepository.save(ChatRoom.createGroup(1L, "left"));

        participantRepository.save(ChatParticipant.join(older.getId(), 1L));
        participantRepository.save(ChatParticipant.join(newer.getId(), 1L));
        ChatParticipant leftP = ChatParticipant.join(left.getId(), 1L);
        leftP.leave();
        participantRepository.save(leftP);

        var page = roomRepository.findRoomsForMember(1L, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(ChatRoom::getId)
                .containsExactly(newer.getId(), older.getId()); // 최신 먼저, left 제외
    }

    @Test
    void existsActive와_활성참여자_목록() {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(1L, "g"));
        participantRepository.save(ChatParticipant.join(room.getId(), 1L));
        ChatParticipant gone = ChatParticipant.join(room.getId(), 2L);
        gone.leave();
        participantRepository.save(gone);

        assertThat(participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(room.getId(), 1L)).isTrue();
        assertThat(participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(room.getId(), 2L)).isFalse();
        assertThat(participantRepository.findByRoomIdAndLeftAtIsNull(room.getId()))
                .extracting(ChatParticipant::getMemberId).containsExactly(1L);
    }

    @Test
    void findHistory는_커서_미만을_id_내림차순으로_준다() {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(1L, "g"));
        ChatMessage m1 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "1"));
        ChatMessage m2 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "2"));
        ChatMessage m3 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "3"));

        var latest = messageRepository.findHistory(room.getId(), null, PageRequest.of(0, 2));
        assertThat(latest).extracting(ChatMessage::getId).containsExactly(m3.getId(), m2.getId());

        var older = messageRepository.findHistory(room.getId(), m2.getId(), PageRequest.of(0, 2));
        assertThat(older).extracting(ChatMessage::getId).containsExactly(m1.getId());
    }

    @Test
    void findLatestPerRoom과_countUnreadPerRoom_배치집계() {
        ChatRoom a = roomRepository.save(ChatRoom.createGroup(1L, "a"));
        ChatRoom b = roomRepository.save(ChatRoom.createGroup(1L, "b"));
        // a방: 회원2가 2개 보냄, 회원1이 1개 읽음커서 없음 → 안읽음 2
        messageRepository.save(ChatMessage.create(a.getId(), 2L, "a1"));
        ChatMessage aLast = messageRepository.save(ChatMessage.create(a.getId(), 2L, "a2"));
        // b방: 회원1(본인)이 보낸 것만 → 안읽음 0
        ChatMessage bLast = messageRepository.save(ChatMessage.create(b.getId(), 1L, "b1"));

        var latest = messageRepository.findLatestPerRoom(List.of(a.getId(), b.getId()));
        assertThat(latest).extracting(ChatMessage::getId)
                .containsExactlyInAnyOrder(aLast.getId(), bLast.getId());

        var unread = messageRepository.countUnreadPerRoom(1L, List.of(a.getId(), b.getId()));
        assertThat(unread).extracting(RoomUnreadCount::getRoomId, RoomUnreadCount::getUnreadCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(a.getId(), 2L));
    }
}
