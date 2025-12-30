"use client";

import { useState, useEffect } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useConnect, useSendTransaction } from "wagmi";
import { encodeFunctionData } from "viem";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getUserByFid, calculateRarityFromScore, getBasePowerFromRarity, generateRandomSuit, getSuitFromFid, generateRankFromRarity, getSuitSymbol, getSuitColor } from "@/lib/neynar";
import { getFidTraits } from "@/lib/fidTraits";
import { getFarcasterAccountCreationDate } from "@/lib/farcasterRegistry";
import type { NeynarUser, CardSuit, CardRank } from "@/lib/neynar";
import { generateFarcasterCardImage } from "@/lib/generateFarcasterCard";
import { generateCardVideo } from "@/lib/generateCardVideo";
import { VIBEFID_ABI, VIBEFID_CONTRACT_ADDRESS, MINT_PRICE } from "@/lib/contracts/VibeFIDABI";
import { parseEther } from "viem";
import FoilCardEffect from "@/components/FoilCardEffect";
import { CardMedia } from "@/components/CardMedia";
import { useFarcasterContext } from "@/lib/hooks/useFarcasterContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMusic } from "@/contexts/MusicContext";
import type { CriminalBackstoryData } from "@/lib/generateCriminalBackstory";
import { VIBEFID_POWER_CONFIG } from "@/lib/collections";
import { fidTranslations } from "@/lib/fidTranslations";
import type { SupportedLanguage } from "@/lib/translations";
import FidGenerationModal from "@/components/FidGenerationModal";
import FidAboutTraitsModal from "@/components/FidAboutTraitsModal";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AudioManager } from "@/lib/audio-manager";
import { sdk } from "@farcaster/miniapp-sdk";
import { DailyLeader } from "@/components/DailyLeader";
import { useClaimVBMS } from "@/lib/hooks/useVBMSContracts";
import { FloatingCardsBackground } from "@/components/FloatingCardsBackground";



// Helper to calculate rarity from score for display
const getRarityFromScore = (score: number) => {
  if (score >= 0.99) return 'Mythic';
  if (score >= 0.90) return 'Legendary';
  if (score >= 0.79) return 'Epic';
  if (score >= 0.70) return 'Rare';
  return 'Common';
};

interface GeneratedTraits {
  rarity: string;
  foil: string;
  wear: string;
  suit: CardSuit;
  rank: CardRank;
  suitSymbol: string;
  color: 'red' | 'black';
  power: number;
}

