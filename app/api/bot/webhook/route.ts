import { NextRequest, NextResponse } from 'next/server';

// Neynar API key for posting
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID!;

// Channel to post quotes
const CHANNEL_ID = 'vibe-most-wanted';

// Keywords that trigger the bot (includes "neymar" typo)
const TRIGGER_KEYWORDS = [
  'what is my neynar score',
  'what\'s my neynar score',
  'whats my neynar score',
  'my neynar score',
  'neynar score',
  'what is my neymar score',
  'what\'s my neymar score',
  'whats my neymar score',
  'my neymar score',
  'neymar score',
  'check my score',
  'my score',
  'score?',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Neynar webhook payload
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: 'No data' }, { status: 400 });
    }

    // Extract cast info
    const cast = data.object === 'cast' ? data : data.cast;
    if (!cast) {
      return NextResponse.json({ ok: true, message: 'Not a cast' });
    }

    const authorFid = cast.author?.fid;
    const castText = cast.text?.toLowerCase() || '';
    const castHash = cast.hash;
    const authorUsername = cast.author?.username || 'anon';
    const displayName = cast.author?.display_name || authorUsername;

    if (!authorFid || !castHash) {
      return NextResponse.json({ ok: true, message: 'Missing author or hash' });
    }

    // Check if message contains trigger keywords
    const shouldRespond = TRIGGER_KEYWORDS.some(keyword =>
      castText.includes(keyword.toLowerCase())
    );

    if (!shouldRespond) {
      return NextResponse.json({ ok: true, message: 'No trigger keyword' });
    }

    console.log(`Bot triggered by @${authorUsername} (FID: ${authorFid})`);

    // Fetch the user's Neynar score
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${authorFid}`,
      { headers: { api_key: NEYNAR_API_KEY } }
    );

    let score = 0;
    let rarity = 'Common';

    if (userResponse.ok) {
      const userData = await userResponse.json();
      const user = userData.users?.[0];
      if (user) {
        score = user.experimental?.neynar_user_score || user.score || 0;

        // Determine rarity
        if (score >= 0.99) rarity = 'Mythic';
        else if (score >= 0.90) rarity = 'Legendary';
        else if (score >= 0.79) rarity = 'Epic';
        else if (score >= 0.70) rarity = 'Rare';
      }
    }

    // Fetch VibeFID rank from Convex
    let vibefidRank = '';
    try {
      const convexUrl = "https://scintillating-mandrill-101.convex.cloud";
      const rankResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'farcasterCards:getVibeFIDRank',
          args: { fid: authorFid },
          format: 'json',
        }),
      });
      if (rankResponse.ok) {
        const rankData = await rankResponse.json();
        if (rankData.value?.rank) {
          vibefidRank = `#${rankData.value.rank.toLocaleString()}`;
        }
      }
    } catch (e) {
      console.log('Failed to fetch VibeFID rank');
    }

    // Fetch Global rank from OpenRank
    let globalRank = '';
    try {
      const openRankResponse = await fetch('https://graph.cast.k3l.io/scores/global/engagement/fids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([authorFid]),
      });
      if (openRankResponse.ok) {
        const openRankData = await openRankResponse.json();
        const results = openRankData.result || openRankData;
        if (Array.isArray(results) && results.length > 0 && results[0].rank) {
          globalRank = `#${results[0].rank.toLocaleString()}`;
        }
      }
    } catch (e) {
      console.log('Failed to fetch OpenRank');
    }

    // Build the score text with all info
    let scoreText = `${displayName} (@${authorUsername})\n\n`;
    scoreText += `Neynar Score: ${score.toFixed(3)} (${rarity})\n`;
    if (vibefidRank) {
      scoreText += `VibeFID Rank: ${vibefidRank}\n`;
    }
    if (globalRank) {
      scoreText += `Global Rank: ${globalRank}\n`;
    }
    scoreText += `\nMint your VibeFID card:`;

    // Share page URL (the actual page with OG image)
    const shareUrl = `https://vibefid.xyz/share/score/${authorFid}`;

    // Original cast URL for quote (warpcast format)
    const quoteCastUrl = `https://warpcast.com/${authorUsername}/${castHash}`;

    // Post quote in channel using Neynar
    const quoteResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: BOT_SIGNER_UUID,
        text: scoreText,
        channel_id: CHANNEL_ID,
        embeds: [
          { url: shareUrl },      // Share page link with OG image
          { url: quoteCastUrl }   // Quote the original cast via URL
        ],
      }),
    });

    if (quoteResponse.ok) {
      const result = await quoteResponse.json();
      console.log(`Bot quoted @${authorUsername} in /${CHANNEL_ID}`);
      return NextResponse.json({ ok: true, message: 'Quote posted', cast: result.cast?.hash });
    } else {
      const error = await quoteResponse.text();
      console.error('Failed to post quote:', error);
      return NextResponse.json({
        error: 'Failed to post quote',
        details: error,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Bot webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'VibeFID Bot is running',
    channel: CHANNEL_ID,
    triggers: TRIGGER_KEYWORDS,
  });
}
