// src/app/api/boards/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Writable only in serverless: use /tmp. This will be ephemeral and per-instance.
const STORE_FILE = path.join("/tmp", "solve_history.json");

type HistoryItem = { question: string; response: string; ts: number };
type Board = { id: string; title: string; createdAt: number; updatedAt: number; items: HistoryItem[] };
type StoreShape = { boards: Board[] } | { sessions: any[] } | any;

async function ensureDir() {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
}

async function readSeed(req: NextRequest): Promise<StoreShape> {
  try {
    const origin = req.nextUrl?.origin;
    const url = `${origin}/solve_history.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Seed fetch failed: ${res.status}`);
    return (await res.json()) as StoreShape;
  } catch (e) {
    // If seed isn't available, default to empty
    return { boards: [] } as StoreShape;
  }
}

async function readStore(req: NextRequest): Promise<StoreShape> {
  try {
    await ensureDir();
    const buf = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(buf);
  } catch {
    // Fallback: prime from public seed
    const seed = await readSeed(req);
    try {
      await writeStore(seed);
    } catch (_) {
      // ignore write errors
    }
    return seed;
  }
}

async function writeStore(data: StoreShape) {
  await ensureDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function toBoards(shape: StoreShape): Board[] {
  if (Array.isArray((shape as any).boards)) return (shape as any).boards as Board[];
  // migrate legacy sessions -> boards
  if (Array.isArray((shape as any).sessions)) return (shape as any).sessions as Board[];
  return [];
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET(req: NextRequest) {
  const shape = await readStore(req);
  const boards = toBoards(shape)
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((b) => ({ id: b.id, title: b.title, createdAt: b.createdAt, updatedAt: b.updatedAt, count: b.items?.length ?? 0 }));
  return NextResponse.json({ boards });
}

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    const t = (title ?? "").toString().trim();
    if (!t) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const shape = await readStore(req);
    let boards = toBoards(shape);
    const now = Date.now();
    const id = makeId();
    const newBoard: Board = { id, title: t, createdAt: now, updatedAt: now, items: [] };
    boards = [newBoard, ...boards];
    await writeStore({ boards });
    return NextResponse.json({ id, title: t, createdAt: now, updatedAt: now });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create board." }, { status: 500 });
  }
}
