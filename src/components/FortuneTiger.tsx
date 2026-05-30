import React, { useState } from 'react';
import { Sparkles, Zap, DollarSign, Award, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface FortTigerProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
}

interface SymbolDef {
  char: string;
  name: string;
  weight: number;
  payouts: Record<number, number>;
}

const SYMBOLS: SymbolDef[] = [
  { char: '🐯', name: 'Tigre', weight: 7, payouts: { 3: 15, 4: 30, 5: 60, 6: 100 } },
  { char: '💎', name: 'Diamante', weight: 10, payouts: { 3: 8, 4: 20, 5: 40, 6: 60 } },
  { char: '🐟', name: 'Peixe', weight: 15, payouts: { 3: 4, 4: 8, 5: 15, 6: 25 } },
  { char: '🐢', name: 'Tartaruga', weight: 18, payouts: { 3: 2, 4: 3, 5: 6, 6: 10 } },
  { char: '☯️', name: 'Yin Yang', weight: 22, payouts: { 3: 1, 4: 2, 5: 4, 6: 6 } },
  { char: '🪙', name: 'Moeda', weight: 28, payouts: { 3: 0.5, 4: 1, 5: 2, 6: 3 } },
];

const pickSymbol = (): SymbolDef => {
  const total = SYMBOLS.reduce((s, sy) => s + sy.weight, 0);
  let r = Math.random() * total;
  for (const sy of SYMBOLS) {
    if (r < sy.weight) return sy;
    r -= sy.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
};

const getPayout = (count: number, payouts: Record<number, number>): number => {
  const keys = Object.keys(payouts).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (count >= keys[i]) return payouts[keys[i]];
  }
  return 0;
};

