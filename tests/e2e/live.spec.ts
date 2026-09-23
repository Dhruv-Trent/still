import { test, expect } from "@playwright/test";
// Run against a disposable real Supabase project with a verified test account.
// Never replaces Auth or APIs with route mocks.
test("live authenticated task journey", async ({ page }) => {
  test.setTimeout(90000);
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Real Supabase test account is required",
  );
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/workspace/);
  await page
    .getByRole("button", { name: /^Add a task/ })
    .first()
    .click();
  const title = `Journey ${Date.now()}`;
  await page.getByLabel("Task title").fill(title);
  await page
    .getByLabel("Date & time", { exact: true })
    .fill("2030-10-20T15:00");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("3");
  await page
    .getByRole("button", { name: "Add details, reminders & repeat" })
    .click();
  await page.getByLabel("10 min before", { exact: true }).check();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByText(title, { exact: true }).click();
  await page.getByLabel("Task title").fill(`${title} edited`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByLabel(`Complete ${title} edited`, { exact: true }).click();
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByText(`${title} edited`, { exact: true }),
  ).toBeVisible();
  await page.getByLabel(`Actions for ${title} edited`).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByText(`${title} edited`, { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Synced", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: /Personal account/ }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/auth/);
});
