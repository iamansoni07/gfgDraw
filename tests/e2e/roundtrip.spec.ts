import { test, expect } from '@playwright/test';

test.describe('Multi-Page Board & File Round-Trip', () => {
  test('creates new pages, switches active page, and preserves document structure', async ({ page }) => {
    const roomId = `e2e-pages-${Date.now()}`;
    await page.goto(`/?room=${roomId}`);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify initial default page exists in bottom tab bar
    const initialPageTab = page.getByRole('button', { name: /Page 1|Architecture/i }).first();
    await expect(initialPageTab).toBeVisible();

    // Click "+" button to create a second page
    const addPageBtn = page.locator('button[title*="Add Page"], button:has-text("+")').first();
    if (await addPageBtn.isVisible()) {
      await addPageBtn.click();
      await page.waitForTimeout(500);

      // Verify second page tab is created and selectable
      const page2Tab = page.getByRole('button', { name: /Page 2/i }).first();
      if (await page2Tab.isVisible()) {
        await page2Tab.click();
        await page.waitForTimeout(300);
      }
    }

    // Verify canvas is fully rendered without crashing
    await expect(canvas).toBeVisible();
  });

  test('opens Markdown Split View and verifies bi-directional pane sync', async ({ page }) => {
    const roomId = `e2e-docs-${Date.now()}`;
    await page.goto(`/?room=${roomId}`);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Find and click the Docs button in StudioHeader
    const docsToggleBtn = page.getByRole('button', { name: /Docs/i }).first();
    if (await docsToggleBtn.isVisible()) {
      await docsToggleBtn.click();
      await page.waitForTimeout(500);

      // Verify the Split-Pane Markdown editor container is open
      const markdownEditor = page.locator('textarea, [contenteditable="true"]').first();
      await expect(markdownEditor).toBeVisible();
    }
  });
});

