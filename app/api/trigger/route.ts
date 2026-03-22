import { triggerAgentRun } from '@/lib/agent-server';

export async function POST(req: Request) {
  try {
    const { agents, cycle, context } = await req.json();
    const data = await triggerAgentRun({ agents, cycle, context });
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
