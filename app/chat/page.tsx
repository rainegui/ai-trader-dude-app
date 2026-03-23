'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import type { FileAttachment } from './components/InputBar';
import ContextDrawer from './components/ContextDrawer';
import { RegimeBadge, ConversationList } from './components/DataCards';
import type { ConversationEntry } from './components/DataCards';
import type { SSEMessage } from '@/lib/types';
import type { AgentRunState } from './components/AgentRunStatusBar';
import { loadAgentRun, saveAgentRun } from './components/AgentRunStatusBar';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileAttached?: {
    name: string;
    type: string;
  };
  report?: {
    title: string;
    url: string;
    format: string;
    expires: string;
  };
}

interface AgentTriggerStatus {
  tool: string;
  status: 'running' | 'complete';
  timestamp: number;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentTriggerStatus[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [regime, setRegime] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [pendingFile, setPendingFile] = useState<FileAttachment | null>(null);
  const [hasFileInFlight, setHasFileInFlight] = useState(false);
  const [agentRun, setAgentRun] = useState<AgentRunState | null>(null);

  // Auth check
  useEffect(() => {
    const hasAuth = document.cookie.includes('atd_auth=true');
    if (!hasAuth) {
      router.push('/');
    }
  }, [router]);

  // Load conversations, regime, and persisted agent run state on mount
  useEffect(() => {
    loadConversations();
    loadRegime();
    setAgentRun(loadAgentRun());
  }, []);

  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data);
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
    if (loadingConversation || convId === conversationId) {
      setSidebarOpen(false);
      return;
    }

    setLoadingConversation(true);
    setConversationId(convId);
    setMessages([]);
    setSidebarOpen(false);
    setAgentStatuses([]);

    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();

