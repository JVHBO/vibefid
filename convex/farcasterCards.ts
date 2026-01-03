import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Mint a Farcaster Card
 *
 * Takes Farcaster user data from Neynar API and creates a playable card
 */
export const mintFarcasterCard = mutation({
  args: {
    // Farcaster Data (from Neynar API)
    fid: v.number(),
    username: v.string(),
    displayName: v.string(),
    pfpUrl: v.string(),
    bio: v.string(),
    neynarScore: v.number(),
    followerCount: v.number(),
    followingCount: v.number(),
    powerBadge: v.boolean(),

    // Owner
    address: v.string(),

    // Card traits (calculated on frontend)
    rarity: v.string(),
    foil: v.string(),
    wear: v.string(),
    power: v.number(),

    // Playing card properties
    suit: v.string(), // "hearts", "diamonds", "spades", "clubs"
    rank: v.string(), // "2"-"10", "J", "Q", "K", "A"
    suitSymbol: v.string(), // "♥", "♦", "♠", "♣"
    color: v.string(), // "red" or "black"

    // Generated image URLs
    imageUrl: v.string(), // Video (MP4)
    cardImageUrl: v.optional(v.string()), // Static PNG for sharing
    shareImageUrl: v.optional(v.string()), // Share image with card + criminal text

    // Contract
    contractAddress: v.optional(v.string()), // NFT contract address

    // User preferences
    language: v.optional(v.string()), // User's preferred language (en, pt, es, etc.)
  },
  handler: async (ctx, args) => {
    const normalizedAddress = args.address.toLowerCase();

    // CRITICAL FIX: Check if FID already exists to prevent orphan duplicates
    const existingCards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .collect();

    if (existingCards.length > 0) {
      console.error(`❌ DUPLICATE PREVENTION: FID ${args.fid} already exists in database!`);
      console.error(`   Existing cards: ${existingCards.length}`);
      existingCards.forEach((card, idx) => {
        console.error(`   ${idx + 1}. ${card.rank}${card.suitSymbol} (${card.rarity}) - ID: ${card._id}`);
      });

      throw new Error(
        `FID ${args.fid} already minted! Each FID can only be minted once. ` +
        `If you believe this is an error, please contact support.`
      );
    }

    // Generate unique card ID with timestamp
    const timestamp = Date.now();
    const cardId = `farcaster_${args.fid}_${timestamp}`;

    // Smart contract ensures 1 mint per FID on-chain
    // This check prevents orphan database entries from bugs/race conditions

    // Insert card (now protected against duplicates)
    const cardDocId = await ctx.db.insert("farcasterCards", {
      // Farcaster Data
      fid: args.fid,
      username: args.username,
      displayName: args.displayName,
      pfpUrl: args.pfpUrl,
      bio: args.bio.slice(0, 200), // Truncate bio

      // Owner
      address: normalizedAddress,

      // Contract
      contractAddress: args.contractAddress,

      // Card Properties
      cardId,
      rarity: args.rarity,
      foil: args.foil,
      wear: args.wear,
      status: "Rarity Assigned", // All Farcaster cards have rarity from Neynar score
      power: args.power,

      // Playing Card Properties
      suit: args.suit,
      rank: args.rank,
      suitSymbol: args.suitSymbol,
      color: args.color,

      // Farcaster Stats
      neynarScore: args.neynarScore,
      followerCount: args.followerCount,
      followingCount: args.followingCount,
      powerBadge: args.powerBadge,

      // Generated Images
      imageUrl: args.imageUrl, // Video (MP4)
      cardImageUrl: args.cardImageUrl, // Static PNG for sharing
      shareImageUrl: args.shareImageUrl, // Share image with card + criminal text

      // Game State
      equipped: false,

      // Metadata
      mintedAt: Date.now(),
    });

    console.log(`✅ Farcaster card minted: FID ${args.fid} (${args.rarity}) by ${normalizedAddress}`);

    // Save initial Neynar score to history (first entry = mint time score)
    try {
      await ctx.db.insert("neynarScoreHistory", {
        fid: args.fid,
        username: args.username,
        score: args.neynarScore,
        rarity: args.rarity,
        checkedAt: Date.now(),
      });
      console.log(`Initial Neynar score saved: ${args.neynarScore}`);
    } catch (error) {
      console.error("Failed to save initial score:", error);
    }

    // Mark VibeFID minted mission - handled by VBMS deployment
    // VibeFID standalone doesnt have the missions module

    // Send welcome VibeMail to new player with translated message
    try {
      const today = new Date().toISOString().split('T')[0];
      const lang = args.language || 'en';

      // Welcome messages in different languages (with special formatting)
      // **bold** and [link](url) are rendered by VibeMail component
      const welcomeMessages: Record<string, string> = {
        en: `🎉 **Welcome to VibeFID, ${args.username}!**

Your **${args.rarity}** card has been created!

📱 **VibeFID** → Your Farcaster profile became a collectible card! Power is based on your Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Battle with your card in Poker and PvP. Bet VBMS in Mecha Arena and fight Raid Bosses!

🃏 **Partner Collections** → Cards from partner projects also work in battles!

🎯 **Wanted Cast** → Interact with featured posts and earn VBMS!

📬 **VibeMail** → Your inbox for anonymous messages.

Good luck! 🚀`,

        pt: `🎉 **Bem-vindo ao VibeFID, ${args.username}!**

Sua carta **${args.rarity}** foi criada!

📱 **VibeFID** → Seu perfil Farcaster virou uma carta colecionável! O poder é baseado no seu Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Batalhe com sua carta em Poker e PvP. Aposte VBMS no Mecha Arena e enfrente Raid Bosses!

🃏 **Coleções Parceiras** → Cartas de projetos parceiros também funcionam nas batalhas!

🎯 **Wanted Cast** → Interaja com posts em destaque e ganhe VBMS!

📬 **VibeMail** → Seu inbox para mensagens anônimas.

Boa sorte! 🚀`,

        es: `🎉 **¡Bienvenido a VibeFID, ${args.username}!**

¡Tu carta **${args.rarity}** ha sido creada!

📱 **VibeFID** → ¡Tu perfil de Farcaster se convirtió en una carta coleccionable! El poder se basa en tu Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → ¡Batalla con tu carta en Poker y PvP. Apuesta VBMS en Mecha Arena y enfrenta Raid Bosses!

🃏 **Colecciones Asociadas** → ¡Las cartas de proyectos asociados también funcionan en las batallas!

🎯 **Wanted Cast** → ¡Interactúa con posts destacados y gana VBMS!

📬 **VibeMail** → Tu buzón para mensajes anónimos.

¡Buena suerte! 🚀`,

        fr: `🎉 **Bienvenue sur VibeFID, ${args.username}!**

Votre carte **${args.rarity}** a été créée!

📱 **VibeFID** → Votre profil Farcaster est devenu une carte de collection! La puissance est basée sur votre Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Combattez avec votre carte au Poker et PvP. Pariez des VBMS dans Mecha Arena et affrontez les Raid Bosses!

🃏 **Collections Partenaires** → Les cartes des projets partenaires fonctionnent aussi dans les batailles!

🎯 **Wanted Cast** → Interagissez avec les posts en vedette et gagnez des VBMS!

📬 **VibeMail** → Votre boîte de réception pour les messages anonymes.

Bonne chance! 🚀`,

        hi: `🎉 **VibeFID mein aapka swagat hai, ${args.username}!**

Aapka **${args.rarity}** card ban gaya hai!

📱 **VibeFID** → Aapka Farcaster profile ek collectible card ban gaya! Power aapke Neynar Score par based hai.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Apne card se Poker aur PvP mein battle karein. Mecha Arena mein VBMS lagayein aur Raid Bosses se ladein!

🃏 **Partner Collections** → Partner projects ke cards bhi battles mein kaam karte hain!

🎯 **Wanted Cast** → Featured posts se interact karein aur VBMS kamayein!

📬 **VibeMail** → Anonymous messages ke liye aapka inbox.

Good luck! 🚀`,

        ru: `🎉 **Dobro pozhalovat v VibeFID, ${args.username}!**

Vasha karta **${args.rarity}** sozdana!

📱 **VibeFID** → Vash profil Farcaster stal kollektsionnoy kartoy! Sila osnovana na vashem Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Srazhaysya kartoy v Poker i PvP. Stavte VBMS v Mecha Arena i srazhaysya s Raid Bossami!

🃏 **Partnerskie Kollektsii** → Karty partnerskih proektov tozhe rabotayut v bitvah!

🎯 **Wanted Cast** → Vzaimodeystvuyte s izbrannymi postami i zarabatyvayte VBMS!

📬 **VibeMail** → Vash pochtovyy yashchik dlya anonimnykh soobshcheniy.

Udachi! 🚀`,

        zh: `🎉 **欢迎来到 VibeFID, ${args.username}!**

你的 **${args.rarity}** 卡片已创建!

📱 **VibeFID** → 你的 Farcaster 个人资料变成了收藏卡!力量基于你的 Neynar Score。

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → 用你的卡片在 Poker 和 PvP 中战斗。在 Mecha Arena 下注 VBMS 并挑战 Raid Bosses!

🃏 **合作系列** → 合作项目的卡片也可以在战斗中使用!

🎯 **Wanted Cast** → 与精选帖子互动并赚取 VBMS!

📬 **VibeMail** → 你的匿名消息收件箱。

祝你好运! 🚀`,

        id: `🎉 **Selamat datang di VibeFID, ${args.username}!**

Kartu **${args.rarity}** kamu sudah dibuat!

📱 **VibeFID** → Profil Farcaster kamu jadi kartu koleksi! Kekuatan berdasarkan Neynar Score kamu.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Bertarung dengan kartumu di Poker dan PvP. Taruh VBMS di Mecha Arena dan lawan Raid Bosses!

🃏 **Koleksi Partner** → Kartu dari proyek partner juga bisa dipakai di pertempuran!

🎯 **Wanted Cast** → Interaksi dengan post unggulan dan dapatkan VBMS!

📬 **VibeMail** → Inbox kamu untuk pesan anonim.

Semoga beruntung! 🚀`,

        ja: `🎉 **VibeFID へようこそ, ${args.username}!**

あなたの **${args.rarity}** カードが作成されました!

📱 **VibeFID** → あなたの Farcaster プロフィールがコレクタブルカードになりました! パワーは Neynar Score に基づいています。

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → カードでポーカーと PvP でバトル。Mecha Arena で VBMS を賭けて Raid Bosses と戦おう!

🃏 **パートナーコレクション** → パートナープロジェクトのカードもバトルで使えます!

🎯 **Wanted Cast** → 注目の投稿とインタラクトして VBMS を獲得!

📬 **VibeMail** → 匿名メッセージ用の受信トレイ。

頑張って! 🚀`,

        it: `🎉 **Benvenuto in VibeFID, ${args.username}!**

La tua carta **${args.rarity}** è stata creata!

📱 **VibeFID** → Il tuo profilo Farcaster è diventato una carta collezionabile! Il potere si basa sul tuo Neynar Score.

🎮 [Vibe Most Wanted](https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms) → Combatti con la tua carta in Poker e PvP. Scommetti VBMS in Mecha Arena e affronta i Raid Bosses!

🃏 **Collezioni Partner** → Anche le carte dei progetti partner funzionano nelle battaglie!

🎯 **Wanted Cast** → Interagisci con i post in evidenza e guadagna VBMS!

📬 **VibeMail** → La tua casella per messaggi anonimi.

Buona fortuna! 🚀`,
      };

      const welcomeMessage = welcomeMessages[lang] || welcomeMessages['en'];

      await ctx.db.insert("cardVotes", {
        cardFid: args.fid,
        voterFid: 0, // System message
        voterAddress: "0x0000000000000000000000000000000000000000",
        date: today,
        createdAt: Date.now(),
        voteCount: 0,
        isPaid: false,
        message: welcomeMessage,
        isRead: false,
      });

      console.log(`📬 Welcome VibeMail sent to FID ${args.fid} in ${lang}`);
    } catch (error) {
      console.error("Failed to send welcome VibeMail:", error);
    }

    return {
      success: true,
      cardId,
      rarity: args.rarity,
      power: args.power,
      message: `Successfully minted ${args.rarity} card for ${args.username}!`,
    };
  },
});

