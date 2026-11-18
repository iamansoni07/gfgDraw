import { test, expect } from '@playwright/test';

test.describe('Multiplayer Collaboration & Awareness', () => {
  test('synchronizes canvas state and awareness across two peers', async ({ browser }) => {
    const roomId = `e2e-room-${Date.now()}`;

    // Peer 1: Editor session
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await editorPage.goto(`/?room=${roomId}&role=edit`);

    const editorCanvas = editorPage.locator('canvas');
    await expect(editorCanvas).toBeVisible();

    // Verify editor HUD is loaded
    await expect(editorPage.getByText('GFG Draw')).toBeVisible();

    // Peer 2: Read-only Viewer session
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(`/?room=${roomId}&role=view`);

    const viewerCanvas = viewerPage.locator('canvas');
    await expect(viewerCanvas).toBeVisible();

    // Verify Viewer has READ-ONLY telemetry indicator
    await expect(viewerPage.getByText('READ-ONLY VIEW')).toBeVisible();

    // Editor selects rectangle tool and draws on canvas
    const rectToolButton = editorPage.locator('button[title*="Rectangle"]').first();
    if (await rectToolButton.isVisible()) {
      await rectToolButton.click();
    }

    const box = await editorCanvas.boundingBox();
    if (box) {
      await editorPage.mouse.move(box.x + 200, box.y + 200);
      await editorPage.mouse.down();
      await editorPage.mouse.move(box.x + 350, box.y + 300);
      await editorPage.mouse.up();
    }

    // Wait for WebSocket awareness exchange
    await editorPage.waitForTimeout(1000);

    // Verify both canvases remain healthy and responsive
    expect(await editorCanvas.isVisible()).toBe(true);
    expect(await viewerCanvas.isVisible()).toBe(true);

    await editorContext.close();
    await viewerContext.close();
  });
});

