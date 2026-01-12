import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeFID Neynar Score';
export const size = { width: 1200, height: 800 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  const { fid } = await params;

  // Static test - no fetch
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#1a1a2e', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 400 }}>
          <div style={{ width: 350, height: 490, backgroundColor: '#2a2a4e', borderRadius: 16, border: '6px solid #F59E0B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#EF4444', fontSize: 72, fontWeight: 900 }}>K♦</div>
            <div style={{ color: 'white', fontSize: 24, marginTop: 20 }}>@jvhbo</div>
            <div style={{ color: '#F59E0B', fontSize: 20, marginTop: 10 }}>Legendary</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingLeft: 40 }}>
          <div style={{ color: '#d4af37', fontSize: 36, fontWeight: 900 }}>NEYNAR SCORE</div>
          <div style={{ color: '#c9a961', fontSize: 22, marginTop: 10 }}>@jvhbo</div>
          <div style={{ color: 'white', fontSize: 80, fontWeight: 900, marginTop: 20 }}>0.970</div>
          <div style={{ display: 'flex', marginTop: 30 }}>
            <div style={{ color: '#c9a961', fontSize: 20, marginRight: 10 }}>Rarity:</div>
            <div style={{ color: '#F59E0B', fontSize: 26, fontWeight: 700 }}>Legendary</div>
          </div>
          <div style={{ display: 'flex', marginTop: 15 }}>
            <div style={{ color: '#c9a961', fontSize: 20, marginRight: 10 }}>Power:</div>
            <div style={{ color: '#fbbf24', fontSize: 26, fontWeight: 700 }}>100</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
            <div style={{ color: '#d4af37', fontSize: 20, padding: '8px 16px', border: '2px solid #d4af37', borderRadius: 6 }}>FID #{fid}</div>
            <div style={{ color: '#d4af37', fontSize: 22, fontWeight: 700 }}>vibefid.xyz</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
