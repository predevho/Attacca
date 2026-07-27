package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** 방 생성 요청. DIRECT 는 participantIds 에 상대 1명, GROUP 은 초기 참여자(비어도 됨). */
public record CreateRoomRequest(@NotNull RoomType type, List<Long> participantIds, String title) {

    public List<Long> participantIdsOrEmpty() {
        return participantIds == null ? List.of() : participantIds;
    }
}
