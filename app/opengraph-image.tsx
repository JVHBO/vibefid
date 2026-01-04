export const runtime = 'edge';
export const alt = 'VibeFID - Mint Playable Cards from Farcaster Profiles';
export const size = {
  width: 1200,
  height: 800,
};
export const contentType = 'image/gif';

// Cache for 1 week
export const revalidate = 604800;

export default async function Image() {
  // Fetch the GIF directly from public folder
  const gifResponse = await fetch('https://vibefid.xyz/images/share-vibefid.gif', {
    next: { revalidate: 604800 },
  });

  if (!gifResponse.ok) {
    // Return a simple error response
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
