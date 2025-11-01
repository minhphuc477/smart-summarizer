"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
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
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useKeyboardShortcuts, commonShortcuts } from '@/lib/useKeyboardShortcuts';
import { Input } from '@/components/ui/input';
import { Save, Plus, Download, FileJson, Share2, Image as ImageIcon, Sparkles, Network, Grid3x3, Circle, GitBranch, CheckSquare, Link as LinkIcon, Code2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { applyLayout, type LayoutType } from '@/lib/canvasLayouts';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

// Import custom node components
import ImageNode from '@/components/canvas-nodes/ImageNode';
import ChecklistNode from '@/components/canvas-nodes/ChecklistNode';
import LinkPreviewNode from '@/components/canvas-nodes/LinkPreviewNode';
import CodeNode from '@/components/canvas-nodes/CodeNode';

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
  image: ImageNode,
  checklist: ChecklistNode,
  linkPreview: LinkPreviewNode,
  code: CodeNode,
};

function CanvasEditorInner({ canvasId, workspaceId, onSave }: CanvasEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('Untitled Canvas');
  const [saving, setSaving] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [currentCanvasId, setCurrentCanvasId] = useState(canvasId);
  const [showMinimap, setShowMinimap] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<Array<{ nodes: Node[]; edges: Edge[]; title: string }>>([]);
  const redoStack = useRef<Array<{ nodes: Node[]; edges: Edge[]; title: string }>>([]);
  const clipboardRef = useRef<Array<Node>>([]);
  const { fitView } = useReactFlow();

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

  const snapshot = useCallback(() => ({
    nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    title,
  }), [nodes, edges, title]);

  const pushUndo = useCallback(() => {
    undoStack.current.push(snapshot());
    // Clear redo on new action
    redoStack.current = [];
  }, [snapshot]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(snapshot());
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setTitle(prev.title);
  }, [setEdges, setNodes, snapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(snapshot());
    setNodes(next.nodes);
    setEdges(next.edges);
    setTitle(next.title);
  }, [setEdges, setNodes, snapshot]);

  

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    pushUndo();
    onNodesChange(changes);
  }, [onNodesChange, pushUndo]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    pushUndo();
    onEdgesChange(changes);
  }, [onEdgesChange, pushUndo]);

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
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    toast.success('Note added');
  };

  const addImageNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'image',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { editing: true },
    };
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    toast.success('Image node added');
  };

  const addChecklistNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'checklist',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        title: 'New Checklist',
        items: [],
      },
    };
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    toast.success('Checklist added');
  };

  const addLinkPreviewNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'linkPreview',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { editing: true },
    };
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    toast.success('Link preview added');
  };

  const addCodeNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'code',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        code: '// Enter your code here',
        language: 'javascript',
      },
    };
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    toast.success('Code node added');
  };

  const handleAutoLayout = (layoutType: LayoutType) => {
    if (nodes.length === 0) {
      toast.error('Add some nodes first');
      return;
    }

    pushUndo();
    const layouted = applyLayout(layoutType, [...nodes], edges);
    setNodes(layouted);
    
    const layoutNames = {
      tree: 'Tree',
      force: 'Force-Directed',
      grid: 'Grid',
      circular: 'Circular',
      hierarchical: 'Hierarchical'
    };
    toast.success(`${layoutNames[layoutType]} layout applied`);
  };

  const getAISuggestions = async () => {
    if (nodes.length === 0) {
      toast.error('Add some nodes first to get AI suggestions');
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/canvas/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map(n => ({ id: n.id, data: n.data })),
          edges,
          context: title
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      const { suggestions } = data;

      // Show suggestions in a toast with interactive options
      if (suggestions.relatedConcepts && suggestions.relatedConcepts.length > 0) {
        toast.success(`AI found ${suggestions.relatedConcepts.length} related concepts!`, {
          description: 'Check the console for details (UI coming soon)',
          duration: 5000
        });
        console.log('AI Suggestions:', suggestions);
        
        // For now, just log. In future, show in a modal with "Add" buttons
        // TODO: Create SuggestionsDialog component
      } else {
        toast.info('No new suggestions at this time');
      }

    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error('Failed to get AI suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
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
      toast.info('Please save the canvas first before sharing');
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
      toast.success('Share link copied to clipboard');
    } catch (error) {
      console.error('Error sharing canvas:', error);
      toast.error('Failed to share canvas');
    }
  };

  // Register keyboard shortcuts after functions are defined
  useKeyboardShortcuts([
    { ...commonShortcuts.save, callback: () => void saveCanvas() },
    { key: 'e', ctrl: true, description: 'Export canvas', callback: exportCanvas },
    { key: 'z', ctrl: true, description: 'Undo', callback: undo },
    { key: 'y', ctrl: true, description: 'Redo', callback: redo },
    { key: 'k', ctrl: true, description: 'Command palette', callback: () => setCommandOpen(true) },
  ]);

  // Context menu actions
  const deleteSelected = () => {
    const anySelected = nodes.some(n => n.selected) || edges.some(e => e.selected);
    if (!anySelected) {
      toast.info('No selection to delete');
      return;
    }
    pushUndo();
    setNodes(prev => prev.filter(n => !n.selected));
    setEdges(prev => prev.filter(e => !e.selected));
  };

  const duplicateSelected = () => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) {
      toast.info('Select nodes to duplicate');
      return;
    }
    pushUndo();
    const dupes: Node[] = selected.map(n => ({
      ...JSON.parse(JSON.stringify(n)),
      id: `${n.id}-copy-${Date.now()}`,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
    }));
    setNodes(prev => [...prev, ...dupes]);
  };

  const copySelected = () => {
    const selected = nodes.filter(n => n.selected);
    clipboardRef.current = selected.map(n => JSON.parse(JSON.stringify(n)));
    toast.success(`${selected.length} node(s) copied`);
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) {
      toast.info('Clipboard is empty');
      return;
    }
    pushUndo();
    const pasted = clipboardRef.current.map(n => ({
      ...JSON.parse(JSON.stringify(n)),
      id: `${n.id}-paste-${Date.now()}`,
      position: { x: n.position.x + 60, y: n.position.y + 60 },
    }));
    setNodes(prev => [...prev, ...pasted]);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Node Types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={addStickyNote}>
                <Plus className="h-4 w-4 mr-2" />
                Sticky Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addImageNode}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addChecklistNode}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Checklist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addLinkPreviewNode}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Link Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addCodeNode}>
                <Code2 className="h-4 w-4 mr-2" />
                Code Snippet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-Layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Smart Layouts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAutoLayout('tree')}>
                <GitBranch className="h-4 w-4 mr-2" />
                Tree Layout
                <span className="ml-auto text-xs text-muted-foreground">Hierarchical</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('force')}>
                <Network className="h-4 w-4 mr-2" />
                Force-Directed
                <span className="ml-auto text-xs text-muted-foreground">Organic</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('hierarchical')}>
                <GitBranch className="h-4 w-4 mr-2 rotate-90" />
                Hierarchical
                <span className="ml-auto text-xs text-muted-foreground">Layered</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('grid')}>
                <Grid3x3 className="h-4 w-4 mr-2" />
                Grid Layout
                <span className="ml-auto text-xs text-muted-foreground">Organized</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('circular')}>
                <Circle className="h-4 w-4 mr-2" />
                Circular Layout
                <span className="ml-auto text-xs text-muted-foreground">Radial</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            onClick={getAISuggestions} 
            variant="outline" 
            size="sm"
            disabled={loadingSuggestions}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {loadingSuggestions ? 'Thinking...' : 'AI Suggest'}
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
      <div className="flex-1">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="h-full" ref={canvasRef}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Controls />
                {showMinimap && <MiniMap />}
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              </ReactFlow>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Add Nodes</ContextMenuLabel>
            <ContextMenuItem onClick={addStickyNote}>
              <Plus className="h-4 w-4 mr-2" />
              Sticky Note
            </ContextMenuItem>
            <ContextMenuItem onClick={addImageNode}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </ContextMenuItem>
            <ContextMenuItem onClick={addChecklistNode}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Checklist
            </ContextMenuItem>
            <ContextMenuItem onClick={addLinkPreviewNode}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Preview
            </ContextMenuItem>
            <ContextMenuItem onClick={addCodeNode}>
              <Code2 className="h-4 w-4 mr-2" />
              Code Snippet
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>Edit</ContextMenuLabel>
            <ContextMenuItem onClick={deleteSelected}>Delete Selected</ContextMenuItem>
            <ContextMenuItem onClick={duplicateSelected}>Duplicate Selected</ContextMenuItem>
            <ContextMenuItem onClick={copySelected}>Copy</ContextMenuItem>
            <ContextMenuItem onClick={pasteClipboard}>Paste</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>Layout</ContextMenuLabel>
            <ContextMenuItem onClick={() => handleAutoLayout('tree')}>Tree</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('force')}>Force-Directed</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('grid')}>Grid</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('hierarchical')}>Hierarchical</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('circular')}>Circular</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => fitView({ padding: 0.2 })}>Fit View</ContextMenuItem>
            <ContextMenuItem onClick={() => setShowMinimap(v => !v)}>{showMinimap ? 'Hide' : 'Show'} Minimap</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={exportAsPNG}>Export as PNG</ContextMenuItem>
            <ContextMenuItem onClick={exportAsSVG}>Export as SVG</ContextMenuItem>
            <ContextMenuItem onClick={exportCanvas}>Export as JSON</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Info Panel */}
      <div className="border-t bg-background p-2 text-sm text-muted-foreground flex items-center gap-4">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
        <span className="ml-auto">Drag to create • Click to edit • Connect nodes</span>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Add Nodes">
            <CommandItem onSelect={() => { addStickyNote(); setCommandOpen(false); }}>
              <Plus className="h-4 w-4 mr-2" />
              Sticky Note
            </CommandItem>
            <CommandItem onSelect={() => { addImageNode(); setCommandOpen(false); }}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </CommandItem>
            <CommandItem onSelect={() => { addChecklistNode(); setCommandOpen(false); }}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Checklist
            </CommandItem>
            <CommandItem onSelect={() => { addLinkPreviewNode(); setCommandOpen(false); }}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Preview
            </CommandItem>
            <CommandItem onSelect={() => { addCodeNode(); setCommandOpen(false); }}>
              <Code2 className="h-4 w-4 mr-2" />
              Code Snippet
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Canvas">
            <CommandItem onSelect={() => { fitView({ padding: 0.2 }); setCommandOpen(false); }}>
              Fit View
            </CommandItem>
            <CommandItem onSelect={() => { setShowMinimap(v => !v); setCommandOpen(false); }}>
              {showMinimap ? 'Hide' : 'Show'} Minimap
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Layout">
            <CommandItem onSelect={() => { handleAutoLayout('tree'); setCommandOpen(false); }}>Tree</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('force'); setCommandOpen(false); }}>Force-Directed</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('grid'); setCommandOpen(false); }}>Grid</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('hierarchical'); setCommandOpen(false); }}>Hierarchical</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('circular'); setCommandOpen(false); }}>Circular</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Export">
            <CommandItem onSelect={() => { exportAsPNG(); setCommandOpen(false); }}>Export as PNG</CommandItem>
            <CommandItem onSelect={() => { exportAsSVG(); setCommandOpen(false); }}>Export as SVG</CommandItem>
            <CommandItem onSelect={() => { exportCanvas(); setCommandOpen(false); }}>Export as JSON</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Edit">
            <CommandItem onSelect={() => { undo(); setCommandOpen(false); }}>Undo</CommandItem>
            <CommandItem onSelect={() => { redo(); setCommandOpen(false); }}>Redo</CommandItem>
            <CommandItem onSelect={() => { copySelected(); setCommandOpen(false); }}>Copy</CommandItem>
            <CommandItem onSelect={() => { pasteClipboard(); setCommandOpen(false); }}>Paste</CommandItem>
            <CommandItem onSelect={() => { duplicateSelected(); setCommandOpen(false); }}>Duplicate</CommandItem>
            <CommandItem onSelect={() => { deleteSelected(); setCommandOpen(false); }}>Delete Selected</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="AI">
            <CommandItem onSelect={() => { getAISuggestions(); setCommandOpen(false); }}>
              AI Suggest
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

// Wrapper component with ReactFlowProvider
function CanvasEditor(props: CanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function CanvasEditorWithBoundary(props: CanvasEditorProps) {
  return (
    <ErrorBoundary>
      <CanvasEditor {...props} />
    </ErrorBoundary>
  );
}
