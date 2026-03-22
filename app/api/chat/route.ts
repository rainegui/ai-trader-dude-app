import { getClaudeClient } from '@/lib/claude';
import { buildSystemPrompt } from '@/lib/system-prompt';
import {
  saveMessage,
  getConversationMessages,
  createConversation,
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      try {
        convId = await createConversation(message.substring(0, 100));
      } catch {
        // Supabase unavailable — generate a temporary ID
        convId = `temp-${Date.now()}`;
      }
    }

    // Save user message
    try {
      await saveMessage(convId, 'user', message);
    } catch {
      // Continue without persistence
    }

    // Get conversation history
    let history: { role: string; content: string }[] = [];
    try {
      const messages = await getConversationMessages(convId);
      history = messages.map((m) => ({ role: m.role, content: m.content }));
    } catch {
      // No history available — just use the current message
      history = [{ role: 'user', content: message }];
    }

    // Ensure history ends with the current user message
    if (
      history.length === 0 ||
      history[history.length - 1].content !== message
    ) {
      history.push({ role: 'user', content: message });
    }

    // Build system prompt with fresh agent data
    let systemPrompt: string;
    try {
      systemPrompt = await buildSystemPrompt();
    } catch {
      systemPrompt =
        'You are AI Trader Dude (ATD), a trading strategist. Agent data is currently unavailable — work from your general knowledge and note that you cannot access live agent outputs right now.';
    }

    // Create streaming response
    const anthropic = getClaudeClient();

    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 5,
        },
      ],
      messages: history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        stream.on('text', (text) => {
          fullResponse += text;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', text })}\n\n`
            )
          );
        });

        stream.on('end', async () => {
          // Save assistant response
          try {
            await saveMessage(convId, 'assistant', fullResponse);
          } catch {
            // Continue without persistence
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`
            )
          );
          controller.close();
        });

        stream.on('error', (error: Error) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
            )
          );
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
