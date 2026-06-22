import { NextResponse } from "next/server";
import { getPoll, getVoterChoice } from "@/lib/poll-repository";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_ID_PATTERN = /^[a-f0-9]{8}$/;
const VOTER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!POLL_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "投票链接无效" }, { status: 400 });
    }

    const poll = await getPoll(id);

    if (!poll) {
      return NextResponse.json({ error: "投票不存在" }, { status: 404 });
    }

    const voterId = new URL(request.url).searchParams.get("voterId");
    if (voterId && !VOTER_ID_PATTERN.test(voterId)) {
      return NextResponse.json({ error: "访问者标识无效" }, { status: 400 });
    }

    const viewerChoice = voterId ? await getVoterChoice(id, voterId) : null;

    return NextResponse.json(
      { poll, viewer: { choice: viewerChoice } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[poll-read]", error);
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取投票失败" },
      { status: 500 },
    );
  }
}
