import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";

/**
 * VibeFID Card Voting System
 *
 * Features:
 * - 1 free vote per day per user
 * - Paid votes (unlimited) cost 100 coins each
 * - Daily prize pool distributed to top voted card
 * - Vote history tracking
 */

// 🚀 BANDWIDTH FIX: Read from pre-computed stats table instead of collecting all votes
export const getCardVotes = query({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];

    // Read from stats table (single document lookup)
    const stats = await ctx.db
      .query("dailyCardVoteStats")
      .withIndex("by_card_date", (q) => q.eq("cardFid", args.fid).eq("date", today))
      .first();

    return {
      totalVotes: stats?.totalVotes ?? 0,
      voterCount: stats?.voterCount ?? 0,
    };
  },
});

// 🚀 BANDWIDTH FIX: Use by_card_voter_date index for direct lookup
export const hasUserVoted = query({
  args: {
    cardFid: v.number(),
    voterFid: v.number(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];

    // Direct index lookup - no filter needed
    const vote = await ctx.db
      .query("cardVotes")
      .withIndex("by_card_voter_date", (q) =>
        q.eq("cardFid", args.cardFid).eq("voterFid", args.voterFid).eq("date", today)
      )
      .first();

    return !!vote;
  },
});

// Get user's remaining free votes for today
// 🚀 BANDWIDTH FIX V2: Uses separate userDailyLimits table
// This query ONLY re-runs when THIS user's limits change, not when ANY vote happens
export const getUserFreeVotesRemaining = query({
  args: { voterFid: v.number() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    const maxFreeVotes = 1;

    // Query the dedicated limits table (only invalidates when THIS user votes)
    const userLimits = await ctx.db
      .query("userDailyLimits")
      .withIndex("by_fid_date", (q) => q.eq("fid", args.voterFid).eq("date", today))
      .first();

    const freeVotesUsed = userLimits?.freeVotesUsed ?? 0;

    return {
      remaining: Math.max(0, maxFreeVotes - freeVotesUsed),
      used: freeVotesUsed,
      max: maxFreeVotes,
    };
  },
});

// DEPRECATED: Old implementation kept for reference, remove after migration
// export const getUserFreeVotesRemainingLegacy = query({ ... });

