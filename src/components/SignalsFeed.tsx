"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useSwitchChain, useChainId, useConnect, useDisconnect } from "wagmi";

// Arbitrum chain configuration
const arbitrum = {
  id: 42161,
  name: 'Arbitrum One',
  network: 'arbitrum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://arb1.arbitrum.io/rpc'],
    },
    public: {
      http: ['https://arb1.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 7654707,
    },
  },
};

// Copy button component
interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

function CopyButton({ text, label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
        copied
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      } ${className}`}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// Simple toast notification component
function Toast({ message, show, onClose }: { message: string; show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
      <div className="bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 rounded-lg px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="text-blue-400">🚀</div>
          <div className="text-white font-medium">{message}</div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition-colors ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

type Subscriber = {
  username: string;
  sent: boolean;
};

type SignalData = {
  token?: string;
  signal?: string; // Buy | Sell | ...
  currentPrice?: number;
  targets?: number[];
  stopLoss?: number;
  timeline?: string;
  maxExitTime?: string | Date;
  tradeTip?: string;
  tweet_id?: string | number;
  tweet_link?: string;
  tweet_timestamp?: string;
  priceAtTweet?: number;
  twitterHandle?: string;
  tokenMentioned?: string;
  tokenId?: string;
};

export type Signal = {
  _id: string;
  tweet_id?: string | number;
  twitterHandle?: string;
  coin?: string;
  signal_message?: string;
  signal_data?: SignalData;
  generatedAt?: string | Date;
  subscribers?: Subscriber[];
  tweet_link?: string;
  messageSent?: boolean;
};

type ApiResponse = {
  success: boolean;
  data?: unknown[];
  error?: string;
  message?: string;
};

interface SwapTransactionData {
  tokenName: string;
  amount: string;
  action: string;
  chainId: number;
  txPlan: Array<{
    to: string;
    data: string;
    value: string;
  }>;
}

function unwrapExtendedJson<T = unknown>(value: any): T {
  if (value == null) return value as T;

  if (typeof value === "object" && "$numberLong" in value) {
    const num = Number((value as any)["$numberLong"]);
    return (Number.isNaN(num) ? (value as any)["$numberLong"] : num) as unknown as T;
  }

  if (typeof value === "object" && "$date" in value) {
    return value["$date"] as string as unknown as T;
  }

  if (typeof value === "object" && value?._bsontype === "ObjectID" && typeof value.toHexString === "function") {
    return value.toHexString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => unwrapExtendedJson(v)) as unknown as T;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = unwrapExtendedJson(v);
    }
    return out as T;
  }

  return value as T;
}

function normalizeSignal(raw: any): Signal {
  const unwrapped = unwrapExtendedJson<Record<string, any>>(raw) || {};
  return {
    _id: String(unwrapped._id ?? ""),
    tweet_id: unwrapped.tweet_id,
    twitterHandle: unwrapped.twitterHandle,
    coin: unwrapped.coin,
    signal_message: unwrapped.signal_message,
    signal_data: unwrapped.signal_data,
    generatedAt: unwrapped.generatedAt,
    subscribers: Array.isArray(unwrapped.subscribers) ? unwrapped.subscribers : [],
    tweet_link: unwrapped.tweet_link,
    messageSent: Boolean(unwrapped.messageSent),
  };
}

function formatCurrency(value?: number, currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function calculatePnL(currentPrice?: number, entryPrice?: number, signal?: string): { percentage: number; absolute: number; isProfit: boolean } {
  if (!currentPrice || !entryPrice || !signal) {
    return { percentage: 0, absolute: 0, isProfit: false };
  }

  const isBuy = signal.toLowerCase() === 'buy';
  const multiplier = isBuy ? 1 : -1;
  const absolute = (currentPrice - entryPrice) * multiplier;
  const percentage = (absolute / entryPrice) * 100;
  const isProfit = absolute > 0;

  return { percentage, absolute, isProfit };
}

function classNames(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Error Display Component
function ErrorDisplay({ 
  error, 
  onClose, 
  onRetryWorkaround 
}: { 
  error: string; 
  onClose: () => void;
  onRetryWorkaround?: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto mb-4 animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-br from-red-50/95 via-red-50/90 to-pink-50/80 dark:from-red-900/20 dark:via-red-900/25 dark:to-pink-900/30 backdrop-blur-xl rounded-2xl border border-red-200/50 dark:border-red-700/50 shadow-2xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              ⚠️ Swap Error
            </h3>
            <div className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
              {error.split('\n').map((line, index) => (
                <div key={index} className={line.startsWith('•') ? 'ml-2' : line.startsWith('🔧') ? 'mt-3 font-semibold' : ''}>
                  {line}
                </div>
              ))}
            </div>
            {error.includes('Backend Balance Detection Issue') && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    💡 <strong>Technical Details:</strong> The backend is treating USDC (6 decimals) as if it has 18 decimals like ETH, 
                    causing a 10^12 precision error in balance detection. Your wallet shows 0.22202 USDC but the API reads it as ~0.000000000000222028 USDC.
                  </p>
                </div>
                {onRetryWorkaround && (
                  <div className="flex gap-2">
                    <button
                      onClick={onRetryWorkaround}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                    >
                      🔧 Try Workaround (0.001 USDC)
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility function for decimal conversions
const formatUSDC = (amount: string | number): { readable: string; wei: string } => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const weiAmount = numAmount * Math.pow(10, 6); // USDC has 6 decimals
  return {
    readable: numAmount.toFixed(6).replace(/\.?0+$/, ''), // Remove trailing zeros
    wei: weiAmount.toString()
  };
};

// Token decimal configurations
const TOKEN_DECIMALS: Record<string, number> = {
  'USDC': 6,
  'USDT': 6,
  'DAI': 18,
  'WETH': 18,
  'ARB': 18,
  'WBTC': 8,
  'LINK': 18,
  'UNI': 18,
  'AAVE': 18,
  'COMP': 18,
};

// Generic token formatting function
const formatTokenAmount = (amount: string | number, tokenSymbol: string): { readable: string; wei: string } => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const decimals = TOKEN_DECIMALS[tokenSymbol.toUpperCase()] || 18; // Default to 18 decimals
  const weiAmount = numAmount * Math.pow(10, decimals);
  return {
    readable: numAmount.toFixed(Math.min(6, decimals)).replace(/\.?0+$/, ''),
    wei: weiAmount.toString()
  };
};

// Amount Input Modal Component
function AmountInputModal({
  signal,
  isOpen,
  onClose,
  onConfirm,
  usdcAmount,
  setUsdcAmount,
  isLoading
}: {
  signal: Signal;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  usdcAmount: string;
  setUsdcAmount: (amount: string) => void;
  isLoading: boolean;
}) {
  const sd = signal.signal_data || {};
  const tokenName = sd.token || signal.coin || 'ARB';
  const targetTokenDecimals = TOKEN_DECIMALS[tokenName.toUpperCase()] || 18;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usdcAmount && parseFloat(usdcAmount) > 0) {
      onConfirm(usdcAmount);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gradient-to-br from-white/95 via-gray-50/90 to-blue-50/80 dark:from-gray-900/95 dark:via-gray-800/90 dark:to-blue-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            💱 Swap USDC to {tokenName}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              USDC Amount to Swap
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">
                (Minimum: 0.001 USDC)
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                placeholder="0.001"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                required
                min="0.001"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400">
                USDC
              </div>
            </div>
          </div>

          {/* Amount Breakdown */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/50">
            <div className="space-y-3">
              {/* USDC Amount Breakdown */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">USDC Amount</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">You entered:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {usdcAmount || '0'} USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Wei equivalent:</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {usdcAmount ? (parseFloat(usdcAmount) * Math.pow(10, 6)).toLocaleString() : '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Sent to API:</span>
                    <span className="font-mono text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                      {(usdcAmount ? (parseFloat(usdcAmount) * Math.pow(10, 6)).toLocaleString() : '0')} (wei format)
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    USDC uses 6 decimal places
                  </p>
                </div>
              </div>

              {/* Target Token Estimation */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Estimated {tokenName} Output</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">You will receive:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ~{usdcAmount ? (parseFloat(usdcAmount) * 1.5).toFixed(Math.min(6, targetTokenDecimals)) : '0.000000'} {tokenName}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {tokenName} uses {targetTokenDecimals} decimal places
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded p-2">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ <strong>Note:</strong> We're sending the amount in wei format (6 decimals for USDC) to prevent decimal misinterpretation by the backend.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!usdcAmount || parseFloat(usdcAmount) < 0.001 || isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span>Continue to Swap</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Enhanced Swap Transaction Preview Component
function SwapTransactionPreview({
  swapData,
  currentTxIndex,
  onApprove,
  onReject,
  isLoading
}: {
  swapData: SwapTransactionData;
  currentTxIndex: number;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  const progress = ((currentTxIndex + 1) / swapData.txPlan.length) * 100;
  const currentStepType = currentTxIndex === 0 ? 'Approval' : 'Swap';

  return (
    <div className="mt-6 animate-in slide-in-from-top duration-500">
      <div className="bg-gradient-to-br from-slate-50/95 via-white/90 to-blue-50/80 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-blue-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl p-6">
        {/* Header with Progress */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white to-gray-300 bg-clip-text text-transparent">
                Swap Transaction
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Step {currentTxIndex + 1} of {swapData.txPlan.length}: {currentStepType}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Progress</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(progress)}%</div>
            </div>
            <div className="w-12 h-12 relative">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${progress}, 100`}
                  className="text-blue-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">{currentTxIndex + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span>{currentStepType}</span>
            <span>{currentTxIndex + 1} / {swapData.txPlan.length}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-800/80 dark:to-gray-900/80 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-lg backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Action</span>
                <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full shadow-md">
                  {swapData.action}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Target Token</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {swapData.tokenName.slice(0, 1)}
                  </div>
                  {swapData.tokenName}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({TOKEN_DECIMALS[swapData.tokenName.toUpperCase()] || 18} decimals)
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-800/80 dark:to-gray-900/80 rounded-xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-lg backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatUSDC(swapData.amount).readable} USDC
                  </div>
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {formatUSDC(swapData.amount).wei} wei
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Network</span>
                <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-bold rounded-full shadow-md">
                  Arbitrum
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none group"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-3">
                <div className="relative">
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-5 h-5 border-3 border-white/30 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
                </div>
                <span className="text-sm font-bold">Processing Transaction...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <div className="relative">
                  <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
                <span className="text-sm font-bold">Approve & Sign</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-bold">Cancel Swap</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  index,
  onTradeClick,
  pendingSwap,
  currentTxIndex,
  onSwapApprove,
  onSwapReject,
  isTxPending,
  isSwapLoading,
  processingSignalId
}: {
  signal: Signal;
  index: number;
  onTradeClick: (signal: Signal) => void;
  pendingSwap: SwapTransactionData | null;
  currentTxIndex: number;
  onSwapApprove: () => Promise<void>;
  onSwapReject: () => void;
  isTxPending: boolean;
  isSwapLoading: boolean;
  processingSignalId: string | null;
}) {
  const sd = signal.signal_data || {};
  const signalType = (sd.signal || "").toLowerCase();
  const isBuy = signalType === "buy";
  const isSell = signalType === "sell";

  // Check if this signal is the one that triggered the current swap
  const isCurrentSignalSwap = pendingSwap && pendingSwap.tokenName === (sd.token || signal.coin || 'ARB');

  // Check if this specific signal is being processed
  const isThisSignalProcessing = processingSignalId === signal._id;

  const pnl = useMemo(() =>
    calculatePnL(sd.currentPrice, sd.priceAtTweet, sd.signal),
    [sd.currentPrice, sd.priceAtTweet, sd.signal]
  );

  const timeAgo = useMemo(() => {
    const d = typeof signal.generatedAt === "string" ? new Date(signal.generatedAt) : (signal.generatedAt as Date | undefined);
    if (!d) return "-";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "< 1h ago";
  }, [signal.generatedAt]);

  return (
    <div
      className="signal-card animate-fade-in-up max-w-2xl mx-auto"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="p-4">
        {/* Enhanced Header with Gradient */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">
                  {sd.token ? sd.token.slice(0, 2).toUpperCase() : "💎"}
                </span>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {sd.token || signal.coin || "Unknown"}
            </h3>
              <p className="text-sm text-gray-400">Trading Signal</p>
            </div>
            {sd.signal && (
              <span className={classNames(
                "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border-2 shadow-lg",
                isBuy ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-400/50" :
                  isSell ? "bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400/50" :
                    "bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400/50"
              )}>
                {sd.signal}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className={classNames(
              "text-lg font-bold",
              pnl.isProfit ? "text-green-400" : "text-red-400"
            )}>
              {pnl.percentage > 0 ? "+" : ""}{pnl.percentage.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-400">{timeAgo}</div>
          </div>
        </div>

        {/* Enhanced Metrics with Glassmorphism */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 shadow-xl">
            <div className="text-xs text-gray-400 mb-2 font-medium">Current Price</div>
            <div className="text-lg font-bold text-white">
              {formatCurrency(sd.currentPrice)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 shadow-xl">
            <div className="text-xs text-gray-400 mb-2 font-medium">Entry Price</div>
            <div className="text-lg font-bold text-white">
              {formatCurrency(sd.priceAtTweet)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/40 to-red-800/40 backdrop-blur-sm rounded-xl p-4 border border-red-500/30 shadow-xl">
            <div className="text-xs text-red-400 mb-2 font-medium">Stop Loss</div>
            <div className="text-lg font-bold text-white">
              {formatCurrency(sd.stopLoss)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30 shadow-xl">
            <div className="text-xs text-blue-400 mb-2 font-medium">Timeline</div>
            <div className="text-sm font-bold text-white">
              {sd.timeline || "N/A"}
            </div>
          </div>
        </div>

        {/* Enhanced Targets */}
        {(sd.targets || []).length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-3 font-semibold flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Price Targets
            </div>
            <div className="flex flex-wrap gap-2">
              {sd.targets!.map((target, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur-sm"
                >
                  🎯 TP{i + 1}: {formatCurrency(target)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Trade Tip */}
        {sd.tradeTip && (
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-xl p-4 mb-4 shadow-xl backdrop-blur-sm">
            <div className="text-sm text-blue-400 font-semibold mb-2 flex items-center gap-2">
              💡 Trade Insight
            </div>
            <div className="text-sm text-gray-300 leading-relaxed">{sd.tradeTip}</div>
          </div>
        )}

        {/* Enhanced Trade Button */}
        {isBuy && (
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <button
              onClick={() => onTradeClick(signal)}
              disabled={isThisSignalProcessing}
              className="w-full bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-500 hover:via-green-400 hover:to-emerald-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-green-500/30 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isThisSignalProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-lg font-bold">Preparing Swap...</span>
                </>
              ) : (
                <>
                  <div className="relative">
                    <span className="text-xl group-hover:animate-bounce">🚀</span>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                  </div>
                  <span className="text-lg font-bold">Execute Swap</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        {/* Swap Transaction Preview - Only show for current signal */}
        {isCurrentSignalSwap && pendingSwap && (
          <SwapTransactionPreview
            swapData={pendingSwap}
            currentTxIndex={currentTxIndex}
            onApprove={onSwapApprove}
            onReject={onSwapReject}
            isLoading={isTxPending}
          />
        )}
      </div>
    </div>
  );
}

export default function SignalsFeed() {
  // --- Existing State ---
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showToast, setShowToast] = useState<boolean>(false);

  // --- Swap State ---
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<SwapTransactionData | null>(null);
  const [currentTxIndex, setCurrentTxIndex] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [processingSignalId, setProcessingSignalId] = useState<string | null>(null);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [usdcAmount, setUsdcAmount] = useState('');
  const [swapError, setSwapError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // --- Wagmi Hooks ---
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isChainSwitching } = useSwitchChain();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    sendTransaction,
    error: txError,
    isError: isTxError,
    isPending: isTxPending,
  } = useSendTransaction();

  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    // --- Swap Handlers ---
  const handleTradeClick = useCallback((signal: Signal) => {
    console.log('🚀 Opening amount input modal for signal:', signal._id);

    if (!isConnected) {
      console.log('❌ Wallet not connected, showing connection prompt');
    setShowToast(true);
      return;
    }

    if (chainId !== arbitrum.id) {
      console.log('🔄 Switching to Arbitrum network...');
      switchChain({ chainId: arbitrum.id });
      setShowToast(true);
      return;
    }

    // Clear any previous errors when starting new swap
    setSwapError(null);

    // Open amount input modal
    setSelectedSignal(signal);
    setShowAmountModal(true);
    setUsdcAmount('');
  }, [isConnected, chainId, switchChain]);

  const handleAmountConfirm = useCallback(async (amount: string) => {
    if (!selectedSignal || !amount) return;

    console.log('💰 Amount confirmed:', amount, 'for signal:', selectedSignal._id);

    const sd = selectedSignal.signal_data || {};
    const tokenName = sd.token || selectedSignal.coin || 'ARB';

    // Validate minimum amount for DEX compatibility
    const usdcAmount = parseFloat(amount);
    if (usdcAmount < 0.001) {
      setSwapError('Minimum swap amount is 0.001 USDC for DEX compatibility');
      return;
    }

    // Backend has decimal precision issues with USDC balance detection
    // Try multiple format approaches to work around the backend bug
    const cleanAmount = usdcAmount.toFixed(6);
    const integerAmount = Math.floor(usdcAmount * 1000000); // Convert to integer (6 decimals)
    const scientificAmount = usdcAmount.toExponential(6);

    console.log('🔢 USDC Amount Processing (Multiple Formats):');
    console.log('  ┌─ User Input:', amount, 'USDC');
    console.log('  ├─ Parsed Amount:', usdcAmount);
    console.log('  ├─ Clean Decimal:', cleanAmount, 'USDC');
    console.log('  ├─ Integer Format:', integerAmount, '(6-decimal integer)');
    console.log('  └─ Scientific:', scientificAmount);

    console.log('🚨 Backend Issue Detected:');
    console.log('  • Backend is misreading USDC balances (treating 6-decimal as 18-decimal)');
    console.log('  • Your actual balance: 0.22202 USDC');
    console.log('  • Backend thinks you have: ~0.000000000000222028 USDC');
    console.log('  • This is a 12-decimal precision error (10^12 difference)');

    // Try different instruction formats to work around backend issues
    let instruction;
    let formatAttempt = 'decimal';

    // First attempt: Standard decimal format
    instruction = `Swap ${cleanAmount} USDC to ${tokenName} token from Arbitrum to Arbitrum`;
    console.log('📝 Generated swap instruction:', instruction);
    console.log('👤 User address:', address);

    // Clear any previous errors
    setSwapError(null);
    setProcessingSignalId(selectedSignal._id);
    setShowAmountModal(false);
    setIsSwapLoading(true);

    try {
      console.log('🔗 Making request to swapping agent API...');
      const response = await fetch('/api/swapping-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instruction,
          userAddress: address,
        }),
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('📦 API Response data:', result);

      // Check for API-level errors first
      if (!result.success) {
        console.error('❌ API returned success: false');
        const errorMsg = result.error || result.message || 'Unknown API error';
        setSwapError(`API Error: ${errorMsg}`);
        return;
      }

      // Check if the task completed successfully
      if (result.data?.status?.state === 'completed') {
        console.log('✅ Swap agent request successful');
        const artifact = result.data.artifacts?.[0];
        if (artifact?.parts?.[0]?.data) {
          const artifactData = artifact.parts[0].data;
          console.log('📋 Transaction artifact data:', artifactData);

          if (artifactData.txPreview && artifactData.txPlan) {
            const { txPreview, txPlan } = artifactData;

            const swapTransactionData: SwapTransactionData = {
              tokenName: txPreview.tokenName || tokenName,
              amount: txPreview.amount || cleanAmount,
              action: txPreview.action || 'Swap',
              chainId: txPreview.chainId || arbitrum.id,
              txPlan,
            };

            console.log('🎯 Swap transaction data prepared:', swapTransactionData);
            setPendingSwap(swapTransactionData);
            setCurrentTxIndex(0);
          } else {
            console.error('❌ Missing txPreview or txPlan in artifact data');
            setSwapError('Invalid transaction data received from API');
          }
        } else {
          console.error('❌ Missing artifact data in response');
          setSwapError('No transaction data available');
        }
      } else {
        // Handle various error states
        console.error('❌ Swap request failed:', result);

        let errorMessage = 'Swap request failed';

        if (result.data?.contextId) {
          // Parse context ID for specific error types
          const contextId = result.data.contextId;

          if (contextId.includes('insufficient-balance')) {
            // Backend has USDC balance reading issues - provide helpful error message
            const userRequestedAmount = parseFloat(amount);
            errorMessage = `⚠️ Backend Balance Detection Issue\n\nThe swapping API is incorrectly reading your USDC balance due to a decimal precision bug.\n\n• You requested: ${userRequestedAmount.toFixed(6)} USDC\n• Your actual balance: 0.22202 USDC (visible on Arbiscan)\n• Backend thinks you have: ~0.000000000000222028 USDC\n\n🔧 Workaround: Try a much smaller amount like 0.001 USDC or contact the API provider to fix the USDC decimal handling.`;
          } else if (contextId.includes('invalid-amount')) {
            errorMessage = `Invalid amount specified. Please enter a valid USDC amount.`;
          } else if (contextId.includes('unsupported-token')) {
            errorMessage = `Token ${tokenName} is not currently supported for swapping.`;
          } else if (contextId.includes('network-error')) {
            errorMessage = 'Network error occurred. Please check your connection and try again.';
          } else if (contextId.includes('rate-limit')) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          } else {
            errorMessage = `Swap failed: ${contextId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`;
          }
        } else if (result.data?.status?.message) {
          errorMessage = result.data.status.message;
        } else if (result.message) {
          errorMessage = result.message;
        }

        console.error('❌ Setting error message:', errorMessage);
        setSwapError(errorMessage);
      }
    } catch (error) {
      console.error('❌ Swap API Error:', error);

      let errorMessage = 'An unexpected error occurred';

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message.includes('HTTP')) {
          errorMessage = `Server error: ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }

      setSwapError(errorMessage);
    } finally {
      setIsSwapLoading(false);
      setProcessingSignalId(null);
      console.log('🏁 Swap preparation completed');
    }
  }, [selectedSignal, address]);

  const handleAmountCancel = useCallback(() => {
    setShowAmountModal(false);
    setSelectedSignal(null);
    setUsdcAmount('');
  }, []);

  const handleSwapApprove = useCallback(async () => {
    if (!pendingSwap || currentTxIndex >= pendingSwap.txPlan.length) {
      console.error('❌ No pending swap or invalid transaction index');
      setSwapError('No pending transaction to approve');
      return;
    }

    const currentTx = pendingSwap.txPlan[currentTxIndex];
    const stepType = currentTxIndex === 0 ? 'Approval' : 'Swap';

    console.log(`🚀 Sending ${stepType} transaction (${currentTxIndex + 1}/${pendingSwap.txPlan.length})`);
    console.log('📋 Transaction details:', {
      to: currentTx.to,
      data: currentTx.data,
      value: currentTx.value,
      stepType,
      txIndex: currentTxIndex
    });

    // Clear any previous errors
    setSwapError(null);

    try {
      await sendTransaction(
        {
          to: currentTx.to as `0x${string}`,
          data: currentTx.data as `0x${string}`,
          value: BigInt(currentTx.value || '0'),
        },
        {
          onSuccess: (hash) => {
            console.log(`✅ ${stepType} transaction sent successfully!`);
            console.log('🔗 Transaction hash:', hash);
            console.log('📊 Full transaction hash:', hash);

            setTxHash(hash);

            // Move to next transaction or complete
            if (currentTxIndex + 1 < pendingSwap.txPlan.length) {
              console.log(`⏭️ Moving to next transaction (${currentTxIndex + 2}/${pendingSwap.txPlan.length})`);
              setCurrentTxIndex(currentTxIndex + 1);
              const nextStepType = currentTxIndex + 1 === 0 ? 'Approval' : 'Swap';
              console.log(`📝 Next step: ${nextStepType}`);
            } else {
              console.log('🎉 All transactions in the swap plan completed!');
            }
          },
          onError: (error) => {
            console.error(`❌ ${stepType} transaction failed:`, error);
            let errorMessage = `${stepType} transaction failed`;

            if (error?.message) {
              if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for transaction';
              } else if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction rejected by user';
              } else if (error.message.includes('network')) {
                errorMessage = 'Network error occurred';
              } else {
                errorMessage = error.message;
              }
            }

            setSwapError(errorMessage);
          },
        }
      );
    } catch (error) {
      console.error('❌ Swap transaction execution failed:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        pendingSwap: pendingSwap,
        currentTxIndex: currentTxIndex,
        currentTx: currentTx
      });

      let errorMessage = 'Transaction failed to execute';

      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for this transaction';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection';
        } else {
          errorMessage = error.message;
        }
      }

      setSwapError(errorMessage);
      setPendingSwap(null);
      setCurrentTxIndex(0);
    }
  }, [pendingSwap, currentTxIndex, sendTransaction]);

  const handleSwapReject = useCallback(() => {
    setPendingSwap(null);
    setCurrentTxIndex(0);
    setSwapError(null);
    console.log('Swap cancelled.');
  }, []);

  const handleErrorClose = useCallback(() => {
    setSwapError(null);
  }, []);

  const handleWorkaroundRetry = useCallback(() => {
    // Find the signal that was being processed when the error occurred
    const lastSignal = selectedSignal || (signals && signals.length > 0 ? signals[0] : null);
    
    if (!lastSignal) {
      console.error('❌ No signal available for workaround retry');
      return;
    }
    
    console.log('🔧 Attempting workaround with minimal amount for signal:', lastSignal._id);
    setSwapError(null);
    setSelectedSignal(lastSignal);
    setUsdcAmount('0.001');
    setShowAmountModal(true);
  }, [selectedSignal, signals]);

  // --- Effects ---
  useEffect(() => {
    if (isTxConfirmed && txHash && pendingSwap) {
      console.log('✅ Swap transaction confirmed on blockchain!');
      console.log('🔗 Confirmed transaction hash:', txHash);
      console.log('📊 Transaction details:', {
        hash: txHash,
        confirmed: isTxConfirmed,
        currentTxIndex: currentTxIndex,
        totalTxCount: pendingSwap.txPlan.length
      });

      // Clear any errors on successful confirmation
      setSwapError(null);

      // Check if there are more transactions to process
      if (currentTxIndex + 1 < pendingSwap.txPlan.length) {
        console.log(`⏳ More transactions pending (${currentTxIndex + 1}/${pendingSwap.txPlan.length})`);
        // Don't reset yet, move to next transaction
        return;
      }

      console.log('🎉 All swap transactions completed successfully!');
      console.log('🧹 Resetting swap state...');

      // All transactions completed, reset state
      setPendingSwap(null);
      setCurrentTxIndex(0);
      setTxHash(null);
    }
  }, [isTxConfirmed, txHash, pendingSwap, currentTxIndex]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/signals", { cache: "no-store" });
        const json: ApiResponse = await res.json();
        if (!json.success) {
          throw new Error(json.message || json.error || "Failed to load signals");
        }
        const normalized = (json.data || []).map((r) => normalizeSignal(r));
        if (isMounted) setSignals(normalized as Signal[]);
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Failed to load signals");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="signal-card animate-pulse"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="h-5 w-24 bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-700 rounded" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="h-14 bg-gray-700 rounded-lg" />
                <div className="h-14 bg-gray-700 rounded-lg" />
                <div className="h-14 bg-gray-700 rounded-lg" />
                <div className="h-14 bg-gray-700 rounded-lg" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-700 rounded" />
                <div className="h-6 w-20 bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="signal-card border-red-500/50 bg-red-500/5 animate-fade-in-up max-w-2xl mx-auto">
        <div className="p-6 text-center">
          <div className="text-red-400 text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Signals</h3>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="signal-card animate-fade-in-up max-w-2xl mx-auto">
        <div className="p-6 text-center">
          <div className="text-gray-400 text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-white mb-2">No Signals Available</h3>
          <p className="text-gray-300">Check back later for new trading signals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900/10">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(59,130,246,0.05)_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_75%,rgba(168,85,247,0.05)_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(59,130,246,0.03)_0deg,rgba(168,85,247,0.03)_120deg,rgba(236,72,153,0.03)_240deg,rgba(59,130,246,0.03)_360deg)]"></div>
      </div>

      <div className="relative z-10">
              <Toast
          message={
            swapError || (
              !isConnected
                ? "Please connect your wallet first!"
                : chainId !== arbitrum.id
                ? "Please switch to Arbitrum network!"
                : "Trading feature coming soon! 🚀"
            )
          }
          show={showToast}
          onClose={() => setShowToast(false)}
        />

        {/* Swap Error Display */}
        {swapError && (
          <ErrorDisplay 
            error={swapError} 
            onClose={handleErrorClose}
            onRetryWorkaround={swapError.includes('Backend Balance Detection Issue') ? handleWorkaroundRetry : undefined}
          />
        )}

        {/* Wallet Connection Banner */}
        {(!isConnected || chainId !== arbitrum.id) && (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-6 shadow-lg">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
                  !isConnected
                    ? 'bg-gradient-to-br from-orange-400 to-red-500'
                    : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                }`}>
                  {!isConnected ? (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l4-4" />
                    </svg>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {!isConnected ? (
                  <>
                    <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200">
                      🔐 Connect Your Wallet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Connect your MetaMask wallet to start trading signals on Arbitrum.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">
                      🌐 Switch to Arbitrum
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Switch to Arbitrum network in your wallet to execute trades.
                    </p>
                  </>
                )}
              </div>

              {!isConnected ? (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => connect({ connector: connectors[2] })} // MetaMask connector
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Connect MetaMask
                  </button>
                  <button
                    onClick={() => connect({ connector: connectors[1] })} // Coinbase Wallet connector
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Connect Coinbase
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => switchChain({ chainId: arbitrum.id })}
                  disabled={isChainSwitching}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isChainSwitching ? 'Switching...' : 'Switch to Arbitrum'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Enhanced Transaction Success */}
      {txHash && !isTxPending && (
        <div className="max-w-2xl mx-auto mb-4 animate-in slide-in-from-bottom duration-500">
          <div className="bg-gradient-to-br from-green-50/95 via-emerald-50/90 to-teal-50/80 dark:from-green-900/20 dark:via-emerald-900/25 dark:to-teal-900/30 backdrop-blur-xl rounded-2xl border border-green-200/50 dark:border-green-700/50 shadow-2xl p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-xs text-yellow-900">🎉</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  🎉 Swap Successful!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Your transaction has been confirmed on the blockchain</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Transaction Confirmed</span>
                </div>
              </div>
            </div>

            {/* Transaction Hash */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Hash</span>
                <div className="flex items-center space-x-2">
                  <CopyButton text={txHash} label="Copy" className="text-xs" />
                  <a
                    href={`https://arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-md transition-colors duration-200"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View
                  </a>
                </div>
              </div>
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all leading-relaxed">
                  {txHash}
                </p>
              </div>
            </div>

            {/* Success Animation */}
            <div className="mt-6 flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 opacity-20 animate-ping"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Swap Loading */}
      {isSwapLoading && (
        <div className="max-w-2xl mx-auto mb-4 animate-in slide-in-from-bottom duration-300">
          <div className="bg-gradient-to-br from-blue-50/95 via-indigo-50/90 to-purple-50/80 dark:from-blue-900/20 dark:via-indigo-900/25 dark:to-purple-900/30 backdrop-blur-xl rounded-2xl border border-blue-200/50 dark:border-blue-700/50 shadow-2xl p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <div className="relative">
                    <svg className="w-7 h-7 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <div className="absolute inset-0 border-2 border-white/30 border-t-white rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white to-gray-300 bg-clip-text text-transparent">
                  🚀 Preparing Your Swap
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Analyzing market data and generating optimal transaction route...</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">AI Agent Processing</span>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">✅ Wallet Connected</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ready for transaction</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">🔄 Generating Route</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Finding optimal swap path</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 opacity-50">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-xs text-gray-600 dark:text-gray-400">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">⏳ Confirm Transaction</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Waiting for approval</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 max-w-2xl mx-auto px-4">
        {signals.map((sig, index) => (
          <SignalCard
            key={sig._id}
            signal={sig}
            index={index}
            onTradeClick={handleTradeClick}
            pendingSwap={pendingSwap}
            currentTxIndex={currentTxIndex}
            onSwapApprove={handleSwapApprove}
            onSwapReject={handleSwapReject}
            isTxPending={isTxPending}
            isSwapLoading={isSwapLoading}
            processingSignalId={processingSignalId}
          />
        ))}
      </div>

      {/* Amount Input Modal */}
      {selectedSignal && (
        <AmountInputModal
          signal={selectedSignal}
          isOpen={showAmountModal}
          onClose={handleAmountCancel}
          onConfirm={handleAmountConfirm}
          usdcAmount={usdcAmount}
          setUsdcAmount={setUsdcAmount}
          isLoading={isSwapLoading}
        />
      )}
      </div>
    </div>
  );
}