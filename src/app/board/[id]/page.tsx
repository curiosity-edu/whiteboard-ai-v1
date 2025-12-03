// src/app/board/[id]/page.tsx
import Board from "@/components/Board";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-white">
      <Board boardId={id} />
    </main>
  );
}
