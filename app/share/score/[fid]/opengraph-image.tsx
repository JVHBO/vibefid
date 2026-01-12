import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeFID Neynar Score';
export const size = { width: 1200, height: 800 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  const { fid } = await params;

  console.log(`[Score OG] Generating for FID: ${fid}`);

  try {
    const convexUrl = "https://agile-orca-761.convex.cloud";

    // Fetch card data
    let cardData: any = null;
    try {
      const cardResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'farcasterCards:getFarcasterCardByFid',
          args: { fid: parseInt(fid) },
          format: 'json',
        }),
      });

      if (cardResponse.ok) {
        const data = await cardResponse.json();
        cardData = data.value;
        console.log(`[Score OG] Card found: ${cardData?.username}`);
      }
    } catch (e) {
      console.error('[Score OG] Failed to fetch card:', e);
    }

    // Fetch score history
    let scoreData: any = null;
    try {
      const scoreResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'neynarScore:getScoreHistory',
          args: { fid: parseInt(fid) },
          format: 'json',
        }),
      });

      if (scoreResponse.ok) {
        const data = await scoreResponse.json();
        scoreData = data.value;
        console.log(`[Score OG] Score found: ${scoreData?.currentScore}`);
      }
    } catch (e) {
      console.error('[Score OG] Failed to fetch score:', e);
    }

    // Rarity colors
    const rarityColors: Record<string, string> = {
      Common: '#9ca3af',
      Rare: '#3B82F6',
      Epic: '#a855f7',
      Legendary: '#F59E0B',
      Mythic: '#EF4444',
    };

    const username = cardData?.username || `FID ${fid}`;
    const rarity = cardData?.rarity || 'Common';
    const borderColor = rarityColors[rarity] || '#9ca3af';
    const suitColor = cardData?.color === 'red' ? '#EF4444' : '#FFFFFF';
    const rank = cardData?.rank || '?';
    const suitSymbol = cardData?.suitSymbol || '?';
    const power = cardData?.power ?? 0;

    const currentScore = scoreData?.currentScore ?? cardData?.neynarScore ?? 0;
    const mintScore = scoreData?.mintScore;
    const mintRarity = scoreData?.mintRarity;

    // Try to fetch card image from IPFS
    let cardImageBase64 = '';
    const cardImageUrl = cardData?.cardImageUrl;

    if (cardImageUrl) {
      try {
        let cid = '';
        if (cardImageUrl.startsWith('ipfs://')) {
          cid = cardImageUrl.replace('ipfs://', '');
        } else if (cardImageUrl.includes('/ipfs/')) {
          cid = cardImageUrl.split('/ipfs/')[1];
        }

        if (cid) {
          const gateways = [
            `https://ipfs.filebase.io/ipfs/${cid}`,
            `https://cloudflare-ipfs.com/ipfs/${cid}`,
          ];

          for (const gatewayUrl of gateways) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);

              const imgResponse = await fetch(gatewayUrl, { signal: controller.signal });
              clearTimeout(timeoutId);

              if (imgResponse.ok) {
                const buffer = await imgResponse.arrayBuffer();
                cardImageBase64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
                console.log(`[Score OG] Card image loaded from IPFS`);
                break;
              }
            } catch (e) {
              console.log(`[Score OG] Gateway failed: ${gatewayUrl}`);
            }
          }
        }
      } catch (e) {
        console.error('[Score OG] Failed to load card image:', e);
      }
    }

    // Calculate score diff
    let scoreDiffText = '';
    let scoreDiffColor = '#9ca3af';
    if (mintScore !== undefined && mintScore !== null) {
      const diff = currentScore - mintScore;
      const sign = diff >= 0 ? '+' : '';
      scoreDiffText = `${sign}${diff.toFixed(4)} since mint`;
      scoreDiffColor = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#9ca3af';
    }

    // Check for rarity upgrade
    const hasRarityUpgrade = mintRarity && mintRarity !== rarity;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a2e',
            padding: 40,
          }}
        >
          {/* Left side - Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 420,
            }}
          >
            {cardImageBase64 ? (
              <img
                src={cardImageBase64}
                width={360}
                height={504}
                style={{
                  borderRadius: 16,
                  border: `6px solid ${borderColor}`,
                  boxShadow: `0 0 30px ${borderColor}`,
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 360,
                  height: 504,
                  backgroundColor: '#2a2a4e',
                  borderRadius: 16,
                  border: `6px solid ${borderColor}`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', color: suitColor, fontSize: 72, fontWeight: 900 }}>
                  {rank}{suitSymbol}
                </div>
                <div style={{ display: 'flex', color: 'white', fontSize: 24, marginTop: 20 }}>
                  @{username}
                </div>
                <div style={{ display: 'flex', color: borderColor, fontSize: 20, marginTop: 10 }}>
                  {rarity}
                </div>
              </div>
            )}
          </div>

          {/* Right side - Score info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              paddingLeft: 50,
            }}
          >
            {/* Title */}
            <div style={{ display: 'flex', color: '#d4af37', fontSize: 38, fontWeight: 900 }}>
              NEYNAR SCORE
            </div>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                width: 400,
                height: 3,
                backgroundColor: '#d4af37',
                marginTop: 15,
                marginBottom: 25,
              }}
            />

            {/* Username */}
            <div style={{ display: 'flex', color: '#c9a961', fontSize: 26 }}>
              @{username}
            </div>

            {/* Big Score */}
            <div style={{ display: 'flex', color: 'white', fontSize: 80, fontWeight: 900, marginTop: 10 }}>
              {currentScore.toFixed(3)}
            </div>

            {/* Score diff */}
            {scoreDiffText && (
              <div style={{ display: 'flex', color: scoreDiffColor, fontSize: 24, fontWeight: 700, marginTop: 5 }}>
                {scoreDiffText}
              </div>
            )}

            {/* Rarity */}
            <div style={{ display: 'flex', marginTop: 35 }}>
              <div style={{ display: 'flex', color: '#c9a961', fontSize: 22, marginRight: 15 }}>
                Rarity:
              </div>
              {hasRarityUpgrade ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', color: '#9ca3af', fontSize: 26, fontWeight: 700 }}>
                    {mintRarity}
                  </div>
                  <div style={{ display: 'flex', color: '#d4af37', fontSize: 26, marginLeft: 10, marginRight: 10 }}>
                    →
                  </div>
                  <div style={{ display: 'flex', color: borderColor, fontSize: 26, fontWeight: 700 }}>
                    {rarity}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', color: borderColor, fontSize: 26, fontWeight: 700 }}>
                  {rarity}
                </div>
              )}
            </div>

            {/* Power */}
            <div style={{ display: 'flex', marginTop: 20 }}>
              <div style={{ display: 'flex', color: '#c9a961', fontSize: 22, marginRight: 15 }}>
                Power:
              </div>
              <div style={{ display: 'flex', color: '#fbbf24', fontSize: 26, fontWeight: 700 }}>
                {power}
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60, width: 400 }}>
              <div
                style={{
                  display: 'flex',
                  color: '#d4af37',
                  fontSize: 20,
                  padding: '10px 20px',
                  border: '2px solid #d4af37',
                  borderRadius: 8,
                }}
              >
                FID #{fid}
              </div>
              <div style={{ display: 'flex', color: '#d4af37', fontSize: 24, fontWeight: 700 }}>
                vibefid.xyz
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (e: any) {
    console.error('[Score OG] Error:', e);

    // Fallback
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            fontSize: '32px',
            fontWeight: 900,
          }}
        >
          VibeFID Score - FID #{fid}
        </div>
      ),
      { ...size }
    );
  }
}