/**
 * Get Farcaster cards owned by an address
 */
export const getFarcasterCardsByAddress = query({
  args: {
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedAddress = args.address.toLowerCase();

    const cards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_address", (q) => q.eq("address", normalizedAddress))
      .collect();

    return cards;
  },
});

/**
 * Get a specific Farcaster card by FID (first mint only)
 */
export const getFarcasterCardByFid = query({
  args: {
    fid: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all cards for this FID and return the most recent one
    const cards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .collect();

    // Sort by creation time (most recent first) and return the first one
    const sortedCards = cards.sort((a, b) => b._creationTime - a._creationTime);
    return sortedCards[0] || null;
  },
});

/**
 * Get ALL Farcaster cards for a specific FID (all mints)
 */
export const getFarcasterCardsByFid = query({
  args: {
    fid: v.number(),
  },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .collect();

    // Sort manually by creation time (most recent first)
    return cards.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Equip/unequip a Farcaster card
 */
export const toggleEquipFarcasterCard = mutation({
  args: {
    address: v.string(),
    cardId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedAddress = args.address.toLowerCase();

    // Find the card
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_address", (q) => q.eq("address", normalizedAddress))
      .filter((q) => q.eq(q.field("cardId"), args.cardId))
      .first();

    if (!card) {
      throw new Error("Card not found or not owned by you");
    }

    // Toggle equipped status
    await ctx.db.patch(card._id, {
      equipped: !card.equipped,
      lastUsed: Date.now(),
    });

    return {
      success: true,
      equipped: !card.equipped,
    };
  },
});

/**
 * Get all Farcaster cards (leaderboard)
 * 🚀 BANDWIDTH FIX: Added limit parameter (default 100, max 500)
 */
export const getAllFarcasterCards = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 🚀 BANDWIDTH FIX: Limit results to prevent abuse
    const limit = Math.min(args.limit || 100, 500);

    // Get cards with limit (uses index for ordering)
    const allCards = await ctx.db
      .query("farcasterCards")
      .order("desc")
      .take(limit);

    return allCards;
  },
});

