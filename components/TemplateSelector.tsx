"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Star, Trash2 } from 'lucide-react';

type Template = {
  id: string;
  name: string;
  description: string;
  content?: string;
  category: string;
  is_system: boolean;
  created_at: string;
  persona_prompt?: string;
  structure?: string;
};

type TemplateSelectorProps = {
  onSelectTemplate: (template: Template) => void;
};

export default function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'meetings',
    persona_prompt: '',
    structure: ''
  });

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'meetings', name: 'Meetings' },
    { id: 'development', name: 'Development' },
    { id: 'planning', name: 'Planning' },
    { id: 'education', name: 'Education' },
    { id: 'custom', name: 'My Templates' },
  ];

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    onSelectTemplate(template);
    setOpen(false);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : selectedCategory === 'custom'
    ? templates.filter(t => !t.is_system)
    : templates.filter(t => t.category === selectedCategory);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          {/* Categories Sidebar */}
          <div className="w-48 space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {category.name}
              </button>
            ))}
            <Button className="mt-3 w-full" size="sm" onClick={() => setCreateOpen(true)}>
              Create Template
            </Button>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates found
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="p-4 cursor-pointer hover:border-primary transition-colors group relative"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-medium text-sm">{template.name}</h3>
                      </div>
                      {template.is_system && (
                        <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                      )}
                      {!template.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    <div className="mt-3 text-xs">
                      <span className="inline-block px-2 py-1 bg-accent rounded-full">
                        {template.category}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Category (e.g., meetings, planning)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Textarea
              placeholder="Persona prompt (optional)"
              value={form.persona_prompt}
              onChange={(e) => setForm({ ...form, persona_prompt: e.target.value })}
            />
            <Textarea
              placeholder="Structure or starter content"
              value={form.structure}
              onChange={(e) => setForm({ ...form, structure: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  setCreating(true);
                  try {
                    const res = await fetch('/api/templates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(form),
                    });
                    if (res.ok) {
                      setCreateOpen(false);
                      await loadTemplates();
                    }
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating || !form.name.trim() || !form.category.trim() || !form.structure.trim()}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
