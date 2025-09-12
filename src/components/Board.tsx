"use client";

import * as React from "react";
import { Tldraw, toRichText, TLTextShape, TLShapeId, Editor } from "tldraw";
import "tldraw/tldraw.css";

export default function Board() {
  const editorRef = React.useRef<Editor | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onMount = React.useCallback((editor: Editor) => {
    editorRef.current = editor;
    try {
      // @ts-ignore
      editor.updateInstanceState({ isReadonly: false });
    } catch {}
    console.log("[Board] Editor mounted:", editor);
  }, []);

  function getUnionBounds(editor: any, ids: TLShapeId[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const b = editor.getShapePageBounds?.(id) ?? editor.getPageBounds?.(id) ?? null;
      if (!b) continue;
      const x = b.x ?? b.minX ?? 0;
      const y = b.y ?? b.minY ?? 0;
      const w = b.w ?? b.width ?? (b.maxX != null && b.minX != null ? b.maxX - b.minX : 0);
      const h = b.h ?? b.height ?? (b.maxY != null && b.minY != null ? b.maxY - b.minY : 0);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  const askAI = React.useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) { alert("Editor not ready yet."); return; }
    try {
      setLoading(true);
      const selection = Array.from(editor.getSelectedShapeIds?.() ?? []);
      const all = Array.from(editor.getCurrentPageShapeIds?.() ?? []);
      const shapeIds: TLShapeId[] = selection.length > 0 ? selection : all;
      if (shapeIds.length === 0) { alert("Draw or select the problem first."); return; }

      const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
      const { blob } = await editor.toImage(shapeIds, { format: "png", background: true, padding: 24, scale });
      if (!blob) { alert("Failed to export image."); return; }

      const fd = new FormData();
      fd.append("image", new File([blob], "board.png", { type: "image/png" }));

      const res = await fetch("/api/solve", { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Solve failed (${res.status})`;
        try { const j = await res.json(); if (j?.error) msg += ` — ${j.error}`; } catch {}
        throw new Error(msg);
      }

      const raw = await res.json();
      console.log("[/api/solve] payload:", raw);

      let finalText = (raw?.message ?? "").toString().trim();
      if (!finalText) {
        const answerPlain = (raw?.answerPlain ?? "").trim();
        const answerLatex = (raw?.answerLatex ?? "").trim();
        const explanation = (raw?.explanation ?? "").trim();
        finalText = answerPlain || answerLatex || "Could not read.";
        if (explanation) finalText = `${finalText}\n\n${explanation}`;
      }

      const b = getUnionBounds(editor, shapeIds);
      let x: number, y: number;
      if (b) { x = b.minX; y = b.maxY + 40; } else {
        const p = editor.screenToPage(editor.getViewportScreenCenter()); x = p.x; y = p.y;
      }

      editor.createShape<TLTextShape>({
        type: "text",
        x,
        y,
        props: { richText: toRichText(finalText), autoSize: false, w: 400 },
      });
    } catch (err) {
      console.error("[AskAI] Error:", err);
      alert(String(err instanceof Error ? err.message : err));
    } finally { setLoading(false); }
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div style={{ position: "absolute", right: 170, top: 8, zIndex: 20, pointerEvents: "all" }}>
        <button
          onClick={askAI}
          disabled={loading}
          className="rounded-xl border border-black px-4 py-2 bg-white text-black shadow"
          title="Export board and ask AI"
        >
          {loading ? "Thinking…" : "Ask AI"}
        </button>
      </div>
      <Tldraw onMount={onMount} persistenceKey={undefined} autoFocus />
    </div>
  );
}
