'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useSendTransaction } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Trophy, Zap, Dices, TrendingUp, Target, Volume2, VolumeX, Info } from 'lucide-react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { SwapModal } from './SwapModal';
import { parseUnits, encodeFunctionData } from 'viem';
import { base } from 'wagmi/chains';
import { toast } from 'sonner';

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

const PAYMENT_AMOUNT = '0.01';
const TOTAL_TILES = 6;

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const PAYMENT_RECEIVER = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const; // Replace with your address

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// Dice face patterns
const diceFaces: Record<DiceValue, { dots: number[][]; color: string }> = {
  1: { dots: [[1, 1]], color: 'from-primary to-primary/80' },
  2: { dots: [[0, 0], [2, 2]], color: 'from-primary/90 to-secondary/80' },
  3: { dots: [[0, 0], [1, 1], [2, 2]], color: 'from-secondary/90 to-primary/80' },
  4: { dots: [[0, 0], [0, 2], [2, 0], [2, 2]], color: 'from-secondary to-secondary/80' },
  5: { dots: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], color: 'from-primary to-secondary' },
  6: { dots: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]], color: 'from-secondary to-primary' },
};

export function DiceGame() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [diceValue, setDiceValue] = useState<DiceValue>(1);
  const [isRolling, setIsRolling] = useState(false);
  const [successfulRolls, setSuccessfulRolls] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [lastRoll, setLastRoll] = useState<DiceValue | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showRules, setShowRules] = useState(false);

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playSound = useCallback((type: 'roll' | 'success' | 'fail' | 'win') => {
    if (isMuted || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (type) {
      case 'roll':
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      case 'success':
        oscillator.frequency.setValueAtTime(523, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'fail':
        oscillator.frequency.setValueAtTime(300, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
        break;
      case 'win':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
        oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.45);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.6);
        break;
    }
  }, [isMuted]);

  const rollDice = useCallback(async () => {
    if (!isConnected || isRolling || !address) return;

    setIsRolling(true);
    setShowResult(false);
    playSound('roll');

    try {
      // Send USDC payment
      const amount = parseUnits(PAYMENT_AMOUNT, 6); // USDC has 6 decimals
      
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [PAYMENT_RECEIVER, amount],
      });

      await sendTransactionAsync({
        to: USDC_ADDRESS,
        data,
        chainId: base.id,
      });

      toast.success('Payment confirmed! Rolling dice...');

      // Payment succeeded, animate dice roll
      let rollCount = 0;
      rollIntervalRef.current = setInterval(() => {
        setDiceValue((Math.floor(Math.random() * 6) + 1) as DiceValue);
        playSound('roll');
        rollCount++;
        if (rollCount >= 15) {
          if (rollIntervalRef.current) {
            clearInterval(rollIntervalRef.current);
          }
          // Final roll
          const finalValue = (Math.floor(Math.random() * 6) + 1) as DiceValue;
          setDiceValue(finalValue);
          setLastRoll(finalValue);
          setTotalRolls((prev) => prev + 1);

          if (finalValue >= 3) {
            setSuccessfulRolls((prev) => prev + 1);
            setStreak((prev) => {
              const newStreak = prev + 1;
              if (newStreak > bestStreak) setBestStreak(newStreak);
              return newStreak;
            });
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
            setStreak(0);
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
      }, 80);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      console.error('Payment error:', errorMessage);
      toast.error('Payment failed. Please try again.');
      setIsRolling(false);
    }
  }, [isConnected, isRolling, address, playSound, sendTransactionAsync, bestStreak]);

  useEffect(() => {
    if (revealedTiles.size === TOTAL_TILES && totalRolls > 0) {
      setShowWinMessage(true);
      playSound('win');
    }
  }, [revealedTiles, totalRolls, playSound]);

  const successRate = totalRolls > 0 ? Math.round((successfulRolls / totalRolls) * 100) : 0;
  const currentFace = diceFaces[diceValue];

  const resetGame = () => {
    setShowWinMessage(false);
    setRevealedTiles(new Set());
    setSuccessfulRolls(0);
    setTotalRolls(0);
    setLastRoll(null);
    setStreak(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 grid-pattern opacity-50" />
      
      {/* Ambient Glow Effects */}
      <motion.div
        className="fixed top-1/4 -left-32 w-64 h-64 rounded-full blur-[100px]"
        style={{ background: 'hsl(170 100% 45% / 0.15)' }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="fixed bottom-1/4 -right-32 w-64 h-64 rounded-full blur-[100px]"
        style={{ background: 'hsl(25 100% 55% / 0.15)' }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border/50 backdrop-blur-sm bg-background/50">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
            whileHover={{ rotate: 15 }}
          >
            <Dices className="w-5 h-5 text-background" />
          </motion.div>
          <div>
            <h1 className="font-[var(--font-orbitron)] text-lg font-bold tracking-wider">DICE2D</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">On Base</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <SwapModal />
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            aria-label="Show rules"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        {/* Stats Bar */}
        <div className="w-full max-w-md grid grid-cols-4 gap-2">
          {[
            { label: 'Rolls', value: totalRolls, icon: Dices, color: 'primary' },
            { label: 'Wins', value: successfulRolls, icon: Trophy, color: 'secondary' },
            { label: 'Rate', value: `${successRate}%`, icon: TrendingUp, color: 'primary' },
            { label: 'Streak', value: streak, icon: Zap, color: streak >= 3 ? 'secondary' : 'primary' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-3 text-center"
            >
              <stat.icon className={`w-4 h-4 mx-auto mb-1 text-${stat.color}`} />
              <div className={`text-lg font-bold font-[var(--font-orbitron)] text-${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Game Card */}
        <Card className="w-full max-w-md glass border-primary/20 shadow-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            {/* Progress Tiles */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Progress</span>
                <span className="text-xs font-[var(--font-orbitron)] text-primary">
                  {revealedTiles.size}/{TOTAL_TILES}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: TOTAL_TILES }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{
                      scale: revealedTiles.has(i) ? 1 : 0.9,
                      opacity: revealedTiles.has(i) ? 1 : 0.3,
                    }}
                    className={`aspect-square rounded-lg flex items-center justify-center transition-colors ${
                      revealedTiles.has(i)
                        ? 'bg-gradient-to-br from-primary/40 to-secondary/40 border border-primary/50'
                        : 'bg-muted/30 border border-muted/50'
                    }`}
                  >
                    {revealedTiles.has(i) ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                      >
                        <Sparkles className="w-4 h-4 text-primary" />
                      </motion.div>
                    ) : (
                      <Target className="w-3 h-3 text-muted-foreground/50" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Dice Display */}
            <div className="flex justify-center mb-6">
              <motion.div
                animate={isRolling ? { 
                  rotateX: [0, 360], 
                  rotateY: [0, 360],
                  scale: [1, 1.1, 1],
                } : {}}
                transition={{ 
                  duration: isRolling ? 0.15 : 0.3, 
                  repeat: isRolling ? Infinity : 0,
                  ease: 'linear',
                }}
                whileHover={!isRolling ? { scale: 1.05, rotate: 5 } : {}}
                onClick={isConnected && !isRolling ? rollDice : undefined}
                className={`w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br ${currentFace.color} p-4 cursor-pointer relative shadow-2xl`}
                style={{
                  boxShadow: isRolling 
                    ? '0 0 40px hsl(170 100% 45% / 0.5), 0 0 80px hsl(25 100% 55% / 0.3)'
                    : '0 0 20px hsl(170 100% 45% / 0.3)',
                }}
              >
                {/* Inner dice face */}
                <div className="w-full h-full bg-background/10 rounded-xl grid grid-cols-3 grid-rows-3 gap-1 p-2">
                  {[0, 1, 2].map((row) =>
                    [0, 1, 2].map((col) => {
                      const hasDot = currentFace.dots.some(
                        ([r, c]) => r === row && c === col
                      );
                      return (
                        <div
                          key={`${row}-${col}`}
                          className="flex items-center justify-center"
                        >
                          {hasDot && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="dice-dot"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10" />
              </motion.div>
            </div>

            {/* Result Message */}
            <AnimatePresence mode="wait">
              {showResult && lastRoll && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  className={`text-center mb-6 p-4 rounded-xl font-semibold ${
                    lastRoll >= 3
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                      : 'bg-red-500/20 border border-red-500/50 text-red-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {lastRoll >= 3 ? (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Rolled {lastRoll}! Tile revealed!</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-5 h-5" />
                        <span>Rolled {lastRoll}. Tile hidden.</span>
                      </>
                    )}
                  </div>
                  {streak >= 3 && lastRoll >= 3 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs mt-1 text-secondary"
                    >
                      Hot streak: {streak} wins!
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
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
                className="w-full py-4 px-6 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg text-primary-foreground flex items-center justify-center gap-3 transition-all shadow-lg"
                style={{
                  boxShadow: !isRolling ? '0 0 30px hsl(170 100% 45% / 0.3)' : 'none',
                }}
              >
                {isRolling ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <Dices className="w-5 h-5" />
                    </motion.div>
                    <span className="font-[var(--font-orbitron)]">Rolling...</span>
                  </>
                ) : (
                  <>
                    <Dices className="w-5 h-5" />
                    <span className="font-[var(--font-orbitron)]">Roll Dice</span>
                    <span className="text-sm opacity-80">(0.01 USDC)</span>
                  </>
                )}
              </motion.button>
            )}
          </CardContent>
        </Card>

        {/* Footer Info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-muted-foreground text-xs max-w-sm"
        >
          Roll 3+ to reveal tiles. Complete all 6 to win!
          {bestStreak > 0 && (
            <span className="block mt-1 text-secondary">Best streak: {bestStreak}</span>
          )}
        </motion.p>
      </main>

      {/* Win Modal */}
      <AnimatePresence>
        {showWinMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="glass rounded-3xl p-8 max-w-sm w-full text-center border border-primary/30"
              style={{
                boxShadow: '0 0 60px hsl(170 100% 45% / 0.3), 0 0 100px hsl(25 100% 55% / 0.2)',
              }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Trophy className="w-20 h-20 mx-auto mb-4 text-secondary" />
              </motion.div>
              <h2 className="font-[var(--font-orbitron)] text-3xl font-bold mb-2 neon-text">
                VICTORY!
              </h2>
              <p className="text-muted-foreground mb-6">
                All tiles revealed in <span className="text-primary font-bold">{totalRolls}</span> rolls!
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetGame}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-secondary rounded-xl font-bold text-primary-foreground"
                >
                  Play Again
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
            onClick={() => setShowRules(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass rounded-2xl p-6 max-w-sm w-full border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-[var(--font-orbitron)] text-xl font-bold mb-4 text-primary">
                How to Play
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Dices className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>Each roll costs 0.01 USDC</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 text-secondary shrink-0" />
                  <span>Roll 3 or higher to reveal a tile</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span>Roll 1 or 2 and lose a revealed tile</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 mt-0.5 text-secondary shrink-0" />
                  <span>Reveal all 6 tiles to win!</span>
                </li>
              </ul>
              <button
                onClick={() => setShowRules(false)}
                className="w-full mt-6 py-2.5 bg-muted/50 hover:bg-muted/70 rounded-xl font-medium transition-colors"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
