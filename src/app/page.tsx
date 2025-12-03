// src/app/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function createBoard() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ||
    (process.env.NODE_ENV !== "production" ? "http" : "https")) as string;
  const base = `${proto}://${host}`;
  const rsp = await fetch(`${base}/api/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Untitled" }),
    cache: "no-store",
  });
  if (!rsp.ok) return null;
  return rsp.json();
}

export default async function Page() {
  const created = await createBoard();
  const id = created?.id as string | undefined;
  if (id) redirect(`/board/${id}`);
  redirect("/boards/new");
}
