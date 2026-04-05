'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, Loader2, ExternalLink, Coins, RefreshCw } from 'lucide-react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, formatUnits, parseUnits, encodeFunctionData, createPublicClient, http, fallback } from 'viem';
import { base } from 'wagmi/chains';
import { toast } from 'sonner';

// Dice2D Token Contract on Base
const TOKEN_ADDRESS = '0xc9837e852a3caa56ee4573091327e70ae1764604' as const;
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;
const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as const;
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as const;

const BASE_RPC_URLS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base',
  'https://base.drpc.org',
];

const POOL_FEES = [10000, 3000, 500, 100] as const;

// ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

const QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'deadline', type: 'uint256' },
      { name: 'data', type: 'bytes[]' },
    ],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
  {
    name: 'unwrapWETH9',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(BASE_RPC_URLS.map((url) => http(url))),
});

interface SwapModalProps {
  onSwapSuccess?: () => void;
}

export function SwapModal({ onSwapSuccess }: SwapModalProps) {
  const { address, isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [ethBalance, setEthBalance] = useState<bigint>(BigInt(0));
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  const [slippage, setSlippage] = useState(5);
  const [bestFee, setBestFee] = useState<number>(3000);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { sendTransactionAsync } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!address) return;

    try {
      const [ethBal, tokenBal] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);

      setEthBalance(ethBal);
      setTokenBalance(tokenBal);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [address]);

  // Check approval
  const checkApproval = useCallback(async () => {
    if (!address || isBuying || !inputAmount) {
      setNeedsApproval(false);
      return;
    }

    try {
      const allowance = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, UNISWAP_V3_ROUTER],
      });

      const amountIn = parseUnits(inputAmount, 18);
      setNeedsApproval(allowance < amountIn);
    } catch (error) {
      console.error('Error checking approval:', error);
    }
  }, [address, isBuying, inputAmount]);

  // Get quote
  const getQuote = useCallback(async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount('');
      return;
    }

    setIsQuoting(true);

    try {
      const amountIn = parseUnits(inputAmount, 18);
      const tokenIn = isBuying ? WETH_ADDRESS : TOKEN_ADDRESS;
      const tokenOut = isBuying ? TOKEN_ADDRESS : WETH_ADDRESS;

      let bestQuote = BigInt(0);
      let bestPoolFee = 3000;

      // Try all fee tiers in parallel
      const quotes = await Promise.allSettled(
        POOL_FEES.map(async (fee) => {
          const data = encodeFunctionData({
            abi: QUOTER_ABI,
            functionName: 'quoteExactInputSingle',
            args: [
              {
                tokenIn,
                tokenOut,
                amountIn,
                fee,
                sqrtPriceLimitX96: BigInt(0),
              },
            ],
          });

          const result = await publicClient.call({
            to: UNISWAP_V3_QUOTER,
            data,
          });

          if (result.data) {
            // Decode the result - first 32 bytes is amountOut
            const amountOut = BigInt('0x' + result.data.slice(2, 66));
            return { fee, amountOut };
          }
          throw new Error('No data returned');
        })
      );

      for (const result of quotes) {
        if (result.status === 'fulfilled' && result.value.amountOut > bestQuote) {
          bestQuote = result.value.amountOut;
          bestPoolFee = result.value.fee;
        }
      }

      if (bestQuote > BigInt(0)) {
        setBestFee(bestPoolFee);
        setOutputAmount(formatUnits(bestQuote, 18));
      } else {
        setOutputAmount('');
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      setOutputAmount('');
    } finally {
      setIsQuoting(false);
    }
  }, [inputAmount, isBuying]);

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      getQuote();
    }, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);

  // Fetch balances on mount and periodically
  useEffect(() => {
    if (isOpen && isConnected) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isConnected, fetchBalances]);

  // Check approval when selling
  useEffect(() => {
    checkApproval();
  }, [checkApproval]);

  // Handle confirmed transaction
  useEffect(() => {
    if (isConfirmed && txHash) {
      toast.success('Swap completed successfully!');
      fetchBalances();
      setInputAmount('');
      setOutputAmount('');
      setTxHash(undefined);
      onSwapSuccess?.();
    }
  }, [isConfirmed, txHash, fetchBalances, onSwapSuccess]);

  const handleApprove = async () => {
    if (!address) return;

    setIsApproving(true);
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [UNISWAP_V3_ROUTER, parseUnits('1000000000', 18)],
      });

      const hash = await sendTransactionAsync({
        to: TOKEN_ADDRESS,
        data,
        chainId: base.id,
      });

      setTxHash(hash);
      toast.success('Approval submitted!');
      
      // Wait a bit and recheck
      setTimeout(() => {
        checkApproval();
        setIsApproving(false);
      }, 5000);
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Approval failed');
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!address || !inputAmount || !outputAmount) return;

    setIsSwapping(true);
    try {
      const amountIn = parseUnits(inputAmount, 18);
      const amountOutMin = (parseUnits(outputAmount, 18) * BigInt(100 - slippage)) / BigInt(100);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

      let hash: `0x${string}`;

      if (isBuying) {
        // ETH -> Token
        const swapData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI,
          functionName: 'exactInputSingle',
          args: [
            {
              tokenIn: WETH_ADDRESS,
              tokenOut: TOKEN_ADDRESS,
              fee: bestFee,
              recipient: address,
              amountIn,
              amountOutMinimum: amountOutMin,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        });

        const multicallData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI,
          functionName: 'multicall',
          args: [deadline, [swapData]],
        });

        hash = await sendTransactionAsync({
          to: UNISWAP_V3_ROUTER,
          data: multicallData,
          value: amountIn,
          chainId: base.id,
        });
      } else {
        // Token -> ETH
        const swapData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI,
          functionName: 'exactInputSingle',
          args: [
            {
              tokenIn: TOKEN_ADDRESS,
              tokenOut: WETH_ADDRESS,
              fee: bestFee,
              recipient: UNISWAP_V3_ROUTER, // Send to router for unwrap
              amountIn,
              amountOutMinimum: amountOutMin,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        });

        const unwrapData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI,
          functionName: 'unwrapWETH9',
          args: [amountOutMin, address],
        });

        const multicallData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI,
          functionName: 'multicall',
          args: [deadline, [swapData, unwrapData]],
        });

        hash = await sendTransactionAsync({
          to: UNISWAP_V3_ROUTER,
          data: multicallData,
          chainId: base.id,
        });
      }

      setTxHash(hash);
      toast.success('Swap submitted!');
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMaxClick = () => {
    if (isBuying) {
      // 90% of ETH balance to reserve gas
      const maxEth = (ethBalance * BigInt(90)) / BigInt(100);
      setInputAmount(formatEther(maxEth));
    } else {
      setInputAmount(formatUnits(tokenBalance, 18));
    }
  };

  const toggleDirection = () => {
    setIsBuying(!isBuying);
    setInputAmount('');
    setOutputAmount('');
  };

  const currentBalance = isBuying ? ethBalance : tokenBalance;
  const inputSymbol = isBuying ? 'ETH' : 'DICE2D';
  const outputSymbol = isBuying ? 'DICE2D' : 'ETH';
  const hasInsufficientBalance = inputAmount
    ? parseUnits(inputAmount || '0', 18) > currentBalance
    : false;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/20 to-secondary/20 hover:from-primary/30 hover:to-secondary/30 border border-primary/40 rounded-xl text-foreground font-semibold text-sm transition-all"
        >
          <Coins className="w-4 h-4 text-primary" />
          <span>Buy $DICE2D</span>
        </motion.button>
      </SheetTrigger>

      <SheetContent side="bottom" className="bg-card border-t border-primary/30 rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Swap Tokens
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {/* Buy/Sell Toggle */}
          <div className="flex gap-2 p-1 bg-muted/30 rounded-xl">
            <button
              onClick={() => {
                setIsBuying(true);
                setInputAmount('');
                setOutputAmount('');
              }}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                isBuying
                  ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Buy DICE2D
            </button>
            <button
              onClick={() => {
                setIsBuying(false);
                setInputAmount('');
                setOutputAmount('');
              }}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                !isBuying
                  ? 'bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sell DICE2D
            </button>
          </div>

          {/* Input Token */}
          <div className="bg-muted/20 border border-border rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">You pay</span>
              <span className="text-xs text-muted-foreground">
                Balance: {parseFloat(formatUnits(currentBalance, 18)).toFixed(4)} {inputSymbol}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="flex-1 bg-transparent border-0 text-2xl font-bold focus-visible:ring-0 p-0 h-auto"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMaxClick}
                  className="text-xs text-primary hover:text-primary/80 font-semibold"
                >
                  MAX
                </button>
                <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full">
                  <div
                    className={`w-5 h-5 rounded-full ${
                      isBuying ? 'bg-blue-500' : 'bg-gradient-to-r from-primary to-secondary'
                    }`}
                  />
                  <span className="font-semibold text-sm">{inputSymbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              onClick={toggleDirection}
              className="p-2.5 bg-card border border-border rounded-xl shadow-lg hover:border-primary/50 transition-colors"
            >
              <ArrowDownUp className="w-5 h-5 text-primary" />
            </motion.button>
          </div>

          {/* Output Token */}
          <div className="bg-muted/20 border border-border rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">You receive</span>
              {isQuoting && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-2xl font-bold text-foreground">
                {outputAmount ? parseFloat(outputAmount).toFixed(6) : '0.0'}
              </div>
              <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full">
                <div
                  className={`w-5 h-5 rounded-full ${
                    !isBuying ? 'bg-blue-500' : 'bg-gradient-to-r from-primary to-secondary'
                  }`}
                />
                <span className="font-semibold text-sm">{outputSymbol}</span>
              </div>
            </div>
          </div>

          {/* Slippage Settings */}
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-muted-foreground">Slippage tolerance</span>
            <div className="flex gap-1">
              {[1, 3, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    slippage === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {hasInsufficientBalance && (
            <p className="text-sm text-destructive text-center">Insufficient {inputSymbol} balance</p>
          )}

          {/* Action Buttons */}
          {!isConnected ? (
            <Button disabled className="w-full py-6 text-lg font-bold rounded-xl">
              Connect Wallet First
            </Button>
          ) : needsApproval && !isBuying ? (
            <Button
              onClick={handleApprove}
              disabled={isApproving || isConfirming}
              className="w-full py-6 text-lg font-bold rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70"
            >
              {isApproving || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve DICE2D'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSwap}
              disabled={
                isSwapping ||
                isConfirming ||
                !inputAmount ||
                !outputAmount ||
                hasInsufficientBalance
              }
              className="w-full py-6 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              {isSwapping || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isConfirming ? 'Confirming...' : 'Swapping...'}
                </>
              ) : (
                `Swap ${inputSymbol} for ${outputSymbol}`
              )}
            </Button>
          )}

          {/* Transaction Link */}
          <AnimatePresence>
            {txHash && (
              <motion.a
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                View on BaseScan
                <ExternalLink className="w-3 h-3" />
              </motion.a>
            )}
          </AnimatePresence>

          {/* Refresh Button */}
          <button
            onClick={fetchBalances}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mx-auto"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh balances
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
