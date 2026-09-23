/* Only public shell and versioned static resources are cached. Never API/auth responses. */
const CACHE = "still-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch("/workspace", { cache: "reload" });
      if (!shell.ok) throw Error("Offline shell unavailable");
      const html = await shell.clone().text();
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
            .map((m) => m[1])
            .filter((path) => path.startsWith("/_next/static/")),
        ),
      ];
      await cache.addAll([...assets, "/favicon.svg", "/icons/icon-192.png"]);
      await cache.put("/workspace", shell);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth") ||
    event.request.headers.has("RSC")
  )
    return;
  if (event.request.mode === "navigate" && url.pathname === "/workspace") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/workspace").then((r) => r || Response.error()),
      ),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(CACHE).then((c) => c.put(event.request, copy)),
              );
            }
            return response;
          }),
      ),
    );
  }
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification("A little reminder", {
      body: "A task in Still needs your attention.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : "still-reminder",
      data: { url: "/workspace" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find(
          (c) => new URL(c.url).pathname === "/workspace",
        );
        if (existing) return existing.focus();
        return self.clients.openWindow("/workspace");
      }),
  );
});
