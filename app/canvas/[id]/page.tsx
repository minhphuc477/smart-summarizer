import CanvasEditor from '@/components/CanvasEditor';

export default function CanvasDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-screen">
      <CanvasEditor canvasId={params.id} />
    </div>
  );
}
