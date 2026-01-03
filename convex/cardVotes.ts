import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * VibeFID Card Voting System
 *
 * Features:
 * - 3 free votes per day per user
 * - Paid votes (unlimited) cost 100 coins each
 * - Daily prize pool distributed to top voted card
 * - Vote history tracking
 */

// Get votes for a specific card
export const getCardVotes = query({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];

    const votes = await ctx.db
      .query("cardVotes")
      .filter((q) => q.and(
        q.eq(q.field("cardFid"), args.fid),
        q.eq(q.field("date"), today)
      ))
      .collect();

    return {
      totalVotes: votes.reduce((sum, v) => sum + v.voteCount, 0),
      voterCount: votes.length,
    };
  },
});

// Check if user has voted for a card today
export const hasUserVoted = query({
  args: {
    cardFid: v.number(),
    voterFid: v.number(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];

    const vote = await ctx.db
      .query("cardVotes")
      .filter((q) => q.and(
        q.eq(q.field("cardFid"), args.cardFid),
        q.eq(q.field("voterFid"), args.voterFid),
        q.eq(q.field("date"), today)
      ))
      .first();

    return !!vote;
  },
});

// Get user's remaining free votes for today
export const getUserFreeVotesRemaining = query({
  args: { voterFid: v.number() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];

    const votesToday = await ctx.db
      .query("cardVotes")
      .filter((q) => q.and(
        q.eq(q.field("voterFid"), args.voterFid),
        q.eq(q.field("date"), today),
        q.eq(q.field("isPaid"), false)
      ))
      .collect();

    const freeVotesUsed = votesToday.length;
    const maxFreeVotes = 3;

    return {
      remaining: Math.max(0, maxFreeVotes - freeVotesUsed),
      used: freeVotesUsed,
      max: maxFreeVotes,
    };
  },
});

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
        .filter((q) => q.and(
          q.eq(q.field("cardFid"), args.cardFid),
          q.eq(q.field("voterFid"), args.voterFid),
          q.eq(q.field("date"), today)
        ))
        .first();

      if (existingVote) {
        return { success: false, error: "Already voted for this card today" };
      }

      // Check free votes remaining
      const votesToday = await ctx.db
        .query("cardVotes")
        .filter((q) => q.and(
          q.eq(q.field("voterFid"), args.voterFid),
          q.eq(q.field("date"), today),
          q.eq(q.field("isPaid"), false)
        ))
        .collect();

      if (votesToday.length >= 3) {
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
    const hasMessage = args.message && args.message.trim().length > 0;
    await ctx.db.insert("cardVotes", {
      cardFid: args.cardFid,
      voterFid: args.voterFid,
      voterAddress: args.voterAddress.toLowerCase(),
      date: today,
      isPaid: args.isPaid,
      voteCount: voteCount,
      createdAt: now,
      // VibeMail fields
      message: hasMessage && args.message ? args.message.slice(0, 200) : undefined, // Max 200 chars
      audioId: hasMessage ? args.audioId : undefined, // Only save audio if message exists
      isRead: hasMessage ? false : undefined, // Only track read status if message exists
    });

    // Update daily leaderboard
    await updateDailyLeaderboard(ctx, args.cardFid, today, voteCount);

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
    .filter((q: any) => q.and(
      q.eq(q.field("cardFid"), cardFid),
      q.eq(q.field("date"), date)
    ))
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
      .filter((q: any) => q.eq(q.field("fid"), cardFid))
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
      .filter((q) => q.eq(q.field("date"), today))
      .collect();

    // Sort by votes and take top N
    return leaders
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, limit);
  },
});

