"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
// @ts-ignore — react-syntax-highlighter types may lag behind
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language?: string;
  showHeader?: boolean;
}

export function CodeBlock({ code, language = "text", showHeader = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="code-block">
      {showHeader && (
        <div className="code-block-header">
          <span className="code-block-lang">{language}</span>
          <button
            onClick={handleCopy}
            className="btn btn-ghost btn-sm"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check size={14} color="var(--color-success)" />
                <span style={{ color: "var(--color-success)", fontSize: "0.75rem" }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span style={{ fontSize: "0.75rem" }}>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem",
          fontSize: "0.8125rem",
          lineHeight: 1.7,
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
