import { expect, test } from '@playwright/test';

test.describe('IMPORT 공개·접근 제어 smoke', () => {
  test('비로그인 사용자는 IMPORT 심사 화면에서 로그인으로 이동한다', async ({ page }) => {
    await page.goto('/admin/imports');

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fimports$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });

  test('로그인 화면은 원래 목적지를 내부 next 값으로 보존한다', async ({ page }) => {
    await page.goto('/login?next=%2Fadmin%2Fimports');

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(page.getByLabel('아이디')).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
  });

  test('공개 공지 상세 경로는 로그인 없이 접근 가능하다', async ({ page }) => {
    const response = await page.goto('/notices/1');

    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
