import { NextRequest, NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const BOT_SIGNER_UUID = process.env.BOT_SIGNER_UUID!;
const BOT_FID = 2411608;

// Anti-spam: in-memory set of already-replied cast hashes
const repliedHashes = new Set<string>();

// Score keywords
const TRIGGER_KEYWORDS = [
  // EN
  'neynar score', 'neymar score', 'check score', 'my neynar', 'what is my score', "what's my score", 'score @',
  // PT
  'qual meu score', 'qual é meu score', 'qual o score', 'me diz meu score', 'meu score',
];

// Gay — individual
const GAY_KEYWORDS_JP = [
  '私はゲイですか', 'ゲイですか', 'ゲイ？',
  'gei desu ka', 'geidesu ka', 'watashi wa gei', 'watashi wa geidesu', 'ore wa gei', 'boku wa gei',
  'ore wa geidesu', 'boku wa geidesu',
];
const GAY_KEYWORDS_EN = [
  'i am gay', 'am i gay', 'are you gay', 'is he gay', 'is she gay', 'is gay',
  'i think i am gay', 'i think i\'m gay', 'am i actually gay',
];
const GAY_KEYWORDS_PT = [
  'eu sou gay', 'sou gay', 'é gay', 'ele é gay', 'ela é gay',
  'sou viado', 'eu sou viado', 'é viado', 'ele é viado', 'ela é viada',
  'vc é gay', 'você é gay',
];
const GAY_KEYWORDS = [...GAY_KEYWORDS_PT, ...GAY_KEYWORDS_EN, ...GAY_KEYWORDS_JP];

// Gay — versus
const GAY_VERSUS_KEYWORDS = [
  // PT
  'quem é mais gay', 'qual é mais gay', 'quem é o mais gay', 'quem é mais viado',
  'qual dos dois é gay', 'qual é mais viado', 'quem é o mais viado', 'qual dos dois é viado',
  // EN
  'who is more gay', "who's more gay", 'whos more gay', 'who is gayer', "who's gayer",
  'whos gayer', 'which one is gay', 'which is gayer', 'who is the gayest', "who's the gayest",
  // JP / Rōmaji
  'どっちがゲイ', 'どちらがゲイ', 'docchi ga gei', 'dochira ga gei',
];

// Deterministic "random" from cast hash — same hash = same choice across all instances
function hashRand(hash: string, max: number): number {
  let n = 0;
  for (let i = 0; i < hash.length; i++) n = (n * 31 + hash.charCodeAt(i)) >>> 0;
  return n % max;
}

// Helper: fetch with timeout
function fetchWithTimeout(url: string, opts: RequestInit, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Check if bot already replied to this cast hash
async function alreadyReplied(parentHash: string): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${parentHash}&type=hash&reply_depth=1&limit=20`,
      { headers: { api_key: NEYNAR_API_KEY } },
      4000
    );
    if (!r.ok) return false;
    const d = await r.json();
    const replies = d.conversation?.cast?.direct_replies || [];
    return replies.some((c: any) => c.author?.fid === BOT_FID);
  } catch { return false; }
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
    if (await alreadyReplied(castHash)) {
      repliedHashes.add(castHash);
      return NextResponse.json({ ok: true, message: 'Already replied (remote)' });
    }
    repliedHashes.add(castHash);

    // Gay question handler
    // "Quem é mais gay?" handler
    const isGayVersus = GAY_VERSUS_KEYWORDS.some(k => castText.includes(k.toLowerCase()));
    if (isGayVersus) {
      const mentionedUsers = (originalText.match(/@(\w+(?:\.\w+)*)/g) || [])
        .filter((m: string) => m.toLowerCase() !== '@vibefid' && m.toLowerCase() !== '@vibefid.base.eth');
      // Include author if they used "eu"/"me"/"i" as a candidate
      const selfWords = ['\\beu\\b', '\\beu mesmo\\b', '\\bme or\\b', '\\bor me\\b', 'myself', '\\bi or\\b', '\\bor i\\b'];
      const authorIsCandidate = selfWords.some(w => new RegExp(w, 'i').test(castText));
      if (authorIsCandidate) mentionedUsers.unshift(`@${authorUsername}`);
      const allMentions = [...new Set(mentionedUsers)];
      if (allMentions.length >= 2) {
        const chosen = allMentions[hashRand(castHash, allMentions.length)] as string;
        const username = chosen.substring(1);
        // Fetch pfp
        let pfpUrl = 'https://ih1.redbubble.net/image.5311218987.4442/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg';
        try {
          const r = await fetchWithTimeout(`https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`, { headers: { api_key: NEYNAR_API_KEY } });
          if (r.ok) {
            const d = await r.json();
            pfpUrl = d.user?.pfp_url || pfpUrl;
          }
        } catch (_) {}
        const isJP = castText.includes('どっち') || castText.includes('docchi');
        const replyText = isJP
          ? `${chosen} の方がゲイです 🏳️‍🌈`
          : castText.includes('who') || castText.includes('which')
            ? `${chosen} is gayer 🏳️‍🌈`
            : `${chosen} é mais gay 🏳️‍🌈`;
        await fetchWithTimeout('https://api.neynar.com/v2/farcaster/cast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY, 'Idempotency-Key': `gayversus-${castHash}` },
          body: JSON.stringify({ signer_uuid: BOT_SIGNER_UUID, text: replyText, parent: castHash, embeds: [{ url: pfpUrl }] }),
        });
        return NextResponse.json({ ok: true, message: 'Gay versus reply sent' });
      }
    }

    const isGayQuestion = GAY_KEYWORDS.some(k => castText.includes(k.toLowerCase()));
    if (isGayQuestion) {
      const isJP = GAY_KEYWORDS_JP.some(k => castText.includes(k));
      const isEN = GAY_KEYWORDS_EN.some(k => castText.includes(k));

      // Detect if asking about another user (@mention that isn't @vibefid)
      const gayMentionMatch = originalText.match(/@(\w+(?:\.\w+)*)/g) || [];
      const gayTarget = gayMentionMatch.find((m: string) =>
        m.toLowerCase() !== '@vibefid' && m.toLowerCase() !== '@vibefid.base.eth'
      );
      const target = gayTarget || null;

      const notGay = hashRand(castHash, 10) === 0;
      const replyText = notGay
        ? isJP
          ? `いいえ、${target ?? 'あなた'} はゲイではありません 🏳️‍🌈`
          : isEN
            ? `No, ${target ?? 'you'} ${target ? 'is' : 'are'} not gay 🏳️‍🌈`
            : `Não, ${target ?? 'você'} não é gay 🏳️‍🌈`
        : isJP
          ? `はい、${target ?? 'あなた'} はゲイです 🏳️‍🌈`
          : isEN
            ? `Yes, ${target ?? 'you'} ${target ? 'is' : 'are'} gay 🏳️‍🌈`
            : `Sim, ${target ?? 'você'} é gay 🏳️‍🌈`;
      const jpImages = [
        'https://m.media-amazon.com/images/I/61eTb-caKiL._UF1000,1000_QL80_.jpg',
        'https://uploads.spiritfanfiction.com/historias/capas/202111/sanji-x-zoro-23215447-051120211126.png',
        'https://cdn.polyspeak.ai/speakmaster/poly-sdispatcher/superresolution/images/20250111/38381fd2-b0d5-4c97-9c89-692f1bf3a250.webp',
      ];
      const enImages = [
        'https://ih1.redbubble.net/image.5311218987.4442/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg',
        'https://images3.memedroid.com/images/UPLOADED356/5dd70d2ca502c.jpeg',
        'https://ih1.redbubble.net/image.5662721872.6818/fposter,small,wall_texture,square_product,600x600.jpg',
      ];
      const notGayImg = isJP
        ? 'https://i.scdn.co/image/ab67616d0000b27360dc8d59c48845c0d65a91ae'
        : 'https://m.media-amazon.com/images/I/41UeVERMojL._UXNaN_FMjpg_QL85_.jpg';
      const replyImg = notGay
        ? notGayImg
        : isJP
          ? jpImages[hashRand(castHash, jpImages.length)]
          : isEN
            ? enImages[hashRand(castHash, enImages.length)]
            : [
                'https://ih1.redbubble.net/image.5311218987.4442/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg',
                'https://images7.memedroid.com/images/UPLOADED347/5ae77b1270483.jpeg',
                'https://preview.redd.it/eae-voc%C3%AAs-s%C3%A3o-v0-7ap0afaqqxdf1.jpeg?width=640&crop=smart&auto=webp&s=1ad3b8773ed83073187c896214ad9cc9ab3f42bf',
            ][hashRand(castHash, 3)];
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
