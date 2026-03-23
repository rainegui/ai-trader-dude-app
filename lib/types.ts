export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  summary?: string;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview?: string;
}

export interface AgentOutput {
  agent: string;
  version: string;
  generated_at: string;
  run_type: 'scheduled' | 'ad_hoc' | 'breaking';
  run_id: string;
  summary: string;
  payload: Record<string, unknown>;
  signals: unknown[];
  meta: {
    data_sources_used: string[];
    data_freshness: string;
    tokens_consumed: number;
    errors: string[];
  };
}

export interface Portfolio {
  positions: Position[];
  cash: Record<string, number>;
  updated_at: string;
}

export interface Position {
  ticker: string;
  name: string;
  shares: number;
  avg_cost: number;
  current_price?: number;
  market: 'US' | 'ASX' | 'LSE';
}

export interface Theme {
  id: string;
  name: string;
  status: 'active' | 'closed' | 'watching';
  thesis: string;
  tickers: string[];
  entry_criteria: string;
  exit_criteria: string;
  created_at: string;
}

export interface SSEMessage {
  type: 'text' | 'done' | 'error' | 'tool_status';
  text?: string;
  conversationId?: string;
  error?: string;
  tool?: string;
  status?: string;
  result?: unknown;
}

export interface MemoryEntry {
  key: string;
  value: unknown;
}

export interface TriggerRequest {
  agents: string[];
  cycle?: string;
  context?: string;
}
