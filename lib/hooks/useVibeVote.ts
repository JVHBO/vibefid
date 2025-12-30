"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";

interface UseVibeVoteProps {
  cardFid: number;
  voterFid?: number;
  voterAddress?: string;
}

interface VoteResult {
  success: boolean;
  error?: string;
  voteCount?: number;
}

export function useVibeVote({ cardFid, voterFid, voterAddress }: UseVibeVoteProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queries
  const cardVotes = useQuery(api.cardVotes.getCardVotes, { fid: cardFid });

  const hasVoted = useQuery(
    api.cardVotes.hasUserVoted,
    voterFid ? { cardFid, voterFid } : "skip"
  );

  const freeVotesRemaining = useQuery(
    api.cardVotes.getUserFreeVotesRemaining,
    voterFid ? { voterFid } : "skip"
  );

  const dailyLeaderboard = useQuery(api.cardVotes.getDailyLeaderboard, { limit: 10 });
  const prizeInfo = useQuery(api.cardVotes.getDailyPrizeInfo, {});
  const pastWinners = useQuery(api.cardVotes.getPastWinners, { limit: 7 });

  // Mutation
  const voteForCardMutation = useMutation(api.cardVotes.voteForCard);

  // Vote handler
  const vote = useCallback(async (isPaid: boolean = false, voteCount: number = 1): Promise<VoteResult> => {
    if (!voterFid || !voterAddress) {
      return { success: false, error: "Not connected" };
    }

    if (isVoting) {
      return { success: false, error: "Vote in progress" };
    }

    setIsVoting(true);
    setError(null);

    try {
      const result = await voteForCardMutation({
        cardFid,
        voterFid,
        voterAddress,
        isPaid,
        voteCount: isPaid ? voteCount : 1,
      });

      if (!result.success) {
        setError(result.error || "Vote failed");
        return { success: false, error: result.error };
      }

      return { success: true, voteCount: result.voteCount };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to vote";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsVoting(false);
    }
  }, [cardFid, voterFid, voterAddress, isVoting, voteForCardMutation]);

  // Free vote
  const voteFree = useCallback(() => vote(false, 1), [vote]);

  // Paid vote
  const votePaid = useCallback((count: number = 1) => vote(true, count), [vote]);

  return {
    // Vote state
    isVoting,
    error,
    hasVoted: hasVoted ?? false,

    // Card votes
    totalVotes: cardVotes?.totalVotes ?? 0,
    voterCount: cardVotes?.voterCount ?? 0,

    // Free votes
    freeVotesRemaining: freeVotesRemaining?.remaining ?? 3,
    freeVotesUsed: freeVotesRemaining?.used ?? 0,
    maxFreeVotes: freeVotesRemaining?.max ?? 3,

    // Leaderboard & Prize
    dailyLeaderboard: dailyLeaderboard ?? [],
    prizeInfo: prizeInfo ?? null,
    pastWinners: pastWinners ?? [],

    // Actions
    voteFree,
    votePaid,
    vote,
  };
}

export default useVibeVote;