// Get daily prize pool info
export const getDailyPrizeInfo = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split('T')[0];

    // Count paid votes today (each paid vote adds to prize pool)
    const paidVotes = await ctx.db
      .query("cardVotes")
      .filter((q) => q.and(
        q.eq(q.field("date"), today),
        q.eq(q.field("isPaid"), true)
      ))
      .collect();

    const totalPaidVotes = paidVotes.reduce((sum, v) => sum + v.voteCount, 0);
    const prizePool = totalPaidVotes * 50; // 50% of vote cost goes to prize pool

    // Get current leader
    const leaders = await ctx.db
      .query("dailyVoteLeaderboard")
      .filter((q) => q.eq(q.field("date"), today))
      .collect();

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
      .filter((q) => q.eq(q.field("date"), date))
      .first();

    if (existingWinner) {
      return { success: false, error: "Prize already distributed for this date" };
    }

    // Get top voted card for yesterday
    const leaders = await ctx.db
      .query("dailyVoteLeaderboard")
      .filter((q) => q.eq(q.field("date"), date))
      .collect();

    if (leaders.length === 0) {
      return { success: false, error: "No votes recorded for this date" };
    }

    const winner = leaders.sort((a, b) => b.totalVotes - a.totalVotes)[0];

    // Calculate prize pool
    const paidVotes = await ctx.db
      .query("cardVotes")
      .filter((q) => q.and(
        q.eq(q.field("date"), date),
        q.eq(q.field("isPaid"), true)
      ))
      .collect();

    const totalPaidVotes = paidVotes.reduce((sum, v) => sum + v.voteCount, 0);
    const prizePool = totalPaidVotes * 50;

    // Find winner's card to get their address
    const winnerCard = await ctx.db
      .query("farcasterCards")
      .filter((q) => q.eq(q.field("fid"), winner.cardFid))
      .first();

    if (winnerCard && prizePool > 0) {
      // Add prize to winner's coins
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_address", (q) => q.eq("address", winnerCard.address.toLowerCase()))
        .first();

      if (profile) {
        await ctx.db.patch(profile._id, {
          coins: (profile.coins || 0) + prizePool,
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

// Get all RECEIVED messages for a card (inbox)
export const getMessagesForCard = query({
  args: {
    cardFid: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const messages = await ctx.db
      .query("cardVotes")
      .withIndex("by_card_unread", (q) => q.eq("cardFid", args.cardFid))
      .filter((q) =>
        q.and(
          q.neq(q.field("message"), undefined),
          q.neq(q.field("isSent"), true) // Only received messages
        )
      )
      .order("desc")
      .take(limit);

    return messages.map(m => ({
      _id: m._id,
      message: m.message,
      audioId: m.audioId,
      imageId: m.imageId,
      isRead: m.isRead ?? false,
      createdAt: m.createdAt,
      voteCount: m.voteCount,
      isPaid: m.isPaid,
      voterFid: m.voterFid,
      isSent: m.isSent ?? false,
    }));
  },
});

// Get sent messages by a user (voterFid)
export const getSentMessages = query({
  args: {
    voterFid: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get all votes sent by this user that have messages
    const allVotes = await ctx.db
      .query("cardVotes")
      .withIndex("by_voter_date", (q) => q.eq("voterFid", args.voterFid))
      .collect();

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
        };
      })
    );

    return messagesWithRecipients;
  },
});

// Mark a message as read
export const markMessageAsRead = mutation({
  args: { messageId: v.id("cardVotes") },
  handler: async (ctx, args) => {
    const vote = await ctx.db.get(args.messageId);
    if (!vote || !vote.message) {
      return { success: false, error: "Message not found" };
    }

    await ctx.db.patch(args.messageId, { isRead: true });
    return { success: true };
  },
});

