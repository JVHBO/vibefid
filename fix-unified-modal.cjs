const fs = require('fs');
let c = fs.readFileSync('app/fid/[fid]/page.tsx', 'utf8');

// Find the paid vote modal and replace it with unified version
const oldModalStart = '{showPaidVoteModal && (';
const oldModalEnd = '{/* Free Vote Modal */}';

const startIdx = c.indexOf(oldModalStart);
const endIdx = c.indexOf(oldModalEnd);

if (startIdx === -1 || endIdx === -1) {
  console.log('Could not find modal markers');
  process.exit(1);
}

const newModal = `{showPaidVoteModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 pt-16 pb-24">
            <div className="bg-vintage-charcoal border-2 border-vintage-gold rounded-2xl p-4 w-full max-w-sm max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    AudioManager.buttonClick();
                    setShowPaidVoteModal(false);
                  }}
                  className="w-8 h-8 bg-vintage-black/50 border border-vintage-gold/30 rounded-full text-vintage-gold hover:bg-vintage-gold/20 transition-all text-sm font-bold"
                >
                  ✕
                </button>
                <h3 className="text-vintage-gold font-bold text-lg text-center">
                  VibeMail
                </h3>
                <button
                  onClick={() => {
                    AudioManager.buttonClick();
                    setShowVoteExplainModal(true);
                  }}
                  className="w-8 h-8 bg-vintage-black/50 border border-vintage-gold/30 rounded-full text-vintage-gold hover:bg-vintage-gold/20 transition-all text-sm font-bold"
                >
                  ?
                </button>
              </div>

              {/* VBMS Balance */}
              <div className="bg-vintage-black/50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-vintage-ice/60 text-xs">{(t as any).yourVbmsBalance || 'Your VBMS Balance'}</p>
                  <button
                    onClick={async () => {
                      AudioManager.buttonClick();
                      const DEX_URL = 'https://vibemostwanted.xyz/dex';
                      if (farcasterContext.isInMiniapp) {
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
                    {(t as any).needMoreVbms || 'Need more VBMS'} →
                  </button>
                </div>
                <p className="text-vintage-gold font-bold text-lg">
                  {parseFloat(vbmsBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} VBMS
                </p>
              </div>

              {/* Tab Toggle - Free / Paid */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { AudioManager.buttonClick(); setVibeMailTab('free'); }}
                  disabled={freeVotesRemaining <= 0}
                  className={\`flex-1 py-2 rounded-lg font-bold text-sm transition-all \${
                    vibeMailTab === 'free'
                      ? 'bg-green-500 text-black'
                      : 'bg-vintage-black/50 text-vintage-ice/60 hover:bg-vintage-black/80'
                  } \${freeVotesRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}\`}
                >
                  🆓 Free ({freeVotesRemaining}/1)
                </button>
                <button
                  onClick={() => { AudioManager.buttonClick(); setVibeMailTab('paid'); }}
                  className={\`flex-1 py-2 rounded-lg font-bold text-sm transition-all \${
                    vibeMailTab === 'paid'
                      ? 'bg-yellow-500 text-black'
                      : 'bg-vintage-black/50 text-vintage-ice/60 hover:bg-vintage-black/80'
                  }\`}
                >
                  💰 Paid
                </button>
              </div>

              {/* Paid Vote Count Selector - Only show in paid mode */}
              {vibeMailTab === 'paid' && (
                <div className="mb-4">
                  <p className="text-vintage-ice/60 text-xs mb-2">{(t as any).vibesToSend || 'Vibes to send'}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaidVoteCount(Math.max(1, paidVoteCount - 1))}
                      className="w-10 h-10 bg-vintage-black border border-vintage-gold/30 text-vintage-gold rounded-lg font-bold hover:bg-vintage-gold/10"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={paidVoteCount}
                      onChange={(e) => setPaidVoteCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 h-10 bg-vintage-black border border-vintage-gold/30 text-vintage-gold text-center rounded-lg font-bold"
                      min="1"
                    />
                    <button
                      onClick={() => setPaidVoteCount(paidVoteCount + 1)}
                      className="w-10 h-10 bg-vintage-black border border-vintage-gold/30 text-vintage-gold rounded-lg font-bold hover:bg-vintage-gold/10"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* VibeMail Composer */}
              <VibeMailComposer
                message={vibeMailTab === 'free' ? freeVibeMailMessage : vibeMailMessage}
                setMessage={vibeMailTab === 'free' ? setFreeVibeMailMessage : setVibeMailMessage}
                audioId={vibeMailTab === 'free' ? freeVibeMailAudioId : vibeMailAudioId}
                setAudioId={vibeMailTab === 'free' ? setFreeVibeMailAudioId : setVibeMailAudioId}
                imageId={vibeMailTab === 'free' ? freeVibeMailImageId : vibeMailImageId}
                setImageId={vibeMailTab === 'free' ? setFreeVibeMailImageId : setVibeMailImageId}
              />

              {/* Cost Summary - Only for paid */}
              {vibeMailTab === 'paid' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-vintage-ice text-sm">{(t as any).costPerVibe || 'Cost per vibe'}:</span>
                    <span className="text-yellow-400 font-bold">{voteCostVBMS} VBMS</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-500/20">
                    <span className="text-vintage-ice font-bold">{(t as any).total || 'Total'}:</span>
                    <span className="text-yellow-400 font-bold text-lg">
                      {(parseInt(voteCostVBMS) * paidVoteCount).toLocaleString()} VBMS
                    </span>
                  </div>
                </div>
              )}

              {/* Free info */}
              {vibeMailTab === 'free' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 mt-4">
                  <p className="text-green-400 text-sm text-center">
                    🆓 {(t as any).freeVoteInfo || '1 free VibeMail per day!'}
                  </p>
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={async () => {
                  AudioManager.buttonClick();
                  if (vibeMailTab === 'free') {
                    const result = await voteFree(freeVibeMailMessage || undefined, freeVibeMailAudioId || undefined, freeVibeMailImageId || undefined);
                    if (result.success) {
                      setShowPaidVoteModal(false);
                      setFreeVibeMailMessage('');
                      setFreeVibeMailAudioId(null);
                      setFreeVibeMailImageId(null);
                    } else {
                      setError(result.error || 'Vote failed');
                      setTimeout(() => setError(null), 5000);
                    }
                  } else {
                    const result = await votePaid(paidVoteCount, vibeMailMessage, vibeMailAudioId || undefined, vibeMailImageId || undefined);
                    if (result.success) {
                      setShowPaidVoteModal(false);
                      setPaidVoteCount(1);
                      setVibeMailMessage('');
                      setVibeMailAudioId(null);
                      setVibeMailImageId(null);
                    } else {
                      setError(result.error || 'Vote failed');
                      setTimeout(() => setError(null), 5000);
                    }
                  }
                }}
                disabled={isVoting || (vibeMailTab === 'free' && freeVotesRemaining <= 0) || (vibeMailTab === 'paid' && parseFloat(vbmsBalance) < parseInt(voteCostVBMS) * paidVoteCount)}
                className={\`w-full py-3 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed \${
                  vibeMailTab === 'free'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black'
                }\`}
              >
                {isVoting ? ((t as any).sendingTx || 'Sending...') : ((t as any).sendVibe || 'Send Vibe')}
              </button>

              {/* Insufficient Balance Warning */}
              {vibeMailTab === 'paid' && parseFloat(vbmsBalance) < parseInt(voteCostVBMS) * paidVoteCount && (
                <p className="text-red-400 text-xs text-center mt-2">
                  {(t as any).insufficientVbms || 'Insufficient VBMS balance'}
                </p>
              )}
            </div>
          </div>
        )}

        `;

c = c.substring(0, startIdx) + newModal + c.substring(endIdx);

// Remove the old Free Vote Modal since it's now unified
const freeModalStart = '{/* Free Vote Modal */}';
const freeModalEnd = '{/* VibeMail Inbox Modal */}';
const freeStartIdx = c.indexOf(freeModalStart);
const freeEndIdx = c.indexOf(freeModalEnd);

if (freeStartIdx !== -1 && freeEndIdx !== -1) {
  c = c.substring(0, freeStartIdx) + c.substring(freeEndIdx);
}

fs.writeFileSync('app/fid/[fid]/page.tsx', c);
console.log('Unified modal created!');
