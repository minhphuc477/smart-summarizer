import CanvasEditor from '@/components/CanvasEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CanvasDetailPage(props: PageProps) {
  const params = await props.params;
  
  return (
    <div className="h-screen">
      <ErrorBoundary>
        <CanvasEditor canvasId={params.id} />
      </ErrorBoundary>
    </div>
  );
}