export default function FidPage() {
  const { address } = useAccount();
  const { connect, connectors } = useConnect();
  const farcasterContext = useFarcasterContext();
  const { lang, setLang } = useLanguage();

  // Upgrade mutations
  const upgradeCardRarity = useMutation(api.farcasterCards.upgradeCardRarity);
  const updateCardImages = useMutation(api.farcasterCards.updateCardImages);
  const { isMusicEnabled, setIsMusicEnabled } = useMusic();
  const t = fidTranslations[lang];
  const router = useRouter();
const searchParams = useSearchParams();  const testFid = searchParams.get("testFid");  const isTestMode = !!testFid;

  // Auto-connect wallet in Farcaster miniapp
  useEffect(() => {
    const autoConnectWallet = async () => {
      // Only auto-connect if in Farcaster miniapp and wallet not connected
      if (farcasterContext.isReady && farcasterContext.isInMiniapp && !address) {
        console.log('[FID] 🔗 Auto-connecting wallet in Farcaster miniapp...');

        const farcasterConnector = connectors.find((c) =>
          c.id === 'farcasterMiniApp' ||
          c.id === 'farcaster' ||
          c.name?.toLowerCase().includes('farcaster')
        );

        if (farcasterConnector) {
          try {
            await connect({ connector: farcasterConnector });
            console.log('[FID] ✅ Wallet auto-connected!');
          } catch (err) {
            console.error('[FID] ❌ Failed to auto-connect wallet:', err);
          }
        } else {
          console.error('[FID] ❌ Farcaster connector not found. Available:', connectors.map(c => c.id));
        }
      }
    };

    autoConnectWallet();
  }, [farcasterContext.isReady, farcasterContext.isInMiniapp, address, connect, connectors]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<NeynarUser | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatedTraits, setGeneratedTraits] = useState<GeneratedTraits | null>(null);
  const [backstoryData, setBackstoryData] = useState<CriminalBackstoryData | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [mintedSuccessfully, setMintedSuccessfully] = useState(false);

  // Neynar score state
  const [neynarScoreData, setNeynarScoreData] = useState<{ score: number; rarity: string; fid: number; username: string } | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);

  // VBMS modal
  const [showVBMSModal, setShowVBMSModal] = useState(false);

  // Upgrade states
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [evolutionPhase, setEvolutionPhase] = useState<'idle' | 'shaking' | 'glowing' | 'transforming' | 'regenerating' | 'complete'>('idle');
  const [regenerationStatus, setRegenerationStatus] = useState<string>('');
  const [evolutionData, setEvolutionData] = useState<{
    oldRarity: string;
    newRarity: string;
    oldPower: number;
    newPower: number;
    oldScore: number;
    newScore: number;
    newBounty: number;
  } | null>(null);

  // Test Mint state
  const [testFidInput, setTestFidInput] = useState("");

  // Temporary storage for mint data
  // 🔒 FIX: Also persist to localStorage to handle page refresh/close
  const [pendingMintData, setPendingMintData] = useState<any>(() => {
    // Restore from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vibefid_pending_mint');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          console.log('📦 Restored pending mint data from localStorage:', data.fid);
          return data;
        } catch (e) {
          console.error('Failed to parse pending mint data:', e);
        }
      }
    }
    return null;
  });

  /**
   * CARD GENERATION & PERSISTENCE FLOW:
   *
   * 1. Player clicks "Generate" → handleGenerateCard()
   *    - Checks if card already exists in localStorage
   *    - If exists: shows saved card (no new generation)
   *    - If not exists: generates new card and saves to localStorage
   *
   * 2. Card persists even if player closes page
   *    - useEffect loads saved card on mount
   *    - Player can continue from where they left off
   *
   * 3. Player clicks "Mint" → handleMintCard()
   *    - Generates video with foil effects
   *    - Uploads video to IPFS (gets permanent URL)
   *    - Gets signature from backend
   *    - Mints NFT on-chain (contract ensures 1 mint per FID)
   *    - After successful mint, clears localStorage
   *
   * 4. Contract prevents duplicate mints
   *    - Each FID can only be minted once
   *    - Enforced on smart contract level
   */

  // LocalStorage key for generated card
  const getStorageKey = () => {
    const fid = farcasterContext.user?.fid;
    return fid ? `vibefid_generated_${fid}` : null;
  };

  // Save generated card to localStorage
  const saveGeneratedCard = (data: any) => {
    const key = getStorageKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  // Load generated card from localStorage
  const loadGeneratedCard = () => {
    const key = getStorageKey();
    if (key) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that previewImage is a data URL (not IPFS or other URL)
          if (parsed.previewImage && !parsed.previewImage.startsWith('data:')) {
            console.warn('⚠️ Invalid preview image in localStorage (not a data URL), clearing cache');
            localStorage.removeItem(key);
            return null;
          }
          return parsed;
        } catch (e) {
          console.error('Failed to parse saved card:', e);
          localStorage.removeItem(key);
        }
      }
    }
    return null;
  };

  // Clear generated card from localStorage
  const clearGeneratedCard = () => {
    const key = getStorageKey();
    if (key) {
      localStorage.removeItem(key);
    }
  };

  // Load saved card on mount (when user is ready)
  useEffect(() => {
    if (farcasterContext.isReady && farcasterContext.user) {
      const saved = loadGeneratedCard();
      if (saved) {
        setUserData(saved.userData);
        setPreviewImage(saved.previewImage);
        setGeneratedTraits(saved.generatedTraits);
        setBackstoryData(saved.backstoryData);
        // Don't auto-open modal - let user click "Generate" button to see it
      }
    }
  }, [farcasterContext.isReady, farcasterContext.user]);

  // Notify Farcaster SDK that miniapp is ready
  useEffect(() => {
    const initFarcasterSDK = async () => {
      try {
        if (typeof window !== 'undefined') {
          await sdk.actions.ready();
          console.log('[SDK] Farcaster SDK ready called');
        }
      } catch (error) {
        console.error('Error calling Farcaster SDK ready:', error);
      }
    };
    initFarcasterSDK();
  }, []);

  // Background music is already playing from main page
  // No need to start it again here

  // Combined fetch and generate function
  const handleGenerateCard = async () => {
    // Play button click sound
    AudioManager.buttonClick();

    // Check if user is connected (skip in test mode)
    if (!farcasterContext.user && !isTestMode) {
      // Redirect to main page to connect
      setError("Opening VibeFID miniapp in Farcaster...");
      setTimeout(() => {
        window.location.href = 'https://farcaster.xyz/miniapps/aisYLhjuH5_G/vibefid';
      }, 1000);
      return;
    }

    // Check if card already generated (saved in localStorage)
    const existingCard = loadGeneratedCard();
    if (existingCard) {
      // Card already generated - show it instead of generating a new one
      setUserData(existingCard.userData);
      setPreviewImage(existingCard.previewImage);
      setGeneratedTraits(existingCard.generatedTraits);
      setBackstoryData(existingCard.backstoryData);
      setShowModal(true);
      return;
    }

    // Use logged-in user's FID or test FID
    const fid = isTestMode ? parseInt(testFid!) : farcasterContext.user!.fid;

    setLoading(true);
    setError(null);

    try {
      // Fetch user data
      const user = await getUserByFid(fid);
      if (!user) {
        setError(`No user found for FID ${fid}`);
        setLoading(false);
        return;
      }

      setUserData(user);

      // Generate card immediately
      await generateCardForUser(user);

      // Open modal
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate card");
    } finally {
      setLoading(false);
    }
  };

  const generateCardForUser = async (user: NeynarUser) => {
    const score = user.experimental?.neynar_user_score || 0;
    const rarity = calculateRarityFromScore(score);

    // Generate DETERMINISTIC suit and rank based on FID
    const suit = getSuitFromFid(user.fid); // DETERMINISTIC based on FID
    const suitSymbol = getSuitSymbol(suit);
    const color = getSuitColor(suit);
    const rank = generateRankFromRarity(rarity);

    // Generate FID-based foil and wear traits (DETERMINISTIC - NO extraSeed!)
    const fidTraits = getFidTraits(user.fid); // REMOVED Date.now()
    const foil = fidTraits.foil;
    const wear = fidTraits.wear;

    // Calculate power with VibeFID balanced config
    const rarityKey = rarity.toLowerCase() as 'mythic' | 'legendary' | 'epic' | 'rare' | 'common';
    const basePower = VIBEFID_POWER_CONFIG.rarityBase[rarityKey] || VIBEFID_POWER_CONFIG.rarityBase.common;

    const wearKey = wear.toLowerCase().replace(' ', '') as 'pristine' | 'mint';
    const wearMult = VIBEFID_POWER_CONFIG.wearMultiplier[wearKey] || VIBEFID_POWER_CONFIG.wearMultiplier.default;

    const foilKey = foil.toLowerCase() as 'prize' | 'standard' | 'none';
    const foilMult = VIBEFID_POWER_CONFIG.foilMultiplier[foilKey] || VIBEFID_POWER_CONFIG.foilMultiplier.none;

    const power = Math.round(basePower * wearMult * foilMult);

    // Save generated traits
    setGeneratedTraits({
      rarity,
      foil,
      wear,
      suit,
      rank,
      suitSymbol,
      color,
      power,
    });

    // Fetch account creation date
    const createdAt = await getFarcasterAccountCreationDate(user.fid);

    // Generate card image
    const imageDataUrl = await generateFarcasterCardImage({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      bio: user.profile?.bio?.text || "",
      neynarScore: score,
      suit,
      suitSymbol,
      rank,
      color,
      rarity,
      bounty: power * 10,
      createdAt: createdAt || undefined,
    });

    setPreviewImage(imageDataUrl);

    // Store backstory data (will be generated in modal based on language)
    const backstory = {
      username: user.username,
      displayName: user.display_name,
      bio: user.profile?.bio?.text || "",
      fid: user.fid,
      followerCount: user.follower_count,
      createdAt,
      power,
      bounty: power * 10,
      rarity,
    };
    setBackstoryData(backstory);

    // Save to localStorage so card persists if user leaves page
    saveGeneratedCard({
      userData: user,
      previewImage: imageDataUrl,
      generatedTraits: {
        rarity,
        foil,
        wear,
        suit,
        rank,
        suitSymbol,
        color,
        power,
      },
      backstoryData: backstory,
    });
  };

  // Check Neynar Score
  const handleCheckNeynarScore = async () => {
    // Play button click sound
    AudioManager.buttonClick();

    // Check if user is connected (skip in test mode)
    if (!farcasterContext.user && !isTestMode) {
      setError("Please connect your Farcaster account first");
      return;
    }

    const fid = isTestMode ? parseInt(testFid!) : farcasterContext.user!.fid;

    setLoading(true);
    setError(null);

    try {
      // Fetch user data from Neynar
      const user = await getUserByFid(fid);
      if (!user) {
        setError(`No user found for FID ${fid}`);
        setLoading(false);
        return;
      }

      const score = user.experimental.neynar_user_score;
      const rarity = calculateRarityFromScore(score);

      // Save score to history (same as /fid/[fid] page)
      await saveScoreCheck({
        fid: user.fid,
        username: user.username,
        score,
        rarity,
      });

      // Set score data and show modal
      setNeynarScoreData({
        score,
        rarity,
        fid: user.fid,
        username: user.username,
      });
      setShowScoreModal(true);
      setLoading(false);

    } catch (err: any) {
      setError(err.message || "Failed to fetch Neynar score");
      setLoading(false);
    }
  };

  // Contract interaction - use both methods for iOS compatibility
  const { writeContract, data: writeHash, isPending: isContractPending, error: writeError } = useWriteContract();
  const { sendTransaction, data: sendHash, isPending: isSendPending, error: sendError } = useSendTransaction();

  // Use whichever hash is available
  const hash = writeHash || sendHash;

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle contract errors
  useEffect(() => {
    const error = writeError || sendError;
    if (error) {
      console.error('❌ Contract error:', error);
      setError(error.message || "Transaction failed. Please try again.");
      setLoading(false);
    }
  }, [writeError, sendError]);

  // Mutations
  const mintCard = useMutation(api.farcasterCards.mintFarcasterCard);
  const saveScoreCheck = useMutation(api.neynarScore.saveScoreCheck);

  // Score history query - use user's fid if available  
  const scoreHistory = useQuery(api.neynarScore.getScoreHistory, farcasterContext.user?.fid ? { fid: farcasterContext.user.fid } : "skip");

  // 🔒 FIX: Check for pending mint data on page load and try to save
  // This handles cases where user refreshed page or transaction was pending
  useEffect(() => {
    const checkPendingMint = async () => {
      const saved = localStorage.getItem('vibefid_pending_mint');
      if (!saved) return;

      try {
        const data = JSON.parse(saved);
        // Only try to save if data is recent (less than 1 hour old)
        const age = Date.now() - (data.timestamp || 0);
        if (age > 60 * 60 * 1000) {
          console.log('⏰ Pending mint data expired, clearing...');
          localStorage.removeItem('vibefid_pending_mint');
          return;
        }

        console.log('🔄 Found pending mint data, attempting to save to Convex...');
        setError("Recovering unsaved mint data...");

        const validatedData: any = {
          fid: Number(data.fid),
          username: String(data.username),
          displayName: String(data.displayName),
          pfpUrl: String(data.pfpUrl),
          bio: String(data.bio || ""),
          neynarScore: Number(data.neynarScore),
          followerCount: Number(data.followerCount),
          followingCount: Number(data.followingCount),
          powerBadge: Boolean(data.powerBadge),
          address: String(data.address),
          rarity: String(data.rarity),
          foil: String(data.foil),
          wear: String(data.wear),
          power: Number(data.power),
          suit: String(data.suit),
          rank: String(data.rank),
          suitSymbol: String(data.suitSymbol),
          color: String(data.color),
          imageUrl: String(data.imageUrl),
          contractAddress: VIBEFID_CONTRACT_ADDRESS.toLowerCase(),
        };

        if (data.cardImageUrl) validatedData.cardImageUrl = String(data.cardImageUrl);
        if (data.shareImageUrl) validatedData.shareImageUrl = String(data.shareImageUrl);

        await mintCard(validatedData);

        // Success! Clear localStorage
        localStorage.removeItem('vibefid_pending_mint');
        setPendingMintData(null);
        setError(null);
        setMintedSuccessfully(true);
        console.log('✅ Successfully recovered and saved mint data!');
      } catch (err: any) {
        // 🔧 IMPROVED: Better error extraction from Convex errors
        const errorMsg = err?.message || err?.data?.message || err?.data || String(err);
        const errorStr = String(errorMsg).toLowerCase();
        console.error('❌ Failed to recover mint data:', errorStr, err);

        // 🔧 IMPROVED: More keywords to detect duplicate/existing card errors
        const isDuplicateError =
          errorStr.includes('already') ||
          errorStr.includes('duplicate') ||
          errorStr.includes('fid') ||
          errorStr.includes('minted') ||
          errorStr.includes('exists');

        if (isDuplicateError) {
          console.log('ℹ️ Card already exists in Convex, clearing pending data');
          localStorage.removeItem('vibefid_pending_mint');
          setPendingMintData(null);
          setError(null);
          setMintedSuccessfully(true); // Show success since card exists
        } else {
          const cleanError = errorStr.slice(0, 100);
          setError(`Failed to save mint data: ${cleanError}`);
          // Clear localStorage after 5s to prevent stuck state
          setTimeout(() => {
            localStorage.removeItem('vibefid_pending_mint');
            setPendingMintData(null);
          }, 5000);
        }
      }
    };

    // Run on mount
    checkPendingMint();
  }, [mintCard]);

  // Save to Convex after successful on-chain mint
  useEffect(() => {
    if (isConfirmed && pendingMintData) {
      const saveToConvex = async () => {
        try {
          // Play victory sound on successful mint
          AudioManager.win();

          setError("Saving card data...");

          // Validate all required fields
          const validatedData: any = {
            fid: Number(pendingMintData.fid),
            username: String(pendingMintData.username),
            displayName: String(pendingMintData.displayName),
            pfpUrl: String(pendingMintData.pfpUrl),
            bio: String(pendingMintData.bio || ""),
            neynarScore: Number(pendingMintData.neynarScore),
            followerCount: Number(pendingMintData.followerCount),
            followingCount: Number(pendingMintData.followingCount),
            powerBadge: Boolean(pendingMintData.powerBadge),
            address: String(pendingMintData.address),
            rarity: String(pendingMintData.rarity),
            foil: String(pendingMintData.foil),
            wear: String(pendingMintData.wear),
            power: Number(pendingMintData.power),
            suit: String(pendingMintData.suit),
            rank: String(pendingMintData.rank),
            suitSymbol: String(pendingMintData.suitSymbol),
            color: String(pendingMintData.color),
            imageUrl: String(pendingMintData.imageUrl),
          };

          // Add cardImageUrl only if it exists (optional field)
          if (pendingMintData.cardImageUrl) {
            validatedData.cardImageUrl = String(pendingMintData.cardImageUrl);
          }

          // Add contractAddress (VibeFID)
          validatedData.contractAddress = VIBEFID_CONTRACT_ADDRESS.toLowerCase();

          // Add shareImageUrl only if it exists (optional field)
          if (pendingMintData.shareImageUrl) {
            validatedData.shareImageUrl = String(pendingMintData.shareImageUrl);
          }

          console.log('💾 Saving to Convex:', validatedData);

          await mintCard(validatedData);
          setError(null);

          // Mark as successfully minted (show share buttons in modal)
          setMintedSuccessfully(true);

          // 🔒 FIX: Clear pending mint data from localStorage (successfully saved to Convex)
          localStorage.removeItem('vibefid_pending_mint');
          setPendingMintData(null);
          console.log('✅ Cleared pending mint data - successfully saved to Convex');

          // Clear localStorage (card has been minted)
          clearGeneratedCard();
        } catch (err: any) {
          console.error('❌ Convex save error:', err);
          setError(`NFT minted but failed to save metadata: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      saveToConvex();
    }
  }, [isConfirmed, pendingMintData, hash]);

  // Pagination and search state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const cardsPerPage = 12;

  // Debounce search to avoid too many queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Queries - Use search query with pagination
  const searchResult = useQuery(api.farcasterCards.searchFarcasterCards, {
    searchTerm: debouncedSearch || undefined,
    limit: cardsPerPage,
    offset: (currentPage - 1) * cardsPerPage,
  });

  // Query to get current user's minted card (if exists)
  const userFid = farcasterContext.user?.fid;

  // Vibe Rewards claim
  const vibeRewards = useQuery(api.vibeRewards.getRewards, userFid ? { fid: userFid } : "skip");
  const prepareVibeRewardsClaim = useAction(api.vibeRewards.prepareVibeRewardsClaim);
  const restoreClaimOnTxFailure = useMutation(api.vibeRewards.restoreClaimOnTxFailure);
  const { claimVBMS, isPending: isClaimTxPending } = useClaimVBMS();
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);
  const myCard = useQuery(
    api.farcasterCards.getFarcasterCardByFid,
    userFid ? { fid: userFid } : "skip"
  );

  // Check if upgrade is available for own card
  const canUpgrade = () => {
    if (!myCard || !neynarScoreData) return false;
    const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    const currentRarityIndex = rarityOrder.indexOf(myCard.rarity);
    const newRarityIndex = rarityOrder.indexOf(neynarScoreData.rarity);
    return newRarityIndex > currentRarityIndex;
  };

  // Play evolution sound
  const playEvolutionSound = () => {
    try {
      const audio = new Audio('/sounds/evolution.mp3');
      audio.volume = 0.7;
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  // Handle upgrade with animation and video regeneration
  const handleUpgrade = async () => {
    if (!myCard || !neynarScoreData || !canUpgrade()) return;

    AudioManager.buttonClick();
    setIsUpgrading(true);
    setShowScoreModal(false);
    setShowEvolutionModal(true);
    setEvolutionPhase('shaking');
    setRegenerationStatus('');

    // Animation sequence
    await new Promise(resolve => setTimeout(resolve, 800)); // Shake
    setEvolutionPhase('glowing');
    await new Promise(resolve => setTimeout(resolve, 1200)); // Glow

    // Play evolution sound when transforming starts
    playEvolutionSound();
    setEvolutionPhase('transforming');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Transform

    try {
      // Step 1: Upgrade rarity/power in database
      const result = await upgradeCardRarity({
        fid: myCard.fid,
        newNeynarScore: neynarScoreData.score,
        newRarity: neynarScoreData.rarity,
      });

      const newBounty = result.newPower * 10;

      // Step 2: Regenerate video with new values
      setEvolutionPhase('regenerating');
      setRegenerationStatus('Generating new card image...');

      // Generate new card image with updated bounty/rarity
      const cardImageDataUrl = await generateFarcasterCardImage({
        pfpUrl: myCard.pfpUrl,
        displayName: myCard.displayName,
        username: myCard.username,
        fid: myCard.fid,
        neynarScore: myCard.neynarScore,
        rarity: result.newRarity,
        suit: myCard.suit as any,
        rank: myCard.rank as any,
        suitSymbol: myCard.suitSymbol,
        color: myCard.color as 'red' | 'black',
        bio: myCard.bio || '',
        bounty: newBounty,
      });

      setRegenerationStatus('Generating video with foil effect...');

      // Generate video with foil animation
      const videoBlob = await generateCardVideo({
        cardImageDataUrl,
        foilType: myCard.foil as 'None' | 'Standard' | 'Prize',
        duration: 3,
        fps: 30,
        pfpUrl: myCard.pfpUrl,
      });

      setRegenerationStatus('Uploading to IPFS...');

      // Upload to IPFS
      const formData = new FormData();
      formData.append('video', videoBlob, 'card.webm');

      const uploadResponse = await fetch('/api/upload-nft-video', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error || 'Failed to upload video');
      }

      const uploadResult = await uploadResponse.json();
      const newVideoUrl = uploadResult.ipfsUrl;

      setRegenerationStatus('Updating card data...');

      // Step 3: Update card images in database
      await updateCardImages({
        fid: myCard.fid,
        imageUrl: newVideoUrl,
      });

      // Step 4: Refresh OpenSea metadata
      setRegenerationStatus('Refreshing OpenSea metadata...');
      try {
        await fetch('/api/opensea/refresh-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: myCard.fid }),
        });
      } catch (e) {
        console.log('OpenSea refresh failed (non-critical):', e);
      }

      setEvolutionData({
        oldRarity: result.oldRarity,
        newRarity: result.newRarity,
        oldPower: result.oldPower,
        newPower: result.newPower,
        oldScore: myCard.neynarScore,
        newScore: neynarScoreData.score,
        newBounty,
      });

      setEvolutionPhase('complete');
      setRegenerationStatus('');
      AudioManager.buttonClick();
    } catch (err: any) {
      console.error('Upgrade error:', err);
      setError(err.message || "Failed to upgrade card");
      setShowEvolutionModal(false);
      setEvolutionPhase('idle');
      setRegenerationStatus('');
    }

    setIsUpgrading(false);
  };

  const handleShare = async (currentLang: SupportedLanguage) => {
    if (!previewImage || !userData || !generatedTraits) return;

    try {
      const { generateShareImage } = await import('@/lib/generateShareImage');
      const createdAt = await getFarcasterAccountCreationDate(userData.fid);

      const shareImageDataUrl = await generateShareImage({
        cardImageDataUrl: previewImage,
        backstoryData: {
          username: userData.username,
          displayName: userData.display_name,
          bio: userData.profile?.bio?.text || "",
          fid: userData.fid,
          followerCount: userData.follower_count,
          createdAt,
          power: generatedTraits.power,
          bounty: generatedTraits.power * 10,
          rarity: generatedTraits.rarity,
        },
        displayName: userData.display_name,
        lang: currentLang,
      });

      // Download share image
      const link = document.createElement('a');
      link.href = shareImageDataUrl;
      link.download = `vibefid-${userData.fid}-${currentLang}.png`;
      link.click();
    } catch (err: any) {
      console.error('Failed to generate share image:', err);
    }
  };

  const handleMintCard = async () => {
    console.log('♣ handleMintCard called!', { address, userData: !!userData, farcasterUser: farcasterContext.user });

    if (!address) {
      console.error('❌ No wallet address connected');
      setError("Please connect your wallet");
      return;
    }

    if (!userData) {
      console.error('❌ No userData available');
      setError("No user data loaded");
      return;
    }

    console.log('✅ Starting mint process for FID:', userData.fid);
    setLoading(true);
    setError(null);

    try {
      const score = userData.experimental?.neynar_user_score || 0;

      // ALWAYS recalculate traits for mint (don't trust preview/localStorage)
      // This ensures deterministic traits even if preview was generated with old random code
      const rarity = calculateRarityFromScore(score);
      const suit = getSuitFromFid(userData.fid); // DETERMINISTIC based on FID
      const suitSymbol = getSuitSymbol(suit);
      const color = getSuitColor(suit);
      const rank = generateRankFromRarity(rarity);

      // Generate FID-based foil and wear traits (DETERMINISTIC for final mint)
      // NO extraSeed - same FID always gives same traits on-chain
      const fidTraits = getFidTraits(userData.fid);
      const foil = fidTraits.foil;
      const wear = fidTraits.wear;

      console.log('♣ MINT DEBUG - FID:', userData.fid, 'Calculated Foil:', foil, 'Wear:', wear);

      // Calculate power with VibeFID balanced config
      const rarityKey = rarity.toLowerCase() as 'mythic' | 'legendary' | 'epic' | 'rare' | 'common';
      const basePower = VIBEFID_POWER_CONFIG.rarityBase[rarityKey] || VIBEFID_POWER_CONFIG.rarityBase.common;

      // Get wear multiplier from config
      const wearKey = wear.toLowerCase().replace(' ', '') as 'pristine' | 'mint';
      const wearMult = VIBEFID_POWER_CONFIG.wearMultiplier[wearKey] || VIBEFID_POWER_CONFIG.wearMultiplier.default;

      // Get foil multiplier from config
      const foilKey = foil.toLowerCase() as 'prize' | 'standard' | 'none';
      const foilMult = VIBEFID_POWER_CONFIG.foilMultiplier[foilKey] || VIBEFID_POWER_CONFIG.foilMultiplier.none;

      const power = Math.round(basePower * wearMult * foilMult);

      // ALWAYS regenerate card image with recalculated power/bounty
      // This ensures the bounty on the image matches the metadata trait
      // (Don't reuse preview - it might have old bounty from before deterministic fix)
      const createdAt = await getFarcasterAccountCreationDate(userData.fid);
      const cardImageDataUrl = await generateFarcasterCardImage({
        fid: userData.fid,
        username: userData.username,
        displayName: userData.display_name,
        pfpUrl: userData.pfp_url,
        bio: userData.profile?.bio?.text || "",
        neynarScore: score,
        suit,
        suitSymbol,
        rank,
        color,
        rarity,
        bounty: power * 10, // Bounty = Power × 10 (matches metadata API)
        createdAt: createdAt || undefined,
      });

      // Upload static card PNG to IPFS first (for sharing)
      setError("Uploading card image to IPFS...");
      const cardPngBlob = await fetch(cardImageDataUrl).then(r => r.blob());
      const pngFormData = new FormData();
      pngFormData.append('image', cardPngBlob, `card-${userData.fid}.png`);

      const pngUploadResponse = await fetch('/api/upload-nft-image', {
        method: 'POST',
        body: pngFormData,
      });

      if (!pngUploadResponse.ok) {
        throw new Error('Failed to upload card image to IPFS');
      }

      const { ipfsUrl: cardImageIpfsUrl } = await pngUploadResponse.json();

      console.log('🖼️ Card PNG IPFS URL:', cardImageIpfsUrl);
      if (!cardImageIpfsUrl) {
        throw new Error('Card PNG IPFS upload returned empty URL!');
      }

      // Generate share image (card + criminal text for social sharing)
      setError("Generating share image...");
      const { generateShareImage } = await import('@/lib/generateShareImage');

      const shareImageDataUrl = await generateShareImage({
        cardImageDataUrl,
        backstoryData: {
          username: userData.username,
          displayName: userData.display_name,
          bio: userData.profile?.bio?.text || "",
          fid: userData.fid,
          followerCount: userData.follower_count,
          createdAt,
          power,
          bounty: power * 10,
          rarity,
        },
        displayName: userData.display_name,
        lang, // Use current language from context
      });

      // Upload share image to IPFS
      setError("Uploading share image to IPFS...");
      const shareImageBlob = await fetch(shareImageDataUrl).then(r => r.blob());
      const shareFormData = new FormData();
      shareFormData.append('image', shareImageBlob, `share-${userData.fid}.png`);

      const shareUploadResponse = await fetch('/api/upload-nft-image', {
        method: 'POST',
        body: shareFormData,
      });

      if (!shareUploadResponse.ok) {
        throw new Error('Failed to upload share image to IPFS');
      }

      const { ipfsUrl: shareImageIpfsUrl } = await shareUploadResponse.json();

      console.log('📤 Share Image IPFS URL:', shareImageIpfsUrl);
      if (!shareImageIpfsUrl) {
        throw new Error('Share image IPFS upload returned empty URL!');
      }

      // Generate MP4 video with foil animation (3s static, 5s animated PFP)
      setError("Generating video with foil animation...");
      console.log('🎬 VIDEO DEBUG - About to generate video with foil:', foil);
      const videoBlob = await generateCardVideo({
        cardImageDataUrl,
        foilType: foil as 'None' | 'Standard' | 'Prize',
        // Duration auto-determined: 3s for static PFP, 5s for animated PFP
        pfpUrl: userData.pfp_url, // Pass PFP URL for animated GIF support
      });

      // Upload video to IPFS
      setError("Uploading video to IPFS...");
      const formData = new FormData();
      formData.append('video', videoBlob, `card-${userData.fid}.webm`);

      const uploadResponse = await fetch('/api/upload-nft-video', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video to IPFS');
      }

      const { ipfsUrl } = await uploadResponse.json();

      console.log('♣ Video IPFS URL:', ipfsUrl);
      if (!ipfsUrl) {
        throw new Error('IPFS upload returned empty URL!');
      }

      // Build metadata URL that OpenSea will read
      const metadataUrl = `https://vibefid.xyz/api/metadata/fid/${userData.fid}`;

      // Get signature from backend
      setError("Verifying FID ownership and getting signature...");
      const signatureResponse = await fetch('/api/farcaster/mint-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          fid: userData.fid,
          ipfsURI: metadataUrl, // Use metadata URL instead of image URL
        }),
      });

      if (!signatureResponse.ok) {
        const errorData = await signatureResponse.json();
        throw new Error(errorData.error || 'Failed to get mint signature');
      }

      const { signature } = await signatureResponse.json();

      // Store mint data for later (after on-chain confirmation)
      // 🔒 FIX: Also save to localStorage to survive page refresh
      const mintData = {
        fid: userData.fid,
        username: userData.username,
        displayName: userData.display_name,
        pfpUrl: userData.pfp_url,
        bio: userData.profile?.bio?.text || "",
        neynarScore: score,
        followerCount: userData.follower_count,
        followingCount: userData.following_count,
        powerBadge: userData.power_badge || false,
        address,
        rarity,
        foil,
        wear,
        power,
        suit,
        rank,
        suitSymbol,
        color,
        imageUrl: ipfsUrl, // Video (MP4)
        cardImageUrl: cardImageIpfsUrl, // Static PNG for sharing
        shareImageUrl: shareImageIpfsUrl, // Share image with card + criminal text
        timestamp: Date.now(), // Track when mint was initiated
      };
      setPendingMintData(mintData);
      localStorage.setItem('vibefid_pending_mint', JSON.stringify(mintData));
      console.log('💾 Saved pending mint data to localStorage:', userData.fid);

      // Mint NFT on smart contract
      setError("Minting NFT on-chain (confirm transaction in wallet)...");
      console.log('🚀 Preparing mint transaction:', {
        address: VIBEFID_CONTRACT_ADDRESS,
        functionName: 'presignedMint',
        fid: userData.fid,
        metadataUrl,
        mintPrice: MINT_PRICE,
        userAddress: address,
      });

      // Detect iOS for alternative transaction method
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      console.log('📱 Device detection - iOS:', isIOS);

      if (isIOS) {
        // iOS: Use sendTransaction with encoded data (more compatible with Farcaster miniapp)
        console.log('📱 Using sendTransaction for iOS compatibility');
        const data = encodeFunctionData({
          abi: VIBEFID_ABI,
          functionName: 'presignedMint',
          args: [BigInt(userData.fid), metadataUrl, signature as `0x${string}`],
        });

        sendTransaction({
          to: VIBEFID_CONTRACT_ADDRESS,
          data,
          value: parseEther(MINT_PRICE),
        });
      } else {
        // Non-iOS: Use standard writeContract
        console.log('💻 Using writeContract for desktop/Android');
        writeContract({
          address: VIBEFID_CONTRACT_ADDRESS,
          abi: VIBEFID_ABI,
          functionName: 'presignedMint',
          args: [BigInt(userData.fid), metadataUrl, signature as `0x${string}`],
          value: parseEther(MINT_PRICE),
        });
      }

      // Note: Transaction confirmation is handled by useWaitForTransactionReceipt hook
      // After confirmation, data is saved to Convex in useEffect above

    } catch (err: any) {
      setError(err.message || "Failed to mint card");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-vintage-charcoal to-vintage-deep-black p-2 sm:p-4 md:p-8 overflow-x-hidden relative">
      {/* Floating Cards Background */}
      <FloatingCardsBackground />

      {/* Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-vintage-charcoal/95 backdrop-blur-sm border-b border-vintage-gold/30 px-3 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left: User Info */}
          <div className="flex items-center gap-2">
            {farcasterContext.user ? (
              <>
                <img
                  src={farcasterContext.user.pfpUrl || '/images/default-avatar.png'}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border-2 border-vintage-gold"
                />
                <div className="text-left">
                  <p className="text-vintage-gold font-bold text-sm leading-tight">
                    @{farcasterContext.user.username}
                  </p>
                  <p className="text-vintage-ice/60 text-xs">
                    FID #{farcasterContext.user.fid}
                  </p>
                </div>
              </>
            ) : (
              <span className="text-vintage-ice/50 text-sm">Not connected</span>
            )}
          </div>

          {/* Right: About, Sound & Language */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                AudioManager.buttonClick();
                setShowAboutModal(true);
              }}
              className="w-8 h-8 flex items-center justify-center bg-vintage-black/50 border border-vintage-gold/30 rounded-lg text-vintage-gold hover:border-vintage-gold hover:bg-vintage-gold/10 transition-all font-bold text-lg"
              title="About"
            >
              ?
            </button>
            <button
              onClick={() => setIsMusicEnabled(!isMusicEnabled)}
              className="w-8 h-8 flex items-center justify-center bg-vintage-black/50 border border-vintage-gold/30 rounded-lg text-vintage-gold hover:border-vintage-gold hover:bg-vintage-gold/10 transition-all"
              title={isMusicEnabled ? "Mute" : "Unmute"}
            >
              {isMusicEnabled ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              )}
            </button>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as any)}
              className="h-8 px-2 bg-[#1a1a1a] border border-vintage-gold/30 rounded-lg text-vintage-gold font-bold focus:outline-none focus:border-vintage-gold text-xs hover:border-vintage-gold hover:bg-vintage-gold/10 transition-all cursor-pointer [&>option]:bg-[#1a1a1a] [&>option]:text-vintage-gold"
            >
              <option value="en">EN</option>
              <option value="pt-BR">PT</option>
              <option value="es">ES</option>
              <option value="it">IT</option>
              <option value="fr">FR</option>
              <option value="ja">JA</option>
              <option value="zh-CN">ZH</option>
              <option value="ru">RU</option>
              <option value="hi">HI</option>
              <option value="id">ID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main content container - centered in viewport */}
      <div className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none" style={{ top: '56px', bottom: '64px' }}>
        {/* Buttons centered in exact middle */}
        <div className="pointer-events-auto flex flex-col items-center gap-3">
          {/* Main action button */}
          {myCard ? (
            <Link
              href={`/fid/${myCard.fid}`}
              onClick={() => AudioManager.buttonClick()}
              className="px-10 py-4 bg-vintage-gold text-vintage-black font-bold text-xl rounded-xl transition-all hover:scale-105 hover:bg-vintage-burnt-gold shadow-[0_0_30px_rgba(255,215,0,0.3)]"
            >
              {t.viewMyCard || "View My Card"}
            </Link>
          ) : (
            <button
              onClick={handleGenerateCard}
              disabled={loading}
              className="px-10 py-4 bg-vintage-gold text-vintage-black font-bold text-xl rounded-xl transition-all hover:scale-105 hover:bg-vintage-burnt-gold disabled:opacity-50 shadow-[0_0_30px_rgba(255,215,0,0.3)]"
            >
              {loading ? t.generating : farcasterContext.user ? t.mintMyCard : t.connectFarcasterToMint}
            </button>
          )}

          {/* Check score link - subtle */}
          {farcasterContext.user && (
            <button
              onClick={handleCheckNeynarScore}
              disabled={loading}
              className="text-vintage-gold/70 text-xs hover:text-vintage-gold transition-colors disabled:opacity-50"
            >
              {t.checkNeynarScore}
            </button>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm break-words max-w-md">
              {error}
            </div>
          )}
        </div>
      </div>


      <div className="max-w-4xl mx-auto w-full pt-16">

        {/* Generation Modal */}
        <FidGenerationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          backstoryData={backstoryData}
          displayName={userData?.display_name || ""}
          previewImage={previewImage}
          generatedTraits={generatedTraits}
          onMint={handleMintCard}
          isMinting={loading || isContractPending || isSendPending || isConfirming}
          isMintedSuccessfully={mintedSuccessfully}
          fid={userData?.fid}
          onShare={handleShare}
          username={userData?.username}
          walletAddress={address}
          onConnectWallet={async () => {
            const farcasterConnector = connectors.find((c) =>
              c.id === 'farcasterMiniApp' ||
              c.id === 'farcaster' ||
              c.name?.toLowerCase().includes('farcaster')
            );
            if (farcasterConnector) {
              try {
                await connect({ connector: farcasterConnector });
              } catch (err) {
                console.error('Failed to connect wallet:', err);
              }
            }
          }}
        />


        {/* Neynar Score Modal - EXACT COPY FROM CARD PAGE */}
        {showScoreModal && neynarScoreData && (
          <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-16 pb-20 overflow-y-auto">
            <div className="bg-vintage-charcoal rounded-xl border-2 border-vintage-gold/50 p-4 max-w-md w-full">
              <h2 className="text-xl font-bold text-vintage-gold mb-3 text-center">
                {t.neynarScoreTitle}
              </h2>

              {/* Current Score */}
              <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4 mb-3">
                <div className="text-center">
                  <p className="text-vintage-burnt-gold text-xs mb-1">@{neynarScoreData.username}</p>
                  <div className="text-4xl font-bold text-vintage-gold mb-1">
                    {neynarScoreData.score.toFixed(3)}
                  </div>
                  <p className="text-vintage-ice text-xs">{t.currentScore}</p>
                  {myCard && myCard.neynarScore && (
                    <p className={`text-xs mt-1 font-bold ${
                      neynarScoreData.score > myCard.neynarScore ? 'text-green-400' :
                      neynarScoreData.score < myCard.neynarScore ? 'text-red-400' : 'text-vintage-ice/50'
                    }`}>
                      {neynarScoreData.score > myCard.neynarScore ? '+' : ''}
                      {(neynarScoreData.score - myCard.neynarScore).toFixed(4)} from mint
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-vintage-gold/20">
                  <span className="text-vintage-burnt-gold text-xs">{t.rarityAvailable || "Rarity Available"}</span>
                  <span className="text-vintage-ice font-bold">{neynarScoreData.rarity}</span>
                </div>
              </div>

              {/* Upgrade Available Banner */}
              {canUpgrade() && myCard && (
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-3 mb-3 text-center">
                  <p className="text-yellow-400 font-bold mb-1">{t.upgradeAvailable}</p>
                  <p className="text-vintage-ice text-xs">
                    <span className="text-vintage-burnt-gold">{myCard.rarity}</span> {"→"} <span className="text-yellow-400">{neynarScoreData.rarity}</span>
                  </p>
                </div>
              )}

              {/* Score History */}
              {scoreHistory && scoreHistory.history && scoreHistory.history.length > 0 && (
                <div className="bg-vintage-black/30 rounded-lg border border-vintage-gold/20 p-3 mb-3">
                  <p className="text-vintage-burnt-gold text-xs mb-2 font-bold">{t.scoreHistory} ({scoreHistory.totalChecks} {t.checks})</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {scoreHistory.history.slice(0, 10).map((entry: any, i: number) => {
                      const prevScore = i < scoreHistory.history.length - 1 ? scoreHistory.history[i + 1]?.score : null;
                      const diff = prevScore !== null ? entry.score - prevScore : 0;
                      return (
                        <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-vintage-gold/10 last:border-0">
                          <span className="text-vintage-ice/60 w-14">
                            {new Date(entry.checkedAt).toLocaleDateString()}</span>
                          <span className="text-vintage-burnt-gold text-[10px] w-14">{getRarityFromScore(entry.score)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-vintage-ice">{entry.score.toFixed(3)}</span>
                            {prevScore !== null && diff !== 0 && (
                              <span className={diff > 0 ? 'text-green-400' : 'text-red-400'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {canUpgrade() && (
                  <button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-lg transition-all disabled:opacity-50"
                  >
                    {isUpgrading ? t.upgrading : t.upgradeRarity}
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      AudioManager.buttonClick();
                      setShowScoreModal(false);
                    }}
                    className="flex-1 px-3 py-2 bg-vintage-charcoal border border-vintage-gold/30 text-vintage-gold rounded-lg hover:bg-vintage-gold/10 transition-colors text-sm"
                  >
                    {t.back}
                  </button>
                  <a
                    href={(() => {
                      const shareUrl = 'https://vibefid.xyz/fid';
                      const scoreDiff = myCard && myCard.neynarScore ? neynarScoreData.score - myCard.neynarScore : 0;
                      const diffSign = scoreDiff >= 0 ? '+' : '';
                      const mintRarity = scoreHistory?.mintRarity || myCard?.rarity;
                      const rarityChanged = mintRarity && mintRarity !== neynarScoreData.rarity;
                      const scoreLine = myCard && myCard.neynarScore
                        ? `${neynarScoreData.score.toFixed(3)} ${diffSign}${scoreDiff.toFixed(4)} ${t.sinceMint || 'since mint'}`
                        : `${neynarScoreData.score.toFixed(3)}`;
                      const rarityLine = rarityChanged
                        ? `${t.cardLeveledUp || 'Card leveled up!'} ${mintRarity} → ${neynarScoreData.rarity}`
                        : neynarScoreData.rarity;
                      const castText = `Neynar Score: ${scoreLine}\n${rarityLine}\n\n${t.neynarScoreCheckMint}`;
                      return `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => AudioManager.buttonClick()}
                    className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors text-center text-sm"
                  >
                    Share
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evolution Animation Modal */}
        {showEvolutionModal && myCard && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="max-w-sm w-full text-center my-auto">
              {/* Card with Animation */}
              <div className={`relative mb-4 sm:mb-8 transition-all duration-500 ${
                evolutionPhase === 'shaking' ? 'animate-shake' : ''
              } ${evolutionPhase === 'glowing' ? 'animate-glow' : ''} ${
                evolutionPhase === 'transforming' ? 'animate-transform-card scale-105 sm:scale-110' : ''
              }`}>
                {/* Glow Effect */}
                {(evolutionPhase === 'glowing' || evolutionPhase === 'transforming') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-xl blur-xl opacity-75 animate-pulse" />
                )}

                {/* Card */}
                <div className="relative w-40 sm:w-56 mx-auto">
                  <FoilCardEffect
                    foilType={myCard.foil === 'None' ? null : (myCard.foil as 'Standard' | 'Prize' | null)}
                    className="w-full rounded-lg shadow-2xl border-2 sm:border-4 border-vintage-gold overflow-hidden"
                  >
                    <CardMedia
                      src={myCard.imageUrl || myCard.pfpUrl}
                      alt={myCard.username}
                      className="w-full"
                    />
                  </FoilCardEffect>
                </div>

                {/* Particles */}
                {evolutionPhase === 'transforming' && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-particle"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 0.5}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Phase Text */}
              <div className="mb-4 sm:mb-6">
                {evolutionPhase === 'shaking' && (
                  <p className="text-lg sm:text-2xl font-bold text-vintage-gold animate-pulse">🔮 {t.channelingPower}</p>
                )}
                {evolutionPhase === 'glowing' && (
                  <p className="text-lg sm:text-2xl font-bold text-yellow-400 animate-pulse">✨ {t.energyBuilding}</p>
                )}
                {evolutionPhase === 'transforming' && (
                  <p className="text-lg sm:text-2xl font-bold text-orange-400 animate-pulse">⚡ {t.evolving}</p>
                )}
                {evolutionPhase === 'regenerating' && (
                  <div className="space-y-2">
                    <p className="text-lg sm:text-2xl font-bold text-cyan-400 animate-pulse">🎬 {t.regenerating}</p>
                    {regenerationStatus && (
                      <p className="text-vintage-ice text-xs sm:text-xs">{regenerationStatus}</p>
                    )}
                  </div>
                )}
                {evolutionPhase === 'complete' && evolutionData && (
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-xl sm:text-3xl font-bold text-green-400">🎉 {t.evolved}</p>

                    <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-3 sm:p-6">
                      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="text-center">
                          <p className="text-vintage-burnt-gold text-[10px] sm:text-xs">{t.before}</p>
                          <p className="text-vintage-ice text-xs sm:text-lg font-bold">{evolutionData.oldRarity}</p>
                          <p className="text-vintage-ice/60 text-xs sm:text-xs">⚡ {evolutionData.oldPower}</p>
                        </div>
                        <div className="text-xl sm:text-3xl">{"→"}</div>
                        <div className="text-center">
                          <p className="text-yellow-400 text-[10px] sm:text-xs">{t.after}</p>
                          <p className="text-yellow-400 text-base sm:text-xl font-bold">{evolutionData.newRarity}</p>
                          <p className="text-yellow-400 text-xs sm:text-xs">⚡ {evolutionData.newPower}</p>
                          <p className="text-green-400 text-[10px] sm:text-xs mt-1">💰 ${evolutionData.newBounty.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="text-center border-t border-vintage-gold/20 pt-2 sm:pt-4">
                        <p className="text-vintage-burnt-gold text-[10px] sm:text-xs">Neynar Score</p>
                        <p className="text-vintage-gold font-bold text-xs sm:text-base">
                          {evolutionData.oldScore.toFixed(3)} {"→"} {evolutionData.newScore.toFixed(3)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 sm:gap-3">
                      <a
                        href={(() => {
                          const shareUrl = `https://vibefid.xyz/fid/${myCard?.fid}`;
                          const scoreDiff = evolutionData.newScore - evolutionData.oldScore;
                          const diffSign = scoreDiff >= 0 ? '+' : '';
                          const castText = `My VibeFID just EVOLVED!\n\n${evolutionData.oldRarity} → ${evolutionData.newRarity}\nPower: ${evolutionData.oldPower} → ${evolutionData.newPower}\nNeynar Score: ${diffSign}${scoreDiff.toFixed(4)}\nBounty: ${evolutionData.newBounty.toLocaleString()}\n\n@jvhbo`;
                          return `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(shareUrl)}`;
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => AudioManager.buttonClick()}
                        className="flex-1 px-3 py-3 sm:px-4 sm:py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors text-center text-xs sm:text-base"
                      >
                        Share
                      </a>
                      <button
                        onClick={() => {
                          AudioManager.buttonClick();
                          setShowEvolutionModal(false);
                          setEvolutionPhase('idle');
                          setEvolutionData(null);
                          setNeynarScoreData(null);
                        }}
                        className="flex-1 px-3 py-3 sm:px-4 sm:py-4 bg-vintage-gold hover:bg-vintage-burnt-gold text-vintage-black font-bold rounded-lg transition-colors text-xs sm:text-base"
                      >
                        {t.close}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* About Traits Modal */}
        <FidAboutTraitsModal
          isOpen={showAboutModal}
          onClose={() => setShowAboutModal(false)}
        />

        {/* OLD MODAL REMOVED - replaced with FidAboutTraitsModal component */}
        {false && showAboutModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto hidden">
            <div className="bg-vintage-charcoal rounded-xl border-2 border-vintage-gold max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-vintage-charcoal border-b-2 border-vintage-gold/30 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-vintage-gold">
                    {fidTranslations[lang].aboutTraits}
                  </h2>
                  <button
                    onClick={() => {
                      AudioManager.buttonClick();
                      setShowAboutModal(false);
                    }}
                    className="text-vintage-ice hover:text-vintage-gold text-2xl sm:text-3xl leading-none bg-vintage-black/70 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>

                {/* Language Selector */}
                <select
                  value={lang}
                  onChange={(e) => {
                    AudioManager.toggleOn();
                    setLang(e.target.value as any);
                  }}
                  className="px-3 py-2 bg-vintage-charcoal border border-vintage-gold/30 rounded-lg text-vintage-ice focus:outline-none focus:border-vintage-gold text-sm [&>option]:bg-vintage-charcoal [&>option]:text-vintage-ice"
                >
                  <option value="en">🇺🇸 English</option>
                  <option value="pt-BR">🇧🇷 Português</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="hi">🇮🇳 हिन्दी</option>
                  <option value="ru">🇷🇺 Русский</option>
                  <option value="zh-CN">🇨🇳 中文</option>
                  <option value="id">🇮🇩 Bahasa</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="ja">🇯🇵 日本語</option>
                </select>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-6">
                <p className="text-vintage-ice text-sm sm:text-base leading-relaxed">
                  VibeFID cards have unique traits that determine their power and value. All traits are <span className="text-vintage-gold font-bold">deterministic</span> - your FID always gets the same traits!
                </p>

                {/* FID & Neynar Score */}
                <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg border-2 border-blue-500/50 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                    <span>🆔</span> FID & Neynar Score
                  </h3>
                  <div className="space-y-3 text-vintage-ice/80 text-sm">
                    <p>
                      <span className="font-bold text-blue-300">FID (Farcaster ID):</span> Your unique Farcaster identifier. It determines your <span className="font-bold">Suit</span> (♠ ♥ ♦ ♣), <span className="font-bold">Foil</span>, and <span className="font-bold">Wear</span> traits through deterministic algorithms - the same FID always gets the same traits!
                    </p>
                    <p>
                      <span className="font-bold text-purple-300">Neynar Score:</span> Measures your Farcaster engagement and reputation (followers, casts, reactions, etc.). Higher scores = <span className="font-bold text-vintage-gold">rarer cards</span> with more base power!
                    </p>
                    <div className="mt-2 p-3 bg-vintage-black/40 rounded border border-blue-500/30 text-xs">
                      💡 <span className="font-bold">Pro tip:</span> Engage more on Farcaster to increase your Neynar Score and get better cards!
                    </div>
                  </div>
                </div>

                {/* Rarity */}
                <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    <span>♣</span> Rarity
                  </h3>
                  <p className="text-vintage-ice/80 text-sm mb-3">
                    Based on your Neynar Score. Higher scores = rarer cards with more base power.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 font-bold">Mythic</span>
                      <span className="text-vintage-ice text-sm">600 base power</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-400 font-bold">Legendary</span>
                      <span className="text-vintage-ice text-sm">100 base power</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-pink-400 font-bold">Epic</span>
                      <span className="text-vintage-ice text-sm">50 base power</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-bold">Rare</span>
                      <span className="text-vintage-ice text-sm">20 base power</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-bold">Common</span>
                      <span className="text-vintage-ice text-sm">10 base power</span>
                    </div>
                  </div>
                </div>

                {/* Foil */}
                <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    <span>✨</span> Foil Type
                  </h3>
                  <p className="text-vintage-ice/80 text-sm mb-3">
                    Randomly assigned based on your FID. Foil cards have visual effects and power multipliers!
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 font-bold">Prize Foil</span>
                      <span className="text-vintage-ice text-sm">×6.0 power • 15% chance</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-bold">Standard Foil</span>
                      <span className="text-vintage-ice text-sm">×2.0 power • 50% chance</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-bold">None</span>
                      <span className="text-vintage-ice text-sm">×1.0 power • 35% chance</span>
                    </div>
                  </div>
                </div>

                {/* Wear */}
                <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    <span>💎</span> Wear Condition
                  </h3>
                  <p className="text-vintage-ice/80 text-sm mb-3">
                    Randomly assigned based on your FID. Better condition = higher power!
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 font-bold">Pristine</span>
                      <span className="text-vintage-ice text-sm">×1.8 power • 40% chance</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-bold">Mint</span>
                      <span className="text-vintage-ice text-sm">×1.4 power • 40% chance</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-bold">Lightly Played</span>
                      <span className="text-vintage-ice text-sm">×1.0 power • 20% chance</span>
                    </div>
                  </div>
                </div>

                {/* Power Calculation */}
                <div className="bg-gradient-to-br from-vintage-gold/20 to-vintage-burnt-gold/20 rounded-lg border-2 border-vintage-gold p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    Power Calculation
                  </h3>
                  <div className="text-center">
                    <div className="text-vintage-ice text-sm sm:text-base mb-2">
                      Power = <span className="text-vintage-gold font-bold">Base Power</span> × <span className="text-blue-400 font-bold">Foil</span> × <span className="text-green-400 font-bold">Wear</span>
                    </div>
                    <div className="text-vintage-ice/60 text-xs sm:text-sm mt-3">
                      Example: Mythic (600) × Prize Foil (6.0) × Pristine (1.8) = <span className="text-vintage-gold font-bold">6,480 Power</span>
                    </div>
                  </div>
                </div>

                {/* Card & Suit */}
                <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    <span>🃏</span> Card & Suit
                  </h3>
                  <p className="text-vintage-ice/80 text-sm">
                    <span className="font-bold">Suit</span> (♠ ♥ ♦ ♣) is deterministic based on FID.<br/>
                    <span className="font-bold">Rank</span> (A, K, Q, J, 10-2) is based on your rarity - higher rarity = higher rank.
                  </p>
                </div>

                {/* Bounty */}
                <div className="bg-vintage-black/50 rounded-lg border border-vintage-gold/30 p-4">
                  <h3 className="text-lg sm:text-xl font-bold text-vintage-gold mb-3 flex items-center gap-2">
                    <span>💰</span> Bounty
                  </h3>
                  <p className="text-vintage-ice/80 text-sm">
                    Your bounty reward = <span className="text-vintage-gold font-bold">Power × 10</span>
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => {
                    AudioManager.buttonClick();
                    setShowAboutModal(false);
                  }}
                  className="w-full px-6 py-3 bg-vintage-gold text-vintage-black font-bold rounded-lg hover:bg-vintage-burnt-gold transition-colors"
                >
                  {fidTranslations[lang].gotIt}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacer for fixed nav */}
        <div className="h-20"></div>
      </div>

      {/* VBMS Confirmation Modal */}
      {showVBMSModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-vintage-charcoal border-2 border-vintage-gold rounded-2xl p-4 w-full max-w-sm">
            <h3 className="text-vintage-gold font-bold text-lg mb-3 text-center">
              {(t as unknown as Record<string, string>).openVBMS || 'Open Vibe Most Wanted?'}
            </h3>
            <p className="text-vintage-ice/80 text-sm text-center mb-4">
              {(t as unknown as Record<string, string>).openVBMSDesc || 'You will be redirected to Vibe Most Wanted to play the game.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  AudioManager.buttonClick();
                  setShowVBMSModal(false);
                }}
                className="flex-1 py-2 bg-vintage-burnt-gold/30 hover:bg-vintage-burnt-gold/50 text-vintage-gold font-bold rounded-xl transition-all"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  AudioManager.buttonClick();
                  const VBMS_MINIAPP_URL = 'https://farcaster.xyz/miniapps/UpOGC4pheWVP/vbms';
                  if (farcasterContext.isInMiniapp) {
                    try {
                      await sdk.actions.openMiniApp({ url: VBMS_MINIAPP_URL });
                    } catch (err) {
                      window.open(VBMS_MINIAPP_URL, '_blank');
                    }
                  } else {
                    window.open(VBMS_MINIAPP_URL, '_blank');
                  }
                  setShowVBMSModal(false);
                }}
                className="flex-1 py-2 bg-vintage-gold hover:bg-yellow-500 text-vintage-black font-bold rounded-xl transition-all"
              >
                {t.open || 'Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* Floating Claim Button */}
      {userFid && vibeRewards && vibeRewards.pendingVbms > 0 && address && (
        <button
          onClick={async () => {
            AudioManager.buttonClick();
            setIsClaimingRewards(true);
            setError(null);
            let claimResult: { success: boolean; amount?: number; nonce?: string; signature?: string; error?: string } | null = null;
            try {
              console.log('📝 Preparing claim via Convex action...');
              claimResult = await prepareVibeRewardsClaim({
                fid: userFid,
                claimerAddress: address,
              });

              if (!claimResult.success || !claimResult.nonce || !claimResult.signature || !claimResult.amount) {
                throw new Error(claimResult.error || 'Failed to prepare claim');
              }

              console.log('✅ Got nonce + signature from Convex');
              console.log('🔗 Calling claimVBMS on contract...');

              const txHash = await claimVBMS(
                claimResult.amount.toString(),
                claimResult.nonce as `0x${string}`,
                claimResult.signature as `0x${string}`
              );
              console.log('✅ Claim TX:', txHash);
              alert(`Claimed ${claimResult.amount} VBMS! TX: ${txHash}`);
            } catch (e: any) {
              console.error('❌ Claim failed:', e);
              if (claimResult?.amount) {
                console.log('🔄 Restoring rewards after TX failure...');
                try {
                  await restoreClaimOnTxFailure({ fid: userFid, amount: claimResult.amount });
                  console.log('✅ Rewards restored');
                } catch (restoreErr) {
                  console.error('Failed to restore rewards:', restoreErr);
                }
              }
              setError(e.message || 'Claim failed');
              setTimeout(() => setError(null), 5000);
            }
            setIsClaimingRewards(false);
          }}
          disabled={isClaimingRewards || isClaimTxPending}
          className="fixed bottom-20 right-4 z-[9998] px-3 py-2 rounded-xl bg-vintage-gold/40 text-vintage-gold hover:bg-vintage-gold/60 transition-all flex flex-col items-center gap-0 disabled:opacity-50 shadow-lg backdrop-blur-sm border border-vintage-gold/30"
          style={{
            animation: 'floatClaim 4s ease-in-out infinite',
          }}
          title={`Claim ${vibeRewards.pendingVbms} VBMS`}
        >
          <span className="text-sm font-bold leading-tight">{isClaimingRewards || isClaimTxPending ? '...' : vibeRewards.pendingVbms}</span>
          <span className="text-[10px] leading-tight">VBMS</span>
        </button>
      )}

      {/* Bottom Navigation Bar - Fixed at bottom (VBMS style) */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] safe-area-bottom">
        <div className="bg-vintage-charcoal/95 backdrop-blur-lg rounded-none border-t-2 border-vintage-gold/30 p-1 flex gap-1">
          <button
            onClick={() => {
              AudioManager.buttonClick();
              setShowVBMSModal(true);
            }}
            className="flex-1 min-w-0 px-1 py-2 flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold transition-all text-[10px] leading-tight bg-vintage-black text-vintage-gold hover:bg-vintage-gold/10 border border-vintage-gold/30"
          >
            <span className="text-[10px] font-bold whitespace-nowrap">Vibe</span>
            <span className="text-xl leading-none">♠</span>
          </button>
          <Link
            href="/fid/most-wanted"
            onClick={() => AudioManager.buttonClick()}
            className="flex-1 min-w-0 px-1 py-2 flex flex-col items-center justify-center gap-0.5 rounded-lg font-semibold transition-all text-[10px] leading-tight bg-vintage-black text-vintage-gold hover:bg-vintage-gold/10 border border-vintage-gold/30"
          >
            <span className="text-[10px] font-bold whitespace-nowrap">Most Wanted</span>
            <span className="text-xl leading-none">♣</span>
          </Link>

        </div>
      </div>

      {/* Floating Animation CSS */}
      <style jsx global>{`
        @keyframes floatClaim {
          0% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(2deg); }
          50% { transform: translateY(-15px) rotate(0deg); }
          75% { transform: translateY(-8px) rotate(-2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
