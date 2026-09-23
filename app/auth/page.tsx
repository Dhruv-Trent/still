import { Suspense } from "react";
import Auth from "@/components/auth";
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Opening your workspace…</p>}>
      <Auth />
    </Suspense>
  );
}
