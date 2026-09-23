import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Isolated UI fixtures: proves component interaction/layout only, never live authentication or sync.
test("workspace task editor, completion, lists, calendar, themes and accessibility", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_COMPONENTS,
    "Start the isolated Vite fixture to run component tests",
  );
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:3001");
  await expect(page.getByRole("heading", { name: /Good/ })).toBeVisible();
  const initial = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    initial.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  const add = page.getByRole("button", { name: /^Add a task/ });
  await add.last().click();
  await page.getByLabel("Task title").fill("Component journey");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("3");
  await page
    .getByRole("button", { name: "Add details, reminders & repeat" })
    .click();
  await page.getByLabel("Notes", { exact: true }).fill("Test notes");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByText("Component journey", { exact: true }),
  ).toBeVisible();
  await page.getByText("Component journey", { exact: true }).click();
  await page.getByLabel("Task title").fill("Updated journey");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByLabel("Complete Updated journey", { exact: true }).click();
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByText("Updated journey", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Restore Updated journey", { exact: true }).click();
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByLabel("Create list", { exact: true }).click();
  await page.getByLabel("List name").fill("Travel");
  await page.getByRole("button", { name: "Save list", exact: true }).click();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await page.getByLabel("Calendar view").selectOption("week");
  await page.getByLabel("Calendar view").selectOption("month");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: /Alex Personal account/ }).click();
  await page.getByLabel("Appearance").selectOption("dark");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (await page.getByLabel("Open navigation").isVisible())
    await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: /^Today/ }).click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await expect(page.getByRole("status")).toHaveCount(0);
  if (testInfo.project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/workspace-fixture.png",
      fullPage: true,
    });
});

test("native IndexedDB preserves concurrent queued changes and account isolation", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_COMPONENTS || testInfo.project.name !== "desktop",
    "Run the native storage test once",
  );
  await page.goto("http://127.0.0.1:3001");
  const result = await page.evaluate(async () => {
    const entry = "/offline-test.ts";
    const { readLocal, updateLocal, clearLocal } = await import(entry);
    const a = crypto.randomUUID(),
      b = crypto.randomUUID();
    const make = () => ({
      id: crypto.randomUUID(),
      entity: "list",
      action: "put",
      record_id: crypto.randomUUID(),
      expected_version: 0,
      scope: "one",
      data: { name: "Offline", position: 0 },
    });
    await Promise.all([
      updateLocal(a, (s: { queue: unknown[] }) => ({
        ...s,
        queue: [...s.queue, make()],
      })),
      updateLocal(a, (s: { queue: unknown[] }) => ({
        ...s,
        queue: [...s.queue, make()],
      })),
    ]);
    const before = (await readLocal(a)).queue.length;
    await updateLocal(b, (s: { queue: unknown[] }) => ({
      ...s,
      queue: [...s.queue, make()],
    }));
    await clearLocal(a);
    const own = (await readLocal(a)).queue.length,
      other = (await readLocal(b)).queue.length;
    await clearLocal(b);
    return { before, own, other };
  });
  expect(result).toEqual({ before: 2, own: 0, other: 1 });
});
