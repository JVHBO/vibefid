import { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ fid: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { fid } = await params;

  return {
    title: `VibeFID #${fid} - Neynar Score`,
    description: 'Check your Neynar Score and mint your VibeFID card!',
    openGraph: {
      title: `VibeFID #${fid} - Neynar Score`,
      description: 'Check your Neynar Score and mint your VibeFID card!',
      siteName: 'VibeFID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `VibeFID #${fid} - Neynar Score`,
      description: 'Check your Neynar Score and mint your VibeFID card!',
    },
    other: {
      'fc:frame': JSON.stringify({
        version: 'next',
        imageUrl: `https://vibefid.xyz/share/score/${fid}/opengraph-image`,
        button: {
          title: 'Check Your Score',
          action: {
            type: 'launch_frame',
            name: 'VibeFID',
            url: 'https://vibefid.xyz/fid',
            splashImageUrl: 'https://vibefid.xyz/splash.png',
            splashBackgroundColor: '#1a1a2e',
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
