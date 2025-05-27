import { test, expect } from '../fixtures';

test.describe('Game Creation Flow', () => {
  test('should create a new game with multiple players', async ({ authenticatedPage: page }) => {
    await page.goto('/games/new');
    
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h1:has-text("Create New Game")')).toBeVisible({ timeout: 10000 });
    
    await expect(page.locator('[data-testid="player-list"] >> text=You')).toBeVisible({ timeout: 10000 });
    
    await page.locator('[data-testid="add-player-button"]').click();
    
    await page.locator('[data-testid="player-select"]').click();
    await page.locator('[data-testid="player-option"]').first().click();
    
    await expect(page.locator('[data-testid="selected-players-count"]')).toContainText('2', { timeout: 10000 });
    
    await page.locator('[data-testid="start-game-button"]').click();
    
    await expect(page.url()).toMatch(/\/games\/[a-zA-Z0-9-]+/);
  });
  
  test('should handle adding a guest player when feature is enabled', async ({ authenticatedPage: page }) => {
    await page.goto('/games/new');
    
    await page.waitForLoadState('networkidle');
    
    const guestTabExists = await page.locator('[data-testid="guest-tab"]').count() > 0;
    test.skip(!guestTabExists, 'Guest players feature is not enabled');
    
    await page.locator('[data-testid="add-player-button"]').click();
    await page.locator('[data-testid="guest-tab"]').click();
    await page.locator('[data-testid="guest-name-input"]').fill('Guest Player');
    await page.locator('[data-testid="add-guest-button"]').click();
    
    await expect(page.locator('[data-testid="player-list"]')).toContainText('Guest Player', { timeout: 10000 });
    await expect(page.locator('[data-testid="player-list"]')).toContainText('Guest', { timeout: 10000 });
    
    await page.locator('[data-testid="start-game-button"]').click();
    
    await expect(page.url()).toMatch(/\/games\/[a-zA-Z0-9-]+/);
  });
  
  test('should validate minimum player requirement', async ({ authenticatedPage: page }) => {
    await page.goto('/games/new');
    
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('[data-testid="start-game-button"]')).toBeDisabled({ timeout: 10000 });
    
    await page.locator('[data-testid="add-player-button"]').click();
    await page.locator('[data-testid="player-select"]').click();
    await page.locator('[data-testid="player-option"]').first().click();
    
    await expect(page.locator('[data-testid="start-game-button"]')).toBeEnabled({ timeout: 10000 });
  });
});