      const loadedMessages: ChatMessage[] = data.map(
        (m: { id: string; role: string; content: string; metadata?: Record<string, unknown> }) => {
          const meta = m.metadata as Record<string, unknown> | undefined;
          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            fileAttached: meta?.file_attached
              ? {
                  name: meta.file_name as string,
                  type: meta.file_type as string,
                }
              : undefined,
            report: meta?.report_generated
              ? {
                  title: meta.report_title as string,
                  url: meta.report_url as string,
                  format: meta.report_format as string,
                  expires: meta.report_expires as string,
                }
              : undefined,
          };
        }
      );

      setMessages(loadedMessages);
    } catch {
      // If we can't load messages, still switch to the conversation
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setAgentStatuses([]);
    setSidebarOpen(false);
  }

  async function deleteConversation(convId: string) {
    try {
      await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true }),
      });

      setConversations((prev) => prev.filter((c) => c.id !== convId));

      if (convId === conversationId) {
        startNewConversation();
      }
    } catch {
      // Silent fail
    }
  }

  const refreshConversationList = useCallback(
    (activeConvId: string, firstUserMessage?: string) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === activeConvId);
        if (existing) {
          return [
            {
              ...existing,
              updated_at: new Date().toISOString(),
              title: existing.title || firstUserMessage?.substring(0, 50) || 'New conversation',
            },
            ...prev.filter((c) => c.id !== activeConvId),
          ];
        } else {
          return [
            {
              id: activeConvId,
              title: firstUserMessage?.substring(0, 50) || 'New conversation',
              updated_at: new Date().toISOString(),
              last_message_preview: null,
            },
            ...prev,
          ];
        }
      });
    },
    []
  );

  // Handle file drops from ChatArea
  const handleFileDrop = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_FILE_SIZE) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;

      setPendingFile({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64Data,
        previewUrl,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const sendMessage = useCallback(
    async (content: string, file?: FileAttachment) => {
      if (isStreaming) return;

      // Use file from arg or from drag-and-drop pending
      const attachedFile = file || pendingFile;
      setPendingFile(null);

      const displayContent = content || (attachedFile ? `[Attached: ${attachedFile.name}]` : '');
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayContent,
        fileAttached: attachedFile
          ? { name: attachedFile.name, type: attachedFile.mimeType }
          : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setIsWaiting(true);
      setStreamingContent('');
      setHasFileInFlight(!!attachedFile);

      try {
        // Build request payload
        const payload: Record<string, unknown> = {
          message: content || 'Please analyse this file.',
          conversationId,
        };

        if (attachedFile) {
          payload.file = {
            name: attachedFile.name,
            mimeType: attachedFile.mimeType,
            size: attachedFile.size,
            base64Data: attachedFile.base64Data,
          };
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Chat API returned ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let pendingReport: ChatMessage['report'] | undefined;

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
                setHasFileInFlight(false);
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

                  // Persist agent run status bar state when we have agent names
                  if (data.agents?.length) {
                    const runState: AgentRunState = {
                      agents: data.agents,
                      triggeredAt: Date.now(),
                      complete: false,
                    };
                    setAgentRun(runState);
                    saveAgentRun(runState);
                  }
                }

                // Mark agents complete when check_agent_status or read_github_file completes
                if (
                  data.status === 'complete' &&
                  (data.tool === 'check_agent_status' || data.tool === 'read_github_file')
                ) {
                  setAgentRun((prev) => {
                    if (!prev || prev.complete) return prev;
                    const updated = { ...prev, complete: true };
                    saveAgentRun(updated);
                    return updated;
                  });
                }
              } else if (data.type === 'report_ready' && data.url) {
                pendingReport = {
                  title: data.title || 'Report',
                  url: data.url,
                  format: data.format || 'markdown',
                  expires: data.expires || '',
                };
              } else if (data.type === 'done') {
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                  const isFirst = !conversationId;
                  refreshConversationList(
                    data.conversationId,
                    isFirst ? (content || attachedFile?.name) : undefined
                  );
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

        if (fullText) {
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fullText,
            report: pendingReport,
          };
          setMessages((prev) => [...prev, assistantMsg]);

          if (conversationId) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      last_message_preview: fullText.substring(0, 100),
                      updated_at: new Date().toISOString(),
                    }
                  : c
              )
            );
          }
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
        setHasFileInFlight(false);
      }
    },
    [isStreaming, conversationId, pendingFile, refreshConversationList]
  );

  const handleDismissAgentRun = useCallback(() => {
    setAgentRun(null);
    saveAgentRun(null);
  }, []);

  const handleCheckResults = useCallback(() => {
    sendMessage('What have we got?');
  }, [sendMessage]);

  return (
    <div className="h-[100dvh] flex flex-col bg-bg">
      {/* ── Header ── spans full width ── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-plum-deep text-white flex-shrink-0 z-20">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <svg
            className="w-5 h-5"
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

        {/* Title — centred on mobile, hidden on desktop (title is in sidebar) */}
        <div className="md:hidden flex-1 text-center">
          <h1 className="text-base font-semibold">AI Trader Dude</h1>
        </div>

        {/* Desktop: regime badge in header (title is in sidebar) */}
        <div className="hidden md:flex flex-1 items-center gap-2">
          <RegimeBadge regime={regime} />
        </div>

        {/* Context toggle — hidden on wide desktop where panel is inline */}
        <button
          onClick={() => setDrawerOpen((prev) => !prev)}
          className="2lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title="View context"
        >
          <svg
            className="w-5 h-5"
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

      {/* ── Body: sidebar + chat + context ── */}
      <div className="flex-1 flex min-h-0">
        {/* ── Left sidebar — desktop (≥768px) ── */}
        <aside className="hidden md:flex w-[260px] flex-shrink-0 flex-col border-r border-[#e8e2e5] bg-[#faf7f5]">
          <div className="px-4 py-3 border-b border-[#e8e2e5]">
            <h2 className="text-base font-bold text-plum-deep">AI Trader Dude</h2>
          </div>
          <ConversationList
            conversations={conversations}
            currentId={conversationId}
            onSelect={loadConversation}
            onNew={startNewConversation}
            onDelete={deleteConversation}
          />
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed top-0 left-0 h-full w-72 bg-[#faf7f5] shadow-xl z-40 md:hidden flex flex-col transform transition-transform duration-250 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="px-4 py-3 border-b border-[#e8e2e5] flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-bold text-plum-deep">AI Trader Dude</h2>
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
            onDelete={deleteConversation}
          />
        </aside>

        {/* ── Centre: chat column ── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Chat messages — scrollable */}
          <ChatArea
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            isWaiting={isWaiting}
            hasFileAttachment={hasFileInFlight}
            agentStatuses={agentStatuses}
            onFileDrop={handleFileDrop}
            agentRun={agentRun}
            onCheckResults={handleCheckResults}
            onDismissAgentRun={handleDismissAgentRun}
          />

          {/* Input bar — bottom of chat column */}
          <InputBar onSend={sendMessage} disabled={isStreaming} />
        </main>

        {/* ── Right panel — desktop ≥1100px, inline context ── */}
        <aside className="hidden 2lg:flex w-[300px] flex-shrink-0 flex-col border-l border-[#e8e2e5] bg-white overflow-y-auto chat-scroll">
          <ContextDrawer isOpen={true} onClose={() => {}} inline />
        </aside>
      </div>

      {/* ── Mobile/tablet context drawer (overlay) — shown below 1100px ── */}
      <ContextDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inline={false}
      />
    </div>
  );
}
