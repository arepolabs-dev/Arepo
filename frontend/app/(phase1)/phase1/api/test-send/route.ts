import { ActionError } from "@/lib/phase1/actions";
import { GmailApiError, GmailAuthError, buildMime, listSendAs, sendRaw } from "@/lib/phase1/gmail";
import { ReconnectError, accessTokenFor } from "@/lib/phase1/mailbox";
import { errorResponse, getDb, requireUser } from "@/lib/phase1/supabase";
import { sendTest } from "@/lib/phase1/test-send";

export const dynamic = "force-dynamic";

/** Send ONE test copy of a programme message to an address the signed-in person types. Writes nothing. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const b = (await request.json().catch(() => ({}))) as { messageId?: string; to?: string };
    try {
      const res = await sendTest(getDb(), user, b, { accessTokenFor, listSendAs, sendRaw, buildMime });
      return Response.json(res);
    } catch (err) {
      if (err instanceof ReconnectError || err instanceof GmailAuthError) return Response.json({ error: "Reconnect Gmail", reconnect: true }, { status: 409 });
      if (err instanceof GmailApiError) return Response.json({ error: "Gmail would not send this one", detail: err.message.slice(0, 200) }, { status: 502 });
      throw err;
    }
  } catch (e) {
    if (e instanceof ActionError) return Response.json({ error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
