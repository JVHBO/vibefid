'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { AudioManager } from '@/lib/audio-manager';
import { useLanguage } from '@/contexts/LanguageContext';
import { fidTranslations } from '@/lib/fidTranslations';
import { translations } from '@/lib/translations';
import { sdk } from '@farcaster/miniapp-sdk';



// Check if message is a welcome message and return translated version
function getTranslatedMessage(message: string, lang: string = "en", username?: string): string {
  if (!message) return message;

  // Detect welcome message by pattern (starts with 🎉 and contains VibeFID)
  if (message.startsWith('🎉') && message.includes('VibeFID')) {
    const displayName = username || 'User';

    // Extract rarity from the original message - look for **Word** after carta/card
    const rarityMatch = message.match(/(?:carta|card)\s*\*\*([A-Za-z]+)\*\*/i);
    const rarity = rarityMatch ? rarityMatch[1] : 'Rare';

    // Get translated welcome message
    const t = translations[lang] || translations['en'];
    if (t.vibemailWelcomeMessage) {
      return t.vibemailWelcomeMessage
        .replace('{username}', displayName)
        .replace('{rarity}', rarity);
    }
  }

  return message;
}

// Check if message is a welcome message
function isWelcomeMessage(message: string): boolean {
  return message?.startsWith('🎉') && message?.includes('VibeFID');
}

// Render formatted message with **bold** and [link](url) support
function renderFormattedMessage(message: string, lang: string = "en", username?: string): React.ReactNode {
  if (!message) return null;

  // Translate welcome messages
  const translatedMessage = getTranslatedMessage(message, lang, username);

  // Handle both real newlines and literal backslash-n (escaped in JSON)
  const normalizedMessage = translatedMessage.replace(/\\n/g, '\n');
  const lines = normalizedMessage.split('\n');

  // Check if this is a welcome message - we'll insert image in the middle
  const isWelcome = isWelcomeMessage(message);
  const vibefidLineIdx = isWelcome ? lines.findIndex(l => l.includes('📱')) : -1;

  const renderLine = (line: string, lineIdx: number, isLast: boolean) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

      const linkIdx = linkMatch ? remaining.indexOf(linkMatch[0]) : -1;
      const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;

      if (linkIdx === -1 && boldIdx === -1) {
        if (remaining) parts.push(<span key={`${lineIdx}-${keyIdx++}`}>{remaining}</span>);
        break;
      }

      if (linkIdx !== -1 && (boldIdx === -1 || linkIdx < boldIdx)) {
        if (linkIdx > 0) {
          parts.push(<span key={`${lineIdx}-${keyIdx++}`}>{remaining.slice(0, linkIdx)}</span>);
        }
        const [, linkText, linkUrl] = linkMatch!;
        parts.push(
          <button
            key={`${lineIdx}-${keyIdx++}`}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                if (sdk?.actions?.openMiniApp) {
                  await sdk.actions.openMiniApp({ url: linkUrl });
                } else {
                  window.open(linkUrl, '_blank');
                }
              } catch {
                window.open(linkUrl, '_blank');
              }
            }}
            className="text-vintage-gold underline hover:text-yellow-400 font-bold transition-colors"
          >
            {linkText}
          </button>
        );
        remaining = remaining.slice(linkIdx + linkMatch![0].length);
      } else {
        if (boldIdx > 0) {
          parts.push(<span key={`${lineIdx}-${keyIdx++}`}>{remaining.slice(0, boldIdx)}</span>);
        }
        const [, boldText] = boldMatch!;
        parts.push(<strong key={`${lineIdx}-${keyIdx++}`} className="text-vintage-gold">{boldText}</strong>);
        remaining = remaining.slice(boldIdx + boldMatch![0].length);
      }
    }

    return (
      <span key={`line-${lineIdx}`}>
        {parts}
        {!isLast && <br />}
      </span>
    );
  };

  // Build the result with image in the middle for welcome messages
  const result: React.ReactNode[] = [];
  lines.forEach((line, lineIdx) => {
    result.push(renderLine(line, lineIdx, lineIdx === lines.length - 1));

    // Insert image after the VibeFID description line (📱)
    if (isWelcome && lineIdx === vibefidLineIdx) {
      result.push(
        <img
          key="welcome-image"
          src="/bom.jpg"
          alt="Welcome"
          className="w-full rounded-lg my-4"
        />
      );
    }
  });

  return <>{result}</>;
}

