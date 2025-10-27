import CanvasEditor from '@/components/CanvasEditor';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CanvasDetailPage(props: PageProps) {
  const params = await props.params;
  
  return (
    <div className="h-screen">
      <CanvasEditor canvasId={params.id} />
    </div>
  );
}
