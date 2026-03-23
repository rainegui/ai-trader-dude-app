'use client';

import { useState, useEffect } from 'react';

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  economist: 'Economist',
  'news-scout': 'News Scout',
  'game-theory': 'Game Theory',
  technical: 'Technical Analyst',
  coordinator: 'Coordinator',
};

export interface AgentRunState {
  agents: string[];
  triggeredAt: number;
  complete: boolean;
}

const LS_KEY = 'atd_agent_run';

export function loadAgentRun(): AgentRunState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentRunState;
    // Auto-expire after 30 minutes
    if (Date.now() - parsed.triggeredAt > 30 * 60 * 1000) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAgentRun(state: AgentRunState | null) {
  if (state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

function formatElapsed(triggeredAt: number): string {
  const seconds = Math.floor((Date.now() - triggeredAt) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

interface AgentRunStatusBarProps {
  runState: AgentRunState;
  onCheckResults: () => void;
  onDismiss: () => void;
}

export default function AgentRunStatusBar({
  runState,
  onCheckResults,
  onDismiss,
}: AgentRunStatusBarProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(runState.triggeredAt));

  // Update timer every 30 seconds
  useEffect(() => {
    setElapsed(formatElapsed(runState.triggeredAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(runState.triggeredAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [runState.triggeredAt]);

  const agentNames = runState.agents
    .map((a) => AGENT_DISPLAY_NAMES[a] || a)
    .join(', ');

  return (
    <div className="sticky top-0 z-10 border-b border-plum/15 bg-plum-light px-4 py-2.5 flex items-center gap-3 flex-wrap"
      style={{ borderLeft: '3px solid var(--color-plum)' }}
    >
      <div className="flex-1 min-w-0">
        {runState.complete ? (
          <p className="text-[13px] text-text leading-snug">
            <span className="mr-1.5">&#x2705;</span>
            <span className="font-medium">Agents complete</span>
            <span className="text-muted"> — results ready</span>
          </p>
        ) : (
          <>
            <p className="text-[13px] text-text leading-snug">
              <span className="mr-1.5">&#x1F504;</span>
              <span className="font-medium">Agents running:</span>{' '}
              {agentNames}
            </p>
            <p className="text-[12px] font-mono text-[#9a8a9e] mt-0.5">
              Started {elapsed} — estimated 10-15 minutes
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onCheckResults}
          className="text-[13px] text-plum font-medium underline underline-offset-2 hover:text-plum-deep transition-colors cursor-pointer"
        >
          {runState.complete ? 'Show results' : 'Check results'}
        </button>
        <button
          onClick={onDismiss}
          className="text-[13px] text-muted hover:text-text transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