// Electronic Secretaries - intercept messages randomly
export const VIBEMAIL_SECRETARIES = [
  { id: 'john-pork', name: 'John Pork', image: '/john-pork.jpg' },
  { id: 'goofy-romero', name: 'Goofy Romero', image: '/goofy-romero.png' },
  { id: 'linda-xied', name: 'Linda Xied', image: '/linda-xied.png' },
] as const;

// Get secretary based on message ID (deterministic random)
export function getSecretaryForMessage(messageId: string): typeof VIBEMAIL_SECRETARIES[number] {
  let hash = 0;
  for (let i = 0; i < messageId.length; i++) {
    hash = ((hash << 5) - hash) + messageId.charCodeAt(i);
    hash = hash & hash;
  }
  return VIBEMAIL_SECRETARIES[Math.abs(hash) % VIBEMAIL_SECRETARIES.length];
}

// Available meme sounds for VibeMail
export const VIBEMAIL_SOUNDS = [
  { id: 'let-him-cook', name: 'Let Him Cook', file: '/sounds/let-him-cook-now.mp3' },
  { id: 'quandale', name: 'Quandale Dingle', file: '/sounds/quandale-dingle-meme.mp3' },
  { id: 'corteze', name: 'Corteze', file: '/sounds/corteze.MP3' },
  { id: 'dry-fart', name: 'Dry Fart', file: '/sounds/dry-fart.mp3' },
  { id: 'receba', name: 'Receba!', file: '/sounds/receba-luva.mp3' },
  { id: 'ringtone', name: 'John Pork', file: '/john-pork-ringtone.mp3' },
] as const;

// Get sound file from ID
export function getSoundFile(audioId: string): string | null {
  const sound = VIBEMAIL_SOUNDS.find(s => s.id === audioId);
  return sound?.file || null;
}

interface VibeMailMessage {
  _id: Id<'cardVotes'>;
  message?: string;
  audioId?: string;
  isRead: boolean;
  createdAt: number;
  voteCount: number;
  isPaid: boolean;
}

interface VibeMailInboxProps {
  cardFid: number;
  onClose: () => void;
}