/**
 * Get Farcaster cards with pagination (cursor-based)
 * 🚀 BANDWIDTH FIX: New paginated endpoint for large datasets
 */
export const getFarcasterCardsPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // _creationTime of last item
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100);

    let query = ctx.db.query("farcasterCards").order("desc");

    // If cursor provided, filter to items before that timestamp
    if (args.cursor) {
      const cursor = args.cursor;
      query = query.filter(q => q.lt(q.field("_creationTime"), cursor));
    }

    const cards = await query.take(limit + 1);
    const hasMore = cards.length > limit;
    const items = hasMore ? cards.slice(0, limit) : cards;

    return {
      cards: items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]._creationTime : null,
      hasMore,
    };
  },
});

/**
 * Search Farcaster cards by username, displayName, or FID
 * With pagination support
 */
export const searchFarcasterCards = query({
  args: {
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 12, 50);
    const offset = args.offset || 0;
    const searchTerm = args.searchTerm?.trim();

    // 🚀 BANDWIDTH FIX: Use search index instead of .collect() + filter
    // Previously fetched ALL cards (~30MB), now uses indexed search

    let cards;
    let totalCount = 0;

    if (!searchTerm || searchTerm.length === 0) {
      // No search term - get recent cards with pagination
      // Use .take() with offset simulation via skip
      const allRecent = await ctx.db
        .query("farcasterCards")
        .order("desc")
        .take(offset + limit + 1); // +1 to check hasMore

      cards = allRecent.slice(offset, offset + limit);
      totalCount = allRecent.length > offset + limit ? offset + limit + 1 : allRecent.length;
    } else {
      // Check if search term is a number (FID search)
      const isNumericSearch = /^\d+$/.test(searchTerm);

      if (isNumericSearch) {
        // FID search - use exact match with index
        const fid = parseInt(searchTerm, 10);
        const exactMatch = await ctx.db
          .query("farcasterCards")
          .withIndex("by_fid", (q) => q.eq("fid", fid))
          .first();

        if (exactMatch) {
          cards = [exactMatch];
          totalCount = 1;
        } else {
          // Partial FID match - need to scan but limit results
          const recentCards = await ctx.db
            .query("farcasterCards")
            .order("desc")
            .take(500); // Limit scan to 500 cards

          const filtered = recentCards.filter(card =>
            card.fid.toString().includes(searchTerm)
          );
          cards = filtered.slice(offset, offset + limit);
          totalCount = filtered.length;
        }
      } else {
        // Username search - use search index
        const searchResults = await ctx.db
          .query("farcasterCards")
          .withSearchIndex("search_username", (q) => q.search("username", searchTerm))
          .take(offset + limit + 50); // Get extra for better totalCount estimate

        cards = searchResults.slice(offset, offset + limit);
        totalCount = searchResults.length;
      }
    }

    const hasMore = totalCount > offset + limit;

    return {
      cards,
      totalCount,
      hasMore,
      offset,
      limit,
    };
  },
});

