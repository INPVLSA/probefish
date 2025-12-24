"use client";

import { useMemo } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { cn } from "@/lib/utils";

SyntaxHighlighter.registerLanguage("json", json);

// Create a transparent version of the theme
const transparentTheme = {
  ...atomOneDark,
  'hljs': {
    ...atomOneDark['hljs'],
    background: 'transparent',
    backgroundColor: 'transparent',
  },
};

interface PreformattedTextProps {
  content: string | null | undefined;
  fallback?: string;
  className?: string;
}

function isValidJson(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export function PreformattedText({ content, fallback = "No output", className }: PreformattedTextProps) {
  const displayContent = content || fallback;

  const { isJson, formattedContent } = useMemo(() => {
    if (!content) return { isJson: false, formattedContent: displayContent };
    const trimmed = content.trim();
    if (isValidJson(trimmed)) {
      return { isJson: true, formattedContent: formatJson(trimmed) };
    }
    return { isJson: false, formattedContent: content };
  }, [content, displayContent]);

  if (isJson) {
    return (
      <SyntaxHighlighter
        language="json"
        style={transparentTheme}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontSize: "0.875rem",
        }}
        className={cn("whitespace-pre-wrap", className)}
        wrapLongLines
      >
        {formattedContent}
      </SyntaxHighlighter>
    );
  }

  return (
    <pre className={cn("text-sm whitespace-pre-wrap", className)}>
      {displayContent}
    </pre>
  );
}
