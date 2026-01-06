const fs = require('fs');

let content = fs.readFileSync('./components/VibeMail.tsx', 'utf8');

// 1. Add vibeMailStats query import and state for success feedback
content = content.replace(
  `const deleteMessagesMutation = useMutation(api.cardVotes.deleteMessages);`,
  `const deleteMessagesMutation = useMutation(api.cardVotes.deleteMessages);

  // VibeMail Stats
  const vibeMailStats = useQuery(
    api.cardVotes.getVibeMailStats,
    myFid ? { fid: myFid } : 'skip'
  );

  // Success feedback state
  const [sendSuccess, setSendSuccess] = useState<{ recipient: string; timestamp: number } | null>(null);`
);

// 2. Update onComplete callback to show success feedback
content = content.replace(
  `onComplete={() => {
            // Reset everything after complete
            setShowGiftModal(false);
            setShowComposer(false);
            setGiftRecipientFid(null);
            setGiftRecipientAddress('');
            setGiftRecipientUsername('');
            setRecipientFid(null);
            setRecipientUsername('');
            setReplyToMessageId(null);
            setReplyToFid(null);
            setComposerMessage('');
            setComposerAudioId(null);
            setComposerImageId(null);
            setSearchQuery('');
          }}`,
  `onComplete={() => {
            // Show success feedback
            const recipientName = giftRecipientUsername || 'sender';
            setSendSuccess({ recipient: recipientName, timestamp: Date.now() });
            // Auto-hide after 3 seconds
            setTimeout(() => setSendSuccess(null), 3000);
            // Reset everything after complete
            setShowGiftModal(false);
            setShowComposer(false);
            setGiftRecipientFid(null);
            setGiftRecipientAddress('');
            setGiftRecipientUsername('');
            setRecipientFid(null);
            setRecipientUsername('');
            setReplyToMessageId(null);
            setReplyToFid(null);
            setComposerMessage('');
            setComposerAudioId(null);
            setComposerImageId(null);
            setSearchQuery('');
          }}`
);

// 3. Add stats display in the header area (after messages count)
content = content.replace(
  `<p className="text-vintage-ice/60 text-xs">
                {messages?.length || 0} {t.messagesCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">`,
  `<p className="text-vintage-ice/60 text-xs">
                {messages?.length || 0} {t.messagesCount}
              </p>
              {/* VibeMail Stats */}
              {vibeMailStats && (vibeMailStats.totalVbmsSent > 0 || vibeMailStats.totalVbmsReceived > 0) && (
                <div className="flex gap-2 text-[10px] mt-1">
                  <span className="text-red-400">📤 {vibeMailStats.totalVbmsSent} VBMS</span>
                  <span className="text-green-400">📥 {vibeMailStats.totalVbmsReceived} VBMS</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">`
);

// 4. Add success feedback toast at the top of the modal
content = content.replace(
  `{/* Header */}
        <div className="flex items-center justify-between mb-4">`,
  `{/* Success Feedback Toast */}
        {sendSuccess && (
          <div className="mb-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 animate-pulse">
            <span className="text-green-400 text-lg">✅</span>
            <p className="text-green-400 text-sm font-bold">
              VibeMail sent to @{sendSuccess.recipient}!
            </p>
            <button
              onClick={() => setSendSuccess(null)}
              className="ml-auto text-green-400/70 hover:text-green-400"
            >✕</button>
          </div>
        )}

        {/* Broadcast Result Feedback (outside composer) */}
        {!showComposer && broadcastResult && (
          <div className={\`mb-3 p-3 rounded-lg flex items-center gap-2 \${
            broadcastResult.failed === 0
              ? 'bg-green-500/20 border border-green-500/50'
              : broadcastResult.sent > 0
                ? 'bg-yellow-500/20 border border-yellow-500/50'
                : 'bg-red-500/20 border border-red-500/50'
          }\`}>
            <span className="text-lg">
              {broadcastResult.failed === 0 ? '✅' : broadcastResult.sent > 0 ? '⚠️' : '❌'}
            </span>
            <p className={\`text-sm font-bold \${
              broadcastResult.failed === 0 ? 'text-green-400' : broadcastResult.sent > 0 ? 'text-yellow-400' : 'text-red-400'
            }\`}>
              {broadcastResult.failed === 0
                ? \`Sent to \${broadcastResult.sent} recipients!\`
                : broadcastResult.sent > 0
                  ? \`Sent \${broadcastResult.sent}/\${broadcastResult.total} (failed: \${broadcastResult.failed})\`
                  : 'Failed to send VibeMail'
              }
            </p>
            <button
              onClick={() => setBroadcastResult(null)}
              className="ml-auto text-vintage-ice/70 hover:text-vintage-ice"
            >✕</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">`
);

fs.writeFileSync('./components/VibeMail.tsx', content);
console.log('✓ Added VibeMail stats and success feedback');