// Vote for a card (free or paid) with optional VibeMail message
export const voteForCard = mutation({
  args: {
    cardFid: v.number(),
    voterFid: v.number(),
    voterAddress: v.string(),
    isPaid: v.boolean(),
    voteCount: v.optional(v.number()), // For paid votes, can vote multiple times
    // VibeMail - Anonymous message with vote
    message: v.optional(v.string()), // Optional text message (max 200 chars)
    audioId: v.optional(v.string()), // Optional meme sound ID
    imageId: v.optional(v.string()), // Optional meme image ID
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const voteCount = args.voteCount || 1;

    // Cannot vote for your own card
    if (args.voterFid === args.cardFid) {
      return { success: false, error: "Cannot vote for your own card" };
    }

    // Check if already voted today (for free votes)
    if (!args.isPaid) {
      const existingVote = await ctx.db
        .query("cardVotes")
        .withIndex("by_card_date", (q) => q.eq("cardFid", args.cardFid).eq("date", today))
        .filter((q) => q.eq(q.field("voterFid"), args.voterFid))
        .first();

      if (existingVote) {
        return { success: false, error: "Already voted for this card today" };
      }

      // 🚀 BANDWIDTH FIX: Check free votes from dedicated limits table
      const userLimits = await ctx.db
        .query("userDailyLimits")
        .withIndex("by_fid_date", (q) => q.eq("fid", args.voterFid).eq("date", today))
        .first();

      if (userLimits && userLimits.freeVotesUsed >= 1) {
        return { success: false, error: "No free votes remaining today" };
      }
    }

    // For paid votes, deduct coins
    if (args.isPaid) {
      const costPerVote = 100;
      const totalCost = costPerVote * voteCount;

      // Find user profile by address
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_address", (q) => q.eq("address", args.voterAddress.toLowerCase()))
        .first();

      if (!profile) {
        return { success: false, error: "Profile not found" };
      }

      const currentCoins = profile.coins || 0;
      if (currentCoins < totalCost) {
        return { success: false, error: `Not enough coins. Need ${totalCost}, have ${currentCoins}` };
      }

      // Deduct coins
      await ctx.db.patch(profile._id, {
        coins: currentCoins - totalCost,
      });
    }

    // Record the vote with optional VibeMail message
    const hasMessageContent = args.message && args.message.trim().length > 0;
    const hasContent = hasMessageContent || args.imageId; // Message or image counts as VibeMail
    await ctx.db.insert("cardVotes", {
      cardFid: args.cardFid,
      voterFid: args.voterFid,
      voterAddress: args.voterAddress.toLowerCase(),
      date: today,
      isPaid: args.isPaid,
      voteCount: voteCount,
      createdAt: now,
      // VibeMail fields
      message: hasMessageContent && args.message ? args.message.slice(0, 200) : undefined,
      audioId: hasContent ? args.audioId : undefined,
      imageId: args.imageId || undefined,
      isRead: hasContent ? false : undefined,
      // 🚀 BANDWIDTH FIX: Boolean for efficient message queries
      hasMessage: hasContent ? true : undefined,
    });

    // 🚀 BANDWIDTH FIX: Update dedicated limits table for free votes
    if (!args.isPaid) {
      const existingLimits = await ctx.db
        .query("userDailyLimits")
        .withIndex("by_fid_date", (q) => q.eq("fid", args.voterFid).eq("date", today))
        .first();

      if (existingLimits) {
        await ctx.db.patch(existingLimits._id, {
          freeVotesUsed: existingLimits.freeVotesUsed + 1,
          lastUpdated: now,
        });
      } else {
        await ctx.db.insert("userDailyLimits", {
          fid: args.voterFid,
          date: today,
          freeVotesUsed: 1,
          lastUpdated: now,
        });
      }
    }

    // 🚀 BANDWIDTH FIX: Update pre-computed vote stats
    const existingStats = await ctx.db
      .query("dailyCardVoteStats")
      .withIndex("by_card_date", (q) => q.eq("cardFid", args.cardFid).eq("date", today))
      .first();

    if (existingStats) {
      await ctx.db.patch(existingStats._id, {
        totalVotes: existingStats.totalVotes + voteCount,
        voterCount: existingStats.voterCount + 1,
        lastUpdated: now,
      });
    } else {
      await ctx.db.insert("dailyCardVoteStats", {
        cardFid: args.cardFid,
        date: today,
        totalVotes: voteCount,
        voterCount: 1,
        lastUpdated: now,
      });
    }

    // Update daily leaderboard
    await updateDailyLeaderboard(ctx, args.cardFid, today, voteCount);

    // 💌 Send VibeMail notification if there's a message or image
    if (hasContent) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendVibemailNotification, {
        recipientFid: args.cardFid,
        hasAudio: !!args.audioId,
      });
    }

    // Update vibeRewards for card owner (100 VBMS per vote)
    const vbmsReward = voteCount * 100;
    const existingReward = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", args.cardFid))
      .first();

    if (existingReward) {
      await ctx.db.patch(existingReward._id, {
        pendingVbms: existingReward.pendingVbms + vbmsReward,
        totalVotes: existingReward.totalVotes + voteCount,
        lastVoteAt: now,
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: args.cardFid,
        pendingVbms: vbmsReward,
        claimedVbms: 0,
        totalVotes: voteCount,
        lastVoteAt: now,
      });
    }

    return { success: true, voteCount };
  },
});

// Helper to update daily leaderboard
async function updateDailyLeaderboard(ctx: any, cardFid: number, date: string, voteCount: number) {
  const existing = await ctx.db
    .query("dailyVoteLeaderboard")
    .withIndex("by_card_date", (q: any) => q.eq("cardFid", cardFid).eq("date", date))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      totalVotes: existing.totalVotes + voteCount,
      lastUpdated: Date.now(),
    });
  } else {
    // Get card info
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q: any) => q.eq("fid", cardFid))
      .first();

    await ctx.db.insert("dailyVoteLeaderboard", {
      cardFid,
      username: card?.username || `FID ${cardFid}`,
      displayName: card?.displayName || "",
      pfpUrl: card?.pfpUrl || "",
      totalVotes: voteCount,
      date,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    });
  }
}

// Get today's vote leaderboard
export const getDailyLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    const limit = args.limit || 10;

    const leaders = await ctx.db
      .query("dailyVoteLeaderboard")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    // Sort by votes and take top N
    return leaders
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, limit);
  },
});

