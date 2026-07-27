package com.back.domain.chat.dto;

/** 참여자 표시정보 + 접속 상태. */
public record ParticipantView(Long id, String nickname, boolean verified, boolean online) {
}
