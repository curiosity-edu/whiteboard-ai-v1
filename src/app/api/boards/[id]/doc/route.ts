// src/app/api/boards/[id]/doc/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const STORE_FILE = path.join(process.cwd(), "data", "solve_history.json");

type HistoryItem = { question: string; response: string; ts: number };
type Board = { id: string; title: string; createdAt: number; updatedAt: number; items: HistoryItem[]; doc?: any };
type StoreShape = { boards: Board[] } | { sessions: any[] } | any;

async function ensureDir() {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
}

async function readStore(): Promise<StoreShape> {
  try {
    await ensureDir();
    const buf = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(buf);
  } catch {
    return { boards: [] } as StoreShape;
  }
}

async function writeStore(data: StoreShape) {
  await ensureDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function toBoards(shape: StoreShape): Board[] {
  if (Array.isArray((shape as any).boards)) return (shape as any).boards as Board[];
  if (Array.isArray((shape as any).sessions)) return (shape as any).sessions as Board[];
  return [];
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const shape = await readStore();
  const boards = toBoards(shape);
  const b = boards.find((x) => x.id === id);
  if (!b) return NextResponse.json({ doc: null, updatedAt: 0 });
  return NextResponse.json({ doc: b.doc ?? null, updatedAt: b.updatedAt });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  if (!Object.prototype.hasOwnProperty.call(body, "doc")) {
    return NextResponse.json({ error: "Missing doc" }, { status: 400 });
  }
  const shape = await readStore();
  const boards = toBoards(shape);
  const idx = boards.findIndex((b) => b.id === id);
  const now = Date.now();
  let nextBoards = boards.slice();
  let updated: Board;
  if (idx === -1) {
    // Upsert a new board if it doesn't exist yet
    updated = { id, title: "Untitled", createdAt: now, updatedAt: now, items: [], doc: body.doc };
    nextBoards = [updated, ...nextBoards];
  } else {
    updated = { ...boards[idx], doc: body.doc, updatedAt: now };
    nextBoards[idx] = updated;
  }
  try {
    await writeStore({ boards: nextBoards });
  } catch (e) {
    console.error("[Boards] writeStore failed during PUT /doc:", e);
  }
  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
