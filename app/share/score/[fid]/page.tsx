import { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ fid: string }>;
  searchParams: Promise<{ lang?: string; v?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { fid } = await params;
  const { lang = 'en', v = '2' } = await searchParams;

  // Build GIF URL with language parameter
  const gifUrl = `https://vibefid.xyz/share/score/${fid}/opengraph-image.gif?lang=${lang}&v=${v}`;

  return {
    title: `VibeFID #${fid} - Neynar Score`,
    description: 'Check your Neynar Score and mint your VibeFID card!',
    openGraph: {
      title: `VibeFID #${fid} - Neynar Score`,
      description: 'Check your Neynar Score and mint your VibeFID card!',
      siteName: 'VibeFID',
      type: 'website',
      images: [gifUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: `VibeFID #${fid} - Neynar Score`,
      description: 'Check your Neynar Score and mint your VibeFID card!',
      images: [gifUrl],
    },
    other: {
      'fc:frame': JSON.stringify({
        version: 'next',
        imageUrl: gifUrl,
        button: {
          title: 'Check Your Score',
          action: {
            type: 'launch_frame',
            name: 'VibeFID',
            url: 'https://vibefid.xyz/fid',
            splashImageUrl: 'https://vibefid.xyz/images/splash-200.png',
            splashBackgroundColor: '#1a1a1a',
          },
        },
      }),
    },
  };
}

export default async function ScoreSharePage({ params }: PageProps) {
  const { fid } = await params;

  // Redirect to the main fid page
  redirect(`/fid/${fid}`);
}
