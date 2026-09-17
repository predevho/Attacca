package com.back.domain.imports.service;

import com.back.domain.imports.dto.ImportApproveRequest;
import com.back.domain.imports.dto.ImportApproveResponse;
import com.back.domain.imports.entity.ImportedItem;
import com.back.domain.imports.repository.ImportedItemRepository;
import com.back.domain.notice.dto.NoticeRequest;
import com.back.domain.notice.dto.NoticeResponse;
import com.back.domain.notice.service.NoticeService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.storage.FileService;
import com.back.global.storage.StoredFile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ImportReviewService {
    private final ImportedItemRepository itemRepository;
    private final NoticeService noticeService;
    private final PosterDownloader posterDownloader;
    private final FileService fileService;

    public ImportApproveResponse approve(long adminId, long itemId, ImportApproveRequest request) {
        ImportedItem snapshot = itemRepository.findById(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.IMPORT_ITEM_NOT_FOUND));
        PosterDownloader.DownloadedPoster poster = null;
        if (snapshot.getPosterUrl() != null && snapshot.getSource() == com.back.domain.imports.entity.ImportSource.KOPIS) {
            poster = posterDownloader.download(snapshot.getPosterUrl());
        }
        return approveTransaction(adminId, itemId, request.notice(), poster);
    }

    @Transactional
    protected ImportApproveResponse approveTransaction(long adminId, long itemId, NoticeRequest noticeRequest,
            PosterDownloader.DownloadedPoster poster) {
        ImportedItem item = itemRepository.findByIdForUpdate(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.IMPORT_ITEM_NOT_FOUND));
        if (noticeRequest.sourceName() == null || noticeRequest.sourceName().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "출처 이름이 필요합니다.");
        }
        NoticeResponse notice = noticeService.create(adminId, noticeRequest);
        boolean saved = false;
        if (poster != null) {
            try {
                noticeService.updateCoverBytes(adminId, notice.id(), poster.content(), poster.contentType(),
                        poster.originalName());
                saved = true;
            } catch (RuntimeException ignored) {
                saved = false;
            }
        }
        item.approve(notice.id());
        return new ImportApproveResponse(notice.id(), saved);
    }

    @Transactional
    public void reject(long itemId) {
        ImportedItem item = itemRepository.findByIdForUpdate(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.IMPORT_ITEM_NOT_FOUND));
        item.reject();
    }
}
