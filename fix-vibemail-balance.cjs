const fs = require('fs');
let c = fs.readFileSync('components/VibeMail.tsx', 'utf8');

// 1. Add import for useVBMSBalance
c = c.replace(
  "import { useTransferVBMS } from '@/lib/hooks/useVBMSContracts';",
  "import { useTransferVBMS, useVBMSBalance } from '@/lib/hooks/useVBMSContracts';\nimport { useFarcasterContext } from '@/contexts/FarcasterContext';"
);

// 2. Add the balance hook usage after vibeMailStats in VibeMailInboxWithClaim
c = c.replace(
  "// VibeMail Stats\n  const vibeMailStats = useQuery(\n    api.cardVotes.getVibeMailStats,\n    myFid ? { fid: myFid } : 'skip'\n  );",
  `// VibeMail Stats
  const vibeMailStats = useQuery(
    api.cardVotes.getVibeMailStats,
    myFid ? { fid: myFid } : 'skip'
  );

  // VBMS Balance for Need More button
  const { balance: vbmsBalance } = useVBMSBalance(myAddress as \`0x\${string}\` | undefined);
  const farcasterContext = useFarcasterContext();`
);

// 3. Add VBMS Balance section after the title in New VibeMail modal
const oldTitle = `<h3 className="text-vintage-gold font-bold text-lg">
                {replyToMessageId ? 'Reply' : 'New VibeMail'}
              </h3>
              <div className="w-10" />
            </div>

            {/* Reply indicator */}`;

const newTitle = `<h3 className="text-vintage-gold font-bold text-lg">
                {replyToMessageId ? 'Reply' : 'New VibeMail'}
              </h3>
              <div className="w-10" />
            </div>

            {/* VBMS Balance */}
            <div className="bg-vintage-black/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-vintage-ice/60 text-xs">{t.yourVbmsBalance || 'Your VBMS Balance'}</p>
                <button
                  onClick={async () => {
                    AudioManager.buttonClick();
                    const DEX_URL = 'https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms/dex';
                    if (farcasterContext?.isInMiniapp) {
                      try {
                        await sdk.actions.openMiniApp({ url: DEX_URL });
                      } catch (err) {
                        window.open(DEX_URL, '_blank');
                      }
                    } else {
                      window.open(DEX_URL, '_blank');
                    }
                  }}
                  className="text-vintage-burnt-gold text-xs hover:text-vintage-gold transition-colors"
                >
                  {t.needMoreVbms || 'Need more VBMS'} →
                </button>
              </div>
              <p className="text-vintage-gold font-bold text-lg">
                {vbmsBalance ? parseFloat(vbmsBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} VBMS
              </p>
            </div>

            {/* Reply indicator */}`;

c = c.replace(oldTitle, newTitle);

fs.writeFileSync('components/VibeMail.tsx', c);
console.log('Added VBMS Balance to New VibeMail modal');
