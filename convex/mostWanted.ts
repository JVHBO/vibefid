/**
 * Most Wanted Ranking - Optimized
 * Cards ranked by Neynar Score increase since mint
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get Most Wanted Ranking - Optimized version
 * Uses pre-calculated latestNeynarScore field on cards
 */
export const getRanking = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50000; // Show all cards
    const offset = args.offset || 0;

    // Get all cards that have score history
    const cards = await ctx.db
      .query("farcasterCards")
      .collect();

    // Get today's votes
    const today = new Date().toISOString().split('T')[0];
    const allVotes = await ctx.db
      .query("cardVotes")
      .filter((q) => q.eq(q.field("date"), today))
      .collect();

    // Create vote count map
    const voteMap = new Map<number, number>();
    for (const vote of allVotes) {
      const current = voteMap.get(vote.cardFid) || 0;
      voteMap.set(vote.cardFid, current + vote.voteCount);
    }

    // Calculate score diff and sort - only include MINTED cards (with contractAddress)
    const withDiff = cards
      .filter(c => c.contractAddress) // Only minted cards
      .map(card => ({
        _id: card._id,
        fid: card.fid,
        username: card.username,
        displayName: card.displayName,
        pfpUrl: card.pfpUrl,
        cardImageUrl: card.cardImageUrl,
        rarity: card.rarity,
        mintScore: card.neynarScore,
        currentScore: card.latestNeynarScore ?? card.neynarScore,
        scoreDiff: (card.latestNeynarScore ?? card.neynarScore) - card.neynarScore,
        votes: voteMap.get(card.fid) || 0,
      }))
      .sort((a, b) => b.scoreDiff - a.scoreDiff);

    return {
      cards: withDiff.slice(offset, offset + limit),
      totalCount: withDiff.length,
      hasMore: offset + limit < withDiff.length,
    };
  },
});

/**
 * Update latest Neynar score on a card
 * Called when user checks their score
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

    await ctx.db.patch(card._id, {
      latestNeynarScore: score,
      latestScoreCheckedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Batch update all cards' latest Neynar scores
 * Only saves if score changed since last check
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

      await ctx.db.patch(card._id, {
        latestNeynarScore: score,
        latestScoreCheckedAt: Date.now(),
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
 * Analyze all cards - for debugging
 */
export const analyzeCards = query({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("farcasterCards").collect();

    const withContract = cards.filter(c => c.contractAddress);
    const withoutContract = cards.filter(c => !c.contractAddress);

    return {
      total: cards.length,
      withContractAddress: withContract.length,
      withoutContractAddress: withoutContract.length,
      cardsWithoutContract: withoutContract.map(c => ({
        fid: c.fid,
        username: c.username,
        rarity: c.rarity,
        neynarScore: c.neynarScore,
        _id: c._id,
      })),
    };
  },
});

/**
 * Delete cards without contractAddress (failed mints)
 */
export const deleteUnmintedCards = mutation({
  args: {},
  handler: async (ctx) => {
    const cards = await ctx.db.query("farcasterCards").collect();
    const unmintedCards = cards.filter(c => !c.contractAddress);

    let deletedCount = 0;
    const deletedFids: number[] = [];

    for (const card of unmintedCards) {
      await ctx.db.delete(card._id);
      deletedFids.push(card.fid);
      deletedCount++;
    }

    return {
      success: true,
      deletedCount,
      deletedFids,
    };
  },
});

/**
 * Delete ghost cards (have contractAddress but not on-chain)
 */
export const deleteGhostCards = mutation({
  args: {
    ghostFids: v.array(v.number()),
  },
  handler: async (ctx, { ghostFids }) => {
    let deletedCount = 0;
    const deletedFids: number[] = [];
    const notFound: number[] = [];

    for (const fid of ghostFids) {
      const card = await ctx.db
        .query("farcasterCards")
        .withIndex("by_fid", (q) => q.eq("fid", fid))
        .first();

      if (card) {
        await ctx.db.delete(card._id);
        deletedFids.push(fid);
        deletedCount++;
      } else {
        notFound.push(fid);
      }
    }

    return {
      success: true,
      deletedCount,
      deletedFids,
      notFound,
    };
  },
});

/**
 * Reimport a card from blockchain data
 */
export const reimportCard = mutation({
  args: {
    fid: v.number(),
    username: v.string(),
    displayName: v.string(),
    pfpUrl: v.string(),
    bio: v.string(),
    neynarScore: v.number(),
    followerCount: v.number(),
    followingCount: v.number(),
    powerBadge: v.boolean(),
    address: v.string(),
    rarity: v.string(),
    foil: v.string(),
    wear: v.string(),
    power: v.number(),
    suit: v.string(),
    rank: v.string(),
    suitSymbol: v.string(),
    color: v.string(),
    imageUrl: v.string(),
    cardImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (existing) {
      return { success: false, error: "Card already exists", fid: args.fid };
    }

    const timestamp = Date.now();
    const cardId = `farcaster_${args.fid}_${timestamp}`;

    await ctx.db.insert("farcasterCards", {
      fid: args.fid,
      username: args.username,
      displayName: args.displayName,
      pfpUrl: args.pfpUrl,
      bio: args.bio.slice(0, 200),
      address: args.address.toLowerCase(),
      contractAddress: "0x60274a138d026e3cb337b40567100fdec3127565",
      cardId,
      rarity: args.rarity,
      foil: args.foil,
      wear: args.wear,
      status: "Rarity Assigned",
      power: args.power,
      suit: args.suit,
      rank: args.rank,
      suitSymbol: args.suitSymbol,
      color: args.color,
      neynarScore: args.neynarScore,
      followerCount: args.followerCount,
      followingCount: args.followingCount,
      powerBadge: args.powerBadge,
      imageUrl: args.imageUrl,
      cardImageUrl: args.cardImageUrl || "",
    });

    return { success: true, fid: args.fid };
  },
});
