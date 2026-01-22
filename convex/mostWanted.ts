/**
 * Most Wanted Ranking - Optimized with Index
 * Cards ranked by Neynar Score increase since mint
 * 🚀 BANDWIDTH FIX: Uses by_score_diff index instead of full table scan
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get Most Wanted Ranking - Uses scoreDiff index
 * scoreDiff is pre-computed when latestNeynarScore is updated
 */
export const getRanking = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 12, 2000);
    const offset = args.offset || 0;

    // 🚀 BANDWIDTH FIX: Use index instead of full table scan
    // Cards with scoreDiff set are fetched in descending order
    const cards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_score_diff")
      .order("desc")
      .take(offset + limit + 50); // Take a bit more to handle offset

    // Get today's votes
    const today = new Date().toISOString().split('T')[0];
    const cardFids = cards.map(c => c.fid);

    // Only fetch votes for cards we're returning
    const allVotes = await ctx.db
      .query("cardVotes")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    const voteMap = new Map<number, number>();
    for (const vote of allVotes) {
      if (cardFids.includes(vote.cardFid)) {
        const current = voteMap.get(vote.cardFid) || 0;
        voteMap.set(vote.cardFid, current + vote.voteCount);
      }
    }

    const result = cards
      .slice(offset, offset + limit)
      .map(card => ({
        fid: card.fid,
        username: card.username,
        displayName: card.displayName,
        pfpUrl: card.pfpUrl,
        cardImageUrl: card.cardImageUrl,
        rarity: card.rarity,
        mintScore: card.neynarScore,
        currentScore: card.latestNeynarScore ?? card.neynarScore,
        scoreDiff: card.scoreDiff ?? 0,
        votes: voteMap.get(card.fid) || 0,
      }));

    // Get total count (cards with scoreDiff)
    const totalCount = cards.length;

    return {
      cards: result,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  },
});

/**
 * Update latest Neynar score on a card
 * Called when user checks their score
 * 🚀 BANDWIDTH FIX: Also updates scoreDiff for indexed ranking queries
 */
export const updateLatestScore = mutation({
  args: {
    fid: v.number(),
    score: v.number(),
  },
  handler: async (ctx, { fid, score }) => {
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", fid))
      .first();

    if (!card) return { success: false, error: "Card not found" };

    // 🚀 BANDWIDTH FIX: Pre-compute scoreDiff for efficient ranking
    const scoreDiff = score - card.neynarScore;

    await ctx.db.patch(card._id, {
      latestNeynarScore: score,
      latestScoreCheckedAt: Date.now(),
      scoreDiff,
    });

    return { success: true };
  },
});

/**
 * Batch update all cards' latest Neynar scores
 * Only saves if score changed since last check
 * 🚀 BANDWIDTH FIX: Also updates scoreDiff for indexed ranking queries
 */
export const batchUpdateScores = mutation({
  args: {
    updates: v.array(v.object({
      fid: v.number(),
      score: v.number(),
    })),
  },
  handler: async (ctx, { updates }) => {
    let updatedCount = 0;
    let skippedCount = 0;

    for (const { fid, score } of updates) {
      const card = await ctx.db
        .query("farcasterCards")
        .withIndex("by_fid", (q) => q.eq("fid", fid))
        .first();

      if (!card) continue;

      // Skip if score hasn't changed (within 0.0001 threshold)
      const lastScore = card.latestNeynarScore ?? card.neynarScore;
      if (Math.abs(lastScore - score) < 0.0001) {
        skippedCount++;
        continue;
      }

      // 🚀 BANDWIDTH FIX: Pre-compute scoreDiff for efficient ranking
      const scoreDiff = score - card.neynarScore;

      await ctx.db.patch(card._id, {
        latestNeynarScore: score,
        latestScoreCheckedAt: Date.now(),
        scoreDiff,
      });

      updatedCount++;
    }

    return { success: true, updatedCount, skippedCount };
  },
});

/**
 * Get all FIDs that need score update
 */
export const getFidsForScoreUpdate = query({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("farcasterCards").collect();
    return cards.map(c => c.fid);
  },
});

/**
 * Backfill scoreDiff on all cards
 * Run once after deploy: npx convex run mostWanted:backfillScoreDiff
 */
export const backfillScoreDiff = mutation({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("farcasterCards").collect();
    let updated = 0;

    for (const card of cards) {
      const currentScore = card.latestNeynarScore ?? card.neynarScore;
      const scoreDiff = currentScore - card.neynarScore;

      // Only update if scoreDiff not set or changed
      if (card.scoreDiff !== scoreDiff) {
        await ctx.db.patch(card._id, { scoreDiff });
        updated++;
      }
    }

    return { success: true, updated, total: cards.length };
  },
});
