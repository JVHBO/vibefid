import { NextRequest, NextResponse } from 'next/server';

// Neynar API key for posting replies
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID!; // You'll need to create this

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

        scoreText = `@${authorUsername} your Neynar Score is ${score.toFixed(3)} (${rarity})! 🎴`;
      }
    }

    if (!scoreText) {
      scoreText = `@${authorUsername} I couldn't fetch your score. Try again later!`;
    }

    // GIF URL with the user's FID
    const gifUrl = `https://vibefid.xyz/share/score/${authorFid}/opengraph-image.gif?v=${Date.now()}`;

    // Post reply using Neynar
    const replyResponse = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        signer_uuid: BOT_SIGNER_UUID,
        text: scoreText,
        parent: castHash,
        embeds: [{ url: gifUrl }],
      }),
    });

    if (replyResponse.ok) {
      console.log(`✅ Bot replied to @${authorUsername}`);
      return NextResponse.json({ ok: true, message: 'Reply sent' });
    } else {
      const error = await replyResponse.text();
      console.error('Failed to post reply:', error);
      return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 });
    }

  } catch (error) {
    console.error('Bot webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Verify webhook signature (optional but recommended)
export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    status: 'VibeFID Bot is running',
    triggers: TRIGGER_KEYWORDS,
  });
}
