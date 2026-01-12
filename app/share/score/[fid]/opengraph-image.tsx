import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeFID Neynar Score';
export const size = {
  width: 1200,
  height: 800,
};
export const contentType = 'image/png';

// Rarity colors
const rarityColors: Record<string, string> = {
  Common: '#9ca3af',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
  Mythic: '#ef4444',
};

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  const { fid } = await params;

  try {
    // Fetch card data from Convex
    let cardData: any = null;
    let scoreHistory: any = null;

    try {
      const convexUrl = "https://agile-orca-761.convex.cloud";

      // Fetch card data
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
        if (data.value) {
          cardData = data.value;
        }
      }

      // Fetch score history
      const historyResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'farcasterCards:getScoreHistory',
          args: { fid: parseInt(fid) },
          format: 'json',
        }),
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.value) {
          scoreHistory = historyData.value;
        }
      }
    } catch (e) {
      console.error('[Score OG] Failed to fetch data:', e);
    }

    if (!cardData) {
      // Fallback for unminted cards
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
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 900 }}>VibeFID</div>
            <div style={{ fontSize: '24px' }}>FID #{fid}</div>
            <div style={{ fontSize: '16px', opacity: 0.9 }}>Check your Neynar Score!</div>
          </div>
        ),
        { ...size }
      );
    }

    // Get current score and calculate diff
    const currentScore = cardData.neynarScore || 0;
    const mintScore = scoreHistory?.mintScore || cardData.neynarScore || currentScore;
    const scoreDiff = currentScore - mintScore;
    const diffSign = scoreDiff >= 0 ? '+' : '';
    const diffColor = scoreDiff > 0 ? '#4ade80' : scoreDiff < 0 ? '#f87171' : '#9ca3af';

    const currentRarity = cardData.rarity || 'Common';
    const mintRarity = scoreHistory?.mintRarity || currentRarity;
    const rarityChanged = mintRarity !== currentRarity;

    const borderColor = rarityColors[currentRarity] || '#9ca3af';

    // Try to fetch card image
    let cardImageBase64 = '';
    const cardImageUrl = cardData.cardImageUrl || cardData.imageUrl;

    if (cardImageUrl) {
      try {
        let imageUrl = cardImageUrl;
        let cid = '';

        if (imageUrl.startsWith('ipfs://')) {
          cid = imageUrl.replace('ipfs://', '');
        } else if (imageUrl.includes('/ipfs/')) {
          cid = imageUrl.split('/ipfs/')[1];
        }

        const gateways = [
          `https://ipfs.filebase.io/ipfs/${cid}`,
          `https://cloudflare-ipfs.com/ipfs/${cid}`,
        ];

        for (const gatewayUrl of gateways) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const imageResponse = await fetch(gatewayUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              cardImageBase64 = `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
              break;
            }
          } catch {
            continue;
          }
        }
      } catch (e) {
        console.error('[Score OG] Failed to fetch card image:', e);
      }
    }

    // Try to fetch PFP as fallback
    let pfpBase64 = '';
    if (!cardImageBase64 && cardData.pfpUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const pfpResponse = await fetch(cardData.pfpUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (pfpResponse.ok) {
          const pfpBuffer = await pfpResponse.arrayBuffer();
          pfpBase64 = `data:image/jpeg;base64,${Buffer.from(pfpBuffer).toString('base64')}`;
        }
      } catch {
        // Ignore
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            padding: 40,
          }}
        >
          {/* Left side - Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 420,
              marginRight: 40,
            }}
          >
            {cardImageBase64 ? (
              <img
                src={cardImageBase64}
                width={380}
                height={532}
                style={{
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                  boxShadow: `0 0 30px ${borderColor}40`,
                }}
              />
            ) : pfpBase64 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 380,
                  height: 532,
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                  background: '#2a2a4e',
                }}
              >
                <img
                  src={pfpBase64}
                  width={200}
                  height={200}
                  style={{ borderRadius: '50%', marginBottom: 20 }}
                />
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>
                  @{cardData.username}
                </div>
                <div style={{ color: borderColor, fontSize: 24, marginTop: 10 }}>
                  {currentRarity}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 380,
                  height: 532,
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                  background: '#2a2a4e',
                }}
              >
                <div style={{ color: '#fff', fontSize: 48, fontWeight: 900 }}>
                  {cardData.rank}{cardData.suitSymbol}
                </div>
                <div style={{ color: '#fff', fontSize: 28, marginTop: 20 }}>
                  @{cardData.username}
                </div>
              </div>
            )}
          </div>

          {/* Right side - Score info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              paddingTop: 20,
            }}
          >
            {/* Title */}
            <div style={{ color: '#d4af37', fontSize: 42, fontWeight: 900, marginBottom: 10 }}>
              NEYNAR SCORE
            </div>

            {/* Divider */}
            <div
              style={{
                width: '100%',
                height: 3,
                background: '#d4af37',
                marginBottom: 30,
              }}
            />

            {/* Username */}
            <div style={{ color: '#c9a961', fontSize: 26, marginBottom: 20 }}>
              @{cardData.username}
            </div>

            {/* Big Score */}
            <div style={{ color: '#ffffff', fontSize: 80, fontWeight: 900, marginBottom: 5 }}>
              {currentScore.toFixed(3)}
            </div>

            {/* Score diff */}
            <div style={{ color: diffColor, fontSize: 32, fontWeight: 700, marginBottom: 40 }}>
              {diffSign}{scoreDiff.toFixed(4)} since mint
            </div>

            {/* Rarity */}
            <div style={{ color: '#c9a961', fontSize: 24, marginBottom: 10 }}>
              Rarity
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
              {rarityChanged ? (
                <>
                  <span style={{ color: '#9ca3af', fontSize: 36, fontWeight: 700 }}>{mintRarity}</span>
                  <span style={{ color: '#d4af37', fontSize: 36, margin: '0 15px' }}>&rarr;</span>
                  <span style={{ color: borderColor, fontSize: 36, fontWeight: 700 }}>{currentRarity}</span>
                </>
              ) : (
                <span style={{ color: borderColor, fontSize: 36, fontWeight: 700 }}>{currentRarity}</span>
              )}
            </div>

            {/* Power */}
            <div style={{ color: '#c9a961', fontSize: 24, marginBottom: 10 }}>
              Power
            </div>
            <div style={{ color: '#fbbf24', fontSize: 36, fontWeight: 700, marginBottom: 40 }}>
              {cardData.power || 0}
            </div>

            {/* Bottom - FID badge */}
            <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 24px',
                  background: 'rgba(212, 175, 55, 0.2)',
                  border: '2px solid #d4af37',
                  borderRadius: 8,
                }}
              >
                <span style={{ color: '#d4af37', fontSize: 24, fontWeight: 700 }}>FID #{fid}</span>
              </div>
              <div style={{ color: '#d4af37', fontSize: 28, fontWeight: 700 }}>
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
            fontSize: '28px',
            fontWeight: 900,
          }}
        >
          VibeFID - Neynar Score
        </div>
      ),
      { ...size }
    );
  }
}
