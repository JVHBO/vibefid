'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page - redirects to /fid
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/fid');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <h1 className="text-4xl font-bold text-white mb-4">VibeFID</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}