/**
 * Get Farcaster cards by rarity
 */
export const getFarcasterCardsByRarity = query({
  args: {
    rarity: v.string(),
  },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("farcasterCards")
      .withIndex("by_rarity", (q) => q.eq("rarity", args.rarity))
      .collect();

    return cards;
  },
});

/**
 * Delete all old VibeFID cards from previous contracts
 * (cards without contractAddress or with old contract addresses)
 */
export const deleteAllOldVibeFIDCards = internalMutation({
  args: {},
  handler: async (ctx) => {
    const VIBEFID_CURRENT_CONTRACT = "0x60274A138d026E3cB337B40567100FdEC3127565";

    // Get all cards
    const allCards = await ctx.db
      .query("farcasterCards")
      .collect();

    let deletedCount = 0;

    // Delete cards that are NOT from the current VibeFID contract
    for (const card of allCards) {
      const isCurrentContract = card.contractAddress?.toLowerCase() === VIBEFID_CURRENT_CONTRACT.toLowerCase();

      if (!isCurrentContract) {
        await ctx.db.delete(card._id);
        deletedCount++;
      }
    }

    console.log(`🗑️ Deleted ${deletedCount} old VibeFID cards from previous contracts`);

    return {
      success: true,
      deletedCount,
    };
  },
});

