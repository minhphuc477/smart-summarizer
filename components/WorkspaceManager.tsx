"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Settings, Trash2, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
  note_count: number;
  folder_count: number;
};

type WorkspaceManagerProps = {
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
};

export default function WorkspaceManager({ 
  selectedWorkspaceId, 
  onWorkspaceChange 
}: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Create workspace
  const handleCreate = async () => {
    if (!newWorkspace.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkspace),
      });

      if (!response.ok) throw new Error('Failed to create workspace');

      const data = await response.json();
      setWorkspaces([...workspaces, { ...data.workspace, member_count: 1, note_count: 0, folder_count: 0 }]);
      setNewWorkspace({ name: '', description: '' });
      setCreateDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError('Failed to create workspace');
    }
  };

  // Delete workspace
  const handleDelete = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace? All notes and folders will be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete workspace');

      setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
      if (selectedWorkspaceId === workspaceId) {
        onWorkspaceChange(null);
      }
    } catch (err) {
      console.error('Error deleting workspace:', err);
      setError('Failed to delete workspace');
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading workspaces...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Workspace Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Workspace</label>
        <Select
          value={selectedWorkspaceId || 'personal'}
          onValueChange={(value) => onWorkspaceChange(value === 'personal' ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select workspace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <div className="flex items-center gap-2">
                <span>📁</span>
                <span>Personal (Private)</span>
              </div>
            </SelectItem>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{workspace.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({workspace.member_count} members)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Workspace Actions */}
      <div className="flex gap-2">
        {/* Create Workspace */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a new workspace to collaborate with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g., Marketing Team"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  placeholder="What is this workspace for?"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Current Workspace */}
        {selectedWorkspaceId && (
          <WorkspaceSettings
            workspaceId={selectedWorkspaceId}
            workspace={workspaces.find(w => w.id === selectedWorkspaceId)}
            onDelete={() => handleDelete(selectedWorkspaceId)}
            onUpdate={fetchWorkspaces}
          />
        )}
      </div>

      {/* Current Workspace Info */}
      {selectedWorkspaceId && (
        <div className="p-4 bg-muted rounded-lg">
          {workspaces.find(w => w.id === selectedWorkspaceId) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  {workspaces.find(w => w.id === selectedWorkspaceId)?.name}
                </h3>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {workspaces.find(w => w.id === selectedWorkspaceId)?.role}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {workspaces.find(w => w.id === selectedWorkspaceId)?.description || 'No description'}
              </p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>👥 {workspaces.find(w => w.id === selectedWorkspaceId)?.member_count} members</span>
                <span>📝 {workspaces.find(w => w.id === selectedWorkspaceId)?.note_count} notes</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Workspace Settings Dialog Component
function WorkspaceSettings({ 
  workspaceId, 
  workspace,
  onDelete,
  onUpdate 
}: { 
  workspaceId: string; 
  workspace?: Workspace;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');
      
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to invite member');
        return;
      }

      setInviteEmail('');
      setError(null);
      fetchMembers();
      onUpdate();
    } catch (err) {
      console.error('Error inviting member:', err);
      setError('Failed to invite member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the workspace?')) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove member');

      fetchMembers();
      onUpdate();
    } catch (err) {
      console.error('Error removing member:', err);
      setError('Failed to remove member');
    }
  };

  const isOwnerOrAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>{workspace?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              className={`px-4 py-2 ${activeTab === 'members' ? 'border-b-2 border-primary' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
            {isOwnerOrAdmin && (
              <button
                className={`px-4 py-2 ${activeTab === 'settings' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {isOwnerOrAdmin && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email to invite"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                  <Button onClick={handleInvite}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{member.user?.email || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{member.role}</div>
                    </div>
                    {isOwnerOrAdmin && member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && workspace?.role === 'owner' && (
            <div className="space-y-4">
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
