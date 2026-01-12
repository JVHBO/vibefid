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
  Common: '#6B7280',
  Rare: '#3B82F6',
  Epic: '#8B5CF6',
  Legendary: '#F59E0B',
  Mythic: '#EF4444',
};

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  const { fid } = await params;

  try {
    // Fetch card data from Convex
    let cardData: any = null;
    let scoreHistory: any = null;

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
      cardData = data.value;
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
      scoreHistory = historyData.value;
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
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 900, marginBottom: 20 }}>VibeFID</div>
            <div style={{ fontSize: 32 }}>FID #{fid}</div>
            <div style={{ fontSize: 24, opacity: 0.8, marginTop: 20 }}>Check your Neynar Score!</div>
          </div>
        ),
        { ...size }
      );
    }

    // Calculate score data
    const currentScore = cardData.neynarScore || 0;
    const mintScore = scoreHistory?.mintScore || cardData.neynarScore || currentScore;
    const scoreDiff = currentScore - mintScore;
    const diffSign = scoreDiff >= 0 ? '+' : '';
    const diffColor = scoreDiff > 0 ? '#4ade80' : scoreDiff < 0 ? '#f87171' : '#9ca3af';

    const currentRarity = cardData.rarity || 'Common';
    const mintRarity = scoreHistory?.mintRarity || currentRarity;
    const rarityChanged = mintRarity !== currentRarity;
    const borderColor = rarityColors[currentRarity] || '#6B7280';

    // Try to fetch card image from IPFS
    let cardImageBase64 = '';
    const cardImageUrl = cardData.cardImageUrl || cardData.imageUrl;

    if (cardImageUrl) {
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
            const timeoutId = setTimeout(() => controller.abort(), 8000);
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
      }
    }

    // Fallback: fetch PFP
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
            fontFamily: 'sans-serif',
          }}
        >
          {/* Left side - Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 400,
              marginRight: 60,
            }}
          >
            {cardImageBase64 ? (
              <img
                src={cardImageBase64}
                width={360}
                height={504}
                style={{
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                }}
              />
            ) : pfpBase64 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 360,
                  height: 504,
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                  background: '#2a2a4e',
                }}
              >
                <img
                  src={pfpBase64}
                  width={180}
                  height={180}
                  style={{ borderRadius: 90, marginBottom: 20 }}
                />
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
                  @{cardData.username}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 360,
                  height: 504,
                  borderRadius: 16,
                  border: `4px solid ${borderColor}`,
                  background: '#2a2a4e',
                }}
              >
                <div style={{ color: '#fff', fontSize: 64, fontWeight: 900 }}>
                  {cardData.rank || '?'}{cardData.suitSymbol || ''}
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
              justifyContent: 'center',
            }}
          >
            {/* Title */}
            <div style={{ color: '#d4af37', fontSize: 38, fontWeight: 900, marginBottom: 20 }}>
              NEYNAR SCORE
            </div>

            {/* Username */}
            <div style={{ color: '#c9a961', fontSize: 24, marginBottom: 30 }}>
              @{cardData.username}
            </div>

            {/* Big Score */}
            <div style={{ color: '#ffffff', fontSize: 72, fontWeight: 900, marginBottom: 10 }}>
              {currentScore.toFixed(3)}
            </div>

            {/* Score diff */}
            <div style={{ color: diffColor, fontSize: 28, fontWeight: 700, marginBottom: 40 }}>
              {diffSign}{scoreDiff.toFixed(4)} since mint
            </div>

            {/* Rarity */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
              <div style={{ color: '#c9a961', fontSize: 22, marginRight: 15 }}>Rarity:</div>
              {rarityChanged ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ color: '#9ca3af', fontSize: 28, fontWeight: 700 }}>{mintRarity}</div>
                  <div style={{ color: '#d4af37', fontSize: 28, margin: '0 10px' }}>→</div>
                  <div style={{ color: borderColor, fontSize: 28, fontWeight: 700 }}>{currentRarity}</div>
                </div>
              ) : (
                <div style={{ color: borderColor, fontSize: 28, fontWeight: 700 }}>{currentRarity}</div>
              )}
            </div>

            {/* Power */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
              <div style={{ color: '#c9a961', fontSize: 22, marginRight: 15 }}>Power:</div>
              <div style={{ color: '#fbbf24', fontSize: 28, fontWeight: 700 }}>{cardData.power || 0}</div>
            </div>

            {/* Bottom - FID and branding */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  background: 'rgba(212, 175, 55, 0.2)',
                  border: '2px solid #d4af37',
                  borderRadius: 8,
                }}
              >
                <div style={{ color: '#d4af37', fontSize: 22, fontWeight: 700 }}>FID #{fid}</div>
              </div>
              <div style={{ color: '#d4af37', fontSize: 24, fontWeight: 700 }}>
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

    // Emergency fallback
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
            fontSize: 32,
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
