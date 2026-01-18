// Script to reimport a card that was minted on-chain but not saved to Convex
const NEYNAR_API_KEY = "26C827AF-2DE5-4EF7-A258-795DA4B592F0";
const ALCHEMY_API_KEY = "ij295aMMQWKFekEdZNdti";
const VIBEFID_CONTRACT = "0x60274A138d026E3cB337B40567100FdEC3127565";

const FID_TO_REIMPORT = 863273;

async function main() {
  console.log(`\n🔍 Reimporting FID ${FID_TO_REIMPORT}...\n`);

  // 1. Get user data from Neynar
  console.log("1️⃣ Fetching user data from Neynar...");
  const neynarResponse = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${FID_TO_REIMPORT}`,
    {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    }
  );

  if (!neynarResponse.ok) {
    console.error("❌ Neynar API error:", neynarResponse.status);
    return;
  }

  const neynarData = await neynarResponse.json();
  const user = neynarData.users?.[0];

  if (!user) {
    console.error("❌ User not found in Neynar");
    return;
  }

  console.log(`   ✅ Found: @${user.username} (${user.display_name})`);
  console.log(`   Score: ${user.experimental?.neynar_user_score}`);
  console.log(`   Followers: ${user.follower_count}`);

  // 2. Get NFT owner from Alchemy
  console.log("\n2️⃣ Fetching NFT owner from blockchain...");
  const alchemyResponse = await fetch(
    `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getOwnersForNFT?contractAddress=${VIBEFID_CONTRACT}&tokenId=${FID_TO_REIMPORT}`,
    {
      headers: { 'accept': 'application/json' },
    }
  );

  if (!alchemyResponse.ok) {
    console.error("❌ Alchemy API error:", alchemyResponse.status);
    return;
  }

  const alchemyData = await alchemyResponse.json();
  const owner = alchemyData.owners?.[0];

  if (!owner) {
    console.error("❌ NFT not found on-chain! Token may not be minted.");
    return;
  }

  console.log(`   ✅ Owner: ${owner}`);

  // 3. Get NFT metadata from Alchemy
  console.log("\n3️⃣ Fetching NFT metadata...");
  const metadataResponse = await fetch(
    `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTMetadata?contractAddress=${VIBEFID_CONTRACT}&tokenId=${FID_TO_REIMPORT}`,
    {
      headers: { 'accept': 'application/json' },
    }
  );

  const metadata = await metadataResponse.json();
  console.log(`   Image: ${metadata.image?.cachedUrl || metadata.raw?.metadata?.image || 'NOT FOUND'}`);
  console.log(`   Animation: ${metadata.raw?.metadata?.animation_url || 'NOT FOUND'}`);

  // 4. Calculate card traits (deterministic based on FID)
  console.log("\n4️⃣ Calculating card traits...");

  const score = user.experimental?.neynar_user_score || 0;

  // Rarity from score
  let rarity;
  if (score >= 0.99) rarity = 'Mythic';
  else if (score >= 0.90) rarity = 'Legendary';
  else if (score >= 0.79) rarity = 'Epic';
  else if (score >= 0.70) rarity = 'Rare';
  else rarity = 'Common';

  // Suit from FID (deterministic)
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const suit = suits[FID_TO_REIMPORT % 4];
  const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const suitSymbol = suitSymbols[suit];
  const color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';

  // Rank from rarity
  const ranksByRarity = {
    'Mythic': ['A'],
    'Legendary': ['K', 'Q'],
    'Epic': ['J', '10', '9'],
    'Rare': ['8', '7', '6', '5'],
    'Common': ['4', '3', '2'],
  };
  const ranks = ranksByRarity[rarity];
  const rank = ranks[FID_TO_REIMPORT % ranks.length];

  // Foil from FID (deterministic) - 5% Prize, 15% Standard, 80% None
  const foilRoll = (FID_TO_REIMPORT * 7) % 100;
  let foil;
  if (foilRoll < 5) foil = 'Prize';
  else if (foilRoll < 20) foil = 'Standard';
  else foil = 'None';

  // Wear from FID (deterministic)
  const wearOptions = ['Pristine', 'Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'];
  const wear = wearOptions[(FID_TO_REIMPORT * 13) % wearOptions.length];

  // Power calculation
  const rarityBasePower = { Common: 10, Rare: 20, Epic: 50, Legendary: 100, Mythic: 600 };
  const wearMultiplier = { Pristine: 1.8, Mint: 1.4, 'Lightly Played': 1.0, 'Moderately Played': 1.0, 'Heavily Played': 1.0 };
  const foilMultiplier = { Prize: 6.0, Standard: 2.0, None: 1.0 };
  const power = Math.round(rarityBasePower[rarity] * wearMultiplier[wear] * foilMultiplier[foil]);

  console.log(`   Rarity: ${rarity}`);
  console.log(`   Suit: ${suit} (${suitSymbol})`);
  console.log(`   Rank: ${rank}`);
  console.log(`   Foil: ${foil}`);
  console.log(`   Wear: ${wear}`);
  console.log(`   Power: ${power}`);

  // 5. Output the reimport data
  console.log("\n5️⃣ Reimport data ready!\n");

  const reimportData = {
    fid: FID_TO_REIMPORT,
    username: user.username,
    displayName: user.display_name,
    pfpUrl: user.pfp_url,
    bio: user.profile?.bio?.text || "",
    neynarScore: score,
    followerCount: user.follower_count,
    followingCount: user.following_count,
    powerBadge: user.power_badge || false,
    address: owner.toLowerCase(),
    rarity,
    foil,
    wear,
    power,
    suit,
    rank,
    suitSymbol,
    color,
    imageUrl: metadata.raw?.metadata?.animation_url || metadata.image?.cachedUrl || "",
    cardImageUrl: metadata.image?.cachedUrl || "",
    contractAddress: VIBEFID_CONTRACT.toLowerCase(),
  };

  console.log("📋 Convex reimport command:\n");
  console.log(`npx convex run farcasterCards:reimportCard '${JSON.stringify(reimportData)}'`);

  console.log("\n\n📊 Summary:");
  console.log(`   FID: ${FID_TO_REIMPORT}`);
  console.log(`   User: @${user.username}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Card: ${rank}${suitSymbol} ${rarity} ${foil !== 'None' ? foil + ' Foil' : ''} (${power} power)`);
}

main().catch(console.error);
