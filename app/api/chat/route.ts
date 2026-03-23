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

const TOOL_TIMEOUT_MS = 15000;

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
  {
    name: 'generate_report',
    description:
      'Generate a downloadable report document. Use when Raine asks for a written report, summary document, portfolio review, or any analysis she wants to save, share, or reference later.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Report title (e.g., "Portfolio Report — March 2026")',
        },
        content: {
          type: 'string',
          description:
            'Full report content in markdown format. Include headers, tables, bold text as needed.',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'markdown'],
          description:
            'Output format. Default to markdown unless PDF specifically requested.',
        },
      },
      required: ['title', 'content'],
    },
  },
];

async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = TOOL_TIMEOUT_MS
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Tool call timed out — agent server may be unreachable')),
      timeoutMs
    )
  );
  return Promise.race([fn(), timeout]);
}

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'trigger_agent_run': {
      const agents = toolInput.agents as string[];
      const context = toolInput.context as string | undefined;
      try {
        const result = await executeWithTimeout(() =>
          triggerAgentRun({ agents, context, cycle: 'ADHOC' })
        );
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to trigger agents',
          hint: 'Agent server may be unreachable. Work with existing outputs instead.',
        });
      }
    }

    case 'trigger_full_cycle': {
      const cycle = toolInput.cycle as string | undefined;
      try {
        const result = await executeWithTimeout(() => triggerFullCycle(cycle));
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to trigger full cycle',
          hint: 'Agent server may be unreachable. Work with existing outputs instead.',
        });
      }
    }

    case 'check_agent_status': {
      const runId = toolInput.run_id as string;
      try {
        const result = await executeWithTimeout(() => getRunStatus(runId));
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
        const content = await executeWithTimeout(
          () => readGitHubFile(path),
          10000
        );
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

    case 'generate_report': {
      const title = toolInput.title as string;
      const content = toolInput.content as string;
      const format = (toolInput.format as string) || 'markdown';
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await executeWithTimeout(
          () =>
            fetch(`${baseUrl}/api/report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, content, format }),
            }).then(async (r) => {
              if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(
                  (err as Record<string, string>).error || `Report API returned ${r.status}`
                );
              }
              return r.json();
            }),
          30000 // Reports may take longer than default timeout
        );
        return JSON.stringify(res);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to generate report',
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

interface FilePayload {
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

export async function POST(req: Request) {
  try {
    const { message, conversationId, file } = await req.json() as {
      message: string;
      conversationId?: string;
      file?: FilePayload;
    };

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      try {
        convId = await createConversation(message.substring(0, 100));
      } catch {
        convId = `temp-${Date.now()}`;
      }
    }

    // Save user message (with file metadata if present)
    try {
      const metadata = file
        ? {
            file_attached: true,
            file_name: file.name,
            file_type: file.mimeType,
            file_size: file.size,
          }
        : undefined;
      await saveMessage(convId, 'user', message, metadata);
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

    // If a file is attached, replace the last user message with multi-part content
    if (file && messages.length > 0) {
      const lastIdx = messages.length - 1;
      const lastMsg = messages[lastIdx];
      if (lastMsg.role === 'user') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentBlocks: any[] = [];

        if (file.mimeType === 'application/pdf') {
          contentBlocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: file.base64Data,
            },
          });
        } else {
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.mimeType,
              data: file.base64Data,
            },
          });
        }

        contentBlocks.push({
          type: 'text',
          text: (typeof lastMsg.content === 'string' ? lastMsg.content : message) || 'Please analyse this file.',
        });

        messages[lastIdx] = {
          role: 'user',
          content: contentBlocks,
        };
      }
    }

    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let reportMeta: Record<string, unknown> | null = null;
        const MAX_TOOL_ROUNDS = 10;

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
                const toolStatusRunning: Record<string, unknown> = {
                  type: 'tool_status',
                  tool: block.name,
                  status: 'running',
                };
                // Include agent names for trigger tools so the UI can display them
                const toolInput = block.input as Record<string, unknown>;
                if (block.name === 'trigger_agent_run' && Array.isArray(toolInput.agents)) {
                  toolStatusRunning.agents = toolInput.agents;
                } else if (block.name === 'trigger_full_cycle') {
                  toolStatusRunning.agents = ['news-scout', 'coordinator', 'economist', 'game-theory'];
                }
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify(toolStatusRunning)}\n\n`
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

                // Capture report metadata and notify client
                if (block.name === 'generate_report') {
                  try {
                    const reportResult = JSON.parse(result);
                    if (reportResult.url) {
                      reportMeta = {
                        report_generated: true,
                        report_title: reportResult.title,
                        report_url: reportResult.url,
                        report_format: reportResult.format,
                        report_expires: reportResult.expires,
                      };
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'report_ready',
                            title: reportResult.title,
                            url: reportResult.url,
                            format: reportResult.format,
                            expires: reportResult.expires,
                          })}\n\n`
                        )
                      );
                    }
                  } catch {
                    // Report parsing failed — tool result will still reach Claude
                  }
                }

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

          // Save assistant response (with report metadata if generated)
          try {
            await saveMessage(
              convId,
              'assistant',
              fullResponse,
              reportMeta || undefined
            );
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
