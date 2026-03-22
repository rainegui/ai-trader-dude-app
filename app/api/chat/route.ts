import Anthropic from '@anthropic-ai/sdk';
import { getClaudeClient } from '@/lib/claude';
import { buildSystemPrompt } from '@/lib/system-prompt';
import {
  saveMessage,
  getConversationMessages,
  createConversation,
} from '@/lib/supabase';
import {
  triggerAgentRun,
  triggerFullCycle,
  getRunStatus,
} from '@/lib/agent-server';
import { readGitHubFile } from '@/lib/github';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Custom tool definitions for ATD capabilities
const customTools: Anthropic.Tool[] = [
  {
    name: 'trigger_agent_run',
    description:
      'Trigger specific AI Trader Dude agents to run on the VPS. Use this when you need fresh analysis — e.g. "Let me run the Technical Analyst on CRWD" or "I\'ll get the Economist to check that data release." Available agents: economist, news-scout, game-theory, technical. You can trigger multiple agents at once.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agents: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Agent names to trigger. Valid values: "economist", "news-scout", "game-theory", "technical"',
        },
        context: {
          type: 'string',
          description:
            'Optional context for the agent run — e.g. "Analyse CRWD entry zone" or "AU CPI just dropped — reassess regime"',
        },
      },
      required: ['agents'],
    },
  },
  {
    name: 'trigger_full_cycle',
    description:
      'Trigger a full ATD cycle on the VPS (News Scout scan + Coordinator triage + specialist agents + email). Use sparingly — only when Raine asks for a full refresh or a complete cycle run.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cycle: {
          type: 'string',
          enum: ['MORNING', 'EVENING', 'WEEKEND'],
          description: 'Which cycle to run. Defaults to context-appropriate.',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_agent_status',
    description:
      'Check the status of a previously triggered agent run. Use the run_id returned from trigger_agent_run or trigger_full_cycle.',
    input_schema: {
      type: 'object' as const,
      properties: {
        run_id: {
          type: 'string',
          description: 'The run ID to check status for',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'read_github_file',
    description:
      'Read a file from the AI-Trader-Dude GitHub repo. Use when you need the full contents of an agent output, state file, or knowledge base file that isn\'t already in your system prompt. Common paths: outputs/economist/latest.json, outputs/news-scout/latest.json, outputs/game-theory/latest.json, outputs/technical/latest.json, state/portfolio.json, state/active-themes.json, state/watchlist.json',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path within the repo (e.g. "outputs/economist/latest.json")',
        },
      },
      required: ['path'],
    },
  },
];

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'trigger_agent_run': {
      const agents = toolInput.agents as string[];
      const context = toolInput.context as string | undefined;
      try {
        const result = await triggerAgentRun({ agents, context });
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to trigger agents',
        });
      }
    }

    case 'trigger_full_cycle': {
      const cycle = toolInput.cycle as string | undefined;
      try {
        const result = await triggerFullCycle(cycle);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to trigger full cycle',
        });
      }
    }

    case 'check_agent_status': {
      const runId = toolInput.run_id as string;
      try {
        const result = await getRunStatus(runId);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to check status',
        });
      }
    }

    case 'read_github_file': {
      const path = toolInput.path as string;
      try {
        const content = await readGitHubFile(path);
        if (content === null) {
          return JSON.stringify({ error: `File not found: ${path}` });
        }
        return content;
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to read file',
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      try {
        convId = await createConversation(message.substring(0, 100));
      } catch {
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

    const anthropic = getClaudeClient();
    const encoder = new TextEncoder();

    // Build messages for the API — supports multi-turn tool use
    let messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        const MAX_TOOL_ROUNDS = 5;

        try {
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await anthropic.messages.create({
              model: 'claude-opus-4-6',
              max_tokens: 4096,
              system: systemPrompt,
              tools: [
                {
                  type: 'web_search_20250305' as const,
                  name: 'web_search',
                  max_uses: 5,
                },
                ...customTools,
              ],
              messages,
            });

            // Process content blocks
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            let hasToolUse = false;

            for (const block of response.content) {
              if (block.type === 'text') {
                fullResponse += block.text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`
                  )
                );
              } else if (block.type === 'tool_use') {
                hasToolUse = true;

                // Notify client that a tool is being called
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_status',
                      tool: block.name,
                      status: 'running',
                    })}\n\n`
                  )
                );

                // Execute the tool
                const result = await handleToolCall(
                  block.name,
                  block.input as Record<string, unknown>
                );

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                });

                // Notify client that the tool completed
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_status',
                      tool: block.name,
                      status: 'complete',
                    })}\n\n`
                  )
                );
              }
            }

            // If no tool use, we're done
            if (!hasToolUse || response.stop_reason === 'end_turn') {
              break;
            }

            // Append assistant response + tool results for the next round
            messages = [
              ...messages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ];
          }

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
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
            )
          );
        }

        controller.close();
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