/**
 * Delete specific orphan cards by Doc ID (for cleanup)
 * SAFE: Only deletes cards you explicitly specify
 */
export const deleteOrphanCardById = internalMutation({
  args: {
    docId: v.id("farcasterCards"),
  },
  handler: async (ctx, args) => {
    // Get the card to verify it exists
    const card = await ctx.db.get(args.docId);

    if (!card) {
      throw new Error(`Card with ID ${args.docId} not found`);
    }

    console.log(`🗑️  Deleting orphan card: FID ${card.fid} (@${card.username}) - ${card.rank}${card.suitSymbol}`);

    // Delete the card
    await ctx.db.delete(args.docId);

    return {
      success: true,
      deleted: {
        fid: card.fid,
        username: card.username,
        suit: card.suitSymbol,
      },
    };
  },
});

/**
 * DEV ONLY: Reset card rarity for testing
 */
export const resetCardRarity = internalMutation({
  args: {
    fid: v.number(),
    rarity: v.string(),
    neynarScore: v.number(),
    power: v.number(),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (!card) {
      throw new Error(`No card found for FID ${args.fid}`);
    }

    await ctx.db.patch(card._id, {
      rarity: args.rarity,
      neynarScore: args.neynarScore,
      power: args.power,
      upgradedAt: undefined,
      previousRarity: undefined,
      previousNeynarScore: undefined,
    });

    return { success: true };
  },
});

