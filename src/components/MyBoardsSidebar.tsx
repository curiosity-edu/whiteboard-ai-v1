"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserAuth } from "@/context/AuthContext";

export default function MyBoardsSidebar({
  currentBoardId,
}: {
  currentBoardId?: string;
}) {
  const router = useRouter();
  const [user] = (UserAuth() as any) || [];

  const [open, setOpen] = React.useState<boolean>(() => {
    try {
      const v = localStorage.getItem("boardsOpen");
      return v ? v !== "false" : false;
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem("boardsOpen", String(open));
    } catch {}
  }, [open]);

  const [boards, setBoards] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [tempTitle, setTempTitle] = React.useState<string>("");

  React.useEffect(() => {
    let aborted = false;
    async function load() {
      if (!user) {
        setBoards([]);
        return;
      }
      try {
        setLoading(true);
        const rsp = await fetch("/api/boards", { cache: "no-store" });
        if (!rsp.ok) {
          if (!aborted) setBoards([]);
          return;
        }
        const j = await rsp.json();
        if (!aborted) setBoards(Array.isArray(j?.boards) ? j.boards : []);
      } catch {
        if (!aborted) setBoards([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [user]);

  // Close menus on outside click or Escape
  React.useEffect(() => {
    function onDocClick() {
      setMenuOpenId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpenId(null);
        setRenamingId(null);
      }
    }
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function onDeleteBoard(id: string) {
    try {
      if (
        !window.confirm(
          "Are you sure you want to delete this board? This action cannot be undone."
        )
      ) {
        return;
      }
      setDeletingId(id);
      const rsp = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!rsp.ok && rsp.status !== 204) {
        throw new Error(`Delete failed (${rsp.status})`);
      }
      setBoards((prev) => prev.filter((b) => b.id !== id));
      if (currentBoardId === id) {
        // Navigate to another board if available, else home
        const remaining = boards.filter((b) => b.id !== id);
        if (remaining.length > 0) router.push(`/board/${remaining[0].id}`);
        else router.push("/");
      }
    } catch (e) {
      console.error("[Boards] delete failed", e);
      alert("Failed to delete board. Please try again.");
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  }

  function startRename(b: any) {
    setRenamingId(b.id);
    setTempTitle(b.title || "Untitled");
    setMenuOpenId(null);
  }

  async function commitRename(id: string) {
    const t = (tempTitle || "").trim();
    setRenamingId(null);
    if (!t) return; // ignore empty
    try {
      // Optimistic update
      setBoards((prev) =>
        prev.map((x) => (x.id === id ? { ...x, title: t } : x))
      );
      const rsp = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!rsp.ok) {
        throw new Error(`Rename failed (${rsp.status})`);
      }
    } catch (e) {
      console.error("[Boards] rename failed", e);
      alert("Failed to rename board. Please try again.");
    }
  }

  if (!user) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-40 h-9 w-9 flex items-center justify-center rounded-md border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50"
        title="Show Boards"
        aria-label="Show Boards"
      >
        {">"}
      </button>
    );
  }

  return (
    <aside
      className="relative z-30 w-64 max-w-[320px] h-full min-h-0 border-r border-neutral-200 bg-white flex flex-col"
      aria-label="My Boards"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 bg-neutral-50">
        <div className="text-sm font-semibold text-neutral-700 select-none">
          My Boards
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/boards/new"
            className="px-2 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
          >
            New
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-xl text-neutral-500 hover:text-neutral-800"
            aria-label="Hide Boards"
            title="Hide Boards"
          >
            {"<"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-xs text-neutral-500 px-2 py-2">Loading…</div>
        ) : boards.length === 0 ? (
          <div className="text-xs text-neutral-500 px-2 py-2">
            No boards yet.
          </div>
        ) : (
          <ul className="space-y-1">
            {boards.map((b: any) => (
              <li
                key={b.id}
                className="group relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => router.push(`/board/${b.id}`)}
                  className={`w-full text-left border border-neutral-200 rounded-md px-3 py-2 hover:bg-neutral-50 pr-10 ${
                    b.id === currentBoardId ? "bg-neutral-50" : "bg-white"
                  }`}
                >
                  {renamingId === b.id ? (
                    <input
                      autoFocus
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(b.id);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setRenamingId(null);
                        }
                      }}
                      onBlur={() => commitRename(b.id)}
                      className="w-full rounded-sm border border-blue-300 bg-blue-50 px-1 py-0.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <div className="font-medium text-neutral-900 truncate">
                      {b.title || "Untitled"}
                    </div>
                  )}
                  <div className="text-[11px] text-neutral-500">
                    {new Date(b.updatedAt).toLocaleString()} • {b.count} item
                    {b.count === 1 ? "" : "s"}
                  </div>
                </button>

                {/* Kebab menu trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId((prev) => (prev === b.id ? null : b.id));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 hidden group-hover:flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 border border-transparent"
                  title="More options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpenId === b.id}
                >
                  ⋮
                </button>

                {menuOpenId === b.id && (
                  <div
                    role="menu"
                    className="absolute right-2 top-8 z-50 w-36 rounded-md border border-neutral-200 bg-white shadow-md py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                      onClick={() => startRename(b)}
                      role="menuitem"
                    >
                      Rename
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => onDeleteBoard(b.id)}
                      role="menuitem"
                      disabled={deletingId === b.id}
                      aria-label={`Delete board ${b.title || "Untitled"}`}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
