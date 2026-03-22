'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import ContextDrawer from './components/ContextDrawer';
import { RegimeBadge, ConversationList } from './components/DataCards';
import type { SSEMessage } from '@/lib/types';

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

interface ConversationMeta {
  id: string;
  title: string;
  updated_at: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentTriggerStatus[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [regime, setRegime] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const hasAuth = document.cookie.includes('atd_auth=true');
    if (!hasAuth) {
      router.push('/');
    }
  }, [router]);

  // Load conversations and regime on mount
  useEffect(() => {
    loadConversations();
    loadRegime();
  }, []);

  async function loadConversations() {
    try {
      const res = await fetch('/api/github/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '_conversations_placeholder' }),
      });
      // For now, conversations come from Supabase through a dedicated endpoint
      // This is a stub — we'll load from the chat API response
    } catch {
      // Silent fail
    }
  }

  async function loadRegime() {
    try {
      const res = await fetch('/api/github/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'state/regime.json' }),
      });
      const { content } = await res.json();
      setRegime(content);
    } catch {
      // Silent fail
    }
  }

  async function loadConversation(convId: string) {
    setConversationId(convId);
    setMessages([]);
    // Messages would be loaded from Supabase via API
    // For now, start fresh per conversation
    setSidebarOpen(false);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setIsWaiting(true);
      setStreamingContent('');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, conversationId }),
        });

        if (!res.ok) {
          throw new Error(`Chat API returned ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data: SSEMessage = JSON.parse(line.slice(6));

              if (data.type === 'text' && data.text) {
                fullText += data.text;
                setIsWaiting(false);
                setStreamingContent(fullText);
              } else if (data.type === 'tool_status' && data.tool) {
                const isTrigger = data.tool.startsWith('trigger_');
                if (isTrigger) {
                  setAgentStatuses((prev) => [
                    ...prev.filter((s) => s.tool !== data.tool),
                    {
                      tool: data.tool!,
                      status: (data.status as 'running' | 'complete') || 'running',
                      timestamp: Date.now(),
                    },
                  ]);
                }
              } else if (data.type === 'done') {
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                }
              } else if (data.type === 'error') {
                fullText += `\n\n*Error: ${data.error}*`;
                setStreamingContent(fullText);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Finalise: move streaming content to a proper message
        if (fullText) {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fullText,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (error) {
        const errMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, something went wrong. ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsStreaming(false);
        setIsWaiting(false);
        setStreamingContent('');
      }
    },
    [isStreaming, conversationId]
  );

  return (
    <div className="h-[100dvh] flex bg-bg">
      {/* Sidebar — desktop */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-white">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-plum-deep">AI Trader Dude</h1>
        </div>
        <ConversationList
          conversations={conversations}
          currentId={conversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-40 md:hidden transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-lg font-bold text-plum-deep">AI Trader Dude</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg"
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
        <ConversationList
          conversations={conversations}
          currentId={conversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
          {/* Hamburger — mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg"
          >
            <svg
              className="w-5 h-5 text-text"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <h1 className="text-base font-semibold text-plum-deep md:hidden">
            ATD
          </h1>

          <div className="flex-1 flex items-center gap-2">
            <RegimeBadge regime={regime} />
          </div>

          {/* Context button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg transition-colors"
            title="View context"
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
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </button>
        </header>

        {/* Chat */}
        <ChatArea
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          isWaiting={isWaiting}
          agentStatuses={agentStatuses}
        />

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </div>

      {/* Context drawer */}
      <ContextDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
