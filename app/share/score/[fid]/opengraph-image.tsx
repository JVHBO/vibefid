import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeFID Neynar Score';
export const size = {
  width: 1200,
  height: 800,
};
export const contentType = 'image/png';

const rarityColors: Record<string, string> = {
  Common: '#6B7280',
  Rare: '#3B82F6',
  Epic: '#8B5CF6',
  Legendary: '#F59E0B',
  Mythic: '#EF4444',
};

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  try {
    const { fid } = await params;

    let cardData: any = null;
    let scoreHistory: any = null;
    let fetchError = '';

    try {
      const convexUrl = "https://agile-orca-761.convex.cloud";

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
      } else {
        fetchError = `Card fetch failed: ${cardResponse.status}`;
      }

      const historyResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'neynarScore:getScoreHistory',
          args: { fid: parseInt(fid) },
          format: 'json',
        }),
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        scoreHistory = historyData.value;
      }
    } catch (e: any) {
      fetchError = e.message || 'Unknown fetch error';
    }

    if (!cardData) {
      return new ImageResponse(
        (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#667eea', color: 'white', flexDirection: 'column' }}>
            <div style={{ fontSize: 48, fontWeight: 900 }}>VibeFID #{fid}</div>
            <div style={{ fontSize: 24, marginTop: 20 }}>Check your Neynar Score!</div>
            {fetchError && <div style={{ fontSize: 16, marginTop: 10, color: '#ff6b6b' }}>{fetchError}</div>}
          </div>
        ),
        { ...size }
      );
    }

    const currentScore = cardData.neynarScore || 0;
    const mintScore = scoreHistory?.mintScore || currentScore;
    const scoreDiff = currentScore - mintScore;
    const diffSign = scoreDiff >= 0 ? '+' : '';
    const currentRarity = cardData.rarity || 'Common';
    const borderColor = rarityColors[currentRarity] || '#6B7280';
    const suitColor = cardData.color === 'red' ? '#EF4444' : '#FFFFFF';

    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#1a1a2e', padding: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 400 }}>
            <div
              style={{
                width: 350,
                height: 490,
                backgroundColor: '#2a2a4e',
                borderRadius: 16,
                border: `6px solid ${borderColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ color: suitColor, fontSize: 72, fontWeight: 900 }}>
                {cardData.rank || '?'}{cardData.suitSymbol || ''}
              </div>
              <div style={{ color: 'white', fontSize: 24, marginTop: 20 }}>@{cardData.username}</div>
              <div style={{ color: borderColor, fontSize: 20, marginTop: 10 }}>{currentRarity}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingLeft: 40 }}>
            <div style={{ color: '#d4af37', fontSize: 36, fontWeight: 900 }}>NEYNAR SCORE</div>
            <div style={{ color: '#c9a961', fontSize: 22, marginTop: 10 }}>@{cardData.username}</div>
            <div style={{ color: 'white', fontSize: 80, fontWeight: 900, marginTop: 20 }}>{currentScore.toFixed(3)}</div>
            <div style={{ color: scoreDiff >= 0 ? '#4ade80' : '#f87171', fontSize: 26, marginTop: 5 }}>
              {diffSign}{scoreDiff.toFixed(4)} since mint
            </div>
            <div style={{ display: 'flex', marginTop: 30 }}>
              <div style={{ color: '#c9a961', fontSize: 20, marginRight: 10 }}>Rarity:</div>
              <div style={{ color: borderColor, fontSize: 26, fontWeight: 700 }}>{currentRarity}</div>
            </div>
            <div style={{ display: 'flex', marginTop: 15 }}>
              <div style={{ color: '#c9a961', fontSize: 20, marginRight: 10 }}>Power:</div>
              <div style={{ color: '#fbbf24', fontSize: 26, fontWeight: 700 }}>{cardData.power || 0}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
              <div style={{ color: '#d4af37', fontSize: 20, padding: '8px 16px', border: '2px solid #d4af37', borderRadius: 6 }}>
                FID #{fid}
              </div>
              <div style={{ color: '#d4af37', fontSize: 22, fontWeight: 700 }}>vibefid.xyz</div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (e: any) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4444', color: 'white', flexDirection: 'column' }}>
          <div style={{ fontSize: 32, fontWeight: 900 }}>Error generating image</div>
          <div style={{ fontSize: 18, marginTop: 10 }}>{e.message || 'Unknown error'}</div>
        </div>
      ),
      { ...size }
    );
  }
}
