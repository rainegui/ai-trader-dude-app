import { writeGitHubFile } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const { path, content, message } = await req.json();
    const success = await writeGitHubFile(path, content, message);
    return Response.json({ success });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
