"use client";

import { useRef, useEffect, useState } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Badge } from "@/components/ui/badge";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  onVariablesChange: (variables: string[]) => void;
  height?: string;
}

export function PromptEditor({
  value,
  onChange,
  variables,
  onVariablesChange,
  height = "300px",
}: PromptEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const varName = match[1].trim();
      if (!vars.includes(varName)) {
        vars.push(varName);
      }
    }
    return vars;
  };

  const handleEditorChange = (newValue: string | undefined) => {
    const content = newValue || "";
    onChange(content);
    const newVars = extractVariables(content);
    if (JSON.stringify(newVars) !== JSON.stringify(variables)) {
      onVariablesChange(newVars);
    }
  };

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    // Define custom language for prompt highlighting
    monaco.languages.register({ id: "prompt" });

    monaco.languages.setMonarchTokensProvider("prompt", {
      tokenizer: {
        root: [
          [/\{\{[^}]+\}\}/, "variable"],
        ],
      },
    });

    // Define custom theme
    monaco.editor.defineTheme("promptTheme", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "variable", foreground: "61AFEF", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
      },
    });

    monaco.editor.setTheme("promptTheme");
  };

  if (!mounted) {
    return (
      <div
        className="bg-[#0a0a0a] rounded-lg border border-border animate-pulse"
        style={{ height }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border overflow-hidden">
        <Editor
          height={height}
          language="prompt"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: "auto",
              horizontal: "hidden",
            },
          }}
          theme="promptTheme"
        />
      </div>
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Variables:</span>
          {variables.map((v) => (
            <Badge key={v} variant="secondary" className="text-xs">
              {`{{${v}}}`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
