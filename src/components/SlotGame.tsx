import React, { useState } from 'react';
import { Sparkles, Play, Award, Coins, BarChart3, Zap, DollarSign, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface SlotGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
}

interface SymbolDef {
  char: string;
  weight: number;
  multiplier: number;
  colorBg: string;
  colorGlow: string;
  name: string;
}

const SYMBOLS: SymbolDef[] = [
  { char: '💎', weight: 8, multiplier: 25, colorBg: 'from-cyan-600/40 to-cyan-900/40 border-cyan-500/40 text-cyan-300', colorGlow: 'rgba(6,182,212,0.3)', name: 'Diamante' },
  { char: '🔔', weight: 12, multiplier: 12, colorBg: 'from-amber-600/40 to-amber-900/40 border-amber-500/40 text-amber-300', colorGlow: 'rgba(245,158,11,0.3)', name: 'Sino' },
  { char: '🍇', weight: 18, multiplier: 6, colorBg: 'from-purple-600/40 to-purple-900/40 border-purple-500/40 text-purple-300', colorGlow: 'rgba(147,51,234,0.3)', name: 'Uva' },
  { char: '🍋', weight: 22, multiplier: 4, colorBg: 'from-yellow-600/40 to-yellow-900/40 border-yellow-500/40 text-yellow-300', colorGlow: 'rgba(234,179,8,0.3)', name: 'Limão' },
  { char: '🍒', weight: 25, multiplier: 3, colorBg: 'from-rose-600/40 to-rose-900/40 border-rose-500/40 text-rose-300', colorGlow: 'rgba(244,63,94,0.3)', name: 'Cereja' },
  { char: '⭐', weight: 5, multiplier: 50, colorBg: 'from-indigo-600/40 to-indigo-900/40 border-indigo-500/40 text-indigo-300', colorGlow: 'rgba(99,102,241,0.3)', name: 'Estrela' }
];

