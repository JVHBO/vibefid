"use client";

import { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

const VBMS_MINIAPP_URL = 'https://farcaster.xyz/miniapps/0sNKxskaSKsH/vbms---game-and-wanted-cast';

export default function VibeFIDMigrated() {
  const [isInMiniapp, setIsInMiniapp] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window === 'undefined') return;
        if (!sdk || typeof sdk.actions?.ready !== 'function') return;
        await sdk.actions.ready();
        setIsInMiniapp(true);
      } catch (e) {
        console.log('[VibeFID Migration] Not in miniapp context');
      }
    };
    init();
  }, []);

  const handleOpenVibe = async () => {
    if (isInMiniapp) {
      try {
        await sdk.actions.openMiniApp({ url: VBMS_MINIAPP_URL });
      } catch (err) {
        window.open(VBMS_MINIAPP_URL, '_blank');
      }
    } else {
      window.open(VBMS_MINIAPP_URL, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-vintage-charcoal to-vintage-deep-black flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        {/* Logo / Icon */}
        <div className="text-7xl mb-6">♠</div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-vintage-gold mb-3">
          VibeFID Migrated
        </h1>

        {/* Message */}
        <p className="text-vintage-ice/80 text-sm mb-2">
          VibeFID is now part of <span className="text-vintage-gold font-bold">Vibe Most Wanted</span>.
        </p>
        <p className="text-vintage-ice/60 text-xs mb-8">
          All your cards, VibeMail, rankings and features have been moved to the main app.
        </p>

        {/* CTA Button */}
        <button
          onClick={handleOpenVibe}
          className="w-full px-6 py-4 bg-vintage-gold hover:bg-yellow-500 text-vintage-black font-bold rounded-xl transition-all text-lg shadow-lg shadow-yellow-500/20"
        >
          Open Vibe Most Wanted ♠
        </button>

        {/* Secondary info */}
        <p className="text-vintage-ice/40 text-xs mt-6">
          vibemostwanted.xyz/fid
        </p>
      </div>
    </div>
  );
}
