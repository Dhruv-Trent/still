import { z } from "zod";
// Restrict outbound server requests to known push services; never fetch arbitrary submitted URLs.
export const pushSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        const u = new URL(value);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          !u.port &&
          ([
            "fcm.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com",
            "wns2-db5p.notify.windows.com",
          ].includes(u.hostname) ||
            u.hostname.endsWith(".notify.windows.com"))
        );
      }, "Unsupported push service"),
    keys: z
      .object({
        p256dh: z
          .string()
          .regex(/^[A-Za-z0-9_-]+$/)
          .min(80)
          .max(100),
        auth: z
          .string()
          .regex(/^[A-Za-z0-9_-]+$/)
          .min(20)
          .max(30),
      })
      .strict(),
  })
  .strict();
