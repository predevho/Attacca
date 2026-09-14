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

  for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 800 }]) {
    test(`${viewport.width}px 공개 홈에서 Header와 본문이 겹치거나 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('banner')).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerHeight: document.querySelector('header')?.getBoundingClientRect().height ?? 0,
        mainTop: document.querySelector('main')?.getBoundingClientRect().top ?? 0,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.mainTop).toBeGreaterThanOrEqual(layout.headerHeight);
    });
  }

  test('320px 홈 헤더의 모바일 메뉴를 열고 메뉴 항목에 접근할 수 있다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto('/');

    const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await menuButton.click();

    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('#mobile-navigation');
    await expect(menu).toBeVisible();
    for (const label of ['홈', '피드', '공연', '구인', '채팅']) {
      await expect(menu.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('모바일 메뉴는 Escape로 닫힌다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto('/');

    const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
    await menuButton.click();
    await expect(page.locator('#mobile-navigation')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('#mobile-navigation')).toBeHidden();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('320px 피드 탭은 overflow 없이 키보드로 정렬을 바꿀 수 있다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto('/');

    const widget = page.getByRole('region', { name: '게시글' });
    const latest = widget.getByRole('tab', { name: '최신글' });
    const popular = widget.getByRole('tab', { name: '인기글' });
    const allFeed = widget.getByRole('link', { name: /피드 전체보기/ });

    await expect(latest).toHaveAttribute('aria-selected', 'true');
    await expect(popular).toHaveAttribute('aria-selected', 'false');
    await expect(allFeed).toBeVisible();

    const layout = await widget.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const controls = Array.from(element.querySelectorAll('button, a')).map((control) => {
        const controlRect = control.getBoundingClientRect();
        return {
          left: controlRect.left,
          right: controlRect.right,
          top: controlRect.top,
          bottom: controlRect.bottom,
        };
      });
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: rect.left,
        right: rect.right,
        controls,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    for (const control of layout.controls) {
      expect(control.left).toBeGreaterThanOrEqual(layout.left);
      expect(control.right).toBeLessThanOrEqual(layout.right);
    }

    await latest.focus();
    await page.keyboard.press('ArrowRight');
    await expect(popular).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(popular).toHaveAttribute('aria-selected', 'true');
    await expect(latest).toHaveAttribute('aria-selected', 'false');
  });
});
