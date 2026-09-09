import type { InstrumentOption } from '@/lib/recruitment/types';

/** 악기 enum명 → 표시 라벨. 옵션은 `/api/bff/profile-options`에서 온다. */
export type InstrumentLabels = Record<string, string>;

export function toLabelMap(options: InstrumentOption[]): InstrumentLabels {
  return Object.fromEntries(options.map((o) => [o.code, o.label]));
}

/**
 * 모집 파트 표시. 목록·상세가 `PIANO, CELLO`처럼 enum명을 그대로 내보내던 것을 대체한다.
 *
 * 모르는 코드는 **코드 그대로** 남긴다. BE에 악기가 추가됐거나 옵션 요청이 실패했을 때
 * 빈칸이 되면 "파트를 안 적은 공고"처럼 보이는데, 그게 코드가 보이는 것보다 나쁘다.
 */
export function instrumentText(codes: string[], labels: InstrumentLabels): string {
  return codes.map((c) => labels[c] ?? c).join(', ');
}
