"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Poll, PollViewerState, VoteChoice } from "@/lib/poll-types";

const VOTER_ID_KEY = "image-poll-voter-id";

function getVoterId() {
  let voterId = localStorage.getItem(VOTER_ID_KEY);
  if (!voterId) {
    voterId = crypto.randomUUID();
    localStorage.setItem(VOTER_ID_KEY, voterId);
  }
  return voterId;
}

function voteStorageKey(pollId: string) {
  return `image-poll-vote:${pollId}`;
}

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const [poll, setPoll] = useState<Poll | null>();
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isViewerStateLoaded, setIsViewerStateLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPoll() {
      try {
        const voterId = getVoterId();
        const query = new URLSearchParams({ voterId });
        const response = await fetch(
          `/api/polls/${params.id}?${query.toString()}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          poll?: Poll;
          viewer?: PollViewerState;
          error?: string;
        };

        if (!response.ok || !result.poll) {
          if (response.status === 404) {
            setPoll(null);
            return;
          }
          throw new Error(result.error || "读取投票失败");
        }

        setPoll(result.poll);
        const viewerChoice = result.viewer?.choice ?? null;
        setSelectedChoice(viewerChoice);
        setIsViewerStateLoaded(true);

        if (viewerChoice) {
          localStorage.setItem(voteStorageKey(params.id), viewerChoice);
          setMessage(`你已投给图片 ${viewerChoice}`);
        } else {
          localStorage.removeItem(voteStorageKey(params.id));
          setMessage("");
        }
      } catch (reason) {
        if ((reason as Error).name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "读取投票失败");
        setPoll(null);
      }
    }

    loadPoll();
    return () => controller.abort();
  }, [params.id]);

  const results = useMemo(() => {
    const votesA = poll?.votesA ?? 0;
    const votesB = poll?.votesB ?? 0;
    const total = votesA + votesB;
    return {
      total,
      percentA: total ? Math.round((votesA / total) * 100) : 0,
      percentB: total ? Math.round((votesB / total) * 100) : 0,
    };
  }, [poll]);

  async function handleVote(choice: VoteChoice) {
    if (!poll || !isViewerStateLoaded || isVoting) return;

    if (selectedChoice) {
      setMessage(`你已经投过图片 ${selectedChoice}，不能重复投票。`);
      return;
    }

    setIsVoting(true);
    setError("");

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, voterId: getVoterId() }),
      });
      const result = (await response.json()) as {
        poll?: Poll;
        duplicate?: boolean;
        choice?: VoteChoice;
        error?: string;
      };

      if (
        (!response.ok && response.status !== 409) ||
        !result.poll ||
        !result.choice
      ) {
        throw new Error(result.error || "投票失败");
      }

      setPoll(result.poll);
      setSelectedChoice(result.choice);
      localStorage.setItem(voteStorageKey(poll.id), result.choice);
      setMessage(
        result.duplicate
          ? `你已经投过图片 ${result.choice}。`
          : `投票成功，你选择了图片 ${result.choice}！`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "投票失败");
    } finally {
      setIsVoting(false);
    }
  }

  async function copyShareLink() {
    const shareUrl = `${window.location.origin}/p/${params.id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setError(`复制失败，请手动复制：${shareUrl}`);
    }
  }

  if (poll === undefined) {
    return (
      <main className="page-shell">
        <p className="status-message">正在加载...</p>
      </main>
    );
  }

  if (!poll) {
    return (
      <main className="page-shell">
        <section className="empty-state">
          <span className="brand-mark">AB</span>
          <h1>没有找到这组图片</h1>
          <p>{error || "这个投票可能已被删除，或者链接不正确。"}</p>
          <Link className="secondary-button" href="/">
            创建一组图片
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="share-shell">
      <header className="share-header">
        <Link className="brand-link" href="/">
          <span className="brand-mark">AB</span>
          <span>图片二选一</span>
        </Link>
        <Link className="new-link" href="/">
          新建
        </Link>
      </header>

      <section className="share-content">
        <div className="poll-heading">
          <h1>{poll.title}</h1>
          <button className="copy-button" type="button" onClick={copyShareLink}>
            {isCopied ? "已复制" : "复制分享链接"}
          </button>
        </div>

        <div className="shared-image-grid">
          <VoteOption
            choice="A"
            label={poll.labelA}
            image={poll.imageA}
            votes={poll.votesA}
            percent={results.percentA}
            showResults={Boolean(selectedChoice)}
            selected={selectedChoice === "A"}
            disabled={
              !isViewerStateLoaded || Boolean(selectedChoice) || isVoting
            }
            onVote={handleVote}
          />
          <VoteOption
            choice="B"
            label={poll.labelB}
            image={poll.imageB}
            votes={poll.votesB}
            percent={results.percentB}
            showResults={Boolean(selectedChoice)}
            selected={selectedChoice === "B"}
            disabled={
              !isViewerStateLoaded || Boolean(selectedChoice) || isVoting
            }
            onVote={handleVote}
          />
        </div>

        <div className="poll-feedback" aria-live="polite">
          {message && <p className="success-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}
          {selectedChoice ? (
            <p className="vote-total">共 {results.total} 票</p>
          ) : (
            <p className="vote-total">点击一张图片投票后查看结果</p>
          )}
        </div>
      </section>
    </main>
  );
}

type VoteOptionProps = {
  choice: VoteChoice;
  label: string;
  image: string;
  votes: number;
  percent: number;
  showResults: boolean;
  selected: boolean;
  disabled: boolean;
  onVote: (choice: VoteChoice) => void;
};

function VoteOption({
  choice,
  label,
  image,
  votes,
  percent,
  showResults,
  selected,
  disabled,
  onVote,
}: VoteOptionProps) {
  return (
    <button
      className={`vote-option ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={() => onVote(choice)}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="vote-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={`图片 ${label}`} />
        <span className="choice-label">{label}</span>
        {selected && <span className="selected-badge">已选择</span>}
      </span>
      {showResults && (
        <>
          <span className="vote-result">
            <span>{votes} 票</span>
            <strong>{percent}%</strong>
          </span>
          <span className="result-track">
            <span style={{ width: `${percent}%` }} />
          </span>
        </>
      )}
    </button>
  );
}
