import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAdminPasswordConfigured()) {
      return NextResponse.json(
        { error: "服务器尚未配置 ADMIN_PASSWORD" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { password?: string };
    if (!verifyAdminPassword(String(body.password || ""))) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
