export const runtime = 'edge';
export const alt = 'VibeFID - Mint Playable Cards from Farcaster Profiles';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/gif';

// Cache for 1 week
export const revalidate = 604800;

export default async function Image() {
  const gifResponse = await fetch('https://ipfs.filebase.io/ipfs/QmWbJ6JveX56Bse2L55PtDq5pkqfR9GLNoa1U41FNTNtwt', {
    next: { revalidate: 604800 },
  });

  if (!gifResponse.ok) {
    return new Response('Not Found', { status: 404 });
  }

  const gifBuffer = await gifResponse.arrayBuffer();

  return new Response(gifBuffer, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
