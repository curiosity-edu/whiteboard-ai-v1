// src/app/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ||
    (process.env.NODE_ENV !== "production" ? "http" : "https")) as string;
  return `${proto}://${host}`;
}

async function fetchBoards(): Promise<any[] | null> {
  const base = await getBaseUrl();
  try {
    const rsp = await fetch(`${base}/api/boards`, { cache: "no-store" });
    if (!rsp.ok) return null;
    const j = await rsp.json();
    return Array.isArray(j?.boards) ? j.boards : [];
  } catch {
    return null;
  }
}

async function createBoard() {
  const base = await getBaseUrl();
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
  // Load existing boards; if any, redirect to the most recent one (index 0)
  const boards = await fetchBoards();
  if (boards && boards.length > 0) {
    const first = boards[0];
    if (first?.id) redirect(`/board/${first.id}`);
  }

  // Only create a new board when the user has zero boards
  const created = await createBoard();
  const id = created?.id as string | undefined;
  if (id) redirect(`/board/${id}`);

  // If both listing and creation fail, render a simple retry UI
  return (
    <main className="h-[calc(100vh-3.5rem)] w-full grid place-items-center bg-white">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-neutral-900">
          We hit a snag
        </h1>
        <p className="text-sm text-neutral-600 mt-1">Please try again.</p>
        <form action="/" method="get" className="mt-3">
          <button className="px-3 py-2 text-sm font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800">
            Try Again
          </button>
        </form>
      </div>
    </main>
  );
}