// 🚀 BANDWIDTH FIX: Uses by_date_paid index instead of filtering all votes
export const getDailyPrizeInfo = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split('T')[0];

    // Count paid votes today using dedicated index (no post-filter needed)
    const paidVotes = await ctx.db
      .query("cardVotes")
      .withIndex("by_date_paid", (q) => q.eq("date", today).eq("isPaid", true))
      .collect();

    const totalPaidVotes = paidVotes.reduce((sum, v) => sum + v.voteCount, 0);
    const prizePool = totalPaidVotes * 50; // 50% of vote cost goes to prize pool

    // Get current leader - take top 10 and sort (usually few leaders per day)
    const leaders = await ctx.db
      .query("dailyVoteLeaderboard")
      .withIndex("by_date", (q) => q.eq("date", today))
      .take(100); // Limit to prevent huge scans

    const topLeader = leaders.sort((a, b) => b.totalVotes - a.totalVotes)[0];

    return {
      prizePool,
      totalPaidVotes,
      currentLeader: topLeader || null,
      endsAt: getEndOfDayTimestamp(),
    };
  },
});

// Get past winners
export const getPastWinners = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 7;

    const winners = await ctx.db
      .query("dailyPrizeWinners")
      .order("desc")
      .take(limit);

    return winners;
  },
});

// Helper to get end of day timestamp
function getEndOfDayTimestamp(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay.getTime();
}

// Reset all votes (admin/dev only)
export const resetAllVotes = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all cardVotes
    const votes = await ctx.db.query("cardVotes").collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Delete all daily leaderboard entries
    const leaderboard = await ctx.db.query("dailyVoteLeaderboard").collect();
    for (const entry of leaderboard) {
      await ctx.db.delete(entry._id);
    }

    return {
      success: true,
      deletedVotes: votes.length,
      deletedLeaderboard: leaderboard.length,
    };
  },
});

// Distribute daily prize (called by cron job)
export const distributeDailyPrize = mutation({
  args: {},
  handler: async (ctx) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    // Check if already distributed
    const existingWinner = await ctx.db
      .query("dailyPrizeWinners")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existingWinner) {
      return { success: false, error: "Prize already distributed for this date" };
    }

    // Get top voted card for yesterday
    const leaders = await ctx.db
      .query("dailyVoteLeaderboard")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();

    if (leaders.length === 0) {
      return { success: false, error: "No votes recorded for this date" };
    }

    const winner = leaders.sort((a, b) => b.totalVotes - a.totalVotes)[0];

    // Calculate prize pool
    const paidVotes = await ctx.db
      .query("cardVotes")
      .withIndex("by_date", (q) => q.eq("date", date))
      .filter((q) => q.eq(q.field("isPaid"), true))
      .collect();

    const totalPaidVotes = paidVotes.reduce((sum, v) => sum + v.voteCount, 0);
    const prizePool = totalPaidVotes * 50;

    // Find winner's card to get their address
    const winnerCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", winner.cardFid))
      .first();

    if (winnerCard && prizePool > 0) {
      // Add prize to winner's coins
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_address", (q) => q.eq("address", winnerCard.address.toLowerCase()))
        .first();

      if (profile) {
        const balanceBefore = profile.coins || 0;
        const balanceAfter = balanceBefore + prizePool;
        await ctx.db.patch(profile._id, {
          coins: balanceAfter,
          // 🔒 SECURITY FIX (2026-01-01): Track lifetimeEarned
          lifetimeEarned: (profile.lifetimeEarned || 0) + prizePool,
        });
        // 🔒 AUDIT LOG
        
        // 📊 Log transaction for history
        await ctx.db.insert("coinTransactions", {
          address: profile.address.toLowerCase(),
          type: "earn",
          amount: prizePool,
          source: "leaderboard",
          description: "Card voting prize - Top voter reward",
          balanceBefore,
          balanceAfter,
          timestamp: Date.now(),
        });
      }
    }

    // Record winner
    await ctx.db.insert("dailyPrizeWinners", {
      date,
      cardFid: winner.cardFid,
      username: winner.username,
      displayName: winner.displayName,
      pfpUrl: winner.pfpUrl,
      totalVotes: winner.totalVotes,
      prizeAmount: prizePool,
      createdAt: Date.now(),
    });

    return {
      success: true,
      winner: winner.username,
      prize: prizePool,
      votes: winner.totalVotes,
    };
  },
});

