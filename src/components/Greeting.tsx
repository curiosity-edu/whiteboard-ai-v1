"use client";

import { UserAuth } from "@/context/AuthContext";

export default function Greeting() {
  const ctx = (UserAuth() as any) || [];
  const user = ctx[0];
  const firstName = (user?.displayName || "").split(" ")[0] || null;
  if (!firstName) return null;
  return <span className="text-sm text-neutral-700">Hello {firstName}</span>;
}
