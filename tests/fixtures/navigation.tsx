import React from "react";
export function useRouter() {
  return { push: () => {} };
}
export default function Link(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  return <a {...props} />;
}
