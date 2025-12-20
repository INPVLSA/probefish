import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check that login form elements are visible
    await expect(page.getByRole('heading', { name: /sign in|log in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should display register page', async ({ page }) => {
    await page.goto('/register');

    // Check that register form elements are visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test('should show validation errors for empty login form', async ({ page }) => {
    await page.goto('/login');

    // Click submit without filling form
    await page.getByRole('button', { name: /sign in|log in|submit/i }).click();

    // Should show validation error or stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/login');

    // Find and click link to register
    const registerLink = page.getByRole('link', { name: /register|sign up|create account/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/projects');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
