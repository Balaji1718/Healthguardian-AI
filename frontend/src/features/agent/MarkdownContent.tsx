import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Clean, safe Markdown renderer for conversational health responses.
 * Renders paragraphs, lists, bold/italics, headings, tables, and blockquotes
 * without executing arbitrary HTML or leaking raw tool tags/JSON.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null;

  // Sanitize content from raw XML tags or JSON action leaks
  const cleanContent = content
    .replace(/<[^>]+>/g, "")
    .replace(/\{\s*"action"\s*:[^}]+\}/g, "")
    .trim();

  const blocks = cleanContent.split(/\n{2,}/);

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-foreground", className)}>
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading 3: ### Heading
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={index} className="pt-2 font-semibold text-foreground text-sm tracking-tight">
              {formatInlineText(trimmed.replace(/^###\s+/, ""))}
            </h4>
          );
        }

        // Heading 2 / 1: ## Heading or # Heading
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <h3 key={index} className="pt-2 font-semibold text-foreground text-base tracking-tight">
              {formatInlineText(trimmed.replace(/^#+\s+/, ""))}
            </h3>
          );
        }

        // Blockquote: > text
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-primary/50 bg-primary/5 pl-3 py-1 text-xs text-muted-foreground italic rounded-r"
            >
              {formatInlineText(trimmed.replace(/^>\s+/, ""))}
            </blockquote>
          );
        }

        // Table detection: starts with | and has |
        if (trimmed.includes("|") && trimmed.split("\n").some((l) => l.startsWith("|"))) {
          const lines = trimmed.split("\n").filter((l) => l.trim().startsWith("|"));
          const tableRows = lines
            .filter((l) => !/^[|\s-:]+$/.test(l)) // filter out separator row
            .map((l) =>
              l
                .split("|")
                .map((c) => c.trim())
                .filter(Boolean),
            );

          if (tableRows.length > 0) {
            const [headers, ...rows] = tableRows;
            if (!headers) return null;
            return (
              <div key={index} className="my-2 overflow-x-auto rounded border bg-card text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {headers.map((h, hi) => (
                        <th key={hi} className="px-3 py-1.5 font-medium">
                          {formatInlineText(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b last:border-0 hover:bg-muted/20">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-muted-foreground">
                            {formatInlineText(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Unordered list: lines starting with -, *, •
        if (/^(\s*[-*•]|\s*\d+\.)\s+/m.test(trimmed)) {
          const lines = trimmed.split("\n");
          return (
            <ul key={index} className="my-1.5 space-y-1 pl-4 list-disc marker:text-primary/70">
              {lines.map((line, li) => {
                const lineTrimmed = line.trim();
                if (!lineTrimmed) return null;
                const cleanLine = lineTrimmed.replace(/^(\s*[-*•]|\s*\d+\.)\s+/, "");
                return (
                  <li key={li} className="leading-normal">
                    {formatInlineText(cleanLine)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // Regular paragraph
        return (
          <p key={index} className="leading-relaxed">
            {formatInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Formats inline bold, italics, inline code, and clean quotes.
 */
function formatInlineText(text: string): React.ReactNode {
  // Split by inline code first: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((codePart, i) => {
    if (codePart.startsWith("`") && codePart.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground font-medium"
        >
          {codePart.slice(1, -1)}
        </code>
      );
    }

    // Process bold (**text**) and italics (*text*)
    const boldParts = codePart.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((boldPart, j) => {
      if (boldPart.startsWith("**") && boldPart.endsWith("**")) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold text-foreground">
            {boldPart.slice(2, -2)}
          </strong>
        );
      }

      // Check for inline source citations e.g. [1], [2], [Source]
      const citationParts = boldPart.split(/(\[\d+\]|\[Source:\s*[^\]]+\])/g);
      return citationParts.map((citPart, k) => {
        if (/^\[\d+\]$/.test(citPart)) {
          return (
            <span
              key={`${i}-${j}-${k}`}
              className="inline-flex items-center justify-center text-[10px] font-bold text-primary bg-primary/10 px-1 py-0.2 mx-0.5 rounded"
            >
              {citPart.slice(1, -1)}
            </span>
          );
        }
        return citPart;
      });
    });
  });
}
