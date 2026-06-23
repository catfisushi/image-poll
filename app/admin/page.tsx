import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  isAdminPasswordConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";
import { getAdminStats } from "@/lib/admin-repository";
import { AdminLogin } from "@/app/admin/admin-login";
import { AdminRefresh } from "@/app/admin/admin-refresh";
import { AdminLogout } from "@/app/admin/admin-logout";
import type { AdminStats } from "@/lib/admin-repository";

export const metadata: Metadata = {
  title: "数据后台 | 图片二选一",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!verifyAdminSessionToken(token)) {
    return <AdminLogin isConfigured={isAdminPasswordConfigured()} />;
  }

  let stats: AdminStats | null = null;
  let loadError = "";

  try {
    stats = await getAdminStats();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "读取统计失败";
  }

  if (!stats) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div>
            <h1>数据后台</h1>
            <p className="error-message">{loadError}</p>
          </div>
          <AdminLogout />
        </header>
      </main>
    );
  }

  const origin = await getOrigin();

  return (
    <main className="admin-shell">
      <AdminRefresh />
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">图片二选一</p>
          <h1>数据后台</h1>
          <p>数据每 60 秒自动刷新。</p>
        </div>
        <AdminLogout />
      </header>

      <section className="admin-metrics" aria-label="核心数据">
        <Metric label="总投票项目数" value={stats.totalPolls} />
        <Metric label="总投票次数" value={stats.totalVotes} />
        <Metric label="总访问次数" value={stats.totalPageViews} />
        <Metric label="今日访问次数" value={stats.todayPageViews} />
      </section>

      <section className="admin-table-section">
        <h2>最近投票</h2>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>创建时间</th>
                <th>A 名称</th>
                <th>B 名称</th>
                <th>A 票数</th>
                <th>B 票数</th>
                <th>总票数</th>
                <th>分享链接</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentPolls.map((poll) => {
                const totalVotes = poll.votesA + poll.votesB;
                const shareUrl = `${origin}/p/${poll.id}`;

                return (
                  <tr key={poll.id}>
                    <td className="admin-title-cell">{poll.title}</td>
                    <td>{formatChinaDate(poll.createdAt)}</td>
                    <td>{poll.optionAName}</td>
                    <td>{poll.optionBName}</td>
                    <td>{poll.votesA}</td>
                    <td>{poll.votesB}</td>
                    <td>{totalVotes}</td>
                    <td>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        {shareUrl}
                      </a>
                    </td>
                  </tr>
                );
              })}
              {stats.recentPolls.length === 0 && (
                <tr>
                  <td colSpan={8} className="admin-empty-cell">
                    暂无投票
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("zh-CN")}</strong>
    </article>
  );
}

function formatChinaDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function getOrigin() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const protocol =
    headerStore.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}