// ============================================================================
// VIBEMAIL - Anonymous messages with votes
// ============================================================================

// Get all messages for a card (inbox)
// 🚀 BANDWIDTH FIX: Uses by_card_message index instead of collecting all votes
export const getMessagesForCard = query({
  args: {
    cardFid: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Use dedicated index for messages (hasMessage = true)
    // Falls back to filtering if hasMessage field not populated yet
    const messagesWithIndex = await ctx.db
      .query("cardVotes")
      .withIndex("by_card_message", (q) =>
        q.eq("cardFid", args.cardFid).eq("hasMessage", true)
      )
      .order("desc")
      .take(limit);

    // If no results from new index, fallback to old method for backwards compat
    // (while hasMessage field is being backfilled)
    if (messagesWithIndex.length === 0) {
      const fallbackVotes = await ctx.db
        .query("cardVotes")
        .withIndex("by_card_date", (q) => q.eq("cardFid", args.cardFid))
        .order("desc")
        .take(limit * 3) // Take more to filter
        .then(votes => votes.filter(v => v.message !== undefined).slice(0, limit));

      return fallbackVotes.map(m => ({
        _id: m._id,
        message: m.message,
        audioId: m.audioId,
        imageId: m.imageId,
        voterFid: m.voterFid,
        isRead: m.isRead ?? false,
        createdAt: m.createdAt,
        voteCount: m.voteCount,
        isPaid: m.isPaid,
        giftNftName: m.giftNftName,
        giftNftImageUrl: m.giftNftImageUrl,
        giftNftCollection: m.giftNftCollection,
      }));
    }

    return messagesWithIndex.map(m => ({
      _id: m._id,
      message: m.message,
      audioId: m.audioId,
      imageId: m.imageId,
      voterFid: m.voterFid,
      isRead: m.isRead ?? false,
      createdAt: m.createdAt,
      voteCount: m.voteCount,
      isPaid: m.isPaid,
      giftNftName: m.giftNftName,
      giftNftImageUrl: m.giftNftImageUrl,
      giftNftCollection: m.giftNftCollection,
    }));
  },
});

// Mark a message as read
export const markMessageAsRead = mutation({
  args: { messageId: v.id("cardVotes") },
  handler: async (ctx, args) => {
    const vote = await ctx.db.get(args.messageId);
    if (!vote || vote.message === undefined) {
      return { success: false, error: "Message not found" };
    }

    await ctx.db.patch(args.messageId, { isRead: true });
    return { success: true };
  },
});

// Delete a message from inbox (only owner can delete)
export const deleteMessage = mutation({
  args: {
    messageId: v.id("cardVotes"),
    ownerFid: v.number(), // FID of the inbox owner
  },
  handler: async (ctx, args) => {
    const vote = await ctx.db.get(args.messageId);
    if (!vote || vote.message === undefined) {
      return { success: false, error: "Message not found" };
    }

    // Only inbox owner can delete messages
    if (vote.cardFid !== args.ownerFid) {
      return { success: false, error: "Not authorized" };
    }

    await ctx.db.delete(args.messageId);
    return { success: true };
  },
});

// Delete multiple messages from inbox
export const deleteMessages = mutation({
  args: {
    messageIds: v.array(v.id("cardVotes")),
    ownerFid: v.number(),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    let errors = 0;

    for (const messageId of args.messageIds) {
      const vote = await ctx.db.get(messageId);
      if (!vote || vote.message === undefined) {
        errors++;
        continue;
      }

      if (vote.cardFid !== args.ownerFid) {
        errors++;
        continue;
      }

      await ctx.db.delete(messageId);
      deleted++;
    }

    return { success: true, deleted, errors };
  },
});

// Get unread message count for a card
export const getUnreadMessageCount = query({
  args: { cardFid: v.number() },
  handler: async (ctx, args) => {
    // Use index to get only unread for this card
    const unread = await ctx.db
      .query("cardVotes")
      .withIndex("by_card_unread", (q) => 
        q.eq("cardFid", args.cardFid).eq("isRead", false)
      )
      .filter((q) => q.neq(q.field("message"), undefined))
      .collect();

    return unread.length;
  },
});


// ============================================================================
// ADMIN: Broadcast VibeMail to multiple FIDs
// ============================================================================