export default function SlotGame({ balance, onUpdateBalance, onAddBetHistory }: SlotGameProps) {
  const [reels, setReels] = useState<SymbolDef[]>([SYMBOLS[2], SYMBOLS[3], SYMBOLS[4]]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [stake, setStake] = useState<string>('5');
  const [winAmount, setWinAmount] = useState<number>(0);
  const [outcomeText, setOutcomeText] = useState<string>('');
  const [totalSpins, setTotalSpins] = useState<number>(0);
  const [totalWins, setTotalWins] = useState<number>(0);
  const [biggestWin, setBiggestWin] = useState<number>(0);
  const [showWinOverlay, setShowWinOverlay] = useState<boolean>(false);
  const [winOverlayAmount, setWinOverlayAmount] = useState<number>(0);

  const pickRandomSymbol = (): SymbolDef => {
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
      if (randomNum < symbol.weight) return symbol;
      randomNum -= symbol.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  };

  const handleSpin = () => {
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) {
      alert('Entre com um valor de spin válido.');
      return;
    }
    if (playCost > balance) {
      alert('Saldo insuficiente para realizar esta rodada.');
      return;
    }

    onUpdateBalance(-playCost);
    setIsSpinning(true);
    setWinAmount(0);
    setOutcomeText('');
    setShowWinOverlay(false);
    setTotalSpins(prev => prev + 1);

    let ticks = 0;
    const interval = setInterval(() => {
      setReels([
        pickRandomSymbol(),
        pickRandomSymbol(),
        pickRandomSymbol()
      ]);
      ticks++;
      if (ticks > 15) {
        clearInterval(interval);
        finalizeSpin(playCost);
      }
    }, 70);
  };

  const finalizeSpin = (playCost: number) => {
    const finalReels = [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()];
    setReels(finalReels);
    setIsSpinning(false);

    const [r1, r2, r3] = finalReels.map(s => s.char);

    let multiplier = 0;
    let text = '';

    if (r1 === r2 && r2 === r3) {
      multiplier = finalReels[0].multiplier;
      text = `${finalReels[0].char} ${finalReels[0].name}! TRIPLO!`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      const matchedSymbol = r1 === r2 ? finalReels[0] : finalReels[2];
      multiplier = parseFloat((matchedSymbol.multiplier * 0.4).toFixed(1));
      text = `${matchedSymbol.char} DUPLA: ${matchedSymbol.name}!`;
    }

    if (multiplier > 0) {
      const payout = playCost * multiplier;
      onUpdateBalance(payout);
      setWinAmount(payout);
      setOutcomeText(`${text} ${multiplier}x = R$ ${payout.toFixed(2)}`);
      setTotalWins(prev => prev + 1);
      if (payout > biggestWin) setBiggestWin(payout);
      setWinOverlayAmount(payout);
      setShowWinOverlay(true);
      setTimeout(() => setShowWinOverlay(false), 2000);

      const newBet: PlacedBet = {
        id: `bet-slot-${Date.now()}`,
        matchName: 'Slots da Sorte',
        selectionName: `[${r1}][${r2}][${r3}]`,
        odds: multiplier,
        stake: playCost,
        potentialPayout: payout,
        status: 'won',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'GANHOU'
      };
      onAddBetHistory(newBet);
    } else {
      setOutcomeText('Tente novamente');
      const newBet: PlacedBet = {
        id: `bet-slot-${Date.now()}`,
        matchName: 'Slots da Sorte',
        selectionName: `[${r1}][${r2}][${r3}]`,
        odds: 0,
        stake: playCost,
        potentialPayout: 0,
        status: 'lost',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'PERDEU'
      };
      onAddBetHistory(newBet);
    }
  };

  const handleShortcutAmount = (val: number) => {
    if (isSpinning) return;
    setStake(val.toString());
  };

  const winRate = totalSpins > 0 ? ((totalWins / totalSpins) * 100).toFixed(1) : '0.0';

  return (
    <div className="relative bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Win overlay */}
      <AnimatePresence>
        {showWinOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-6xl mb-2"
              >
                {winOverlayAmount >= 100 ? '🏆' : '🎉'}
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-black text-brand drop-shadow-[0_0_30px_rgba(0,255,135,0.5)]"
              >
                +R$ {winOverlayAmount.toFixed(2)}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paytable Header */}
      <div className="bg-gradient-to-r from-[#0d0e16] to-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-yellow-400" /> Pagamentos
          </span>
          <span className="text-[8px] text-slate-500 font-mono uppercase">Triplo = x{Math.max(...SYMBOLS.map(s => s.multiplier))}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {SYMBOLS.slice(0, 5).map((sym, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-slate-400 font-mono shrink-0">
              <span>{sym.char}</span>
              <span className="text-yellow-500 font-bold">{sym.multiplier}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Slot Machine Frame */}
      <div className="relative bg-gradient-to-b from-[#1a1c2e] to-[#0d0e16] p-1 rounded-2xl shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
        <div className="bg-gradient-to-b from-[#0d0e16] to-[#06070d] border border-[#2a2d45] rounded-xl p-6 relative overflow-hidden">
          {/* Decorative top lights */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
          <div className="absolute -top-1 left-1/4 w-2 h-2 bg-brand rounded-full animate-pulse" />
          <div className="absolute -top-1 left-2/4 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="absolute -top-1 left-3/4 w-2 h-2 bg-brand rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />

          {/* Reels */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
            {reels.map((symbol, idx) => (
              <div key={idx} className="relative">
                {/* Reel background */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0b14]/50 to-transparent rounded-xl" />
                <motion.div
                  animate={isSpinning ? { y: [-20, 20, -20] } : { y: 0 }}
                  transition={{ repeat: isSpinning ? Infinity : 0, duration: 0.12 }}
                  className={`relative aspect-square rounded-xl bg-gradient-to-b ${symbol.colorBg} border-2 flex items-center justify-center text-4xl md:text-5xl shadow-[inset_0_0_15px_rgba(0,0,0,0.3)] select-none`}
                  style={{ boxShadow: winAmount > 0 && !isSpinning ? `0 0 25px ${symbol.colorGlow}` : '' }}
                >
                  <motion.span
                    animate={winAmount > 0 && !isSpinning ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    {symbol.char}
                  </motion.span>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Result display */}
          <div className="h-10 flex items-center justify-center mt-3">
            <AnimatePresence mode="wait">
              {outcomeText && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-xs font-bold font-mono py-1.5 px-4 rounded-full ${
                    winAmount > 0
                      ? 'bg-gradient-to-r from-brand/10 to-emerald-500/10 border border-brand/30 text-brand shadow-[0_0_15px_rgba(0,255,135,0.15)]'
                      : 'bg-[#151724] text-slate-400 border border-[#212437]'
                  }`}
                >
                  {winAmount > 0 && <Sparkles className="w-3 h-3 inline mr-1 text-brand" />}
                  {outcomeText}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0d0e16]/80 border border-[#1a1c2a] p-3 rounded-xl space-y-2">
          <label className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Valor do Spin (R$)
          </label>
          <input
            type="number"
            disabled={isSpinning}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-[#7c3aed] rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
          />
          <div className="flex gap-1.5 mt-2">
            {[1, 2, 5, 10, 20].map((val) => (
              <button
                key={val}
                onClick={() => handleShortcutAmount(val)}
                disabled={isSpinning}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                  stake === val.toString()
                    ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                    : 'bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white'
                }`}
              >
                R${val}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <motion.button
            onClick={handleSpin}
            disabled={isSpinning || parseFloat(stake) <= 0 || !stake || parseFloat(stake) > balance}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] disabled:border-none hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-black py-5 px-6 rounded-xl transition-all duration-300 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.25)] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
          >
            <Zap className="w-4 h-4" />
            {isSpinning ? 'Girando...' : 'Girar Alavanca'}
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Spins</p>
          <p className="text-sm font-bold text-white font-mono">{totalSpins}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-bold text-brand font-mono">{totalWins}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</p>
          <p className="text-sm font-bold text-slate-300 font-mono">{winRate}%</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Maior</p>
          <p className="text-sm font-bold text-yellow-400 font-mono">R$ {biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
