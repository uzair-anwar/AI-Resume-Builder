import { test, expect } from "@playwright/test";

test("home loads wizard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Resume Tailor" })).toBeVisible();
  await expect(page.getByText("Job description")).toBeVisible();
});

test("tailor java job shows analysis", async ({ page }) => {
  await page.goto("/");
  const jd = `
Senior Java Developer
Requirements:
- Java and Spring Boot
- REST APIs
- PostgreSQL
`;
  const jobBox = page.locator("textarea").first();
  await jobBox.fill(jd);
  await expect(jobBox).toHaveValue(/Java/);
  const tailorBtn = page.getByRole("button", { name: "Analyze & tailor" });
  await expect(tailorBtn).toBeEnabled();
  await tailorBtn.click();
  await expect(page.getByText(/matched or transferable/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Headline")).toBeVisible({ timeout: 60_000 });
  const headline = await page.locator('input').first().inputValue();
  expect(headline.toLowerCase()).not.toContain("spring boot");
});
