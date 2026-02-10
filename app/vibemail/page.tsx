"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function VibeMailMigrated() {
  useEffect(() => {
    const init = async () => {
      try {
        if (!sdk || typeof sdk.actions?.ready !== 'function') return;
        await sdk.actions.ready();
      } catch (e) {}
    };
    init();
  }, []);

  const handleOpen = async () => {
    const MINIAPP_URL = 'https://farcaster.xyz/miniapps/0sNKxskaSKsH/vbms---game-and-wanted-cast';
    try {
      await sdk.actions.openMiniApp({ url: MINIAPP_URL });
    } catch (err) {
      window.open('https://vibemostwanted.xyz/fid/vibemail', '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-vintage-charcoal to-vintage-deep-black flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-7xl mb-6">♠</div>
        <h1 className="text-3xl font-bold text-vintage-gold mb-3">VibeFID Migrated</h1>
        <p className="text-vintage-ice/80 text-sm mb-2">
          VibeMail is now on <span className="text-vintage-gold font-bold">Vibe Most Wanted</span>.
        </p>
        <p className="text-vintage-ice/60 text-xs mb-8">
          All cards and features have been moved to the main app.
        </p>
        <button
          onClick={handleOpen}
          className="w-full px-6 py-4 bg-vintage-gold hover:bg-yellow-500 text-vintage-black font-bold rounded-xl transition-all text-lg shadow-lg shadow-yellow-500/20"
        >
          Open Vibe Most Wanted ♠
        </button>
        <p className="text-vintage-ice/40 text-xs mt-6">vibemostwanted.xyz/fid/vibemail</p>
      </div>
    </div>
  );
}
