import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeFID Neynar Score';
export const size = {
  width: 1200,
  height: 800,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ fid: string }> }) {
  const { fid } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: 'white',
          fontSize: 48,
          fontWeight: 900,
        }}
      >
        VibeFID Score - FID #{fid}
      </div>
    ),
    { ...size }
  );
}
