'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Trophy, Zap } from 'lucide-react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

const PAYMENT_AMOUNT = '0.01';
const TOTAL_TILES = 6;

export function DiceGame() {
  const { address, isConnected } = useAccount();
  const [diceValue, setDiceValue] = useState<DiceValue>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [successfulRolls, setSuccessfulRolls] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [lastRoll, setLastRoll] = useState<DiceValue | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const playSound = useCallback((type: 'roll' | 'success' | 'fail') => {
    // Sound effects would go here
  }, []);

  const rollDice = useCallback(async () => {
    if (!isConnected || isRolling) return;

    setIsRolling(true);
    setShowResult(false);
    setPaymentError('');
    playSound('roll');

    try {
      console.log('[v0] Starting x402 payment request');
      
      const response = await fetch('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: PAYMENT_AMOUNT,
          description: 'Dice2D Game Roll',
        }),
      });

      console.log('[v0] Payment response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('[v0] Payment failed:', errorData);
        setPaymentError(errorData.message || 'Payment failed');
        setIsRolling(false);
        playSound('fail');
        return;
      }

      const paymentData = await response.json();
      console.log('[v0] Payment successful:', paymentData);

      let rollCount = 0;
      rollIntervalRef.current = setInterval(() => {
        setDiceValue((Math.floor(Math.random() * 6) + 1) as DiceValue);
        rollCount++;
        if (rollCount >= 10) {
          if (rollIntervalRef.current) {
            clearInterval(rollIntervalRef.current);
          }
          const finalValue = (Math.floor(Math.random() * 6) + 1) as DiceValue;
          setDiceValue(finalValue);
          setLastRoll(finalValue);
          setTotalRolls((prev) => prev + 1);

          if (finalValue >= 3) {
            setSuccessfulRolls((prev) => prev + 1);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[v0] Payment request error:', errorMessage);
      setPaymentError(`Payment error: ${errorMessage}`);
      setIsRolling(false);
      playSound('fail');
    }
  }, [isConnected, isRolling, playSound]);

  useEffect(() => {
    if (revealedTiles.size === TOTAL_TILES && totalRolls > 0) {
      setShowWinMessage(true);
    }
  }, [revealedTiles, totalRolls]);

  const successRate =
    totalRolls > 0 ? Math.round((successfulRolls / totalRolls) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 md:p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <motion.div
        className="fixed -top-20 -left-20 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        animate={{ x: [0, 30, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
      />
      <motion.div
        className="fixed -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--secondary) 0%, transparent 70%)' }}
        animate={{ x: [0, -40, 0], y: [0, -50, 0] }}
        transition={{ duration: 25, repeat: Infinity }}
      />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-[var(--font-playfair)] text-5xl md:text-7xl font-bold mb-4 text-balance bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Dice 2D
          </h1>
          <p className="text-muted-foreground text-lg font-light tracking-wide">
            Test your fortune with x402 blockchain payments
          </p>
        </motion.div>

        {/* Main Game Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="bg-card/50 backdrop-blur border-primary/20 shadow-2xl overflow-hidden">
            <CardContent className="p-8 md:p-12">
              {/* Dice Display */}
              <motion.div
                animate={isRolling ? { rotateX: 360, rotateY: 360 } : { rotateX: 0, rotateY: 0 }}
                transition={{ duration: isRolling ? 0.1 : 0.3 }}
                className="flex justify-center mb-12"
              >
                <motion.div
                  className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-6xl md:text-7xl font-bold text-primary-foreground shadow-lg cursor-pointer"
                  whileHover={!isRolling ? { scale: 1.05 } : {}}
                  onClick={rollDice}
                >
                  {diceValue}
                </motion.div>
              </motion.div>

              {/* Result Message */}
              <AnimatePresence>
                {showResult && lastRoll && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`text-center mb-8 p-4 rounded-lg font-semibold text-lg ${
                      lastRoll >= 3
                        ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                        : 'bg-red-500/20 border border-red-500/50 text-red-300'
                    }`}
                  >
                    {lastRoll >= 3 ? '🎉 Success! Tile revealed!' : '❌ Unlucky! Tile hidden.'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Total Rolls</div>
                  <div className="text-3xl font-bold text-primary">{totalRolls}</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Success Rate</div>
                  <div className="text-3xl font-bold text-secondary">{successRate}%</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Tiles Revealed</div>
                  <div className="text-3xl font-bold text-accent">{revealedTiles.size}/{TOTAL_TILES}</div>
                </motion.div>
              </div>

              {/* Tiles Grid */}
              <div className="mb-8">
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: TOTAL_TILES }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={revealedTiles.has(i) ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0.3 }}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center font-bold text-xl transition-all ${
                        revealedTiles.has(i)
                          ? 'bg-gradient-to-br from-primary/30 to-secondary/30 border-primary'
                          : 'bg-muted/20 border-muted'
                      }`}
                    >
                      {revealedTiles.has(i) ? (
                        <Sparkles className="w-6 h-6 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">?</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Connection & Roll Section */}
              {!isConnected ? (
                <div className="flex justify-center">
                  <ConnectWallet />
                </div>
              ) : (
                <motion.button
                  onClick={rollDice}
                  disabled={isRolling || showWinMessage}
                  whileHover={!isRolling && !showWinMessage ? { scale: 1.02 } : {}}
                  whileTap={!isRolling && !showWinMessage ? { scale: 0.98 } : {}}
                  className="w-full py-4 px-6 bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-lg text-primary-foreground flex items-center justify-center gap-2"
                >
                  {isRolling ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                        <Zap className="w-5 h-5" />
                      </motion.div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Roll Dice (0.01 USDC)
                    </>
                  )}
                </motion.button>
              )}

              {/* Payment Error */}
              {paymentError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm text-center mt-4"
                >
                  {paymentError}
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Win Message */}
        <AnimatePresence>
          {showWinMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                className="bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm rounded-2xl p-8 md:p-12 max-w-md text-center border border-primary/50 shadow-2xl"
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h2 className="font-[var(--font-playfair)] text-4xl font-bold mb-2 text-primary">Victory!</h2>
                <p className="text-muted-foreground mb-6">
                  You&apos;ve revealed all tiles! Completed in {totalRolls} rolls.
                </p>
                <Button
                  onClick={() => {
                    setShowWinMessage(false);
                    setRevealedTiles(new Set());
                    setSuccessfulRolls(0);
                    setTotalRolls(0);
                    setLastRoll(null);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  Play Again
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-muted-foreground text-sm"
        >
          <p className="mb-2">Each roll costs 0.01 USDC and is processed via x402</p>
          <p>Roll 3 or higher to reveal tiles, lower to hide them</p>
        </motion.div>
      </div>
    </div>
  );
}

const PAYMENT_AMOUNT = '0.01';
const TOTAL_TILES = 6;

export function DiceGame() {
  const { address, isConnected } = useAccount();
  const [diceValue, setDiceValue] = useState<DiceValue>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [successfulRolls, setSuccessfulRolls] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [lastRoll, setLastRoll] = useState<DiceValue | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [paymentError, setPaymentError] = useState<string>('');

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const playSound = useCallback((type: 'roll' | 'success' | 'fail') => {
    // Sound effects would go here
  }, []);

  const rollDice = useCallback(async () => {
    if (!isConnected || isRolling) return;

    setIsRolling(true);
    setShowResult(false);
    setPaymentError('');
    playSound('roll');

    try {
      console.log('[v0] Starting x402 payment request');
      
      const response = await fetch('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: PAYMENT_AMOUNT,
          description: 'Dice2D Game Roll',
        }),
      });

      console.log('[v0] Payment response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('[v0] Payment failed:', errorData);
        setPaymentError(errorData.message || 'Payment failed');
        setIsRolling(false);
        playSound('fail');
        return;
      }

      const paymentData = await response.json();
      console.log('[v0] Payment successful:', paymentData);

      let rollCount = 0;
      rollIntervalRef.current = setInterval(() => {
        setDiceValue((Math.floor(Math.random() * 6) + 1) as DiceValue);
        rollCount++;
        if (rollCount >= 10) {
          if (rollIntervalRef.current) {
            clearInterval(rollIntervalRef.current);
          }
          const finalValue = (Math.floor(Math.random() * 6) + 1) as DiceValue;
          setDiceValue(finalValue);
          setLastRoll(finalValue);
          setTotalRolls((prev) => prev + 1);

          if (finalValue >= 3) {
            setSuccessfulRolls((prev) => prev + 1);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[v0] Payment request error:', errorMessage);
      setPaymentError(`Payment error: ${errorMessage}`);
      setIsRolling(false);
      playSound('fail');
    }
  }, [isConnected, isRolling, playSound]);

  useEffect(() => {
    if (revealedTiles.size === TOTAL_TILES && totalRolls > 0) {
      setShowWinMessage(true);
    }
  }, [revealedTiles, totalRolls]);

  const successRate =
    totalRolls > 0 ? Math.round((successfulRolls / totalRolls) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 md:p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <motion.div
        className="fixed -top-20 -left-20 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }}
        animate={{ x: [0, 30, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
      />
      <motion.div
        className="fixed -bottom-20 -right-20 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--secondary) 0%, transparent 70%)' }}
        animate={{ x: [0, -40, 0], y: [0, -50, 0] }}
        transition={{ duration: 25, repeat: Infinity }}
      />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-[var(--font-playfair)] text-5xl md:text-7xl font-bold mb-4 text-balance bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Dice 2D
          </h1>
          <p className="text-muted-foreground text-lg font-light tracking-wide">
            Test your fortune with x402 blockchain payments
          </p>
        </motion.div>

        {/* Main Game Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="bg-card/50 backdrop-blur border-primary/20 shadow-2xl overflow-hidden">
            <CardContent className="p-8 md:p-12">
              {/* Dice Display */}
              <motion.div
                animate={isRolling ? { rotateX: 360, rotateY: 360 } : { rotateX: 0, rotateY: 0 }}
                transition={{ duration: isRolling ? 0.1 : 0.3 }}
                className="flex justify-center mb-12"
              >
                <motion.div
                  className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-6xl md:text-7xl font-bold text-primary-foreground shadow-lg cursor-pointer"
                  whileHover={!isRolling ? { scale: 1.05 } : {}}
                  onClick={rollDice}
                >
                  {diceValue}
                </motion.div>
              </motion.div>

              {/* Result Message */}
              <AnimatePresence>
                {showResult && lastRoll && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`text-center mb-8 p-4 rounded-lg font-semibold text-lg ${
                      lastRoll >= 3
                        ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                        : 'bg-red-500/20 border border-red-500/50 text-red-300'
                    }`}
                  >
                    {lastRoll >= 3 ? '🎉 Success! Tile revealed!' : '❌ Unlucky! Tile hidden.'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Total Rolls</div>
                  <div className="text-3xl font-bold text-primary">{totalRolls}</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Success Rate</div>
                  <div className="text-3xl font-bold text-secondary">{successRate}%</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-muted/30 border border-primary/20 rounded-lg p-4 text-center"
                >
                  <div className="text-muted-foreground text-sm font-light mb-2">Tiles Revealed</div>
                  <div className="text-3xl font-bold text-accent">{revealedTiles.size}/{TOTAL_TILES}</div>
                </motion.div>
              </div>

              {/* Tiles Grid */}
              <div className="mb-8">
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: TOTAL_TILES }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={revealedTiles.has(i) ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0.3 }}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center font-bold text-xl transition-all ${
                        revealedTiles.has(i)
                          ? 'bg-gradient-to-br from-primary/30 to-secondary/30 border-primary'
                          : 'bg-muted/20 border-muted'
                      }`}
                    >
                      {revealedTiles.has(i) ? (
                        <Sparkles className="w-6 h-6 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">?</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Connection & Roll Section */}
              {!isConnected ? (
                <div className="flex justify-center">
                  <ConnectWallet />
                </div>
              ) : (
                <motion.button
                  onClick={rollDice}
                  disabled={isRolling || showWinMessage}
                  whileHover={!isRolling && !showWinMessage ? { scale: 1.02 } : {}}
                  whileTap={!isRolling && !showWinMessage ? { scale: 0.98 } : {}}
                  className="w-full py-4 px-6 bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-lg text-primary-foreground flex items-center justify-center gap-2"
                >
                  {isRolling ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                        <Zap className="w-5 h-5" />
                      </motion.div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Roll Dice (0.01 USDC)
                    </>
                  )}
                </motion.button>
              )}

              {/* Payment Error */}
              {paymentError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm text-center mt-4"
                >
                  {paymentError}
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Win Message */}
        <AnimatePresence>
          {showWinMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                className="bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm rounded-2xl p-8 md:p-12 max-w-md text-center border border-primary/50 shadow-2xl"
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h2 className="font-[var(--font-playfair)] text-4xl font-bold mb-2 text-primary">Victory!</h2>
                <p className="text-muted-foreground mb-6">
                  You&apos;ve revealed all tiles! Completed in {totalRolls} rolls.
                </p>
                <Button
                  onClick={() => {
                    setShowWinMessage(false);
                    setRevealedTiles(new Set());
                    setSuccessfulRolls(0);
                    setTotalRolls(0);
                    setLastRoll(null);
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  Play Again
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-muted-foreground text-sm"
        >
          <p className="mb-2">Each roll costs 0.01 USDC and is processed via x402</p>
          <p>Roll 3 or higher to reveal tiles, lower to hide them</p>
        </motion.div>
      </div>
    </div>
  );
}

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

  // Roll dice with x402 payment
  const rollDice = useCallback(async () => {
    if (!isConnected || isRolling) return;

    setIsRolling(true);
    setShowResult(false);
    setPaymentError('');
    playSound('roll');

    try {
      console.log('[v0] Starting x402 payment request');
      
      // Call x402 payment endpoint
      const response = await fetch('/api/x402-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: PAYMENT_AMOUNT,
          description: 'Dice2D Game Roll',
        }),
      });

      console.log('[v0] Payment response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('[v0] Payment failed:', errorData);
        setPaymentError(errorData.message || 'Payment failed');
        setIsRolling(false);
        playSound('fail');
        return;
      }

      const paymentData = await response.json();
      console.log('[v0] Payment successful:', paymentData);

      // Payment succeeded, animate dice roll
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[v0] Payment request error:', errorMessage);
      setPaymentError(`Payment error: ${errorMessage}`);
      setIsRolling(false);
      playSound('fail');
    }
  }, [isConnected, isRolling, playSound]);

  // Remove the useEffect that watches for transaction confirmation
  // since we now handle the dice animation directly in rollDice()

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

          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectWallet />
            </div>
          ) : (
            <Button
              onClick={rollDice}
              disabled={isRolling || showWinMessage}
              className="w-full h-14 text-lg font-bold bg-teal-600 hover:bg-teal-500 text-white"
            >
              {isRolling
                ? '🎲 Rolling...'
                : '🎲 Roll Dice (0.01 USDC)'}
            </Button>
          )}

          {/* Payment Error Message */}
          {paymentError && (
            <p className="text-red-400 text-sm text-center">
              {paymentError}
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
