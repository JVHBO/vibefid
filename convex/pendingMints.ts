import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 🔧 FIX: Pending Mints System
 *
 * Saves IPFS URLs BEFORE on-chain mint to prevent orphan cards.
 * If the final save to farcasterCards fails, we can recover using this data.
 */

/**
 * Save pending mint data (called BEFORE on-chain mint)
 */
export const savePendingMint = mutation({
  args: {
    fid: v.number(),
    address: v.string(),
    username: v.string(),
    displayName: v.string(),
    pfpUrl: v.string(),
    bio: v.string(),
    neynarScore: v.number(),
    followerCount: v.number(),
    followingCount: v.number(),
    powerBadge: v.boolean(),
    rarity: v.string(),
    foil: v.string(),
    wear: v.string(),
    power: v.number(),
    suit: v.string(),
    rank: v.string(),
    suitSymbol: v.string(),
    color: v.string(),
    imageUrl: v.string(),
    cardImageUrl: v.string(),
    shareImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedAddress = args.address.toLowerCase();

    // Check if pending mint already exists for this FID
    const existing = await ctx.db
      .query("pendingMints")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        ...args,
        address: normalizedAddress,
        status: "pending",
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });
      console.log(`[PendingMints] Updated existing pending mint for FID ${args.fid}`);
      return existing._id;
    }

    // Create new pending mint
    const id = await ctx.db.insert("pendingMints", {
      ...args,
      address: normalizedAddress,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log(`[PendingMints] Created pending mint for FID ${args.fid}`);
    return id;
  },
});

/**
 * Get pending mint by FID
 */
export const getPendingMint = query({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingMints")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();
  },
});

/**
 * Get pending mint by address
 */
export const getPendingMintByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const normalizedAddress = args.address.toLowerCase();
    return await ctx.db
      .query("pendingMints")
      .withIndex("by_address", (q) => q.eq("address", normalizedAddress))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
  },
});

/**
 * Mark pending mint as minted (on-chain confirmed)
 */
export const markAsMinted = mutation({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingMints")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (!pending) {
      console.error(`[PendingMints] No pending mint found for FID ${args.fid}`);
      return null;
    }

    await ctx.db.patch(pending._id, {
      status: "minted",
      mintedAt: Date.now(),
    });

    console.log(`[PendingMints] Marked FID ${args.fid} as minted`);
    return pending;
  },
});

/**
 * Complete pending mint (after successfully saving to farcasterCards)
 */
export const completePendingMint = mutation({
  args: { fid: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingMints")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (!pending) {
      return false;
    }

    // Delete the pending mint (no longer needed)
    await ctx.db.delete(pending._id);
    console.log(`[PendingMints] Completed and deleted pending mint for FID ${args.fid}`);
    return true;
  },
});

/**
 * Clean up expired pending mints (called by cron or manually)
 */
export const cleanupExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("pendingMints")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    let count = 0;
    for (const mint of expired) {
      // Only delete if not minted (don't lose data for minted but incomplete)
      if (mint.status === "pending") {
        await ctx.db.delete(mint._id);
        count++;
      }
    }

    console.log(`[PendingMints] Cleaned up ${count} expired pending mints`);
    return count;
  },
});