// VibeMail Inbox Component - Shows all messages for a card
export function VibeMailInbox({ cardFid, username, onClose }: VibeMailInboxProps) {
  const { lang } = useLanguage();
  const t = fidTranslations[lang];
  const messages = useQuery(api.cardVotes.getMessagesForCard, { cardFid, limit: 50 });
  const markAsRead = useMutation(api.cardVotes.markMessageAsRead);
  const [selectedMessage, setSelectedMessage] = useState<VibeMailMessage | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get secretary for selected message
  const secretary = selectedMessage ? getSecretaryForMessage(selectedMessage._id) : VIBEMAIL_SECRETARIES[0];

  const handleOpenMessage = async (msg: VibeMailMessage) => {
    AudioManager.buttonClick();
    setSelectedMessage(msg);

    // Mark as read if not already
    if (!msg.isRead) {
      await markAsRead({ messageId: msg._id });
    }

    // Auto-play audio if exists
    if (msg.audioId) {
      const soundFile = getSoundFile(msg.audioId);
      if (soundFile && audioRef.current) {
        audioRef.current.src = soundFile;
        audioRef.current.play().catch(console.error);
        setPlayingAudio(msg.audioId);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingAudio(null);
  };

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/90 p-4">
      <audio ref={audioRef} onEnded={() => setPlayingAudio(null)} />

      <div className="bg-vintage-charcoal border-2 border-vintage-gold rounded-2xl p-4 w-full max-w-md max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={secretary.image}
              alt={secretary.name}
              className="w-12 h-12 rounded-full border-2 border-vintage-gold"
            />
            <div>
              <h3 className="text-vintage-gold font-bold text-lg">{t.vibeMailTitle}</h3>
              <p className="text-vintage-ice/60 text-xs">
                {messages?.length || 0} {t.messagesCount}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="w-8 h-8 bg-vintage-black/50 border border-vintage-gold/30 rounded-full text-vintage-gold hover:bg-vintage-gold/20 transition-all"
          >
            X
          </button>
        </div>

        {/* Selected Message View */}
        {selectedMessage ? (
          <div className="flex-1 flex flex-col">
            {/* John Pork Header */}
            <div className="bg-vintage-black/50 rounded-lg p-4 mb-3 text-center">
              <img
                src={secretary.image}
                alt={secretary.name}
                className="w-20 h-20 rounded-full border-4 border-vintage-gold mx-auto mb-3 animate-pulse"
              />
              <p className="text-vintage-gold font-bold text-sm">
                {secretary.name} intercepted this message!
              </p>
            </div>

            {/* Message Content */}
            <div className="bg-gradient-to-b from-vintage-black/80 to-vintage-charcoal rounded-lg p-4 flex-1">
              <p className="text-vintage-ice text-base leading-relaxed mb-4">
                "{renderFormattedMessage(selectedMessage.message || "", lang, username)}"
              </p>

              {/* Audio Player */}
              {selectedMessage.audioId && (
                <div className="bg-vintage-gold/10 border border-vintage-gold/30 rounded-lg p-3 flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (playingAudio === selectedMessage.audioId) {
                        stopAudio();
                      } else {
                        const soundFile = getSoundFile(selectedMessage.audioId!);
                        if (soundFile && audioRef.current) {
                          audioRef.current.src = soundFile;
                          audioRef.current.play().catch(console.error);
                          setPlayingAudio(selectedMessage.audioId!);
                        }
                      }
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      playingAudio === selectedMessage.audioId
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-vintage-gold text-black'
                    }`}
                  >
                    {playingAudio === selectedMessage.audioId ? '■' : '▶'}
                  </button>
                  <div className="flex-1">
                    <p className="text-vintage-gold font-bold text-sm">
                      {VIBEMAIL_SOUNDS.find(s => s.id === selectedMessage.audioId)?.name || t.memeSound}
                    </p>
                    <p className="text-vintage-ice/50 text-xs">
                      {playingAudio === selectedMessage.audioId ? t.playing : t.tapToPlay}
                    </p>
                  </div>
                </div>
              )}

              {/* Vote Info */}
              <div className="mt-4 pt-3 border-t border-vintage-gold/20 flex items-center justify-between text-xs">
                <span className="text-vintage-ice/50">
                  {new Date(selectedMessage.createdAt).toLocaleDateString()}
                </span>
                <span className={`font-bold ${selectedMessage.isPaid ? 'text-yellow-400' : 'text-vintage-gold'}`}>
                  +{selectedMessage.voteCount} {selectedMessage.isPaid ? t.paidVote : t.freeVote}
                </span>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => {
                stopAudio();
                setSelectedMessage(null);
              }}
              className="mt-3 w-full py-2 bg-vintage-black border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10"
            >
              Back to Inbox
            </button>
          </div>
        ) : (
          /* Message List */
          <div className="flex-1 overflow-y-auto space-y-2">
            {!messages || messages.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-vintage-ice/50 text-sm">{t.noMessagesYet}</p>
                <p className="text-vintage-ice/30 text-xs mt-1">
                  {t.messagesWillAppear}
                </p>
              </div>
            ) : (
              messages.map((msg: VibeMailMessage) => (
                <button
                  key={msg._id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    msg.isRead
                      ? 'bg-vintage-black/30 border-vintage-gold/20 hover:border-vintage-gold/40'
                      : 'bg-vintage-gold/10 border-vintage-gold/50 hover:bg-vintage-gold/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${msg.isRead ? 'bg-vintage-ice/30' : 'bg-vintage-gold animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${msg.isRead ? 'text-vintage-ice/70' : 'text-vintage-gold font-bold'}`}>
                        {msg.message?.slice(0, 50)}...
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {msg.audioId && (
                          <span className="text-xs text-vintage-burnt-gold">{t.hasAudio}</span>
                        )}
                        <span className="text-xs text-vintage-ice/40">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${msg.isPaid ? 'text-yellow-400' : 'text-vintage-ice/50'}`}>
                      +{msg.voteCount}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// VibeMail Inbox WITH Claim button (for home page)
interface VibeMailInboxWithClaimProps {
  cardFid: number;
  onClose: () => void;
  pendingVbms: number;
  address?: string;
  isClaimingRewards: boolean;
  isClaimTxPending: boolean;
  onClaim: () => Promise<void>;
}

export function VibeMailInboxWithClaim({
  cardFid,
  username,
  onClose,
  pendingVbms,
  address,
  isClaimingRewards,
  isClaimTxPending,
  onClaim,
}: VibeMailInboxWithClaimProps) {
  const { lang } = useLanguage();
  const t = fidTranslations[lang];
  const messages = useQuery(api.cardVotes.getMessagesForCard, { cardFid, limit: 50 });
  const markAsRead = useMutation(api.cardVotes.markMessageAsRead);
  const [selectedMessage, setSelectedMessage] = useState<VibeMailMessage | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get secretary for selected message
  const secretary = selectedMessage ? getSecretaryForMessage(selectedMessage._id) : VIBEMAIL_SECRETARIES[0];

  const handleOpenMessage = async (msg: VibeMailMessage) => {
    AudioManager.buttonClick();
    setSelectedMessage(msg);

    if (!msg.isRead) {
      await markAsRead({ messageId: msg._id });
    }

    if (msg.audioId) {
      const soundFile = getSoundFile(msg.audioId);
      if (soundFile && audioRef.current) {
        audioRef.current.src = soundFile;
        audioRef.current.play().catch(console.error);
        setPlayingAudio(msg.audioId);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingAudio(null);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/90 p-4">
      <audio ref={audioRef} onEnded={() => setPlayingAudio(null)} />

      <div className="bg-vintage-charcoal border-2 border-vintage-gold rounded-2xl p-4 w-full max-w-md max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={secretary.image}
              alt={secretary.name}
              className="w-12 h-12 rounded-full border-2 border-vintage-gold"
            />
            <div>
              <h3 className="text-vintage-gold font-bold text-lg">{t.vibeMailTitle}</h3>
              <p className="text-vintage-ice/60 text-xs">
                {messages?.length || 0} {t.messagesCount}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="w-8 h-8 bg-vintage-black/50 border border-vintage-gold/30 rounded-full text-vintage-gold hover:bg-vintage-gold/20 transition-all"
          >
            X
          </button>
        </div>

        {/* Selected Message View */}
        {selectedMessage ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* John Pork Header */}
            <div className="bg-vintage-black/50 rounded-lg p-4 mb-3 text-center">
              <img
                src={secretary.image}
                alt={secretary.name}
                className="w-16 h-16 rounded-full border-4 border-vintage-gold mx-auto mb-2 animate-pulse"
              />
              <p className="text-vintage-gold font-bold text-xs">
                {secretary.name} intercepted this message!
              </p>
            </div>

            {/* Message Content */}
            <div className="bg-gradient-to-b from-vintage-black/80 to-vintage-charcoal rounded-lg p-4 flex-1 overflow-y-auto">
              <p className="text-vintage-ice text-base leading-relaxed mb-4">
                "{renderFormattedMessage(selectedMessage.message || "", lang, username)}"
              </p>

              {selectedMessage.audioId && (
                <div className="bg-vintage-gold/10 border border-vintage-gold/30 rounded-lg p-3 flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (playingAudio === selectedMessage.audioId) {
                        stopAudio();
                      } else {
                        const soundFile = getSoundFile(selectedMessage.audioId!);
                        if (soundFile && audioRef.current) {
                          audioRef.current.src = soundFile;
                          audioRef.current.play().catch(console.error);
                          setPlayingAudio(selectedMessage.audioId!);
                        }
                      }
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      playingAudio === selectedMessage.audioId
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-vintage-gold text-black'
                    }`}
                  >
                    {playingAudio === selectedMessage.audioId ? '■' : '▶'}
                  </button>
                  <div className="flex-1">
                    <p className="text-vintage-gold font-bold text-sm">
                      {VIBEMAIL_SOUNDS.find(s => s.id === selectedMessage.audioId)?.name || t.memeSound}
                    </p>
                    <p className="text-vintage-ice/50 text-xs">
                      {playingAudio === selectedMessage.audioId ? t.playing : t.tapToPlay}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-vintage-gold/20 flex items-center justify-between text-xs">
                <span className="text-vintage-ice/50">
                  {new Date(selectedMessage.createdAt).toLocaleDateString()}
                </span>
                <span className={`font-bold ${selectedMessage.isPaid ? 'text-yellow-400' : 'text-vintage-gold'}`}>
                  +{selectedMessage.voteCount} {selectedMessage.isPaid ? t.paidVote : t.freeVote}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                stopAudio();
                setSelectedMessage(null);
              }}
              className="mt-3 w-full py-2 bg-vintage-black border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10"
            >
              Voltar
            </button>
          </div>
        ) : (
          /* Message List */
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {!messages || messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-vintage-ice/50 text-sm">Nenhuma mensagem ainda</p>
                <p className="text-vintage-ice/30 text-xs mt-1">
                  Mensagens dos votantes aparecem aqui
                </p>
              </div>
            ) : (
              messages.map((msg: VibeMailMessage) => (
                <button
                  key={msg._id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    msg.isRead
                      ? 'bg-vintage-black/30 border-vintage-gold/20 hover:border-vintage-gold/40'
                      : 'bg-vintage-gold/10 border-vintage-gold/50 hover:bg-vintage-gold/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${msg.isRead ? 'bg-vintage-ice/30' : 'bg-vintage-gold animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${msg.isRead ? 'text-vintage-ice/70' : 'text-vintage-gold font-bold'}`}>
                        {msg.message?.slice(0, 50)}...
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {msg.audioId && (
                          <span className="text-xs text-vintage-burnt-gold">🔊</span>
                        )}
                        <span className="text-xs text-vintage-ice/40">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${msg.isPaid ? 'text-yellow-400' : 'text-vintage-ice/50'}`}>
                      +{msg.voteCount}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Claim Button at bottom (always visible when not viewing message and has pending VBMS) */}
        {!selectedMessage && pendingVbms > 0 && (
          <div className="border-t border-vintage-gold/30 pt-4 mt-auto">
            <button
              onClick={() => {
                AudioManager.buttonClick();
                if (!address) {
                  alert('Connect wallet to claim VBMS');
                  return;
                }
                onClaim();
              }}
              disabled={isClaimingRewards || isClaimTxPending}
              className="w-full py-4 bg-gradient-to-r from-vintage-gold to-yellow-500 text-vintage-black font-bold text-lg rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-vintage-gold/30"
            >
              <span className="text-2xl">💰</span>
              <span>
                {isClaimingRewards || isClaimTxPending ? 'Claiming...' : `CLAIM ${pendingVbms} VBMS`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface VibeMailComposerProps {
  message: string;
  setMessage: (msg: string) => void;
  audioId: string | null;
  setAudioId: (id: string | null) => void;
}

// VibeMail Composer - Inline component for vote modal
export function VibeMailComposer({ message, setMessage, audioId, setAudioId }: VibeMailComposerProps) {
  const { lang } = useLanguage();
  const t = fidTranslations[lang];
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [previewSound, setPreviewSound] = useState<string | null>(null);

  const playPreview = (soundId: string) => {
    const sound = VIBEMAIL_SOUNDS.find(s => s.id === soundId);
    if (sound && audioRef.current) {
      if (previewSound === soundId) {
        // Stop if same sound
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPreviewSound(null);
      } else {
        audioRef.current.src = sound.file;
        audioRef.current.play().catch(console.error);
        setPreviewSound(soundId);
      }
    }
  };

  return (
    <div className="bg-vintage-black/50 rounded-lg p-3 space-y-3">
      <audio ref={audioRef} onEnded={() => setPreviewSound(null)} />

      {/* Header with John Pork */}
      <div className="flex items-center gap-2">
        <img
          src="/john-pork.jpg"
          alt="VibeMail"
          className="w-8 h-8 rounded-full border border-vintage-gold"
        />
        <p className="text-vintage-gold font-bold text-xs">{t.vibeMailTitle}</p>
      </div>

      {/* Message Input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 200))}
        placeholder={t.vibeMailPlaceholder}
        className="w-full h-20 bg-vintage-charcoal border border-vintage-gold/30 rounded-lg p-2 text-vintage-ice text-sm placeholder:text-vintage-ice/30 resize-none focus:border-vintage-gold focus:outline-none"
      />
      <p className="text-right text-vintage-ice/40 text-xs">{message.length}/200</p>

      {/* Sound Picker */}
      <div>
        <button
          onClick={() => {
            AudioManager.buttonClick();
            setShowSoundPicker(!showSoundPicker);
          }}
          className="w-full flex items-center justify-between p-2 bg-vintage-charcoal border border-vintage-gold/30 rounded-lg text-vintage-ice text-sm hover:border-vintage-gold/50"
        >
          <span>
            {audioId ? `${t.soundLabel}: ${VIBEMAIL_SOUNDS.find(s => s.id === audioId)?.name}` : t.addMemeSound}
          </span>
          <span className="text-vintage-gold">{showSoundPicker ? '▲' : '▼'}</span>
        </button>

        {showSoundPicker && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {VIBEMAIL_SOUNDS.map((sound) => (
              <button
                key={sound.id}
                onClick={() => {
                  playPreview(sound.id);
                  setAudioId(audioId === sound.id ? null : sound.id);
                }}
                className={`p-2 rounded-lg border text-xs transition-all flex items-center gap-2 ${
                  audioId === sound.id
                    ? 'bg-vintage-gold/20 border-vintage-gold text-vintage-gold'
                    : 'bg-vintage-black border-vintage-gold/30 text-vintage-ice hover:border-vintage-gold/50'
                }`}
              >
                <span className={previewSound === sound.id ? 'animate-pulse' : ''}>
                  {previewSound === sound.id ? '■' : '▶'}
                </span>
                <span className="truncate">{sound.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