export const broadcastVibeMail = mutation({
  args: {
    recipientFids: v.array(v.number()), // List of FIDs to send to
    message: v.string(),
    audioId: v.optional(v.string()),
    imageId: v.optional(v.string()), // Meme image
    senderAddress: v.optional(v.string()), // Sender address
    senderFid: v.optional(v.number()), // Admin sender FID (default: 0 for system)
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const senderFid = args.senderFid || 0;
    const senderAddress = args.senderAddress?.toLowerCase() || "0x0000000000000000000000000000000000000000";

    const results = [];

    for (const recipientFid of args.recipientFids) {
      try {
        // Insert VibeMail directly (no vote restrictions)
        await ctx.db.insert("cardVotes", {
          cardFid: recipientFid,
          voterFid: senderFid,
          voterAddress: senderAddress,
          date: today,
          createdAt: now,
          voteCount: 0, // No vote, just message
          isPaid: false,
          message: args.message.slice(0, 1000), // Increased limit for system messages
          audioId: args.audioId,
          imageId: args.imageId,
          isRead: false,
        });

        // Send notification
        await ctx.scheduler.runAfter(0, internal.notifications.sendVibemailNotification, {
          recipientFid,
          hasAudio: !!args.audioId,
        });

        results.push({ fid: recipientFid, success: true });
      } catch (error: any) {
        results.push({ fid: recipientFid, success: false, error: error.message });
      }
    }

    return {
      success: true,
      total: args.recipientFids.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});

// Get recent VibeMail messages for background display (for specific user)
export const getRecentVibeMails = query({
  args: {
    cardFid: v.optional(v.number()), // Filter by recipient FID
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 6;

    // If cardFid provided, get messages for that user only
    if (args.cardFid) {
      const cardFid = args.cardFid;
      const messages = await ctx.db
        .query("cardVotes")
        .withIndex("by_card_date", (q) => q.eq("cardFid", cardFid))
        .filter((q) => q.neq(q.field("message"), undefined))
        .collect();

      const sorted = messages
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, limit);

      return sorted.map(m => ({
        _id: m._id,
        message: m.message?.slice(0, 50),
        cardFid: m.cardFid,
        voterFid: m.voterFid,
        createdAt: m.createdAt,
      }));
    }

    // Fallback: get recent messages - 🚀 BANDWIDTH FIX: Use index + limit
    const fallbackToday = new Date().toISOString().split('T')[0];
    const allMessages = await ctx.db
      .query("cardVotes")
      .withIndex("by_date", (q) => q.eq("date", fallbackToday))
      .filter((q) => q.neq(q.field("message"), undefined))
      .take(100);

    const sorted = allMessages
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);

    return sorted.map(m => ({
      _id: m._id,
      message: m.message?.slice(0, 50),
      cardFid: m.cardFid,
      voterFid: m.voterFid,
      createdAt: m.createdAt,
    }));
  },
});

// 🚀 BANDWIDTH FIX: Get sent messages with limited fetch
export const getSentMessages = query({
  args: {
    voterFid: v.optional(v.number()),
    senderFid: v.optional(v.number()), // backwards compatibility
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const fid = args.voterFid || args.senderFid;

    if (!fid) {
      return [];
    }

    // 🚀 BANDWIDTH FIX: Take limited sample instead of collecting all
    // Take 3x limit to account for filtering
    const allVotes = await ctx.db
      .query("cardVotes")
      .withIndex("by_voter_date", (q) => q.eq("voterFid", fid))
      .order("desc")
      .take(limit * 3);

    // Filter to only votes with messages and sort by creation time
    const messages = allVotes
      .filter(v => v.message !== undefined && v.isSent !== false)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);

    // Get recipient info for each message
    const messagesWithRecipients = await Promise.all(
      messages.map(async (m) => {
        // Get recipient card info
        const recipientCard = await ctx.db
          .query("farcasterCards")
          .withIndex("by_fid", (q) => q.eq("fid", m.cardFid))
          .first();

        return {
          _id: m._id,
          message: m.message,
          audioId: m.audioId,
          imageId: m.imageId,
          recipientFid: m.cardFid,
          recipientUsername: recipientCard?.username || m.recipientUsername || `FID ${m.cardFid}`,
          recipientPfpUrl: recipientCard?.pfpUrl || "",
          createdAt: m.createdAt,
          voteCount: m.voteCount,
          isPaid: m.isPaid,
      // NFT Gift fields
      giftNftName: m.giftNftName,
      giftNftImageUrl: m.giftNftImageUrl,
      giftNftCollection: m.giftNftCollection,
        };
      })
    );

    return messagesWithRecipients;
  },
});

