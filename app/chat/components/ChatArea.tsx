'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAreaProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
}

export default function ChatArea({
  messages,
  streamingContent,
  isStreaming,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

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
              G&apos;day.
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

        {/* Streaming message */}
        {isStreaming && (
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
