"use client";

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Code, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type CodeNodeData = {
  code?: string;
  language?: string;
  title?: string;
};

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'plaintext', label: 'Plain Text' },
];

function CodeNode({ data, selected }: NodeProps<CodeNodeData>) {
  const [code, setCode] = useState(data.code ?? '// Enter your code here');
  const [language, setLanguage] = useState(data.language ?? 'javascript');
  const [title, setTitle] = useState(data.title ?? '');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(!data.code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const updateCode = (newCode: string) => {
    setCode(newCode);
    data.code = newCode;
  };

  const updateLanguage = (newLang: string) => {
    setLanguage(newLang);
    data.language = newLang;
  };

  const updateTitle = (newTitle: string) => {
    setTitle(newTitle);
    data.title = newTitle;
  };

  return (
    <div
      className={cn(
        "bg-background border-2 rounded-lg overflow-hidden min-w-[350px] max-w-[600px]",
        selected ? "border-primary shadow-lg" : "border-border"
      )}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1">
          <Code className="h-4 w-4 text-primary" />
          {editing ? (
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              className="text-sm font-medium bg-transparent border-none outline-none flex-1"
            />
          ) : (
            <span className="text-sm font-medium">
              {title || 'Code Snippet'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={updateLanguage}>
            <SelectTrigger className="h-7 text-xs w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Code Editor/Display */}
      {editing ? (
        <div className="p-3">
          <Textarea
            value={code}
            onChange={(e) => updateCode(e.target.value)}
            onBlur={() => setEditing(false)}
            className="font-mono text-xs min-h-[200px] max-h-[400px]"
            autoFocus
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Double-click to edit • Press Tab to indent
          </p>
        </div>
      ) : (
        <pre className="p-3 overflow-x-auto max-h-[400px] text-xs font-mono bg-muted/20">
          <code className={cn("language-" + language)}>
            {code}
          </code>
        </pre>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(CodeNode);
