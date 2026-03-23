'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import AgentRunStatusBar from './AgentRunStatusBar';
import type { AgentRunState } from './AgentRunStatusBar';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileAttached?: {
    name: string;
    type: string;
  };
}

interface AgentTriggerStatus {
  tool: string;
  status: 'running' | 'complete';
  timestamp: number;
}

interface ChatAreaProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  isWaiting?: boolean;
  hasFileAttachment?: boolean;
  agentStatuses?: AgentTriggerStatus[];
  onFileDrop?: (file: File) => void;
  agentRun?: AgentRunState | null;
  onCheckResults?: () => void;
  onDismissAgentRun?: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  trigger_agent_run: 'Agent Run',
  trigger_full_cycle: 'Full Cycle',
};

function AgentStatusCard({ statuses }: { statuses: AgentTriggerStatus[] }) {
  if (statuses.length === 0) return null;

  // Only show the most recent trigger
  const latest = statuses[statuses.length - 1];
  const label = TOOL_LABELS[latest.tool] || latest.tool;
  const isComplete = latest.status === 'complete';

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 bg-plum-deep/5 border border-plum/20 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{isComplete ? '✓' : '🔄'}</span>
          <span className="font-semibold text-plum-deep">
            {isComplete ? 'Triggered' : 'Triggering'}: {label}
          </span>
        </div>
        <p className="text-muted text-xs leading-relaxed">
          {isComplete
            ? 'Agents are running on the server. Ask me for results in a few minutes.'
            : 'Sending request to agent server...'}
        </p>
      </div>
    </div>
  );
}

export default function ChatArea({
  messages,
  streamingContent,
  isStreaming,
  isWaiting = false,
  hasFileAttachment = false,
  agentStatuses = [],
  onFileDrop,
  agentRun,
  onCheckResults,
  onDismissAgentRun,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, agentStatuses]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file && onFileDrop) {
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  // Determine thinking text
  const thinkingText = hasFileAttachment
    ? '\u{1F4CE} Processing file...'
    : undefined;

  return (
    <div
      className={`flex-1 overflow-y-auto chat-scroll px-4 py-6 relative transition-colors ${
        isDragging ? 'bg-plum-light/20' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Agent run status bar — sticky at top of chat area */}
      {agentRun && onCheckResults && onDismissAgentRun && (
        <AgentRunStatusBar
          runState={agentRun}
          onCheckResults={onCheckResults}
          onDismiss={onDismissAgentRun}
        />
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-4 border-2 border-dashed border-plum/40 rounded-2xl flex items-center justify-center bg-plum-light/10 z-10 pointer-events-none">
          <div className="text-center">
            <svg
              className="w-10 h-10 text-plum/50 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-plum font-medium">
              Drop file to attach
            </p>
            <p className="text-xs text-muted mt-0.5">
              Images or PDFs, up to 3MB
            </p>
          </div>
        </div>
      )}

      <div className="max-w-[640px] mx-auto">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-plum-light mb-6">
              <svg
                className="w-10 h-10 text-plum"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-plum-deep mb-2">
              Hey Raine.
            </h2>
            <p className="text-muted text-sm max-w-xs">
              What are we looking at today? Ask me about markets, your
              portfolio, or a specific trade idea.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            fileAttached={msg.fileAttached}
          />
        ))}

        {/* Thinking indicator — visible while waiting for first token */}
        {isWaiting && agentStatuses.length === 0 && (
          <ThinkingIndicator statusText={thinkingText} />
        )}

        {/* Agent trigger status card */}
        {isStreaming && agentStatuses.length > 0 && (
          <AgentStatusCard statuses={agentStatuses} />
        )}

        {/* Streaming message — only show once content starts arriving */}
        {isStreaming && !isWaiting && (
          <MessageBubble
            role="assistant"
            content={streamingContent || ''}
            isStreaming={streamingContent.length === 0}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
