// src/app/page.tsx
import Board from "@/components/Board";

/**
 * Home page component that renders the main application interface.
 * This is a simple wrapper around the Board component that provides the main layout.
 */
export default function Page() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      {/* The Board component contains the interactive whiteboard with AI capabilities */}
      <Board />
    </main>
  );
}
