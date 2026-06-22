import { NextResponse } from "next/server";
import { getPoll } from "@/lib/poll-repository";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_ID_PATTERN = /^[a-f0-9]{8}$/;

export async function GET(
  _request: Request,
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

    return NextResponse.json(
      { poll },
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
