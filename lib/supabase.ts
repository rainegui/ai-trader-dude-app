import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Message, Conversation, MemoryEntry } from './types';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase not configured');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  },
});

export async function createConversation(title: string): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data!.id;
}

export async function getConversationMessages(
  conversationId: string
): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  return (data as Message[]) || [];
}

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const row: Record<string, unknown> = {
    conversation_id: conversationId,
    role,
    content,
  };
  if (metadata) row.metadata = metadata;
  await supabase.from('messages').insert(row);

  // Update conversation's updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function getMemory(): Promise<string> {
  const { data } = await supabase.from('memory').select('key, value');
  if (!data || data.length === 0) return '';
  return (data as MemoryEntry[])
    .map((m) => `${m.key}: ${JSON.stringify(m.value)}`)
    .join('\n');
}

export async function getRecentConversations(
  limit = 50
): Promise<Conversation[]> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data as Conversation[]) || [];
}

export async function softDeleteConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ is_deleted: true })
    .eq('id', id);
  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'is_deleted' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
}

export async function getLastMessagePreview(
  conversationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return data[0].content.substring(0, 100);
}