// Get unread message count for a card
export const getUnreadMessageCount = query({
  args: { cardFid: v.number() },
  handler: async (ctx, args) => {
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
        .withIndex("by_card_unread", (q) => q.eq("cardFid", cardFid))
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

    // Fallback: get all recent messages
    const allMessages = await ctx.db
      .query("cardVotes")
      .filter((q) => q.neq(q.field("message"), undefined))
      .collect();

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

// Reply to a message anonymously - looks up voterFid internally for privacy
// Costs 100 coins, recipient gets 100 VBMS
export const replyToMessage = mutation({
  args: {
    originalMessageId: v.id("cardVotes"),
    senderFid: v.number(),
    senderAddress: v.string(),
    message: v.string(),
    audioId: v.optional(v.string()),
    imageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const costPerMessage = 100;
    const vbmsReward = 100;

    // Get original message to find who sent it
    const originalMessage = await ctx.db.get(args.originalMessageId);
    if (!originalMessage) {
      return { success: false, error: "Original message not found" };
    }

    // Get the voterFid from original message - this is who we reply to
    const recipientFid = originalMessage.voterFid;
    if (!recipientFid) {
      return { success: false, error: "Cannot reply to this message" };
    }

    // Cannot reply to yourself
    if (recipientFid === args.senderFid) {
      return { success: false, error: "Cannot send VibeMail to yourself" };
    }

    // Check if sender has a minted card
    const senderCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.senderFid))
      .first();
    if (!senderCard || !senderCard.contractAddress) {
      return { success: false, error: "You need a minted VibeFID card to send VibeMail" };
    }

    // Check if recipient has a minted card
    const recipientCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", recipientFid))
      .first();
    if (!recipientCard || !recipientCard.contractAddress) {
      return { success: false, error: "Recipient doesn't have a minted VibeFID card" };
    }

    // Find sender profile and check coins
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_address", (q) => q.eq("address", args.senderAddress.toLowerCase()))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    const currentCoins = profile.coins || 0;
    if (currentCoins < costPerMessage) {
      return { success: false, error: `Not enough coins. Need ${costPerMessage}, have ${currentCoins}` };
    }

    // Deduct coins from sender
    await ctx.db.patch(profile._id, {
      coins: currentCoins - costPerMessage,
    });

    // Get recipient username for sent copy (recipientCard already fetched above)
    const recipientUsername = recipientCard?.username || `FID ${recipientFid}`;

    // Create the reply message (sent to the original sender's inbox)
    await ctx.db.insert("cardVotes", {
      cardFid: recipientFid,
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid: true,
      voteCount: 1,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: false,
      isSent: false,
      createdAt: now,
    });

    // Create copy for sender (sent folder)
    await ctx.db.insert("cardVotes", {
      cardFid: args.senderFid, // Goes to sender's inbox
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid: true,
      voteCount: 1,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: true,
      isSent: true,
      recipientFid: recipientFid,
      recipientUsername,
      createdAt: now,
    });

    // Update vibeRewards for recipient
    const existingReward = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", recipientFid))
      .first();

    if (existingReward) {
      await ctx.db.patch(existingReward._id, {
        pendingVbms: existingReward.pendingVbms + vbmsReward,
        totalVotes: existingReward.totalVotes + 1,
        lastVoteAt: now,
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: recipientFid,
        pendingVbms: vbmsReward,
        claimedVbms: 0,
        totalVotes: 1,
        lastVoteAt: now,
        lastClaimAt: 0,
      });
    }

    return { success: true };
  },
});

// Send VibeMail directly to a FID
// Costs 100 coins, recipient gets 100 VBMS
export const sendDirectVibeMail = mutation({
  args: {
    recipientFid: v.number(),
    senderFid: v.number(),
    senderAddress: v.string(),
    message: v.string(),
    audioId: v.optional(v.string()),
    imageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const costPerMessage = 100;
    const vbmsReward = 100;

    // Don't allow sending to yourself
    if (args.recipientFid === args.senderFid) {
      return { success: false, error: "Cannot send VibeMail to yourself" };
    }

    // Check if sender has a minted card
    const senderCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.senderFid))
      .first();
    if (!senderCard || !senderCard.contractAddress) {
      return { success: false, error: "You need a minted VibeFID card to send VibeMail" };
    }

    // Check if recipient has a minted card
    const recipientCardCheck = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.recipientFid))
      .first();
    if (!recipientCardCheck || !recipientCardCheck.contractAddress) {
      return { success: false, error: "Recipient doesn't have a minted VibeFID card" };
    }

    // Find sender profile and check coins
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_address", (q) => q.eq("address", args.senderAddress.toLowerCase()))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    const currentCoins = profile.coins || 0;
    if (currentCoins < costPerMessage) {
      return { success: false, error: `Not enough coins. Need ${costPerMessage}, have ${currentCoins}` };
    }

    // Deduct coins from sender
    await ctx.db.patch(profile._id, {
      coins: currentCoins - costPerMessage,
    });

    // Get recipient username for sent copy
    const recipientCard = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.recipientFid))
      .first();
    const recipientUsername = recipientCard?.username || `FID ${args.recipientFid}`;

    // Create the message for recipient (inbox)
    await ctx.db.insert("cardVotes", {
      cardFid: args.recipientFid,
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid: true,
      voteCount: 1,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: false,
      isSent: false,
      createdAt: now,
    });

    // Create copy for sender (sent folder)
    await ctx.db.insert("cardVotes", {
      cardFid: args.senderFid, // Goes to sender's inbox
      voterFid: args.senderFid,
      voterAddress: args.senderAddress.toLowerCase(),
      date: today,
      isPaid: true,
      voteCount: 1,
      message: args.message.slice(0, 200),
      audioId: args.audioId,
      imageId: args.imageId,
      isRead: true, // Sender doesn't need to "read" their own sent message
      isSent: true,
      recipientFid: args.recipientFid,
      recipientUsername,
      createdAt: now,
    });

    // Update vibeRewards for recipient
    const existingReward = await ctx.db
      .query("vibeRewards")
      .withIndex("by_fid", (q) => q.eq("fid", args.recipientFid))
      .first();

    if (existingReward) {
      await ctx.db.patch(existingReward._id, {
        pendingVbms: existingReward.pendingVbms + vbmsReward,
        totalVotes: existingReward.totalVotes + 1,
        lastVoteAt: now,
      });
    } else {
      await ctx.db.insert("vibeRewards", {
        fid: args.recipientFid,
        pendingVbms: vbmsReward,
        claimedVbms: 0,
        totalVotes: 1,
        lastVoteAt: now,
        lastClaimAt: 0,
      });
    }

    return { success: true };
  },
});

// Search cards for VibeMail recipient (lightweight query)
export const searchCardsForVibeMail = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 10, 20);
    const searchTerm = args.searchTerm.trim();
    
    if (!searchTerm) return [];

    // Check if search term is a FID (number)
    const isNumericSearch = /^\d+$/.test(searchTerm);

    if (isNumericSearch) {
      const fid = parseInt(searchTerm, 10);
      const card = await ctx.db
        .query("farcasterCards")
        .withIndex("by_fid", (q) => q.eq("fid", fid))
        .first();
      
      if (card) {
        return [{
          fid: card.fid,
          username: card.username,
          pfpUrl: card.pfpUrl,
        }];
      }
      return [];
    }

    // Username search
    const results = await ctx.db
      .query("farcasterCards")
      .withSearchIndex("search_username", (q) => q.search("username", searchTerm))
      .take(limit);

    return results.map(card => ({
      fid: card.fid,
      username: card.username,
      pfpUrl: card.pfpUrl,
    }));
  },
});
