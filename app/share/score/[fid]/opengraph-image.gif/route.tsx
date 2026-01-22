import satori from 'satori';
import sharp from 'sharp';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const runtime = 'nodejs';
export const maxDuration = 30;

let fontData: ArrayBuffer | null = null;

// Farcaster Frames v2 size (3:2 aspect ratio)
const width = 1200;
const height = 800;

// Translations for GIF labels
const gifTranslations: Record<string, {
  neynarScore: string;
  rarity: string;
  vibefidRank: string;
  globalRank: string;
  needMint: string;
  prizeFoil: string;
  foil: string;
}> = {
  en: {
    neynarScore: 'NEYNAR SCORE',
    rarity: 'Rarity:',
    vibefidRank: 'VibeFID Rank:',
    globalRank: 'Global Rank:',
    needMint: 'Need Mint',
    prizeFoil: 'PRIZE FOIL',
    foil: 'FOIL',
  },
  'pt-BR': {
    neynarScore: 'NEYNAR SCORE',
    rarity: 'Raridade:',
    vibefidRank: 'Rank VibeFID:',
    globalRank: 'Rank Global:',
    needMint: 'Precisa Mintar',
    prizeFoil: 'FOIL PRIZE',
    foil: 'FOIL',
  },
  es: {
    neynarScore: 'NEYNAR SCORE',
    rarity: 'Rareza:',
    vibefidRank: 'Rank VibeFID:',
    globalRank: 'Rank Global:',
    needMint: 'Necesita Mint',
    prizeFoil: 'FOIL PRIZE',
    foil: 'FOIL',
  },
  ja: {
    neynarScore: 'NEYNARスコア',
    rarity: 'レアリティ:',
    vibefidRank: 'VibeFIDランク:',
    globalRank: 'グローバルランク:',
    needMint: 'ミント必要',
    prizeFoil: 'プライズフォイル',
    foil: 'フォイル',
  },
  'zh-CN': {
    neynarScore: 'NEYNAR分数',
    rarity: '稀有度:',
    vibefidRank: 'VibeFID排名:',
    globalRank: '全球排名:',
    needMint: '需要铸造',
    prizeFoil: '奖品闪卡',
    foil: '闪卡',
  },
  ru: {
    neynarScore: 'NEYNAR СЧЁТ',
    rarity: 'Редкость:',
    vibefidRank: 'Ранг VibeFID:',
    globalRank: 'Глобальный ранг:',
    needMint: 'Нужен Минт',
    prizeFoil: 'ПРИЗОВАЯ ФОЛЬГА',
    foil: 'ФОЛЬГА',
  },
  hi: {
    neynarScore: 'NEYNAR स्कोर',
    rarity: 'दुर्लभता:',
    vibefidRank: 'VibeFID रैंक:',
    globalRank: 'वैश्विक रैंक:',
    needMint: 'मिंट चाहिए',
    prizeFoil: 'प्राइज़ फ़ॉइल',
    foil: 'फ़ॉइल',
  },
  fr: {
    neynarScore: 'SCORE NEYNAR',
    rarity: 'Rareté:',
    vibefidRank: 'Rang VibeFID:',
    globalRank: 'Rang Global:',
    needMint: 'Mint Requis',
    prizeFoil: 'FOIL PRIX',
    foil: 'FOIL',
  },
  id: {
    neynarScore: 'SKOR NEYNAR',
    rarity: 'Kelangkaan:',
    vibefidRank: 'Peringkat VibeFID:',
    globalRank: 'Peringkat Global:',
    needMint: 'Perlu Mint',
    prizeFoil: 'FOIL HADIAH',
    foil: 'FOIL',
  },
};

