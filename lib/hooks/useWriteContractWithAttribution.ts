'use client';

/**
 * useWriteContractWithAttribution
 *
 * Drop-in replacement for wagmi's useWriteContract that automatically adds
 * Base builder code attribution to transactions.
 *
 * Docs: https://docs.base.org/base-chain/quickstart/builder-codes
 */

import { useWriteContract, useAccount, useSendTransaction } from 'wagmi';
import { useSendCalls, useCapabilities } from 'wagmi/experimental';
import { base } from 'viem/chains';
import { encodeFunctionData, type Abi } from 'viem';

// Your unique builder code from base.dev
export const BUILDER_CODE = 'bc_j3oc0rlv';

// Coinbase Paymaster URL for Base mainnet (gas sponsorship)
const PAYMASTER_URL = process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL || '';

/**
 * Generate ERC-8021 data suffix for builder code attribution
 * Format: builder_code_hex + 0001 (version) + 8021 (magic)
 */
function generateDataSuffix(builderCode: string): `0x${string}` {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(builderCode);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hex}00018021` as `0x${string}`;
  } catch {
    return '0x';
  }
}

// Generate the dataSuffix for attribution
export const dataSuffix: `0x${string}` = generateDataSuffix(BUILDER_CODE);

/**
 * Drop-in replacement for useWriteContract with builder code attribution
 */
export function useWriteContractWithAttribution() {
  const { address: userAddress, chainId } = useAccount();
  const isOnBase = chainId === base.id;

  // Regular writeContract
  const writeContractResult = useWriteContract();

  // ERC-5792 sendCalls with capabilities
  const sendCallsResult = useSendCalls();

  // Raw transaction sender for manual suffix append
  const sendTxResult = useSendTransaction();

  // Check wallet capabilities
  const { data: capabilities } = useCapabilities({
    account: userAddress,
  });

  // Check if wallet supports ERC-5792 capabilities on Base
  const baseCapabilities = capabilities?.[base.id];
  const supportsERC5792 = isOnBase && (
    baseCapabilities?.atomicBatch?.supported === true ||
    baseCapabilities?.paymasterService?.supported === true
  );
  const supportsPaymaster = baseCapabilities?.paymasterService?.supported === true;

  /**
   * writeContractAsync with automatic builder code attribution
   */
  const writeContractAsync: typeof writeContractResult.writeContractAsync = async (params: any) => {
    const { address, abi, functionName, args, value, chainId: txChainId } = params;

    // Only add attribution on Base
    if (!isOnBase) {
      console.log('📝 Not on Base, using regular writeContract');
      return writeContractResult.writeContractAsync(params);
    }

    // Use manual method for builder code attribution
    if (dataSuffix !== '0x') {
      try {
        console.log('🏗️ Adding builder code suffix:', BUILDER_CODE);

        const callData = encodeFunctionData({
          abi: abi as Abi,
          functionName,
          args: args || [],
        });

        const dataWithSuffix = (callData + dataSuffix.slice(2)) as `0x${string}`;

        const hash = await sendTxResult.sendTransactionAsync({
          to: address,
          data: dataWithSuffix,
          value: value,
          chainId: txChainId ?? base.id,
        });

        console.log('✅ Transaction with builder code sent:', hash);
        return hash;
      } catch (err) {
        console.warn('⚠️ Manual suffix failed:', err);
      }
    }

    // Fallback: regular writeContract
    console.log('📝 Fallback: regular writeContract');
    return writeContractResult.writeContractAsync(params);
  };

  /**
   * writeContract (sync version) - uses regular writeContract
   */
  const writeContract: typeof writeContractResult.writeContract = (params: any) => {
    if (isOnBase) {
      console.log('🏗️ Builder code:', BUILDER_CODE);
    }
    return writeContractResult.writeContract(params);
  };

  return {
    writeContract,
    writeContractAsync,
    isPending: writeContractResult.isPending || sendCallsResult.isPending || sendTxResult.isPending,
    isError: writeContractResult.isError || sendCallsResult.isError || sendTxResult.isError,
    isSuccess: writeContractResult.isSuccess || sendCallsResult.isSuccess || sendTxResult.isSuccess,
    error: writeContractResult.error || sendCallsResult.error || sendTxResult.error,
    data: writeContractResult.data || sendTxResult.data,
    reset: () => {
      writeContractResult.reset();
      sendCallsResult.reset();
      sendTxResult.reset();
    },
    builderCode: BUILDER_CODE,
    dataSuffix,
    isOnBase,
    supportsERC5792,
    supportsPaymaster,
    paymasterUrl: PAYMASTER_URL,
    _original: writeContractResult,
  };
}

export default useWriteContractWithAttribution;
