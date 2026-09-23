package com.back.global.storage;

/** 게시글 응답에서 사용하는 첨부 파일 표시 정보다. */
public record AttachmentResponse(
        Long id,
        String originalName,
        String contentType,
        long size,
        String url) {

    public static AttachmentResponse of(FileMetadata metadata, String url) {
        return new AttachmentResponse(metadata.getId(), metadata.getOriginalName(),
                metadata.getContentType(), metadata.getSize(), url);
    }
}
