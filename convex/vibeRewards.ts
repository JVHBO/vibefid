/**
 * Vibe Rewards System
 * Each vote = 100 VBMS for the card owner
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const VBMS_PER_VOTE = 10;

/**
 * Record a vote and add VBMS reward to card owner
 */
export const recordVote = mutation({
  args: {
    cardFid: v.number(),
    voterFid: v.number(),
  },
  handler: async (ctx, { cardFid, voterFid }) => {
    // Get or create reward record for card owner
    const existing = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", cardFid))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pendingVbms: existing.pendingVbms + VBMS_PER_VOTE,
        totalVotes: existing.totalVotes + 1,
        lastVoteAt: Date.now(),
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: cardFid,
        pendingVbms: VBMS_PER_VOTE,
        claimedVbms: 0,
        totalVotes: 1,
        lastVoteAt: Date.now(),
        lastClaimAt: undefined,
      });
    }

    return { success: true, vbmsAdded: VBMS_PER_VOTE };
  },
});

/**
 * Get pending rewards for a card
 */
export const getRewards = query({
  args: { fid: v.number() },
  handler: async (ctx, { fid }) => {
    const rewards = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", fid))
      .first();

    return rewards || { 
      fid, 
      pendingVbms: 0, 
      claimedVbms: 0, 
      totalVotes: 0 
    };
  },
});

/**
 * Claim pending VBMS rewards
 * Returns the claim details for blockchain tx
 */
export const claimRewards = mutation({
  args: {
    fid: v.number(),
    claimerAddress: v.string(),
  },
  handler: async (ctx, { fid, claimerAddress }) => {
    const rewards = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", fid))
      .first();

    if (!rewards || rewards.pendingVbms === 0) {
      return { success: false, error: "No pending rewards" };
    }

    const claimAmount = rewards.pendingVbms;

    // Update rewards record
    await ctx.db.patch(rewards._id, {
      pendingVbms: 0,
      claimedVbms: rewards.claimedVbms + claimAmount,
      lastClaimAt: Date.now(),
    });

    return { 
      success: true, 
      claimAmount,
      claimerAddress,
      fid,
    };
  },
});

/**
 * Get total VBMS distributed via votes
 */
export const getTotalDistributed = query({
  args: {},
  handler: async (ctx) => {
    const allRewards = await ctx.db.query("vibeRewards").collect();
    
    const total = allRewards.reduce((sum, r) => sum + r.claimedVbms + r.pendingVbms, 0);
    const pending = allRewards.reduce((sum, r) => sum + r.pendingVbms, 0);
    const claimed = allRewards.reduce((sum, r) => sum + r.claimedVbms, 0);

    return { total, pending, claimed };
  },
});
