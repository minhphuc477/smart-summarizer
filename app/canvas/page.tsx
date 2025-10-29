import CanvasEditor from '@/components/CanvasEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function CanvasPage() {
  return (
    <div className="h-screen">
      <ErrorBoundary>
        <CanvasEditor />
      </ErrorBoundary>
    </div>
  );
}
