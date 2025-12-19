"use client";

import { useRef, useEffect, useState } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  placeholder?: string;
}

export function JsonEditor({
  value,
  onChange,
  height = "200px",
}: JsonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFormat = () => {
    setFormatError(null);

    // Replace variables with placeholders before parsing
    const placeholders: Record<string, string> = {};
    let placeholderIndex = 0;
    const valueWithPlaceholders = value.replace(/\{\{([^}]+)\}\}/g, (match) => {
      const placeholder = `"__PLACEHOLDER_${placeholderIndex}__"`;
      placeholders[placeholder] = match;
      placeholderIndex++;
      return placeholder;
    });

    try {
      const parsed = JSON.parse(valueWithPlaceholders);
      let formatted = JSON.stringify(parsed, null, 2);

      // Restore variables
      Object.entries(placeholders).forEach(([placeholder, original]) => {
        formatted = formatted.replace(placeholder, original);
      });

      onChange(formatted);
    } catch (e) {
      setFormatError("Invalid JSON - cannot format");
      setTimeout(() => setFormatError(null), 3000);
    }
  };

  const handleEditorChange = (newValue: string | undefined) => {
    onChange(newValue || "");
  };

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    // Register custom language for JSON with variables
    monaco.languages.register({ id: "json-template" });

    monaco.languages.setMonarchTokensProvider("json-template", {
      tokenizer: {
        root: [
          [/\{\{[^}]+\}\}/, "variable"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
          [/[{}[\]]/, "@brackets"],
          [/[,:]/, "delimiter"],
          [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],
          [/\b(true|false)\b/, "keyword"],
          [/\bnull\b/, "keyword"],
          [/\s+/, "white"],
        ],
        string: [
          [/\{\{[^}]+\}\}/, "variable"],
          [/[^\\"{{]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        ],
      },
    });

    // Define custom theme
    monaco.editor.defineTheme("jsonTemplateTheme", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "variable", foreground: "61AFEF", fontStyle: "bold" },
        { token: "string", foreground: "98C379" },
        { token: "string.quote", foreground: "98C379" },
        { token: "string.escape", foreground: "D19A66" },
        { token: "number", foreground: "D19A66" },
        { token: "keyword", foreground: "E06C75" },
        { token: "delimiter", foreground: "ABB2BF" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
      },
    });

    monaco.editor.setTheme("jsonTemplateTheme");
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
    <div className="relative rounded-lg border border-border overflow-hidden">
      <Editor
        height={height}
        language="json-template"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          formatOnPaste: true,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          tabSize: 2,
          scrollbar: {
            vertical: "auto",
            horizontal: "hidden",
          },
        }}
        theme="jsonTemplateTheme"
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {formatError && (
          <span className="text-xs text-destructive bg-background/80 px-2 py-1 rounded">
            {formatError}
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleFormat}
          disabled={!value.trim()}
          className="h-7 text-xs"
        >
          <Wand2 className="h-3 w-3 mr-1" />
          Format
        </Button>
      </div>
    </div>
  );
}
