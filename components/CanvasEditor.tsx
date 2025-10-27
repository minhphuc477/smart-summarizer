"use client";

import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Plus, Download } from 'lucide-react';

type CanvasEditorProps = {
  canvasId?: string;
  workspaceId?: string | null;
  onSave?: () => void;
};

const nodeTypes = {
  // Custom node types can be added here
};

export default function CanvasEditor({ canvasId, workspaceId, onSave }: CanvasEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('Untitled Canvas');
  const [saving, setSaving] = useState(false);
  const [currentCanvasId, setCurrentCanvasId] = useState(canvasId);

  // Load canvas if canvasId provided
  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId);
    }
  }, [canvasId]);

  const loadCanvas = async (id: string) => {
    try {
      const response = await fetch(`/api/canvases/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTitle(data.canvas.title);
        
        // Convert nodes from DB format to ReactFlow format
        const flowNodes = data.nodes.map((node: any) => ({
          id: node.node_id,
          type: node.type,
          position: { x: node.position_x, y: node.position_y },
          data: { 
            label: node.content,
            color: node.color,
            backgroundColor: node.background_color,
          },
          style: {
            width: node.width,
            height: node.height,
            backgroundColor: node.background_color,
            border: `2px solid ${node.border_color}`,
            borderRadius: '8px',
            padding: '10px',
          },
        }));
        
        // Convert edges
        const flowEdges = data.edges.map((edge: any) => ({
          id: edge.edge_id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: edge.type,
          label: edge.label,
          animated: edge.animated,
          style: { stroke: edge.color },
        }));
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error) {
      console.error('Error loading canvas:', error);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addStickyNote = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: 'New Note' },
      style: {
        backgroundColor: '#fef3c7',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '10px',
        width: 200,
        height: 150,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveCanvas = async () => {
    setSaving(true);
    try {
      // Convert ReactFlow format back to DB format
      const dbNodes = nodes.map(node => ({
        node_id: node.id,
        type: node.type || 'note',
        content: node.data.label,
        position_x: node.position.x,
        position_y: node.position.y,
        width: node.style?.width || 200,
        height: node.style?.height || 150,
        color: node.data.color || '#000',
        background_color: node.style?.backgroundColor || '#fef3c7',
        border_color: node.data.borderColor || '#fbbf24',
        metadata: {},
      }));

      const dbEdges = edges.map(edge => ({
        edge_id: edge.id,
        source_node_id: edge.source,
        target_node_id: edge.target,
        type: edge.type || 'default',
        label: edge.label || '',
        color: edge.style?.stroke || '#94a3b8',
        animated: edge.animated || false,
        metadata: {},
      }));

      if (currentCanvasId) {
        // Update existing canvas
        await fetch(`/api/canvases/${currentCanvasId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, nodes: dbNodes, edges: dbEdges }),
        });
      } else {
        // Create new canvas
        const response = await fetch('/api/canvases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, workspace_id: workspaceId }),
        });
        const data = await response.json();
        setCurrentCanvasId(data.canvas.id);
        
        // Save nodes and edges
        await fetch(`/api/canvases/${data.canvas.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes: dbNodes, edges: dbEdges }),
        });
      }
      
      onSave?.();
    } catch (error) {
      console.error('Error saving canvas:', error);
    } finally {
      setSaving(false);
    }
  };

  const exportCanvas = () => {
    const dataStr = JSON.stringify({ nodes, edges, title }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.json`;
    link.click();
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background p-4 flex items-center gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-md"
          placeholder="Canvas title"
        />
        <div className="flex gap-2 ml-auto">
          <Button onClick={addStickyNote} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
          <Button onClick={saveCanvas} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={exportCanvas} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* Info Panel */}
      <div className="border-t bg-background p-2 text-sm text-muted-foreground flex items-center gap-4">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
        <span className="ml-auto">Drag to create • Click to edit • Connect nodes</span>
      </div>
    </div>
  );
}
