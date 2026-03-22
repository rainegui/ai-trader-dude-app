import { readGitHubFile } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const { path } = await req.json();
    const content = await readGitHubFile(path);
    return Response.json({ content });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
