"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Folder, FolderOpen } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FolderType = {
  id: number;
  name: string;
  description: string | null;
  color: string;
  note_count: number;
  user_id: string;
  created_at: string;
};

type FolderSidebarProps = {
  userId: string;
  onFolderSelect: (folderId: number | null) => void;
  selectedFolderId: number | null;
};


export default function FolderSidebar({ userId: _userId, onFolderSelect, selectedFolderId }: FolderSidebarProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  
  // Form states
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColor, setFolderColor] = useState("#3B82F6");

  const colors = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Green", value: "#10B981" },
    { name: "Yellow", value: "#F59E0B" },
    { name: "Red", value: "#EF4444" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Pink", value: "#EC4899" },
  ];

  // Fetch folders
  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/folders");
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  // Create folder
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          description: folderDescription || null,
          color: folderColor,
        }),
      });

      if (response.ok) {
        await fetchFolders();
        setIsCreateDialogOpen(false);
        setFolderName("");
        setFolderDescription("");
        setFolderColor("#3B82F6");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  // Update folder
  const handleUpdateFolder = async () => {
    if (!selectedFolder || !folderName.trim()) return;

    try {
      const response = await fetch(`/api/folders/${selectedFolder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          description: folderDescription || null,
          color: folderColor,
        }),
      });

      if (response.ok) {
        await fetchFolders();
        setIsEditDialogOpen(false);
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error("Error updating folder:", error);
    }
  };

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;

    try {
      const response = await fetch(`/api/folders/${selectedFolder.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        if (selectedFolderId === selectedFolder.id) {
          onFolderSelect(null);
        }
        await fetchFolders();
        setIsDeleteDialogOpen(false);
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const openEditDialog = (folder: FolderType) => {
    setSelectedFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || "");
    setFolderColor(folder.color);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (folder: FolderType) => {
    setSelectedFolder(folder);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Folders
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* All Notes */}
          <button
            onClick={() => onFolderSelect(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              selectedFolderId === null
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
          >
            <Folder className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">All Notes</div>
            </div>
          </button>

          {/* Folder List */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground px-3 py-2">Loading...</div>
          ) : folders.length === 0 ? (
            <div className="text-sm text-muted-foreground px-3 py-2">
              No folders yet. Create one!
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors group ${
                  selectedFolderId === folder.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                <button
                  onClick={() => onFolderSelect(folder.id)}
                  className="flex-1 flex items-center gap-3 min-w-0"
                >
                  <Folder className="h-4 w-4 flex-shrink-0" style={{ color: folder.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folder.note_count} note{folder.note_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </button>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      openEditDialog(folder);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      openDeleteDialog(folder);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Organize your notes into folders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g., Work Projects"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFolderColor(c.value)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      folderColor === c.value ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFolderColor(c.value)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      folderColor === c.value ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFolder} disabled={!folderName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure? Notes in this folder will be moved to &quot;All Notes&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder}>
              Delete Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
