'use client';

import { useState } from 'react';
import { postBffForm } from '@/lib/api';

export const MAX_ATTACHMENT_COUNT = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export type PendingAttachment = {
  clientId: string;
  file: File;
  attachmentId?: number;
  status: 'ready' | 'uploading' | 'failed';
  error?: string;
};

type UploadResult =
  | { ok: true; attachmentIds: number[] }
  | { ok: false };

type UploadResponse = { attachmentId: number; url: string };

let nextClientId = 0;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `파일당 최대 10MB까지 첨부할 수 있습니다. (${file.name})`;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const expectedMime = extension ? MIME_BY_EXTENSION[extension] : undefined;
  if (!expectedMime || (file.type !== '' && file.type !== expectedMime)) {
    return 'JPG, PNG, WebP 또는 PDF 파일만 첨부할 수 있습니다.';
  }
  return null;
}

/**
 * 게시 전 TEMPORARY 파일만 관리한다. 재시도 때 attachmentId가 있는 항목은 건너뛰어
 * 이미 성공한 업로드를 중복 생성하지 않는다.
 */
export function useTemporaryAttachments() {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function addFiles(files: File[]) {
    const next = [...items];
    const knownKeys = new Set(next.map((item) => fileKey(item.file)));
    let nextError: string | null = null;

    for (const file of files) {
      if (knownKeys.has(fileKey(file))) continue;
      const validationError = validateFile(file);
      if (validationError) {
        nextError ??= validationError;
        continue;
      }
      if (next.length >= MAX_ATTACHMENT_COUNT) {
        nextError ??= `첨부 파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 추가할 수 있습니다.`;
        continue;
      }
      next.push({
        clientId: `${Date.now()}-${nextClientId++}`,
        file,
        status: 'ready',
      });
      knownKeys.add(fileKey(file));
    }

    setItems(next);
    setError(nextError);
  }

  function remove(clientId: string) {
    setItems((current) => current.filter((item) => item.clientId !== clientId));
    setError(null);
  }

  function clear() {
    setItems([]);
    setError(null);
  }

  async function upload(clientIds?: string[]): Promise<UploadResult> {
    if (uploading) return { ok: false };
    setUploading(true);
    setError(null);

    const completed = items.filter((item) => item.attachmentId != null);
    const candidates = clientIds == null
      ? items
      : items.filter((item) => clientIds.includes(item.clientId));

    for (const item of candidates) {
      if (item.attachmentId != null) {
        continue;
      }

      setItems((current) => current.map((candidate) =>
        candidate.clientId === item.clientId ? { ...candidate, status: 'uploading' } : candidate));
      const form = new FormData();
      form.append('file', item.file);
      const response = await postBffForm<UploadResponse>('/api/bff/files/attachments', form);

      if (!response.ok || response.data?.attachmentId == null) {
        const message = response.message ?? `${item.file.name} 업로드에 실패했습니다. 다시 시도해 주세요.`;
        setItems((current) => current.map((candidate) =>
          candidate.clientId === item.clientId
            ? { ...candidate, status: 'failed', error: message }
            : candidate));
        setError(message);
        setUploading(false);
        return { ok: false };
      }

      const uploaded = {
        ...item,
        attachmentId: response.data.attachmentId,
        status: 'ready' as const,
        error: undefined,
      };
      completed.push(uploaded);
      setItems((current) => current.map((candidate) =>
        candidate.clientId === item.clientId ? uploaded : candidate));
    }

    setUploading(false);
    return { ok: true, attachmentIds: completed.map((item) => item.attachmentId!).filter((id) => id != null) };
  }

  function retry(clientId: string) {
    return upload([clientId]);
  }

  return { items, error, uploading, addFiles, remove, clear, upload, retry };
}
