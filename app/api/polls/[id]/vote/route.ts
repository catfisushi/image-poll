import { NextResponse } from "next/server";
import {
  castVote,
  PollNotFoundError,
} from "@/lib/poll-repository";
import { VoteChoice } from "@/lib/poll-types";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_ID_PATTERN = /^[a-f0-9]{8}$/;
const VOTER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!POLL_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "投票链接无效" }, { status: 400 });
    }

    const body = (await request.json()) as {
      choice?: VoteChoice;
      voterId?: string;
    };

    if (body.choice !== "A" && body.choice !== "B") {
      return NextResponse.json({ error: "请选择图片 A 或 B" }, { status: 400 });
    }

    if (!body.voterId || !VOTER_ID_PATTERN.test(body.voterId)) {
      return NextResponse.json({ error: "缺少有效的访问者标识" }, { status: 400 });
    }

    const result = await castVote(id, body.choice, body.voterId);
    return NextResponse.json(result, { status: result.duplicate ? 409 : 200 });
  } catch (error) {
    if (error instanceof PollNotFoundError) {
      return NextResponse.json({ error: "投票不存在" }, { status: 404 });
    }

    console.error("[poll-vote]", error);
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "投票失败" },
      { status: 500 },
    );
  }
}
