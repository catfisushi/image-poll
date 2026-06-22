import "server-only";

import { Poll, VoteChoice } from "@/lib/poll-types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SUPABASE_BUCKET = "poll-images";

type CreatePollInput = {
  id: string;
  title: string;
  imageAPath: string;
  imageBPath: string;
};

type SupabasePollRow = {
  id: string;
  title: string;
  option_a_label: string;
  option_b_label: string;
  image_a: string;
  image_b: string;
  votes_a: number;
  votes_b: number;
  created_at: string;
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
        option_a_label: "A",
        option_b_label: "B",
        image_a: imageAUrl,
        image_b: imageBUrl,
      })
      .select(
        "id,title,option_a_label,option_b_label,image_a,image_b,votes_a,votes_b,created_at",
      )
      .single();

    if (error) {
      throw new Error(`创建投票失败：${error.message}`);
    }

    return mapPoll(data as SupabasePollRow);
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
      "id,title,option_a_label,option_b_label,image_a,image_b,votes_a,votes_b,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`读取投票失败：${error.message}`);
  }

  return data ? mapPoll(data as SupabasePollRow) : null;
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
    title: row.title,
    labelA: row.option_a_label,
    labelB: row.option_b_label,
    imageA: row.image_a,
    imageB: row.image_b,
    votesA: Number(row.votes_a),
    votesB: Number(row.votes_b),
    createdAt: row.created_at,
  };
}

export class PollNotFoundError extends Error {}
