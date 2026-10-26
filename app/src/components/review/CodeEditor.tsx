import { useRef } from "react";

type TokenKind = "plain" | "keyword" | "string" | "comment" | "number";

const tokenClass: Record<TokenKind, string> = {
  plain: "text-[#172033]",
  keyword: "text-[#4F46E5]",
  string: "text-[#0F766E]",
  comment: "text-[#94A3B8]",
  number: "text-[#B45309]",
};

function tokenKind(text: string): TokenKind {
  if (text.startsWith("//") || text.startsWith("/*")) return "comment";
  if (text.startsWith("'") || text.startsWith('"') || text.startsWith("`") || text.startsWith("/")) return "string";
  if (/^\d/.test(text)) return "number";
  return "keyword";
}

function tokenize(code: string): { kind: TokenKind; text: string }[] {
  const pattern =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\/(?:\\.|[^/\n])+\/[gimsuy]*|\b(?:const|let|var|function|return|if|else|await|async|new|class|import|from|export|typeof|interface|type|of|in)\b|\b\d+(?:\.\d+)?\b/g;
  const tokens: { kind: TokenKind; text: string }[] = [];
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: "plain", text: code.slice(last, index) });
    const text = match[0];
    tokens.push({ kind: tokenKind(text), text });
    last = index + text.length;
  }
  if (last < code.length) tokens.push({ kind: "plain", text: code.slice(last) });
  return tokens;
}

export function CodeEditor({
  code,
  onChange,
  readOnly,
  highlightedLines = [],
}: {
  code: string;
  onChange: (code: string) => void;
  readOnly: boolean;
  highlightedLines?: readonly number[];
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const lineCount = code.length === 0 ? 1 : code.split("\n").length;
  const tokens = tokenize(code);
  const marked = new Set(highlightedLines);

  function syncScroll(): void {
    const text = textRef.current;
    const gutterNode = gutterRef.current;
    const highlight = highlightRef.current;
    const bands = bandRef.current;
    if (text === null || gutterNode === null || highlight === null || bands === null) return;
    gutterNode.scrollTop = text.scrollTop;
    highlight.scrollTop = text.scrollTop;
    highlight.scrollLeft = text.scrollLeft;
    bands.scrollTop = text.scrollTop;
  }

  return (
    <div className="grid h-[32rem] grid-cols-[3.25rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-[#F8FAFC]">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="overflow-hidden border-r border-line py-3 text-right text-xs leading-6"
      >
        {Array.from({ length: lineCount }, (_, index) => {
          const line = index + 1;
          const active = marked.has(line);
          return (
            <div key={line} className={active ? "bg-amber-100 px-2 text-amber-800" : "px-2 text-slate-400"}>
              {line}
            </div>
          );
        })}
      </div>
      <div className="relative min-w-0">
        <div ref={bandRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {highlightedLines.map((line) => (
            <span
              key={line}
              className="absolute left-0 right-0 bg-amber-100/80"
              style={{ top: `${12 + (line - 1) * 24}px`, height: "24px" }}
            />
          ))}
        </div>
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="editor-highlight pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 py-3 text-xs leading-6"
        >
          {code.length === 0
            ? " "
            : tokens.map((token, index) => (
                <span key={`${index}-${token.text.length}`} className={tokenClass[token.kind]}>
                  {token.text}
                </span>
              ))}
        </pre>
        <textarea
          ref={textRef}
          value={code}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Paste JavaScript or TypeScript"
          onScroll={syncScroll}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Source code"
          className="relative h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-xs leading-6 text-transparent caret-[#172033]"
          maxLength={20000}
        />
      </div>
    </div>
  );
}
