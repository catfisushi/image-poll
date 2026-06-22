export type VoteChoice = "A" | "B";

export type Poll = {
  id: string;
  title: string;
  labelA: string;
  labelB: string;
  imageA: string;
  imageB: string;
  votesA: number;
  votesB: number;
  createdAt: string;
};

export type PollViewerState = {
  choice: VoteChoice | null;
};
