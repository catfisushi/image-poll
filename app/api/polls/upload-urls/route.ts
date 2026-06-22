import { NextResponse } from "next/server";
import { createPollUploadUrls } from "@/lib/poll-repository";
import { SupabaseConfigError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const upload = await createPollUploadUrls(id);
    return NextResponse.json(upload);
  } catch (error) {
    console.error("[poll-upload-urls]", error);
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建上传地址失败" },
      { status: 500 },
    );
  }
}
