import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/admin-repository";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_PATH_PATTERN = /^\/p\/([a-f0-9]{8})$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pathname?: string };
    const pathname = String(body.pathname || "");
    const pollMatch = pathname.match(POLL_PATH_PATTERN);

    if (pathname !== "/" && !pollMatch) {
      return NextResponse.json({ error: "访问路径无效" }, { status: 400 });
    }

    await recordPageView(pathname, pollMatch?.[1] ?? null);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[page-view]", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "记录访问失败" },
      { status: 500 },
    );
  }
}