/**
 * Upgrade card rarity based on new Neynar score
 * Keeps all traits (foil, wear, suit, rank) but updates rarity and power
 */
// Note: Called from frontend /fid/[fid]/page.tsx
export const upgradeCardRarity = mutation({
  args: {
    fid: v.number(),
    newNeynarScore: v.number(),
    newRarity: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the card
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (!card) {
      throw new Error(`No card found for FID ${args.fid}`);
    }

    // Check if rarity actually changed (improved)
    const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    const oldRarityIndex = rarityOrder.indexOf(card.rarity);
    const newRarityIndex = rarityOrder.indexOf(args.newRarity);

    if (newRarityIndex <= oldRarityIndex) {
      throw new Error(
        `Cannot upgrade: New rarity (${args.newRarity}) is not higher than current (${card.rarity})`
      );
    }

    // Calculate new power based on new rarity but keeping same foil/wear
    const rarityBasePower: Record<string, number> = {
      Common: 10, Rare: 20, Epic: 50, Legendary: 100, Mythic: 600,
    };
    const wearMultiplier: Record<string, number> = {
      Pristine: 1.8, Mint: 1.4, 'Lightly Played': 1.0,
      'Moderately Played': 1.0, 'Heavily Played': 1.0,
    };
    const foilMultiplier: Record<string, number> = {
      Prize: 6.0, Standard: 2.0, None: 1.0,
    };

    const basePower = rarityBasePower[args.newRarity] || 10;
    const wearMult = wearMultiplier[card.wear] || 1.0;
    const foilMult = foilMultiplier[card.foil] || 1.0;
    const newPower = Math.round(basePower * wearMult * foilMult);

    // Update rarity and power (power recalculated based on new rarity)
    await ctx.db.patch(card._id, {
      rarity: args.newRarity,
      power: newPower,
      // Mark when upgraded
      upgradedAt: Date.now(),
      previousRarity: card.rarity,
    });

    console.log(`✅ Card upgraded: FID ${args.fid} from ${card.rarity} to ${args.newRarity} (Power: ${card.power} → ${newPower})`);

    return {
      success: true,
      fid: args.fid,
      oldRarity: card.rarity,
      newRarity: args.newRarity,
      oldPower: card.power,
      newPower: newPower,
    };
  },
});

/**
 * Get recent Farcaster cards (latest 20)
 * Shows all cards until old cards from previous contracts are manually deleted
 */
export const getRecentFarcasterCards = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // 🚀 PERF: Use .order("desc").take() instead of .collect() + sort + slice
    // This avoids loading the entire table into memory
    const sortedCards = await ctx.db
      .query("farcasterCards")
      .order("desc") // Orders by _creationTime descending
      .take(limit);

    return sortedCards;
  },
});

/**
 * Update card images after upgrade
 * Used when regenerating video/image with new rarity/power/bounty values
 */
