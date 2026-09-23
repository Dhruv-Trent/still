import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("landing, sign-in, legal pages, security headers and responsive width", async ({
  page,
  request,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await expect(
    page.getByRole("heading", { name: "Less on your mind. More in your day." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy, with a little clarity." }),
  ).toBeVisible();
  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "A few things to agree on." }),
  ).toBeVisible();
  expect((await request.get("/api/sync")).status()).toBe(401);
  expect((await request.get("/api/reminders")).status()).toBe(401);
  expect((await request.post("/api/sync", { data: {} })).status()).toBe(401);
});
test("public accessibility and manifest", async ({ page, request }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  await page.goto("/auth");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("workspace requires a session", async ({ page }) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/auth/);
});

test("small and large screens, dark mode, and offline shell", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Run the viewport matrix once",
  );
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    dark.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "docs/screenshots/landing.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const cached = await page.evaluate(async () => {
    const c = await caches.open("still-shell-v1");
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain("/workspace");
  expect(cached.some((p) => p.startsWith("/_next/static/"))).toBe(true);
  expect(cached.some((p) => p.startsWith("/api/"))).toBe(false);
  expect(browserName).toBe("chromium");
});