export default function FortuneTiger({ balance, onUpdateBalance, onAddBetHistory }: FortTigerProps) {
  const [grid, setGrid] = useState<SymbolDef[][]>(
    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => SYMBOLS[3]))
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [stake, setStake] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [payoutMult, setPayoutMult] = useState(0);
  const [fortuneMult, setFortuneMult] = useState(0);
  const [tigerCount, setTigerCount] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [biggestWin, setBiggestWin] = useState(0);
  const [showFortune, setShowFortune] = useState(false);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [winOverlayAmount, setWinOverlayAmount] = useState(0);

  const handleSpin = () => {
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) { alert('Valor inválido.'); return; }
    if (playCost > balance) { alert('Saldo insuficiente.'); return; }

    onUpdateBalance(-playCost);
    setIsSpinning(true);
    setWinAmount(0);
    setPayoutMult(0);
    setFortuneMult(0);
    setTigerCount(0);
    setShowFortune(false);
    setShowWinOverlay(false);
    setTotalSpins(p => p + 1);

    let ticks = 0;
    const interval = setInterval(() => {
      setGrid(Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => pickSymbol())));
      ticks++;
      if (ticks > 12) {
        clearInterval(interval);
        finalizeSpin(playCost);
      }
    }, 80);
  };

  const finalizeSpin = (playCost: number) => {
    const finalGrid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => pickSymbol()));
    setGrid(finalGrid);
    setIsSpinning(false);

    const flat = finalGrid.flat();
    const counts: Record<string, { symbol: SymbolDef; count: number }> = {};
    for (const s of flat) {
      if (!counts[s.char]) counts[s.char] = { symbol: s, count: 0 };
      counts[s.char].count++;
    }

    let bestMult = 0;
    let bestSym: SymbolDef | null = null;
    for (const key of Object.keys(counts)) {
      const { symbol, count } = counts[key];
      if (count >= 3) {
        const m = getPayout(count, symbol.payouts);
        if (m > bestMult) { bestMult = m; bestSym = symbol; }
      }
    }

    if (bestMult > 0) {
      const tCount = counts['🐯']?.count || 0;
      let mult = bestMult;
      let fMult = 0;
      if (tCount > 0) {
        fMult = 1 + tCount * (0.2 + Math.random() * 0.6);
        fMult = parseFloat(fMult.toFixed(2));
        mult = parseFloat((bestMult * fMult).toFixed(2));
        setFortuneMult(fMult);
        setShowFortune(true);
        setTimeout(() => setShowFortune(false), 2500);
      }
      setTigerCount(tCount);
      setPayoutMult(bestMult);

      const payout = parseFloat((playCost * mult).toFixed(2));
      onUpdateBalance(payout);
      setWinAmount(payout);
      setWinOverlayAmount(payout);
      setShowWinOverlay(true);
      setTimeout(() => setShowWinOverlay(false), 2500);
      setTotalWins(p => p + 1);
      if (payout > biggestWin) setBiggestWin(payout);

      const label = bestSym && bestMult >= 15 ? `${bestSym.char} ${bestSym.name}!` : `${bestSym?.char || ''} ${bestMult}x`;
      onAddBetHistory({
        id: `bet-ft-${Date.now()}`,
        matchName: 'Fortune Tiger',
        selectionName: `${label}${fMult > 0 ? ` 🐯×${fMult}` : ''}`,
        odds: mult,
        stake: playCost,
        potentialPayout: payout,
        status: 'won',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: `R$ ${payout.toFixed(2)}`,
      });
    } else {
      onAddBetHistory({
        id: `bet-ft-${Date.now()}`,
        matchName: 'Fortune Tiger',
        selectionName: `Sem sorte`,
        odds: 0,
        stake: playCost,
        potentialPayout: 0,
        status: 'lost',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'PERDEU',
      });
    }
  };

  const handleShortcut = (val: number) => { if (!isSpinning) setStake(val.toString()); };

  const winRate = totalSpins > 0 ? ((totalWins / totalSpins) * 100).toFixed(1) : '0.0';

  return (
    <div className="relative bg-gradient-to-b from-[#1a0a0a] to-[#0d0606] border border-[#3d1a1a] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_10px_30px_rgba(200,50,0,0.2)] overflow-hidden">
      {/* Decorative top glow */}
      <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />

      {/* Fortune Overlay */}
      <AnimatePresence>
        {showFortune && (
          <motion.div
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-gradient-to-b from-yellow-900/30 via-red-900/20 to-yellow-900/30"
          >
            <div className="text-center">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-7xl mb-2">🐯</motion.div>
              <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]">
                FORTUNA ×{fortuneMult}!
              </motion.div>
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-yellow-300/60 text-xs mt-1 font-bold">
                {tigerCount} tigre{tigerCount > 1 ? 's' : ''} multiplicou seu prêmio!
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Overlay */}
      <AnimatePresence>
        {showWinOverlay && !showFortune && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <div className="text-5xl mb-2">{winOverlayAmount >= 50 ? '🏆' : '🎉'}</div>
              <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">+R$ {winOverlayAmount.toFixed(2)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paytable */}
      <div className="bg-gradient-to-r from-[#1a0a0a] to-[#0d0606] border border-[#3d1a1a] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-yellow-500/80 font-bold uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-yellow-500" /> Pagamentos (3+)
          </span>
          <span className="text-[8px] text-yellow-600/50 font-mono">🐯 Fortuna ×{tigerCount > 0 ? fortuneMult : '1-3'}x</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SYMBOLS.map((sy, i) => (
            <div key={i} className="flex items-center gap-1 text-[9px] text-yellow-300/60 font-mono shrink-0">
              <span>{sy.char}</span>
              <span className="text-yellow-500 font-bold">{sy.payouts[3]}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="relative bg-gradient-to-b from-[#2d1510] to-[#1a0a0a] p-1.5 rounded-2xl shadow-[inset_0_0_40px_rgba(150,30,0,0.3)] border border-[#4d2015]">
        <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0d0606] border border-[#5d2a1a] rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {grid.flat().map((symbol, idx) => (
              <motion.div
                key={idx}
                animate={isSpinning ? { rotateX: [0, 180, 360] } : { rotateX: 0 }}
                transition={{ duration: 0.2, repeat: isSpinning ? Infinity : 0 }}
                className={`aspect-square rounded-xl bg-gradient-to-b from-[#2d1510] to-[#1a0a0a] border-2 border-[#4d2015] flex items-center justify-center text-3xl md:text-4xl select-none shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] ${symbol.char === '🐯' && winAmount > 0 && !isSpinning ? 'border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : ''}`}
              >
                <motion.span
                  animate={symbol.char === '🐯' && winAmount > 0 && !isSpinning ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  {symbol.char}
                </motion.span>
              </motion.div>
            ))}
          </div>

          {/* Result display */}
          <div className="h-10 flex items-center justify-center mt-3">
            <AnimatePresence mode="wait">
              {winAmount > 0 && !isSpinning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-bold font-mono py-1.5 px-4 rounded-full bg-gradient-to-r from-yellow-500/10 to-red-500/10 border border-yellow-500/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                >
                  <Sparkles className="w-3 h-3 inline mr-1 text-yellow-400" />
                  {payoutMult}×{fortuneMult > 0 ? ` ×🐯${fortuneMult}` : ''} = R$ {winAmount.toFixed(2)}
                </motion.div>
              )}
              {winAmount === 0 && !isSpinning && payoutMult === 0 && totalSpins > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold py-1.5 px-4 rounded-full bg-[#151015] text-slate-500 border border-[#2d1a1a]"
                >
                  Tente novamente
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a0a0a]/80 border border-[#3d1a1a] p-3 rounded-xl space-y-2">
          <label className="text-[9px] text-yellow-500/70 uppercase font-semibold tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Valor da Rodada (R$)
          </label>
          <input
            type="number"
            disabled={isSpinning}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full bg-[#0a0505] border border-[#3d1a1a] focus:border-yellow-600 rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-yellow-600"
          />
          <div className="flex gap-1.5 mt-2">
            {[1, 2, 5, 10, 25, 50].map((val) => (
              <button key={val} onClick={() => handleShortcut(val)} disabled={isSpinning}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${stake === val.toString() ? 'bg-gradient-to-r from-yellow-600 to-red-600 text-white shadow-[0_0_12px_rgba(234,179,8,0.3)]' : 'bg-[#0a0505] border border-[#3d1a1a] text-slate-500 hover:text-yellow-400'}`}>
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
            className="w-full bg-gradient-to-r from-yellow-600 to-red-600 disabled:from-[#1a1010] disabled:to-[#1a1010] disabled:text-[#4a3030] disabled:border-none hover:from-yellow-500 hover:to-red-500 text-white font-black py-5 px-6 rounded-xl transition-all duration-300 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
          >
            <Zap className="w-4 h-4" />
            {isSpinning ? 'Girando...' : 'Girar Fortune Tiger'}
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#1a0a0a]/60 border border-[#3d1a1a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-yellow-600/50 uppercase font-bold tracking-wider">Rodadas</p>
          <p className="text-sm font-bold text-white font-mono">{totalSpins}</p>
        </div>
        <div className="bg-[#1a0a0a]/60 border border-[#3d1a1a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-yellow-600/50 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-bold text-yellow-400 font-mono">{totalWins}</p>
        </div>
        <div className="bg-[#1a0a0a]/60 border border-[#3d1a1a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-yellow-600/50 uppercase font-bold tracking-wider">Win Rate</p>
          <p className="text-sm font-bold text-slate-300 font-mono">{winRate}%</p>
        </div>
        <div className="bg-[#1a0a0a]/60 border border-[#3d1a1a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-yellow-600/50 uppercase font-bold tracking-wider">Maior</p>
          <p className="text-sm font-bold text-yellow-500 font-mono">R$ {biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
