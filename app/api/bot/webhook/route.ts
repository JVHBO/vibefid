import { NextRequest, NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID!;
const BOT_FID = 2411608;

// Anti-spam: in-memory set of already-replied cast hashes
const repliedHashes = new Set<string>();

// Score keywords — must be specific enough to avoid false positives
const TRIGGER_KEYWORDS = [
  'neynar score',
  'neymar score',
  'check score',
  'my neynar',
  'qual meu score',
  'qual o score',
  'score @',
];

const GAY_KEYWORDS_JP = ['私はゲイですか', 'ゲイですか', 'ゲイ？', 'gei desu ka', 'watashi wa gei', 'ore wa gei', 'boku wa gei'];
const GAY_KEYWORDS_EN = ['i am gay', 'am i gay', 'are you gay', 'is he gay', 'is she gay'];
const GAY_KEYWORDS_PT = ['eu sou gay', 'sou gay', 'é gay', 'ele é gay', 'ela é gay'];
const GAY_KEYWORDS = [...GAY_KEYWORDS_PT, ...GAY_KEYWORDS_EN, ...GAY_KEYWORDS_JP];

// Helper: fetch with timeout
function fetchWithTimeout(url: string, opts: RequestInit, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

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
    const originalText = cast.text || '';
    const castHash = cast.hash;
    const authorUsername = cast.author?.username || 'anon';

    if (!authorFid || !castHash) {
      return NextResponse.json({ ok: true, message: 'Missing author or hash' });
    }

    // Ignore own casts
    if (authorFid === BOT_FID) {
      return NextResponse.json({ ok: true, message: 'Own cast ignored' });
    }

    // Anti-spam: ignore already-replied hashes
    if (repliedHashes.has(castHash)) {
      return NextResponse.json({ ok: true, message: 'Already replied' });
    }

    // Gay question handler
    const isGayQuestion = GAY_KEYWORDS.some(k => castText.includes(k.toLowerCase()));
    if (isGayQuestion) {
      const isJP = GAY_KEYWORDS_JP.some(k => castText.includes(k));
      const isEN = GAY_KEYWORDS_EN.some(k => castText.includes(k));
      const replyText = isJP
        ? 'はい、あなたはゲイです 🏳️‍🌈'
        : isEN
          ? 'Yes, you are gay 🏳️‍🌈'
          : 'Sim, você é gay 🏳️‍🌈';
      const replyImg = isJP
        ? 'https://m.media-amazon.com/images/I/61eTb-caKiL._UF1000,1000_QL80_.jpg'
        : 'https://ih1.redbubble.net/image.5311218987.4442/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg';
      repliedHashes.add(castHash);
      await fetchWithTimeout('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY, 'Idempotency-Key': `gay-${castHash}` },
        body: JSON.stringify({
          signer_uuid: BOT_SIGNER_UUID,
          text: replyText,
          parent: castHash,
          embeds: [{ url: replyImg }],
        }),
      });
      return NextResponse.json({ ok: true, message: 'Gay reply sent' });
    }

    // Check if message contains trigger keywords
    const shouldRespond = TRIGGER_KEYWORDS.some(keyword =>
      castText.includes(keyword.toLowerCase())
    );

    if (!shouldRespond) {
      return NextResponse.json({ ok: true, message: 'No trigger keyword' });
    }

    // Check if there's another @mention (not @vibefid) to look up their score
    const mentionRegex = /@(\w+(?:\.\w+)*)/g;
    const mentions = originalText.match(mentionRegex) || [];
    const otherMentions = mentions.filter((m: string) =>
      m.toLowerCase() !== '@vibefid' &&
      m.toLowerCase() !== '@vibefid.base.eth'
    );

    let targetFid = authorFid;
    let targetUsername = authorUsername;
    let targetDisplayName = cast.author?.display_name || authorUsername;
    let isLookingUpOther = false;

    // If there's another mention, look up that user instead
    if (otherMentions.length > 0) {
      const targetMention = otherMentions[0].substring(1); // Remove @
      try {
        const lookupResponse = await fetchWithTimeout(
          `https://api.neynar.com/v2/farcaster/user/by_username?username=${targetMention}`,
          { headers: { api_key: NEYNAR_API_KEY } }
        );
        if (lookupResponse.ok) {
          const lookupData = await lookupResponse.json();
          if (lookupData.user) {
            targetFid = lookupData.user.fid;
            targetUsername = lookupData.user.username;
            targetDisplayName = lookupData.user.display_name || targetUsername;
            isLookingUpOther = true;
          }
        }
      } catch (e) {
        console.log(`Failed to lookup @${targetMention}`);
      }
    }

    console.log(`Bot triggered by @${authorUsername} for @${targetUsername} (FID: ${targetFid})`);

    // Fetch all data in parallel with timeout
    const [userResponse, rankResponse, openRankResponse] = await Promise.all([
      fetchWithTimeout(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}`, {
        headers: { api_key: NEYNAR_API_KEY }
      }).catch(() => null),
      fetchWithTimeout("https://scintillating-mandrill-101.convex.cloud/api/query", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'farcasterCards:getVibeFIDRank', args: { fid: targetFid }, format: 'json' }),
      }).catch(() => null),
      fetchWithTimeout('https://graph.cast.k3l.io/scores/global/engagement/fids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([targetFid]),
      }).catch(() => null),
    ]);

    let score = 0;
    let rarity = 'Common';

    if (userResponse?.ok) {
      const userData = await userResponse.json();
      const user = userData.users?.[0];
      if (user) {
        score = user.experimental?.neynar_user_score || user.score || 0;
        targetDisplayName = user.display_name || targetUsername;

        if (score >= 0.99) rarity = 'Mythic';
        else if (score >= 0.90) rarity = 'Legendary';
        else if (score >= 0.79) rarity = 'Epic';
        else if (score >= 0.70) rarity = 'Rare';
      }
    }

    let vibefidRank = '';
    if (rankResponse?.ok) {
      try {
        const rankData = await rankResponse.json();
        if (rankData.value?.rank) {
          vibefidRank = `#${rankData.value.rank.toLocaleString()}`;
        }
      } catch (e) {}
    }

    let globalRank = '';
    let isEstimated = false;
    if (openRankResponse?.ok) {
      try {
        const openRankData = await openRankResponse.json();
        const results = openRankData.result || openRankData;
        if (Array.isArray(results) && results.length > 0 && results[0].rank) {
          globalRank = `#${results[0].rank.toLocaleString()}`;
        }
      } catch (e) {}
    }
    // Fallback: estimate rank based on Neynar Score
    if (!globalRank && score > 0) {
      const estimatedRank = Math.max(1, Math.round(800000 * (1 - score)));
      globalRank = `~#${estimatedRank.toLocaleString()}`;
      isEstimated = true;
    }

    // Build the score text with all info
    let scoreText = '';
    if (isLookingUpOther) {
      scoreText = `@${authorUsername} asked about @${targetUsername}:\n\n`;
    }
    scoreText += `${targetDisplayName} @${targetUsername}\n\n`;
    scoreText += `Neynar Score: ${score.toFixed(3)} (${rarity})\n`;
    if (vibefidRank) {
      scoreText += `VibeFID Rank: ${vibefidRank}\n`;
    }
    if (globalRank) {
      scoreText += `Global Rank: ${globalRank}${isEstimated ? ' (est.)' : ''}\n`;
    }
    scoreText += `\nGet your playable VibeFID card:`;

    // Share page URL (the actual page with OG image)
    const shareUrl = `https://vibefid.xyz/share/score/${targetFid}`;

    repliedHashes.add(castHash);
    const replyResponse = await fetchWithTimeout('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
        'Idempotency-Key': `score-${castHash}`,
      },
      body: JSON.stringify({
        signer_uuid: BOT_SIGNER_UUID,
        text: scoreText,
        parent: castHash,  // Reply to the original cast
        embeds: [
          { url: shareUrl }  // Share page link with OG image
        ],
      }),
    });

    if (replyResponse.ok) {
      const result = await replyResponse.json();
      console.log(`Bot replied to @${authorUsername}`);
      return NextResponse.json({ ok: true, message: 'Reply posted', cast: result.cast?.hash });
    } else {
      const error = await replyResponse.text();
      console.error('Failed to post reply:', error);
      return NextResponse.json({
        error: 'Failed to post reply',
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
    configured: !!BOT_SIGNER_UUID && !!NEYNAR_API_KEY,
  });
}
