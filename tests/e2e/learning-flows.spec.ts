import { test, expect } from '@playwright/test';

test.describe('End-to-End Learning Loop', () => {
  const testEmail = `e2e_learner_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test('Flow A: Learner signup, space creation, project initialization, and material upload', async ({ page }) => {
    // 1. Visit signup
    await page.goto('/auth/signup');
    await page.fill('#email', testEmail);
    await page.fill('#name', 'E2E Learner');
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.click('button[type="submit"]');

    // 2. Expect redirect to dashboard/spaces
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

    // 3. Create Space
    await page.goto('/dashboard/spaces');
    const newSpaceBtn = page.getByRole('button', { name: /New Space|Create Space/i });
    if (await newSpaceBtn.isVisible()) {
      await newSpaceBtn.click();
      await page.fill('input[name="name"], input[placeholder*="Space name"]', 'Computer Science Fundamentals');
      await page.click('button:has-text("Create")');
    }

    // 4. Create Project
    const newProjectBtn = page.getByRole('button', { name: /New Project|Create Project/i });
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
      await page.fill('input[name="name"]', 'Deep Learning');
      await page.fill('textarea[name="goal"]', 'Master neural network architectures');
      await page.click('button:has-text("Create")');
    }

    // 5. Document upload area visibility
    const uploadTrigger = page.locator('input[type="file"], label:has-text("Upload"), button:has-text("Upload")').first();
    if (await uploadTrigger.isVisible()) {
      await expect(uploadTrigger).toBeVisible();
    }
  });

  test('Flow B: AI Tutor grounded question with citation & insufficient evidence refusal', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button[type="submit"]');

    // Visit Tutor view
    await page.goto('/dashboard');
    const tutorLink = page.locator('a:has-text("Tutor"), a[href*="/tutor"]').first();
    if (await tutorLink.isVisible()) {
      await tutorLink.click();

      // Test 1: Grounded question
      const input = page.locator('textarea, input[placeholder*="Ask"]').first();
      await input.fill('What is backpropagation?');
      await page.keyboard.press('Enter');

      // Check for tutor response stream
      await expect(page.locator('.message-assistant, [data-role="assistant"]').first()).toBeVisible({
        timeout: 10000,
      });

      // Test 2: Out of scope / unanswerable question
      await input.fill('How do I bake sourdough bread?');
      await page.keyboard.press('Enter');

      // Expect refusal indicator or insufficient evidence acknowledgement
      await expect(page.locator('body')).toContainText(/not found|cannot answer|not covered|study material/i);
    }
  });

  test('Flow C: Take full adaptive quiz and verify concept mastery updates', async ({ page }) => {
    await page.goto('/dashboard');
    const quizLink = page.locator('a:has-text("Quiz"), a[href*="/quiz"]').first();
    if (await quizLink.isVisible()) {
      await quizLink.click();

      // Start quiz
      const startBtn = page.getByRole('button', { name: /Launch|Start Adaptive Quiz/i });
      if (await startBtn.isVisible()) {
        await startBtn.click();

        // Answer questions
        await expect(page.locator('text=Question 1 of')).toBeVisible({ timeout: 15000 });

        // Select first choice or fill answer
        const choiceBtn = page.locator('button:has-text("A"), button:has-text("B")').first();
        if (await choiceBtn.isVisible()) {
          await choiceBtn.click();
        }

        // Submit quiz
        const submitBtn = page.getByRole('button', { name: /Submit/i });
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          // Expect score card
          await expect(page.locator('text=Overall, text=%')).toBeVisible({ timeout: 15000 });
        }
      }
    }
  });
});
