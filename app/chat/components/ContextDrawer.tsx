'use client';

import { useState, useEffect } from 'react';

interface ContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SectionData {
  portfolio: string | null;
  themes: string | null;
  watchlist: string | null;
}

export default function ContextDrawer({ isOpen, onClose }: ContextDrawerProps) {
  const [data, setData] = useState<SectionData>({
    portfolio: null,
    themes: null,
    watchlist: null,
  });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    portfolio: true,
    themes: true,
    watchlist: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  async function fetchData() {
    setLoading(true);
    try {
      const [portfolio, themes, watchlist] = await Promise.all([
        fetchFile('state/portfolio.json'),
        fetchFile('state/active-themes.json'),
        fetchFile('state/watchlist.json'),
      ]);
      setData({ portfolio, themes, watchlist });
    } catch {
      // Leave data as null
    }
    setLoading(false);
  }

  async function fetchFile(path: string): Promise<string | null> {
    try {
      const res = await fetch('/api/github/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const { content } = await res.json();
      return content;
    } catch {
      return null;
    }
  }

  function toggleSection(section: string) {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function renderJson(raw: string | null, label: string) {
    if (!raw) return <p className="text-muted text-xs">No {label} data</p>;
    try {
      const parsed = JSON.parse(raw);
      return (
        <pre className="text-xs font-mono text-text bg-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <pre className="text-xs font-mono text-muted">{raw}</pre>;
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-plum-deep">Context</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg transition-colors"
          >
            <svg
              className="w-5 h-5 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-57px)] p-4 space-y-3">
          {loading && (
            <p className="text-muted text-sm text-center py-4">Loading...</p>
          )}

          {/* Portfolio */}
          <Section
            title="Portfolio"
            expanded={expanded.portfolio}
            onToggle={() => toggleSection('portfolio')}
          >
            {renderJson(data.portfolio, 'portfolio')}
          </Section>

          {/* Active Themes */}
          <Section
            title="Active Themes"
            expanded={expanded.themes}
            onToggle={() => toggleSection('themes')}
          >
            {renderJson(data.themes, 'themes')}
          </Section>

          {/* Watchlist */}
          <Section
            title="Watchlist"
            expanded={expanded.watchlist}
            onToggle={() => toggleSection('watchlist')}
          >
            {renderJson(data.watchlist, 'watchlist')}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-bg hover:bg-plum-light/30 transition-colors"
      >
        <span className="text-sm font-medium text-plum-deep">{title}</span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {expanded && <div className="p-3 border-t border-border">{children}</div>}
    </div>
  );
}
