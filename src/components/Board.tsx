"use client";

import * as React from "react";
import { Tldraw, toRichText, TLTextShape, TLShapeId, Editor } from "tldraw";
import "tldraw/tldraw.css";

/**
 * Board component that provides a collaborative whiteboard with AI integration.
 * Users can draw or write math problems and get AI-powered solutions.
 */
export default function Board() {
  // Reference to the Tldraw editor instance
  const editorRef = React.useRef<Editor | null>(null);
  // Loading state for the AI request
  const [loading, setLoading] = React.useState(false);

  /**
   * Callback when the Tldraw editor mounts
   * @param editor - The Tldraw editor instance
   */
  const onMount = React.useCallback((editor: Editor) => {
    editorRef.current = editor;
    try {
      // @ts-ignore - Update editor state to allow editing
      editor.updateInstanceState({ isReadonly: false });
    } catch {}
    console.log("[Board] Editor mounted:", editor);
  }, []);

  /**
   * Calculates the bounding box that contains all specified shapes
   * @param editor - The Tldraw editor instance
   * @param ids - Array of shape IDs to calculate bounds for
   * @returns Bounding box information or null if no valid bounds could be calculated
   */
  function getUnionBounds(editor: any, ids: TLShapeId[]) {
    // Initialize bounds with extreme values
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Calculate the union of all shape bounds
    for (const id of ids) {
      const b =
        editor.getShapePageBounds?.(id) ?? editor.getPageBounds?.(id) ?? null;
      if (!b) continue;

      // Handle different possible bounding box formats
      const x = b.x ?? b.minX ?? 0;
      const y = b.y ?? b.minY ?? 0;
      const w =
        b.w ??
        b.width ??
        (b.maxX != null && b.minX != null ? b.maxX - b.minX : 0);
      const h =
        b.h ??
        b.height ??
        (b.maxY != null && b.minY != null ? b.maxY - b.minY : 0);

      // Update the overall bounds
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    // Return null if no valid bounds were found
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    )
      return null;

    // Return the calculated bounds with additional convenience properties
    return {
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }

  /**
   * Captures the current board content, sends it to the AI, and displays the response
   */
  const askAI = React.useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      alert("Editor not ready yet.");
      return;
    }

    try {
      setLoading(true);

      // Get selected shapes or all shapes if none selected
      const selection = Array.from(editor.getSelectedShapeIds?.() ?? []);
      const all = Array.from(editor.getCurrentPageShapeIds?.() ?? []);
      const shapeIds: TLShapeId[] = selection.length > 0 ? selection : all;

      if (shapeIds.length === 0) {
        alert("Draw or select the problem first.");
        return;
      }

      // Export the selected area as an image
      const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
      const { blob } = await editor.toImage(shapeIds, {
        format: "png",
        background: true,
        padding: 24,
        scale,
      });

      if (!blob) {
        alert("Failed to export image.");
        return;
      }

      // Prepare the image for sending to the API
      const fd = new FormData();
      fd.append("image", new File([blob], "board.png", { type: "image/png" }));

      // Send the image to the solve API
      const res = await fetch("/api/solve", { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Solve failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg += ` — ${j.error}`;
        } catch {}
        throw new Error(msg);
      }

      // Process the API response
      const raw = await res.json();
      console.log("[/api/solve] payload:", raw);

      // Format the response text
      let finalText = (raw?.message ?? "").toString().trim();
      if (!finalText) {
        // Fallback to alternative response fields if message is empty
        const answerPlain = (raw?.answerPlain ?? "").trim();
        const answerLatex = (raw?.answerLatex ?? "").trim();
        const explanation = (raw?.explanation ?? "").trim();
        finalText = answerPlain || answerLatex || "Could not read.";
        if (explanation) finalText = `${finalText}\n\n${explanation}`;
      }

      // Calculate position for the response text
      const b = getUnionBounds(editor, shapeIds);
      let x: number, y: number;
      if (b) {
        // Position below the selected area
        x = b.minX;
        y = b.maxY + 40;
      } else {
        // Fallback to viewport center if bounds can't be calculated
        const p = editor.screenToPage(editor.getViewportScreenCenter());
        x = p.x;
        y = p.y;
      }

      // Create a text shape with the AI response
      editor.createShape<TLTextShape>({
        type: "text",
        x,
        y,
        props: {
          richText: toRichText(finalText),
          autoSize: false,
          w: 400,
        },
      });
    } catch (err) {
      console.error("[AskAI] Error:", err);
      alert(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* AI Button */}
      <div
        style={{
          position: "absolute",
          right: 170,
          top: 8,
          zIndex: 20,
          pointerEvents: "all",
        }}
      >
        <button
          onClick={askAI}
          disabled={loading}
          className="rounded-xl border border-black px-4 py-2 bg-white text-black shadow"
          title="Export board and ask AI"
        >
          {loading ? "Thinking…" : "Ask AI"}
        </button>
      </div>

      {/* Tldraw Editor */}
      <Tldraw
        onMount={onMount}
        persistenceKey={undefined} // Disable local persistence
        autoFocus
      />
    </div>
  );
}
