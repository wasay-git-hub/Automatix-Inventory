"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Sparkles, RefreshCw, AlertOctagon } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { renderMarkdown } from "@/lib/renderMarkdown";

export default function SuggestionsPage() {
  const { userRole, currentBranchName } = useApp();

  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scopeInstruction = userRole === 'HQ'
        ? "The operator is the HQ Operations Manager overseeing all branches. Cover every branch."
        : `The operator is the branch manager for ${currentBranchName} only. Scope every suggestion to ${currentBranchName} — only mention another branch if it's the source of a suggested inter-branch transfer into ${currentBranchName}.`;

      const message =
        `${scopeInstruction} I want ONLY sales-based suggestions for dealing with stock — nothing else. ` +
        `Do NOT include a business rules table, do NOT list full current inventory levels, and do NOT restate raw data or add any preamble/introduction. ` +
        `Always use the product's actual name (e.g. "Local Hummus 250g") — never a bare product ID or store ID number. ` +
        `Output only the following three sections, as short bullet points or compact tables: ` +
        `1) Suggested Reorders — product name, quantity, one-line reason based on recent sales velocity and the reorder multiplier (only products that are actually low on stock); ` +
        `2) Suggested Promotions — near-expiry product name and the discount to offer to clear them via sales; ` +
        `3) Suggested Inter-Branch Transfers — only if genuinely better than reordering (product name, quantity, from/to branch name). ` +
        `If a section has nothing to suggest, write a single line "None right now" under that section's heading instead of an empty or padded table. ` +
        `Keep the whole thing short — this is a quick login briefing, not a full audit report.`;

      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to generate suggestions.");

      setReport(json.reply);
    } catch (err: any) {
      setError(err.message || "Failed to generate suggestions.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, currentBranchName]);

  const hasAutoRunRef = useRef(false);
  useEffect(() => {
    // Guards against React Strict Mode's dev-only double-invoke of effects, which would otherwise
    // fire two concurrent requests against the same backend agent instance.
    if (hasAutoRunRef.current) return;
    hasAutoRunRef.current = true;
    runSuggestions();
    // Only auto-run once per page visit (e.g. right after login) — refresh button handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="action-card" style={{ minHeight: '480px' }}>
      <div className="action-header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} style={{ color: "var(--accent-gold)" }} />
          <h3>
            {userRole === 'HQ' ? "All-Branch Sales Suggestions" : `${currentBranchName} Sales Suggestions`}
          </h3>
        </div>
        <button
          onClick={runSuggestions}
          disabled={loading}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={12} style={loading ? { animation: 'spin 1.5s linear infinite' } : undefined} /> Refresh Suggestions
        </button>
      </div>

      <p className="action-desc">
        Generated automatically by the Automatix agent from live sales history — just the actionable calls: what to reorder, what to promote, and what to transfer.
      </p>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} style={{ color: "var(--accent-gold)", animation: 'spin 1.5s linear infinite' }} />
          <p style={{ fontSize: '0.85rem' }}>Analyzing recent sales trends...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert-message error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertOctagon size={14} />
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <div className="markdown-body">
          {renderMarkdown(report)}
        </div>
      )}
    </section>
  );
}
