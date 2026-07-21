import React from "react";

// Minimal markdown renderer shared across the chat widget and the Suggestions page
export function renderMarkdown(text: any) {
  if (!text) return null;
  const textStr = typeof text === "string"
    ? text
    : (text.raw && typeof text.raw === "string" ? text.raw : String(text));
  const lines = textStr.split("\n");
  return lines.map((line: string, idx: number) => {
    if (line.startsWith("# ")) {
      return <h1 key={idx} style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '20px', marginBottom: '10px', color: 'var(--accent-gold)' }}>{line.replace("# ", "")}</h1>;
    } else if (line.startsWith("## ")) {
      return <h2 key={idx} style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '18px', marginBottom: '8px', color: 'var(--accent-gold)' }}>{line.replace("## ", "")}</h2>;
    } else if (line.startsWith("### ")) {
      return <h3 key={idx} style={{ fontSize: '1rem', fontWeight: 600, marginTop: '14px', marginBottom: '6px', color: 'var(--text-heading)' }}>{line.replace("### ", "")}</h3>;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      return <li key={idx} style={{ marginLeft: '20px', listStyleType: 'disc', margin: '4px 0 4px 20px', color: 'var(--text-body)' }}>{line.substring(2)}</li>;
    } else if (line.trim().startsWith("|") && line.includes("---")) {
      return null;
    } else if (line.trim().startsWith("|")) {
      const cols = line.split("|").map((c: string) => c.trim()).filter((c: string) => c);
      const isHeader = (idx > 0 && lines[idx - 1] === "") || idx === 0;
      return (
        <div key={idx} style={{
          display: 'flex',
          gap: '16px',
          borderBottom: '1px solid var(--card-border)',
          padding: '8px 12px',
          background: isHeader ? 'var(--input-bg)' : 'var(--card-bg)'
        }}>
          {cols.map((col: string, colIdx: number) => (
            <span key={colIdx} style={{
              flex: 1,
              fontSize: isHeader ? '0.8rem' : '0.85rem',
              fontWeight: isHeader ? 700 : 400,
              color: isHeader ? 'var(--accent-gold)' : 'var(--text-body)',
              textTransform: isHeader ? 'uppercase' : 'none',
              letterSpacing: isHeader ? '0.03em' : 'normal'
            }}>{col}</span>
          ))}
        </div>
      );
    }
    if (line.trim() === "") return null;
    return <p key={idx} style={{ margin: '8px 0', color: 'var(--text-body)' }}>{line}</p>;
  });
}