// Helper to estimate global rank if OpenRank fails
function estimateGlobalRank(neynarScore: number): string {
  if (neynarScore >= 1.00) return 'Top 50';
  if (neynarScore >= 0.99) return 'Top 200';
  if (neynarScore >= 0.95) return 'Top 1k';
  if (neynarScore >= 0.90) return 'Top 2.5k';
  if (neynarScore >= 0.85) return 'Top 5k';
  if (neynarScore >= 0.80) return 'Top 10k';
  if (neynarScore >= 0.70) return 'Top 25k';
  if (neynarScore >= 0.60) return 'Top 50k';
  if (neynarScore >= 0.50) return 'Top 100k';
  return 'Top 50%';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const { fid } = await params;
  const fidNum = parseInt(fid);

  // Get language from query param
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') || 'en';
  const t = gifTranslations[lang] || gifTranslations['en'];

  try {
    // Load font
    if (!fontData) {
      const fontResponse = await fetch(
        'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff'
      );
      fontData = await fontResponse.arrayBuffer();
    }

    const convexUrl = "https://agile-orca-761.convex.cloud";
    const neynarApiKey = process.env.NEYNAR_API_KEY;

    // Fetch card data from Convex
    let cardData: any = null;
    const cardResponse = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'farcasterCards:getFarcasterCardByFid',
        args: { fid: fidNum },
        format: 'json',
      }),
    });

    if (cardResponse.ok) {
      const data = await cardResponse.json();
      cardData = data.value;
    }

    // Fetch VibeFID rank from Convex
    let vibefidRank: number | null = null;
    let totalCards: number = 0;
    try {
      const rankResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'farcasterCards:getVibeFIDRank',
          args: { fid: fidNum },
          format: 'json',
        }),
      });
      if (rankResponse.ok) {
        const rankData = await rankResponse.json();
        vibefidRank = rankData.value?.rank;
        totalCards = rankData.value?.totalCards || 0;
      }
    } catch (e) {
      console.log('VibeFID rank fetch failed');
    }

    // Fetch global rank from OpenRank API
    let globalRank: number | null = null;
    let globalRankDisplay: string = '';
    try {
      const openRankResponse = await fetch('https://graph.cast.k3l.io/scores/global/engagement/fids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([fidNum]),
      });
      if (openRankResponse.ok) {
        const openRankData = await openRankResponse.json();
        if (Array.isArray(openRankData) && openRankData.length > 0) {
          globalRank = openRankData[0].rank;
          globalRankDisplay = `#${globalRank?.toLocaleString()}`;
        }
      }
    } catch (e) {
      console.log('OpenRank API fetch failed');
    }

    // Always fetch current score from Neynar API
    let neynarData: any = null;
    if (neynarApiKey) {
      try {
        const neynarResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
          { headers: { api_key: neynarApiKey } }
        );
        if (neynarResponse.ok) {
          const data = await neynarResponse.json();
          const user = data.users?.[0];
          if (user) {
            const neynarScore = user.experimental?.neynar_user_score || 0;
            let neynarRarity = 'Common';
            if (neynarScore >= 0.99) neynarRarity = 'Mythic';
            else if (neynarScore >= 0.90) neynarRarity = 'Legendary';
            else if (neynarScore >= 0.79) neynarRarity = 'Epic';
            else if (neynarScore >= 0.70) neynarRarity = 'Rare';

            neynarData = {
              username: user.username,
              score: neynarScore,
              rarity: neynarRarity,
            };

            // If OpenRank failed, use estimate based on score
            if (!globalRank) {
              globalRankDisplay = estimateGlobalRank(neynarScore);
            }
          }
        }
      } catch (e) {
        console.log('Neynar API fetch failed');
      }
    }

    const hasMinted = !!cardData;
    const username = cardData?.username || neynarData?.username || `FID ${fid}`;
    // Always use current Neynar score, fallback to card score if API fails
    const score = neynarData?.score ?? cardData?.neynarScore ?? 0;
    const rarity = neynarData?.rarity || cardData?.rarity || 'Common';
    const power = cardData?.power ?? 0;
    const foil = cardData?.foil || 'None';

    // Fallback for global rank estimate if still empty
    if (!globalRankDisplay) {
      globalRankDisplay = estimateGlobalRank(score);
    }

    const rarityColors: Record<string, string> = {
      Common: '#9ca3af',
      Rare: '#3B82F6',
      Epic: '#a855f7',
      Legendary: '#F59E0B',
      Mythic: '#EF4444',
    };
    const borderColor = rarityColors[rarity] || '#9ca3af';
    const gold = '#d4af37';

    // Fetch card image from IPFS
    let cardImageBase64 = '';
    const cardImageUrl = cardData?.cardImageUrl;

    if (cardImageUrl && cardImageUrl.startsWith('http')) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);
        const imgResponse = await fetch(cardImageUrl, { signal: controller.signal });
        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer();
          cardImageBase64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
        }
      } catch (e) {
        console.log('Failed to fetch card image');
      }
    }

    // Create GIF encoder
    const gif = GIFEncoder();

    // Generate frames - card rotation
    const frameCount = 12;
    const cardBaseWidth = 320;
    const cardHeight = 448;

    for (let i = 0; i < frameCount; i++) {
      const angle = (i / frameCount) * Math.PI * 2;
      const scaleX = Math.cos(angle);
      const absScale = Math.abs(scaleX);
      const cardW = Math.floor(cardBaseWidth * absScale);
      const showFront = scaleX >= 0;

      const svg = await satori(
        // @ts-ignore - satori accepts this format
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 50%, #1a1a2e 100%)',
              position: 'relative',
              fontFamily: 'Inter',
            },
            children: [
              // Outer gold border
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: `4px solid ${gold}`,
                  },
                },
              },
              // Inner border
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    right: 8,
                    bottom: 8,
                    border: `1px solid ${gold}50`,
                  },
                },
              },
              // Decorative line top
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: 16,
                    left: 50,
                    width: width - 100,
                    height: 1,
                    backgroundColor: `${gold}60`,
                  },
                },
              },
              // Decorative line bottom
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: 16,
                    left: 50,
                    width: width - 100,
                    height: 1,
                    backgroundColor: `${gold}60`,
                  },
                },
              },
              // Main content
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    padding: 40,
                  },
                  children: [
                    // Left side - Card
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 380,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: Math.max(cardW, 4),
                                height: cardHeight,
                                borderRadius: 12,
                                border: `4px solid ${borderColor}`,
                                overflow: 'hidden',
                                backgroundColor: showFront ? '#1a1a2e' : borderColor,
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 0 30px ${borderColor}40`,
                              },
                              children: showFront && absScale > 0.15 && cardImageBase64 ? [
                                {
                                  type: 'img',
                                  props: {
                                    src: cardImageBase64,
                                    width: Math.max(Math.floor(cardW - 8), 1),
                                    height: cardHeight - 8,
                                    style: {
                                      objectFit: 'cover',
                                    },
                                  },
                                },
                              ] : showFront && absScale > 0.3 ? [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      color: 'white',
                                      fontSize: 24,
                                    },
                                    children: `@${username}`,
                                  },
                                },
                              ] : undefined,
                            },
                          },
                        ],
                      },
                    },
                    // Right side - Score info
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          flex: 1,
                          paddingLeft: 60,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: { color: gold, fontSize: 36, fontWeight: 700 },
                              children: t.neynarScore,
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: 350,
                                height: 3,
                                backgroundColor: gold,
                                marginTop: 12,
                                marginBottom: 20,
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: { color: '#c9a961', fontSize: 24 },
                              children: `@${username}`,
                            },
                          },
                          !hasMinted ? {
                            type: 'div',
                            props: {
                              style: { color: '#ef4444', fontSize: 18, marginTop: 4 },
                              children: t.needMint,
                            },
                          } : null,
                          {
                            type: 'div',
                            props: {
                              style: { color: 'white', fontSize: 72, fontWeight: 700, marginTop: 8 },
                              children: score.toFixed(3),
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                marginTop: 20,
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: '#c9a961', fontSize: 18, marginRight: 12 },
                                    children: t.rarity,
                                  },
                                },
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: borderColor, fontSize: 20, fontWeight: 700 },
                                    children: rarity,
                                  },
                                },
                                // Show foil if not None
                                foil !== 'None' ? {
                                  type: 'div',
                                  props: {
                                    style: {
                                      color: foil === 'Prize' ? '#fbbf24' : '#a78bfa',
                                      fontSize: 18,
                                      fontWeight: 700,
                                      marginLeft: 16,
                                      padding: '2px 8px',
                                      backgroundColor: foil === 'Prize' ? '#fbbf2420' : '#a78bfa20',
                                      borderRadius: 4,
                                    },
                                    children: foil === 'Prize' ? t.prizeFoil : t.foil,
                                  },
                                } : null,
                              ],
                            },
                          },
                          // VibeFID Rank row
                          hasMinted && vibefidRank ? {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                marginTop: 12,
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: '#c9a961', fontSize: 18, marginRight: 12 },
                                    children: t.vibefidRank,
                                  },
                                },
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: '#22c55e', fontSize: 20, fontWeight: 700 },
                                    children: `#${vibefidRank} / ${totalCards}`,
                                  },
                                },
                              ],
                            },
                          } : null,
                          // Global Rank row
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                marginTop: 12,
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: '#c9a961', fontSize: 18, marginRight: 12 },
                                    children: t.globalRank,
                                  },
                                },
                                {
                                  type: 'div',
                                  props: {
                                    style: { color: '#60a5fa', fontSize: 20, fontWeight: 700 },
                                    children: globalRankDisplay,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                marginTop: 25,
                                color: gold,
                                fontSize: 18,
                                padding: '8px 20px',
                                border: `2px solid ${gold}`,
                                borderRadius: 8,
                              },
                              children: `FID #${fid}`,
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          width,
          height,
          fonts: [
            {
              name: 'Inter',
              data: fontData!,
              weight: 400,
              style: 'normal' as const,
            },
          ],
        }
      );

      // Convert SVG to pixels using sharp
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(width, height)
        .raw()
        .toBuffer();
      const pixels = new Uint8Array(pngBuffer);

      // Quantize and add frame
      const palette = quantize(pixels, 256);
      const index = applyPalette(pixels, palette);

      gif.writeFrame(index, width, height, {
        palette,
        delay: 150,
      });
    }

    gif.finish();

    return new Response(gif.bytes(), {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });

  } catch (e: any) {
    console.error('GIF Error:', e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
