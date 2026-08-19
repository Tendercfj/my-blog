import { CodeCopyButton } from "@/components/blog/code-copy-button";

export function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="code-frame">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-xs font-semibold text-white/60">{language}</span>
        <CodeCopyButton code={code} />
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}
