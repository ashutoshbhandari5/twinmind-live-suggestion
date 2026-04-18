"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { children: string };

// Constrained markdown renderer. The model's output is untrusted so we
// disable raw HTML and drop image/iframe/script elements entirely. Links
// are forced to open in a new tab with noopener,noreferrer.
export function AssistantMarkdown({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        a: ({ href, children: c }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            {c}
          </a>
        ),
        img: () => null,
        p: ({ children: c }) => (
          <p className="mb-2 leading-relaxed last:mb-0">{c}</p>
        ),
        ul: ({ children: c }) => (
          <ul className="mb-2 list-disc pl-6 last:mb-0">{c}</ul>
        ),
        ol: ({ children: c }) => (
          <ol className="mb-2 list-decimal pl-6 last:mb-0">{c}</ol>
        ),
        li: ({ children: c }) => <li className="mb-1 last:mb-0">{c}</li>,
        code: ({ className, children: c }) => {
          const isBlock = (className ?? "").startsWith("language-");
          return isBlock ? (
            <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code className={className}>{c}</code>
            </pre>
          ) : (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{c}</code>
          );
        },
        h1: ({ children: c }) => (
          <h1 className="mb-2 text-base font-semibold">{c}</h1>
        ),
        h2: ({ children: c }) => (
          <h2 className="mb-2 text-sm font-semibold">{c}</h2>
        ),
        h3: ({ children: c }) => (
          <h3 className="mb-2 text-sm font-semibold">{c}</h3>
        ),
        h4: ({ children: c }) => (
          <h4 className="mb-2 text-sm font-semibold">{c}</h4>
        ),
        blockquote: ({ children: c }) => (
          <blockquote className="my-2 border-l-2 border-border pl-3 italic">
            {c}
          </blockquote>
        ),
        table: ({ children: c }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">{c}</table>
          </div>
        ),
        th: ({ children: c }) => (
          <th className="border border-border bg-muted/40 px-2 py-1 text-left">
            {c}
          </th>
        ),
        td: ({ children: c }) => (
          <td className="border border-border px-2 py-1">{c}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
