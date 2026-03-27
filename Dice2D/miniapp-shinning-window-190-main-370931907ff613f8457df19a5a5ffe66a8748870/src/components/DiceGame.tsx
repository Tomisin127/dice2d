'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSendTransaction, isApiError } from '@/app/types/api';
import { Sparkles } from 'lucide-react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // USDC on Base
const CREATOR_WALLET = '0xb3C18Ab6d6e1B3591a5F471649A89C84e99fbDb5'; // Your wallet
const ROLL_COST = parseUnits('0.00001', 6); // 0.00001 USDC (6 decimals)

// Grid dimensions - 4x4 = 16 tiles
const GRID_ROWS = 4;
const GRID_COLS = 4;
const TOTAL_TILES = GRID_ROWS * GRID_COLS;

export function DiceGame() {
  const { address, isConnected } = useAccount();
  const [diceValue, setDiceValue] = useState<DiceValue>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [successfulRolls, setSuccessfulRolls] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [lastRoll, setLastRoll] = useState<DiceValue | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [showWinMessage, setShowWinMessage] = useState(false);

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: hash, sendTransaction, isPending: isSending, error: sendError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch random image on mount and when resetting
  const fetchRandomImage = useCallback(async () => {
    setIsLoadingImage(true);
    try {
      const response = await fetch('/api/random-image');
      const data = await response.json();
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
      }
    } catch (error) {
      console.error('Failed to fetch random image:', error);
    } finally {
      setIsLoadingImage(false);
    }
  }, []);

  // Load initial image
  useEffect(() => {
    fetchRandomImage();
  }, [fetchRandomImage]);

  // Check for win condition
  useEffect(() => {
    if (revealedTiles.size === TOTAL_TILES && !showWinMessage) {
      setShowWinMessage(true);
      // Wait 2 seconds, then reset with new image
      setTimeout(() => {
        setShowWinMessage(false);
        setRevealedTiles(new Set());
        setTotalRolls(0);
        setSuccessfulRolls(0);
        setLastRoll(null);
        setShowResult(false);
        fetchRandomImage();
      }, 2000);
    }
  }, [revealedTiles.size, showWinMessage, fetchRandomImage]);

  // Sound effects using Web Audio API
  const playSound = useCallback((type: 'roll' | 'success' | 'fail' | 'win') => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'roll') {
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } else if (type === 'success') {
      [400, 500, 600].forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.3);
        osc.start(audioContext.currentTime + i * 0.1);
        osc.stop(audioContext.currentTime + i * 0.1 + 0.3);
      });
    } else if (type === 'win') {
      [500, 600, 700, 800].forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.5);
        osc.start(audioContext.currentTime + i * 0.15);
        osc.stop(audioContext.currentTime + i * 0.15 + 0.5);
      });
    } else {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  }, []);

  // Roll dice
  const rollDice = useCallback(async () => {
    if (!isConnected || isRolling || isSending || isConfirming) return;

    setIsRolling(true);
    setShowResult(false);
    playSound('roll');

    // Build transaction
    const sendCall = buildSendTransaction({
      recipientAddress: CREATOR_WALLET as `0x${string}`,
      tokenAddress: USDC_ADDRESS as `0x${string}`,
      amount: ROLL_COST,
    });

    if (isApiError(sendCall)) {
      console.error('Failed to build transaction:', sendCall.message);
      setIsRolling(false);
      return;
    }

    // Send transaction
    try {
      sendTransaction({
        to: sendCall.to,
        data: sendCall.data,
        value: sendCall.value || 0n,
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      setIsRolling(false);
    }
  }, [isConnected, isRolling, isSending, isConfirming, playSound, sendTransaction]);

  // Handle transaction confirmation - FIX: Remove dependencies that cause re-renders
  useEffect(() => {
    if (isConfirmed && isRolling) {
      // Animate dice roll
      let rollCount = 0;
      rollIntervalRef.current = setInterval(() => {
        setDiceValue((Math.floor(Math.random() * 6) + 1) as DiceValue);
        rollCount++;
        if (rollCount >= 10) {
          if (rollIntervalRef.current) {
            clearInterval(rollIntervalRef.current);
          }
          // Final roll
          const finalValue = (Math.floor(Math.random() * 6) + 1) as DiceValue;
          setDiceValue(finalValue);
          setLastRoll(finalValue);
          setTotalRolls((prev) => prev + 1);

          // Check result and update tiles
          if (finalValue >= 3) {
            setSuccessfulRolls((prev) => prev + 1);
            // Reveal a random hidden tile
            setRevealedTiles((prevRevealed) => {
              const hiddenTiles = Array.from({ length: TOTAL_TILES }, (_, i) => i).filter(
                (i) => !prevRevealed.has(i)
              );
              if (hiddenTiles.length > 0) {
                const randomTile = hiddenTiles[Math.floor(Math.random() * hiddenTiles.length)];
                const newSet = new Set(prevRevealed);
                newSet.add(randomTile);
                return newSet;
              }
              return prevRevealed;
            });
            playSound('success');
          } else {
            // Hide a random revealed tile
            setRevealedTiles((prevRevealed) => {
              const revealed = Array.from(prevRevealed);
              if (revealed.length > 0) {
                const randomTile = revealed[Math.floor(Math.random() * revealed.length)];
                const newSet = new Set(prevRevealed);
                newSet.delete(randomTile);
                return newSet;
              }
              return prevRevealed;
            });
            playSound('fail');
          }

          setShowResult(true);
          setIsRolling(false);
        }
      }, 100);

      return () => {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
        }
      };
    }
  }, [isConfirmed, isRolling, playSound]);

  const revealPercentage = Math.round((revealedTiles.size / TOTAL_TILES) * 100);

  return (
    <div className="min-h-screen bg-teal-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-teal-400 rounded-full opacity-20"
            initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%` }}
            animate={{
              x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              y: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Hidden Image Reveal Area */}
      <div className="mb-6 z-20">
        <div
          className="relative bg-teal-900 rounded-lg overflow-hidden shadow-2xl border-4 border-teal-700"
          style={{ width: '320px', height: '320px', maxWidth: '90vw', maxHeight: '90vw' }}
        >
          {/* Background Image (hidden behind tiles) */}
          <div className="absolute inset-0">
            {isLoadingImage ? (
              <div className="w-full h-full flex items-center justify-center bg-teal-800">
                <p className="text-teal-300">Loading image...</p>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt="Hidden artwork"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            )}
          </div>

          {/* Grid of tiles (covers the image) - 4x4 */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
            {Array.from({ length: TOTAL_TILES }).map((_, index) => (
              <AnimatePresence key={index}>
                {!revealedTiles.has(index) && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.4 }}
                    className="bg-teal-800 border border-teal-700"
                  />
                )}
              </AnimatePresence>
            ))}
          </div>

          {/* Win Message Overlay */}
          <AnimatePresence>
            {showWinMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onAnimateComplete={() => {
                  playSound('win');
                }}
              >
                <div className="text-center">
                  <p className="text-5xl mb-2">🎉</p>
                  <p className="text-3xl font-bold text-amber-400">You Won!</p>
                  <p className="text-teal-300 mt-2">Loading new image...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Progress bar */}
        <div className="mt-3 bg-teal-900 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${revealPercentage}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-center text-teal-300 text-sm mt-1 font-semibold">
          {revealPercentage}% Revealed
        </p>
      </div>

      {/* Main Game Card */}
      <Card className="w-full max-w-md bg-teal-900 backdrop-blur-lg border-teal-700 z-20">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-white flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-amber-400" />
            Dice2D
            <Sparkles className="w-8 h-8 text-amber-400" />
          </CardTitle>
          <p className="text-center text-white/80 text-sm mt-2">
            Roll the dice to reveal the hidden artwork! Each roll costs 0.00001 USDC.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-teal-800 rounded-lg p-3">
              <p className="text-teal-300 text-xs">Total Rolls</p>
              <p className="text-2xl font-bold text-white">{totalRolls}</p>
            </div>
            <div className="bg-teal-800 rounded-lg p-3">
              <p className="text-teal-300 text-xs">Successful</p>
              <p className="text-2xl font-bold text-amber-400">{successfulRolls}</p>
            </div>
            <div className="bg-teal-800 rounded-lg p-3">
              <p className="text-teal-300 text-xs">Tiles Shown</p>
              <p className="text-2xl font-bold text-cyan-400">{revealedTiles.size}/{TOTAL_TILES}</p>
            </div>
          </div>

          {/* Dice Display */}
          <div className="flex justify-center">
            <motion.div
              className="w-24 h-24 bg-white rounded-2xl shadow-2xl flex items-center justify-center"
              animate={{
                rotateX: isRolling ? [0, 360] : 0,
                rotateY: isRolling ? [0, 360] : 0,
              }}
              transition={{ duration: 0.6, repeat: isRolling ? Infinity : 0 }}
            >
              <span className="text-6xl font-bold text-teal-900">{diceValue}</span>
            </motion.div>
          </div>

          {/* Result Message */}
          <AnimatePresence>
            {showResult && lastRoll && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center p-3 rounded-lg ${
                  lastRoll >= 3
                    ? 'bg-teal-800 text-amber-300'
                    : 'bg-teal-800 text-red-300'
                }`}
              >
                {lastRoll >= 3 ? (
                  <p className="font-semibold">🎨 Success! A piece revealed! ✨</p>
                ) : (
                  <p className="font-semibold">💫 A piece got hidden again...</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wallet Connection / Roll Button */}
          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectWallet />
            </div>
          ) : (
            <Button
              onClick={rollDice}
              disabled={isRolling || isSending || isConfirming || showWinMessage}
              className="w-full h-14 text-lg font-bold bg-teal-600 hover:bg-teal-500 text-white"
            >
              {isSending || isConfirming
                ? '🎲 Processing...'
                : isRolling
                ? '🎲 Rolling...'
                : '🎲 Roll Dice (0.00001 USDC)'}
            </Button>
          )}

          {/* Transaction Error */}
          {sendError && (
            <p className="text-red-400 text-sm text-center">
              Transaction failed: {sendError.message}
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