// Note: Called from frontend /fid/[fid]/page.tsx
export const updateCardImages = mutation({
  args: {
    fid: v.number(),
    imageUrl: v.optional(v.string()), // Video URL (MP4/WebM)
    cardImageUrl: v.optional(v.string()), // Static PNG
    shareImageUrl: v.optional(v.string()), // Share image with card + criminal text
  },
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query("farcasterCards")
      .withIndex("by_fid", (q) => q.eq("fid", args.fid))
      .first();

    if (!card) {
      throw new Error(`No card found for FID ${args.fid}`);
    }

    const updates: Record<string, any> = {};

    if (args.imageUrl) {
      updates.imageUrl = args.imageUrl;
    }

    if (args.cardImageUrl) {
      updates.cardImageUrl = args.cardImageUrl;
    }

    if (args.shareImageUrl) {
      updates.shareImageUrl = args.shareImageUrl;
    }

    await ctx.db.patch(card._id, updates);

    console.log(`✅ Card images updated for FID ${args.fid}`);
    if (args.imageUrl) console.log(`   Video: ${args.imageUrl}`);
    if (args.cardImageUrl) console.log(`   Static: ${args.cardImageUrl}`);
    if (args.shareImageUrl) console.log(`   Share: ${args.shareImageUrl}`);

    return {
      success: true,
      fid: args.fid,
      imageUrl: args.imageUrl,
      cardImageUrl: args.cardImageUrl,
      shareImageUrl: args.shareImageUrl,
    };
  },
});

/**
 * Get card images only (lightweight query for floating background)
 * Returns only imageUrl/cardImageUrl - much faster than full card data
 */
export const getCardImagesOnly = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 8, 20);

    // Get more to filter unminted cards
    const cards = await ctx.db
      .query("farcasterCards")
      .order("desc")
      .take(limit * 5);

    // Filter only cards with cardImageUrl (properly minted)
    const validCards = cards
      .filter(card => card.cardImageUrl && card.cardImageUrl.length > 0)
      .slice(0, limit);

    return validCards.map(card => ({
      _id: card._id,
      fid: card.fid,
      cardImageUrl: card.cardImageUrl,
    }));
  },
});

/**
 * Get cards for gallery (lightweight)
 * Returns only: _id, fid, username, cardImageUrl, pfpUrl
 */
export const getCardsForGallery = query({
  args: {
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 12, 50);
    const offset = args.offset || 0;
    const searchTerm = args.searchTerm?.trim();

    let cards;
    let totalCount = 0;

    if (!searchTerm || searchTerm.length === 0) {
      const allRecent = await ctx.db
        .query("farcasterCards")
        .order("desc")
        .take(offset + limit + 1);

      cards = allRecent.slice(offset, offset + limit);
      totalCount = allRecent.length > offset + limit ? offset + limit + 1 : allRecent.length;
    } else {
      const isNumericSearch = /^\d+$/.test(searchTerm);

      if (isNumericSearch) {
        const fid = parseInt(searchTerm, 10);
        const exactMatch = await ctx.db
          .query("farcasterCards")
          .withIndex("by_fid", (q) => q.eq("fid", fid))
          .first();

        if (exactMatch) {
          cards = [exactMatch];
          totalCount = 1;
        } else {
          const recentCards = await ctx.db
            .query("farcasterCards")
            .order("desc")
            .take(500);

          const filtered = recentCards.filter(card =>
            card.fid.toString().includes(searchTerm)
          );
          cards = filtered.slice(offset, offset + limit);
          totalCount = filtered.length;
        }
      } else {
        const searchResults = await ctx.db
          .query("farcasterCards")
          .withSearchIndex("search_username", (q) => q.search("username", searchTerm))
          .take(offset + limit + 50);

        cards = searchResults.slice(offset, offset + limit);
        totalCount = searchResults.length;
      }
    }

    const hasMore = totalCount > offset + limit;

    // Return only essential fields for gallery
    return {
      cards: cards.map(card => ({
        _id: card._id,
        fid: card.fid,
        username: card.username,
        cardImageUrl: card.cardImageUrl,
      })),
      totalCount,
      hasMore,
      offset,
      limit,
    };
  },
});