// Search cards for VibeMail recipient
export const searchCardsForVibeMail = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const searchLower = args.searchTerm.toLowerCase();

    // 🚀 BANDWIDTH FIX: Use search index instead of full table scan
    // First try to find by exact FID
    const fidNumber = parseInt(args.searchTerm);
    if (!isNaN(fidNumber)) {
      const cardByFid = await ctx.db
        .query("farcasterCards")
        .withIndex("by_fid", (q) => q.eq("fid", fidNumber))
        .first();
      if (cardByFid) {
        return [{
          fid: cardByFid.fid,
          username: cardByFid.username,
          pfpUrl: cardByFid.pfpUrl,
        }];
      }
    }

    // Use search index for username lookup
    const searchResults = await ctx.db
      .query("farcasterCards")
      .withSearchIndex("search_username", (q) => q.search("username", args.searchTerm))
      .take(limit);

    return searchResults.map(card => ({
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
    }));
  },
});

// Send direct VibeMail to a card
export const sendDirectVibeMail = mutation({
  args: {
    recipientFid: v.number(),
    senderFid: v.number(),
    senderAddress: v.string(),
    message: v.string(),
    audioId: v.optional(v.string()),
    imageId: v.optional(v.string()), // Meme image
    // NFT Gift fields
    giftNftName: v.optional(v.string()),
    giftNftImageUrl: v.optional(v.string()),
    giftNftCollection: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Cannot send to yourself
    if (args.senderFid === args.recipientFid) {
      throw new Error("Cannot send VibeMail to yourself");
    }

    // 🚀 BANDWIDTH FIX: Determine if paid using dedicated limits table
    const userLimits = await ctx.db
      .query("userDailyLimits")
      .withIndex("by_fid_date", (q) => q.eq("fid", args.senderFid).eq("date", today))
      .first();
    const freeVotesUsed = userLimits?.freeVotesUsed ?? 0;
    const maxFreeVotes = 1;
    const isPaid = freeVotesUsed >= maxFreeVotes;

    // Get recipient card info
    const recipientCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.recipientFid))
      .first();

    if (!recipientCard) {
      throw new Error("Recipient card not found");
    }

    // Insert as a vote with message
    await ctx.db.insert("cardVotes", {
      cardFid: args.recipientFid,
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid,
      voteCount: 1,
      createdAt: now,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: false,
      isSent: true,
      recipientFid: args.recipientFid,
      recipientUsername: recipientCard.username,
      // NFT Gift
      giftNftName: args.giftNftName,
      giftNftImageUrl: args.giftNftImageUrl,
      giftNftCollection: args.giftNftCollection,
      // 🚀 BANDWIDTH FIX: Boolean for efficient message queries
      hasMessage: true,
    });

    // 🚀 BANDWIDTH FIX: Update dedicated limits table for free votes
    if (!isPaid) {
      if (userLimits) {
        await ctx.db.patch(userLimits._id, {
          freeVotesUsed: userLimits.freeVotesUsed + 1,
          lastUpdated: now,
        });
      } else {
        await ctx.db.insert("userDailyLimits", {
          fid: args.senderFid,
          date: today,
          freeVotesUsed: 1,
          lastUpdated: now,
        });
      }
    }

    // 🚀 BANDWIDTH FIX: Update pre-computed vote stats
    const existingStats = await ctx.db
      .query("dailyCardVoteStats")
      .withIndex("by_card_date", (q) => q.eq("cardFid", args.recipientFid).eq("date", today))
      .first();

    if (existingStats) {
      await ctx.db.patch(existingStats._id, {
        totalVotes: existingStats.totalVotes + 1,
        voterCount: existingStats.voterCount + 1,
        lastUpdated: now,
      });
    } else {
      await ctx.db.insert("dailyCardVoteStats", {
        cardFid: args.recipientFid,
        date: today,
        totalVotes: 1,
        voterCount: 1,
        lastUpdated: now,
      });
    }

    // Give 100 VBMS to recipient (always, both free and paid give rewards)
    const existingReward = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", args.recipientFid))
      .first();

    if (existingReward) {
      await ctx.db.patch(existingReward._id, {
        pendingVbms: existingReward.pendingVbms + 100,
        totalVotes: existingReward.totalVotes + 1,
        lastVoteAt: now,
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: args.recipientFid,
        pendingVbms: 100,
        claimedVbms: 0,
        totalVotes: 1,
        lastVoteAt: now,
      });
    }

    // Send notification
    const hasContent = args.message?.trim() || args.imageId;
    if (hasContent) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendVibemailNotification, {
        recipientFid: args.recipientFid,
        hasAudio: !!args.audioId,
      });
    }

    return { success: true };
  },
});

