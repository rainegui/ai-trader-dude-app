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
    .limit(40);
  return (data as Message[]) || [];
}

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string
): Promise<void> {
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role,
    content,
  });

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
  limit = 10
): Promise<Conversation[]> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data as Conversation[]) || [];
}
