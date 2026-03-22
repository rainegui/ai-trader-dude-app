'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  agentStatuses?: AgentTriggerStatus[];
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
      <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 bg-plum-deep/5 border border-plum/20 text-sm">
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
  agentStatuses = [],
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, agentStatuses]);

  return (
    <div className="flex-1 overflow-y-auto chat-scroll px-4 py-6">
      <div className="max-w-2xl mx-auto">
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
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {/* Thinking indicator — visible while waiting for first token */}
        {isWaiting && agentStatuses.length === 0 && <ThinkingIndicator />}

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
