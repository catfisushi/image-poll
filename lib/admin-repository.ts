import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RecentPoll = {
  id: string;
  title: string;
  optionAName: string;
  optionBName: string;
  votesA: number;
  votesB: number;
  createdAt: string;
};

export type AdminStats = {
  totalPolls: number;
  totalVotes: number;
  totalPageViews: number;
  todayPageViews: number;
  recentPolls: RecentPoll[];
};

type AdminPollRow = {
  id: string;
  title: string;
  option_a_name: string | null;
  option_b_name: string | null;
  option_a_label: string | null;
  option_b_label: string | null;
  votes_a: number;
  votes_b: number;
  created_at: string;
};

export async function recordPageView(pathname: string, pollId: string | null) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("page_views").insert({
    pathname,
    poll_id: pollId,
  });

  if (error) {
    throw new Error(`记录访问失败：${error.message}`);
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = getSupabaseAdmin();
  const todayStart = startOfTodayInChina();

  const [
    totalPollsResult,
    totalPageViewsResult,
    todayPageViewsResult,
    recentPollsResult,
  ] = await Promise.all([
    supabase.from("polls").select("*", { count: "exact", head: true }),
    supabase
      .from("page_views")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("polls")
      .select(
        "id,title,option_a_name,option_b_name,option_a_label,option_b_label,votes_a,votes_b,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const coreError =
    totalPollsResult.error ||
    totalPageViewsResult.error ||
    todayPageViewsResult.error;

  if (coreError) {
    throw new Error(`读取后台统计失败：${coreError.message}`);
  }

  if (
    recentPollsResult.error &&
    !isMissingOptionNameColumns(recentPollsResult.error)
  ) {
    throw new Error(`读取最近投票失败：${recentPollsResult.error.message}`);
  }

  const [totalVotes, recentPolls] = await Promise.all([
    getTotalVotes(),
    recentPollsResult.error
      ? getLegacyRecentPolls()
      : Promise.resolve((recentPollsResult.data ?? []) as AdminPollRow[]),
  ]);

  return {
    totalPolls: totalPollsResult.count ?? 0,
    totalVotes,
    totalPageViews: totalPageViewsResult.count ?? 0,
    todayPageViews: todayPageViewsResult.count ?? 0,
    recentPolls: recentPolls.map((poll) => ({
      id: poll.id,
      title: poll.title || "谁素攻？",
      optionAName: poll.option_a_name || poll.option_a_label || "A",
      optionBName: poll.option_b_name || poll.option_b_label || "B",
      votesA: Number(poll.votes_a),
      votesB: Number(poll.votes_b),
      createdAt: poll.created_at,
    })),
  };
}

async function getTotalVotes() {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    const { data, error } = await supabase
      .from("polls")
      .select("votes_a,votes_b")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`统计总投票次数失败：${error.message}`);
    }

    const rows = data ?? [];
    total += rows.reduce(
      (sum, poll) => sum + Number(poll.votes_a) + Number(poll.votes_b),
      0,
    );
    if (rows.length < pageSize) return total;
    from += pageSize;
  }
}

async function getLegacyRecentPolls(): Promise<AdminPollRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("polls")
    .select(
      "id,title,option_a_label,option_b_label,votes_a,votes_b,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`读取最近投票失败：${error.message}`);
  }

  return (data ?? []).map((poll) => ({
    ...poll,
    option_a_name: null,
    option_b_name: null,
  })) as AdminPollRow[];
}

function isMissingOptionNameColumns(
  error: { code?: string; message?: string } | null,
) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.code === "42703" ||
        error.message?.includes("option_a_name") ||
        error.message?.includes("option_b_name")),
  );
}

function startOfTodayInChina() {
  const now = new Date();
  const chinaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    chinaParts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T00:00:00+08:00`;
}
