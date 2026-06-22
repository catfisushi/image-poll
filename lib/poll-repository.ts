import "server-only";

import { Poll, VoteChoice } from "@/lib/poll-types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SUPABASE_BUCKET = "poll-images";

type CreatePollInput = {
  id: string;
  title: string;
  optionAName: string;
  optionBName: string;
  imageAPath: string;
  imageBPath: string;
};

type SupabasePollRow = {
  id: string;
  title: string;
  option_a_name: string | null;
  option_b_name: string | null;
  image_a: string;
  image_b: string;
  votes_a: number;
  votes_b: number;
  created_at: string;
};

type LegacySupabasePollRow = Omit<
  SupabasePollRow,
  "option_a_name" | "option_b_name"
> & {
  option_a_label: string | null;
  option_b_label: string | null;
};

type CastVoteRow = {
  duplicate: boolean;
  saved_choice: VoteChoice;
  votes_a: number;
  votes_b: number;
};

export async function createPollUploadUrls(id: string) {
  const supabase = getSupabaseAdmin();
  const imageAPath = `${id}/a.jpg`;
  const imageBPath = `${id}/b.jpg`;
  const [imageA, imageB] = await Promise.all([
    supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUploadUrl(imageAPath),
    supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUploadUrl(imageBPath),
  ]);

  if (imageA.error || !imageA.data) {
    throw new Error(`无法创建图片 A 上传地址：${imageA.error?.message}`);
  }
  if (imageB.error || !imageB.data) {
    throw new Error(`无法创建图片 B 上传地址：${imageB.error?.message}`);
  }

  return {
    id,
    imageA: {
      path: imageAPath,
      token: imageA.data.token,
    },
    imageB: {
      path: imageBPath,
      token: imageB.data.token,
    },
  };
}

export async function createPoll(input: CreatePollInput): Promise<Poll> {
  const supabase = getSupabaseAdmin();
  const expectedImageAPath = `${input.id}/a.jpg`;
  const expectedImageBPath = `${input.id}/b.jpg`;

  if (
    input.imageAPath !== expectedImageAPath ||
    input.imageBPath !== expectedImageBPath
  ) {
    throw new Error("图片路径与投票 ID 不匹配");
  }

  const [imageAExists, imageBExists] = await Promise.all([
    supabase.storage.from(SUPABASE_BUCKET).exists(input.imageAPath),
    supabase.storage.from(SUPABASE_BUCKET).exists(input.imageBPath),
  ]);

  if (imageAExists.error || imageBExists.error) {
    throw new Error(
      `检查上传图片失败：${
        imageAExists.error?.message || imageBExists.error?.message
      }`,
    );
  }
  if (!imageAExists.data || !imageBExists.data) {
    throw new Error("图片尚未上传完成，请重试");
  }

  const imageAUrl = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(input.imageAPath).data.publicUrl;
  const imageBUrl = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(input.imageBPath).data.publicUrl;

  try {
    const { data, error } = await supabase
      .from("polls")
      .insert({
        id: input.id,
        title: input.title,
        option_a_name: input.optionAName,
        option_b_name: input.optionBName,
        option_a_label: "A",
        option_b_label: "B",
        image_a: imageAUrl,
        image_b: imageBUrl,
      })
      .select(
        "id,title,option_a_name,option_b_name,image_a,image_b,votes_a,votes_b,created_at",
      )
      .single();

    if (!error && data) {
      return mapPoll(data as SupabasePollRow);
    }

    if (!isMissingOptionNameColumns(error)) {
      throw new Error(`创建投票失败：${error?.message}`);
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("polls")
      .insert({
        id: input.id,
        title: input.title,
        option_a_label: input.optionAName,
        option_b_label: input.optionBName,
        image_a: imageAUrl,
        image_b: imageBUrl,
      })
      .select(
        "id,title,option_a_label,option_b_label,image_a,image_b,votes_a,votes_b,created_at",
      )
      .single();

    if (legacyError || !legacyData) {
      throw new Error(`创建投票失败：${legacyError?.message}`);
    }

    return mapLegacyPoll(legacyData as LegacySupabasePollRow);
  } catch (error) {
    const { error: cleanupError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([input.imageAPath, input.imageBPath]);

    if (cleanupError) {
      console.error("[poll-storage-cleanup]", cleanupError);
    }
    throw error;
  }
}

export async function getPoll(id: string): Promise<Poll | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("polls")
    .select(
      "id,title,option_a_name,option_b_name,image_a,image_b,votes_a,votes_b,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!error) {
    return data ? mapPoll(data as SupabasePollRow) : null;
  }

  if (!isMissingOptionNameColumns(error)) {
    throw new Error(`读取投票失败：${error.message}`);
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("polls")
    .select(
      "id,title,option_a_label,option_b_label,image_a,image_b,votes_a,votes_b,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (legacyError) {
    throw new Error(`读取投票失败：${legacyError.message}`);
  }

  return legacyData
    ? mapLegacyPoll(legacyData as LegacySupabasePollRow)
    : null;
}

export async function getVoterChoice(
  pollId: string,
  voterId: string,
): Promise<VoteChoice | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("votes")
    .select("choice")
    .eq("poll_id", pollId)
    .eq("voter_id", voterId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取访问者投票状态失败：${error.message}`);
  }

  return data ? (data.choice as VoteChoice) : null;
}

export async function castVote(
  id: string,
  choice: VoteChoice,
  voterId: string,
): Promise<{ poll: Poll; duplicate: boolean; choice: VoteChoice }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("cast_poll_vote", {
    p_poll_id: id,
    p_voter_id: voterId,
    p_choice: choice,
  });

  if (error) {
    if (error.code === "P0002") throw new PollNotFoundError();
    throw new Error(`投票失败：${error.message}`);
  }

  const voteResult = (data as CastVoteRow[] | null)?.[0];
  if (!voteResult) {
    throw new Error("投票接口没有返回结果");
  }

  const poll = await getPoll(id);
  if (!poll) throw new PollNotFoundError();

  return {
    poll: {
      ...poll,
      votesA: Number(voteResult.votes_a),
      votesB: Number(voteResult.votes_b),
    },
    duplicate: voteResult.duplicate,
    choice: voteResult.saved_choice,
  };
}

function mapPoll(row: SupabasePollRow): Poll {
  return {
    id: row.id,
    title: row.title || "谁素攻？",
    labelA: row.option_a_name || "A",
    labelB: row.option_b_name || "B",
    imageA: row.image_a,
    imageB: row.image_b,
    votesA: Number(row.votes_a),
    votesB: Number(row.votes_b),
    createdAt: row.created_at,
  };
}

function mapLegacyPoll(row: LegacySupabasePollRow): Poll {
  return {
    id: row.id,
    title: row.title || "谁素攻？",
    labelA: row.option_a_label || "A",
    labelB: row.option_b_label || "B",
    imageA: row.image_a,
    imageB: row.image_b,
    votesA: Number(row.votes_a),
    votesB: Number(row.votes_b),
    createdAt: row.created_at,
  };
}

function isMissingOptionNameColumns(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.code === "42703" ||
        error.message?.includes("option_a_name") ||
        error.message?.includes("option_b_name")),
  );
}

export class PollNotFoundError extends Error {}
