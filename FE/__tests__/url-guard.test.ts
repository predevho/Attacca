import { describe, it, expect } from 'vitest';
import { isHttpUrl } from '@/lib/url';

describe('링크 스킴 가드', () => {
  it.each(['http://a.com', 'https://a.com/x?y=1', '  https://a.com  ', 'HTTPS://A.COM'])(
    '%s 는 링크로 그려도 된다', (u) => expect(isHttpUrl(u)).toBe(true));

  it.each([
    'javascript:alert(1)',
    '  javascript:alert(1)',   // 앞 공백으로 우회
    'JaVaScRiPt:alert(1)',     // 대소문자로 우회
    'data:text/html,<script>x</script>',
    'vbscript:msgbox(1)',
    '/relative',
    '',
  ])('%s 는 링크로 그리면 안 된다', (u) => expect(isHttpUrl(u)).toBe(false));
});
