import { NextResponse } from "next/server";
import { createPoll } from "@/lib/poll-repository";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_ID_PATTERN = /^[a-f0-9]{8}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      imageAPath?: string;
      imageBPath?: string;
    };
    const id = String(body.id || "");
    const title = String(body.title || "").trim() || "你更喜欢哪一张？";
    const imageAPath = String(body.imageAPath || "");
    const imageBPath = String(body.imageBPath || "");

    if (!POLL_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "投票 ID 无效" }, { status: 400 });
    }
    if (title.length > 60) {
      return NextResponse.json(
        { error: "标题不能超过 60 个字符。" },
        { status: 400 },
      );
    }

    const poll = await createPoll({ id, title, imageAPath, imageBPath });
    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    console.error("[poll-create]", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建投票失败" },
      { status: 500 },
    );
  }
}