// Reply to a VibeMail message
export const replyToMessage = mutation({
  args: {
    originalMessageId: v.id("cardVotes"),
    senderFid: v.number(),
    senderAddress: v.string(),
    message: v.string(),
    audioId: v.optional(v.string()),
    imageId: v.optional(v.string()), // Meme image
    // NFT Gift fields (optional)
    giftNftName: v.optional(v.string()),
    giftNftImageUrl: v.optional(v.string()),
    giftNftCollection: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Get original message
    const originalMessage = await ctx.db.get(args.originalMessageId);
    if (!originalMessage) {
      throw new Error("Original message not found");
    }

    // Reply goes to the original sender (voterFid)
    const recipientFid = originalMessage.voterFid;

    // Cannot reply to system messages (voterFid = 0)
    if (recipientFid === 0) {
      throw new Error("Cannot reply to system messages");
    }

    // Cannot reply to yourself
    if (args.senderFid === recipientFid) {
      throw new Error("Cannot reply to yourself");
    }

    // Get recipient card info
    const recipientCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", recipientFid))
      .first();

    // Insert reply as a new vote/message
    await ctx.db.insert("cardVotes", {
      cardFid: recipientFid,
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid: false,
      voteCount: 1,
      createdAt: now,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: false,
      isSent: true,
      recipientFid: recipientFid,
      recipientUsername: recipientCard?.username || `FID ${recipientFid}`,
      // NFT Gift fields
      giftNftName: args.giftNftName,
      giftNftImageUrl: args.giftNftImageUrl,
      giftNftCollection: args.giftNftCollection,
    });

    // Give 100 VBMS to recipient
    const existingReward = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", recipientFid))
      .first();

    if (existingReward) {
      await ctx.db.patch(existingReward._id, {
        pendingVbms: existingReward.pendingVbms + 100,
        totalVotes: existingReward.totalVotes + 1,
        lastVoteAt: now,
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: recipientFid,
        pendingVbms: 100,
        claimedVbms: 0,
        totalVotes: 1,
        lastVoteAt: now,
      });
    }

    return { success: true };
  },
});

// Admin: Clear all VibeMails
export const clearAllVibeMails = mutation({
  args: {},
  handler: async (ctx) => {
    const allVotes = await ctx.db
      .query("cardVotes")
      .filter((q) => q.neq(q.field("message"), undefined))
      .collect();
    
    let deleted = 0;
    for (const vote of allVotes) {
      await ctx.db.delete(vote._id);
      deleted++;
    }
    
    return { deleted };
  },
});

// 🚀 BANDWIDTH FIX: Get a random card from a sample
export const getRandomCard = query({
  args: { excludeFid: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Take a sample instead of all cards
    const sample = await ctx.db
      .query("farcasterCards")
      .take(100);

    // Filter out the sender's card
    const eligibleCards = args.excludeFid
      ? sample.filter(c => c.fid !== args.excludeFid)
      : sample;

    if (eligibleCards.length === 0) return null;

    // Pick a random card from the sample
    const randomIndex = Math.floor(Math.random() * eligibleCards.length);
    const card = eligibleCards[randomIndex];

    return {
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
      displayName: card.displayName,
    };
  },
});

// 🚀 BANDWIDTH FIX: Get multiple random cards from a sample
export const getRandomCards = query({
  args: {
    count: v.number(),
    excludeFid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Take a larger sample to have enough variety
    const sampleSize = Math.max(100, args.count * 3);
    const sample = await ctx.db
      .query("farcasterCards")
      .take(sampleSize);

    // Filter out the sender's card
    const eligibleCards = args.excludeFid
      ? sample.filter(c => c.fid !== args.excludeFid)
      : sample;

    if (eligibleCards.length === 0) return [];

    // Shuffle and pick count cards
    const shuffled = [...eligibleCards].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(args.count, eligibleCards.length));

    return selected.map(card => ({
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
    }));
  },
});

