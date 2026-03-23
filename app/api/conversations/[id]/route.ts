import { updateConversation, softDeleteConversation } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.is_deleted === true) {
      await softDeleteConversation(id);
    } else if (body.title !== undefined) {
      await updateConversation(id, { title: body.title });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
