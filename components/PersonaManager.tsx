'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Trash2, Star, User } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  is_default: boolean;
  created_at: string;
}

interface PersonaManagerProps {
  currentPersona?: string;
  onSelectPersona: (prompt: string) => void;
  userId?: string;
}

export function PersonaManager({
  currentPersona = '',
  onSelectPersona,
  userId,
}: PersonaManagerProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [personaSearchQuery, setPersonaSearchQuery] = useState('');

  // Form state for saving new persona
  const [newPersona, setNewPersona] = useState({
    name: '',
    prompt: currentPersona,
    description: '',
    is_default: false,
  });

  // Fetch personas on mount
  useEffect(() => {
    if (userId) {
      fetchPersonas();
    }
  }, [userId]);

  // Update newPersona prompt when currentPersona changes
  useEffect(() => {
    setNewPersona((prev) => ({ ...prev, prompt: currentPersona }));
  }, [currentPersona]);

  const fetchPersonas = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/personas');
      const data = await response.json();

      if (response.ok) {
        setPersonas(data.personas || []);
      } else {
        throw new Error(data.error || 'Failed to fetch personas');
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
      setToast({ type: 'error', message: 'Failed to load personas' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePersona = async () => {
    if (!newPersona.name.trim() || !newPersona.prompt.trim()) {
      setToast({ type: 'error', message: 'Name and prompt are required' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPersona),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({ type: 'success', message: 'Persona saved successfully' });
        setTimeout(() => setToast(null), 2500);
        setIsSaveDialogOpen(false);
        setNewPersona({
          name: '',
          prompt: currentPersona,
          description: '',
          is_default: false,
        });
        await fetchPersonas();
      } else {
        throw new Error(data.error || 'Failed to save persona');
      }
    } catch (error) {
      console.error('Error saving persona:', error);
      setToast({ type: 'error', message: 'Failed to save persona' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setToast({ type: 'success', message: 'Persona deleted successfully' });
        setTimeout(() => setToast(null), 2500);
        await fetchPersonas();
        if (selectedPersonaId === id) {
          setSelectedPersonaId('');
        }
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete persona');
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
      setToast({ type: 'error', message: 'Failed to delete persona' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/personas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });

      if (response.ok) {
        setToast({ type: 'success', message: 'Default persona updated' });
        setTimeout(() => setToast(null), 2500);
        await fetchPersonas();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set default');
      }
    } catch (error) {
      console.error('Error setting default persona:', error);
      setToast({ type: 'error', message: 'Failed to set default persona' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPersona = (value: string) => {
    setSelectedPersonaId(value);
    const persona = personas.find((p) => p.id === value);
    if (persona) {
      onSelectPersona(persona.prompt);
      setToast({ type: 'success', message: `Using persona: ${persona.name}` });
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Filter personas based on search query
  const filteredPersonas = personas.filter((persona) => {
    const query = personaSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      persona.name.toLowerCase().includes(query) ||
      (persona.description || '').toLowerCase().includes(query) ||
      persona.prompt.toLowerCase().includes(query)
    );
  });

  // Don't show for guest users
  if (!userId) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2">
      {/* Persona Selector */}
      <Select value={selectedPersonaId} onValueChange={handleSelectPersona}>
        <SelectTrigger className="w-[200px]">
          <User className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select Persona" />
        </SelectTrigger>
        <SelectContent>
          {/* Search Input */}
          {personas.length > 0 && (
            <div className="p-2 border-b">
              <Input
                placeholder="Search personas..."
                value={personaSearchQuery}
                onChange={(e) => setPersonaSearchQuery(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          {filteredPersonas.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {personaSearchQuery ? 'No personas found' : 'No saved personas yet'}
            </div>
          ) : (
            filteredPersonas.map((persona) => (
              <SelectItem key={persona.id} value={persona.id}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {persona.is_default && <Star className="h-3 w-3 fill-current text-yellow-500" />}
                    <span className="font-medium">{persona.name}</span>
                  </div>
                  {persona.description && (
                    <span className="text-xs text-muted-foreground">
                      {persona.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Save Current Persona Button */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Persona
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Save Current Persona</DialogTitle>
            <DialogDescription>
              Save the current persona prompt for quick reuse later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Persona Name *
              </label>
              <Input
                placeholder="e.g., Professional Summary, Student Notes"
                value={newPersona.name}
                onChange={(e) =>
                  setNewPersona({ ...newPersona, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Persona Prompt *
              </label>
              <Textarea
                placeholder="The AI persona prompt..."
                value={newPersona.prompt}
                onChange={(e) =>
                  setNewPersona({ ...newPersona, prompt: e.target.value })
                }
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Description (optional)
              </label>
              <Input
                placeholder="Brief description of when to use this persona"
                value={newPersona.description}
                onChange={(e) =>
                  setNewPersona({ ...newPersona, description: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={newPersona.is_default}
                onChange={(e) =>
                  setNewPersona({ ...newPersona, is_default: e.target.checked })
                }
                className="h-4 w-4"
              />
              <label htmlFor="is_default" className="text-sm">
                Set as default persona
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePersona} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Persona'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Personas Dialog */}
      {personas.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Manage
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Manage Saved Personas</DialogTitle>
              <DialogDescription>
                View, delete, or set default personas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{persona.name}</h4>
                        {persona.is_default && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {persona.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {persona.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {persona.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {!persona.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(persona.id)}
                          disabled={isLoading}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePersona(persona.id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
