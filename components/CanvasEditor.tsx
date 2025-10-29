"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Plus, Download, FileJson, Share2, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CanvasEditorProps = {
  canvasId?: string;
  workspaceId?: string | null;
  onSave?: () => void;
};

type DBNode = {
  node_id: string;
  type: string;
  position_x: number;
  position_y: number;
  content: string;
  color: string;
  background_color: string;
  width?: number;
  height?: number;
  border_color: string;
};

type DBEdge = {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  label?: string | null;
  animated?: boolean | null;
  color?: string | null;
};

const nodeTypes = {
  // Custom node types can be added here
};

function CanvasEditorInner({ canvasId, workspaceId, onSave }: CanvasEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('Untitled Canvas');
  const [saving, setSaving] = useState(false);
  const [currentCanvasId, setCurrentCanvasId] = useState(canvasId);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load canvas if canvasId provided
  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId);
    } else {
      // Check for draft canvas in sessionStorage
      try {
        const draft = sessionStorage.getItem('canvasDraft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.title) setTitle(parsed.title);
          if (Array.isArray(parsed.nodes)) setNodes(parsed.nodes);
          if (Array.isArray(parsed.edges)) setEdges(parsed.edges);
          sessionStorage.removeItem('canvasDraft');
        }
      } catch (e) {
        console.warn('Failed to load canvas draft:', e);
      }
    }
    // loadCanvas, setNodes, and setEdges are stable callbacks from hooks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const loadCanvas = async (id: string) => {
    try {
      const response = await fetch(`/api/canvases/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTitle(data.canvas.title);
        
        // Convert nodes from DB format to ReactFlow format
        const flowNodes = (data.nodes as DBNode[]).map((node) => ({
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
        const flowEdges = (data.edges as DBEdge[]).map((edge) => ({
          id: edge.edge_id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: edge.type,
          label: edge.label ?? undefined,
          animated: edge.animated ?? false,
          style: edge.color ? { stroke: edge.color } : undefined,
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
    URL.revokeObjectURL(url);
  };

  const exportAsPNG = async () => {
    if (!canvasRef.current) return;
    
    try {
      // Get the ReactFlow viewport element
      const viewport = canvasRef.current.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return;

      // Create a canvas from the viewport
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size based on viewport
      const bounds = viewport.getBoundingClientRect();
      canvas.width = bounds.width;
      canvas.height = bounds.height;

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert to data URL
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${title}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Error exporting as PNG:', error);
    }
  };

  const exportAsSVG = () => {
    // Create SVG from nodes and edges data
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
        <rect width="100%" height="100%" fill="#ffffff"/>
        ${nodes.map(node => `
          <g transform="translate(${node.position.x}, ${node.position.y})">
            <rect width="${node.style?.width || 200}" height="${node.style?.height || 150}" 
                  fill="${node.style?.backgroundColor || '#fef3c7'}" 
                  stroke="${node.data.borderColor || '#fbbf24'}" 
                  stroke-width="2" rx="8"/>
            <text x="10" y="30" font-family="Arial" font-size="14" fill="${node.data.color || '#000'}">
              ${node.data.label}
            </text>
          </g>
        `).join('')}
        ${edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return '';
          
          const sx = sourceNode.position.x + ((sourceNode.style?.width as number) || 200) / 2;
          const sy = sourceNode.position.y + ((sourceNode.style?.height as number) || 150) / 2;
          const tx = targetNode.position.x + ((targetNode.style?.width as number) || 200) / 2;
          const ty = targetNode.position.y + ((targetNode.style?.height as number) || 150) / 2;
          
          return `
            <line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" 
                  stroke="${edge.style?.stroke || '#94a3b8'}" 
                  stroke-width="2" 
                  marker-end="url(#arrowhead)"/>
          `;
        }).join('')}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    `.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareCanvas = async () => {
    if (!currentCanvasId) {
      alert('Please save the canvas first before sharing');
      return;
    }

    try {
      // Make canvas public
      await fetch(`/api/canvases/${currentCanvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true }),
      });

      // Copy share link
      const shareUrl = `${window.location.origin}/canvas/${currentCanvasId}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Error sharing canvas:', error);
      alert('Failed to share canvas');
    }
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportAsPNG}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportAsSVG}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export as SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCanvas}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={shareCanvas} variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1" ref={canvasRef}>
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

// Wrapper component with ReactFlowProvider
export default function CanvasEditor(props: CanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}