// 🚀 BANDWIDTH FIX: Get a random card without loading all cards
export const getRandomCardMutation = mutation({
  args: { excludeFid: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Take a sample of 100 cards (much lighter than all cards)
    const sampleSize = 100;
    const sample = await ctx.db
      .query("farcasterCards")
      .take(sampleSize);

    // Filter out the sender's card
    const eligibleCards = args.excludeFid
      ? sample.filter(c => c.fid !== args.excludeFid)
      : sample;

    if (eligibleCards.length === 0) return null;

    // Pick a random card from the sample
    const randomIndex = Math.floor(Math.random() * eligibleCards.length);
    const card = eligibleCards[randomIndex];

    return {
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
      displayName: card.displayName,
      address: card.address,
    };
  },
});

// 🚀 BANDWIDTH FIX: Get multiple random cards from a sample
export const getRandomCardsMutation = mutation({
  args: {
    count: v.number(),
    excludeFid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Take a sample instead of all cards
    const sampleSize = Math.max(100, args.count * 3);
    const sample = await ctx.db
      .query("farcasterCards")
      .take(sampleSize);

    // Filter out the sender's card
    const eligibleCards = args.excludeFid
      ? sample.filter(c => c.fid !== args.excludeFid)
      : sample;

    if (eligibleCards.length === 0) return [];

    // Shuffle and pick count cards
    const shuffled = [...eligibleCards].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(args.count, eligibleCards.length));

    return selected.map(card => ({
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
    }));
  },
});

// Get VibeMail stats for a user (VBMS sent to others, VBMS received from others)
export const getVibeMailStats = query({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    // Get all VibeMails SENT by this user (any message sent, paid or not)
    const sentMessages = await ctx.db
      .query("cardVotes")
      .withIndex("by_voter_date", (q) => q.eq("voterFid", args.fid))
      .collect();

    // Count ALL messages sent (with message field) - each costs 100 VBMS
    // Include both paid votes and replies/broadcasts
    const allSent = sentMessages.filter(v => v.message !== undefined && v.message !== "");
    const totalVbmsSent = allSent.length * 100; // Each VibeMail costs 100 VBMS

    // Get vibeRewards for RECEIVED - this is the actual earned VBMS
    const vibeRewards = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    // Total received = pending + already claimed
    const totalVbmsReceived = vibeRewards
      ? vibeRewards.pendingVbms + vibeRewards.claimedVbms
      : 0;

    // Count all messages received (for stats)
    const receivedMessages = await ctx.db
      .query("cardVotes")
      .withIndex("by_card_date", (q) => q.eq("cardFid", args.fid))
      .collect();

    return {
      totalVbmsSent,           // Total VBMS spent on ALL VibeMails sent
      totalVbmsReceived,       // Total VBMS earned from ALL votes (pending + claimed)
      messagesSent: allSent.length,
      messagesReceived: receivedMessages.length,
    };
  },
});

/**
 * Backfill dailyCardVoteStats for today
 * Run once after deploy: npx convex run cardVotes:backfillDailyStats
 */
export const backfillDailyStats = mutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();

    // Get all votes for today grouped by card
    const votes = await ctx.db
      .query("cardVotes")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    // Group by cardFid
    const statsByCard = new Map<number, { totalVotes: number; voterCount: number }>();
    for (const vote of votes) {
      const existing = statsByCard.get(vote.cardFid) || { totalVotes: 0, voterCount: 0 };
      statsByCard.set(vote.cardFid, {
        totalVotes: existing.totalVotes + vote.voteCount,
        voterCount: existing.voterCount + 1,
      });
    }

    let created = 0;
    let updated = 0;

    for (const [cardFid, stats] of statsByCard) {
      const existing = await ctx.db
        .query("dailyCardVoteStats")
        .withIndex("by_card_date", (q) => q.eq("cardFid", cardFid).eq("date", today))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          totalVotes: stats.totalVotes,
          voterCount: stats.voterCount,
          lastUpdated: now,
        });
        updated++;
      } else {
        await ctx.db.insert("dailyCardVoteStats", {
          cardFid,
          date: today,
          totalVotes: stats.totalVotes,
          voterCount: stats.voterCount,
          lastUpdated: now,
        });
        created++;
      }
    }

    return { success: true, created, updated, total: statsByCard.size };
  },
});
