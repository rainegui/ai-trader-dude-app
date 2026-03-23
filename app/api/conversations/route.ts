import {
  getRecentConversations,
  createConversation,
  getLastMessagePreview,
} from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const conversations = await getRecentConversations(50);

    // Attach last message preview to each conversation
    const withPreviews = await Promise.all(
      conversations.map(async (conv) => {
        let last_message_preview: string | null = null;
        try {
          last_message_preview = await getLastMessagePreview(conv.id);
        } catch {
          // Silent fail — preview is optional
        }
        return { ...conv, last_message_preview };
      })
    );

    return Response.json(withPreviews);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    const id = await createConversation(title || 'New conversation');
    return Response.json({ id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
