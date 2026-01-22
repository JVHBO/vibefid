import { NextRequest, NextResponse } from 'next/server';

// Neynar API key for posting
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID!;

// Channel to post quotes
const CHANNEL_ID = 'vibe-most-wanted';

// Keywords that trigger the bot
const TRIGGER_KEYWORDS = [
  'what is my neynar score',
  'what\'s my neynar score',
  'whats my neynar score',
  'my neynar score',
  'check my score',
  'neynar score',
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

    console.log(`🤖 Bot triggered by @${authorUsername} (FID: ${authorFid})`);

    // Fetch the user's Neynar score
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${authorFid}`,
      { headers: { api_key: NEYNAR_API_KEY } }
    );

    let scoreText = '';
    let score = 0;

    if (userResponse.ok) {
      const userData = await userResponse.json();
      const user = userData.users?.[0];
      if (user) {
        score = user.experimental?.neynar_user_score || user.score || 0;

        // Determine rarity
        let rarity = 'Common';
        if (score >= 0.99) rarity = 'Mythic';
        else if (score >= 0.90) rarity = 'Legendary';
        else if (score >= 0.79) rarity = 'Epic';
        else if (score >= 0.70) rarity = 'Rare';

        scoreText = `@${authorUsername} your Neynar Score is ${score.toFixed(3)} (${rarity})! 🎴\n\nMint your VibeFID card:`;
      }
    }

    if (!scoreText) {
      scoreText = `@${authorUsername} I couldn't fetch your score. Try again later!`;
    }

    // Share page URL (not the GIF, the actual page)
    const shareUrl = `https://vibefid.xyz/share/score/${authorFid}`;

    // Original cast URL for quote embed
    const originalCastUrl = `https://warpcast.com/${authorUsername}/${castHash.substring(0, 10)}`;

    // Post quote in channel using Neynar
    // For a quote cast: include the original cast URL as an embed
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
          { url: shareUrl },           // Share page link
          { cast_id: { fid: authorFid, hash: castHash } }  // Quote the original cast
        ],
      }),
    });

    if (quoteResponse.ok) {
      console.log(`✅ Bot quoted @${authorUsername} in /${CHANNEL_ID}`);
      return NextResponse.json({ ok: true, message: 'Quote posted' });
    } else {
      const error = await quoteResponse.text();
      console.error('Failed to post quote:', error);
      return NextResponse.json({ error: 'Failed to post quote' }, { status: 500 });
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
