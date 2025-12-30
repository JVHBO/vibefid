import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Save notification token for a user
 * Used by FarcasterNotificationRegistration component
 */
export const saveToken = mutation({
  args: {
    fid: v.string(),
    token: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const { fid, token, url } = args;
    const now = Date.now();

    // Determine platform from URL
    const platform = url.includes("api.farcaster.xyz") ? "warpcast" : "neynar";

    // Check for existing token for this fid + platform
    const existing = await ctx.db
      .query("notificationTokens")
      .withIndex("by_fid_platform", (q) => q.eq("fid", fid).eq("platform", platform))
      .first();

    if (existing) {
      // Update existing token
      await ctx.db.patch(existing._id, {
        token,
        url,
        lastUpdated: now,
      });
      return { success: true, action: "updated" };
    }

    // Create new token
    await ctx.db.insert("notificationTokens", {
      fid,
      token,
      url,
      platform,
      createdAt: now,
      lastUpdated: now,
    });

    return { success: true, action: "created" };
  },
});

/**
 * Get notification token for a user
 */
export const getToken = query({
  args: {
    fid: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("notificationTokens")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    return token;
  },
});
