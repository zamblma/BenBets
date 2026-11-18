import { useState, useEffect, useRef } from 'react';
import { Sparkles, DollarSign, Award, Zap, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';
import { updateMissionProgress } from '../firebase/db';

interface FortTigerProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

interface SymbolDef {
  id: string;
  char: string;
  name: string;
  weight: number;
  linePayout: number;
  isWild?: boolean;
  tileBg: string;
  ringColor: string;
  tag?: string;
}

const SYMBOLS: SymbolDef[] = [
  {
    id: 'tiger',
    char: '🐯',
    name: 'Tigre Wild',
    weight: 5,
    linePayout: 25,
    isWild: true,
    tag: 'WILD',
    tileBg: 'from-amber-400/25 via-yellow-500/15 to-[#1f1206]',
    ringColor: 'border-yellow-400/80',
  },
  {
    id: 'envelope',
    char: '🧧',
    name: 'Envelope Real',
    weight: 8,
    linePayout: 12,
    tileBg: 'from-rose-500/25 via-red-700/20 to-[#1a080a]',
    ringColor: 'border-rose-400/55',
  },
  {
    id: 'ingot',
    char: '💰',
    name: 'Lingote Sycee',
    weight: 11,
    linePayout: 6,
    tileBg: 'from-yellow-500/20 via-amber-700/15 to-[#181106]',
    ringColor: 'border-amber-400/50',
  },
  {
    id: 'jade',
    char: '💎',
    name: 'Jade Imperial',
    weight: 16,
    linePayout: 3,
    tileBg: 'from-emerald-400/20 via-teal-700/15 to-[#061812]',
    ringColor: 'border-brand/50',
  },
  {
    id: 'orange',
    char: '🍊',
    name: 'Tangerina',
    weight: 24,
    linePayout: 1.5,
    tileBg: 'from-orange-400/20 via-amber-800/15 to-[#1a0d05]',
    ringColor: 'border-orange-400/45',
  },
  {
    id: 'firecracker',
    char: '🧨',
    name: 'Fogos da Sorte',
    weight: 36,
    linePayout: 0.8,
    tileBg: 'from-red-500/15 via-stone-800/30 to-[#140909]',
    ringColor: 'border-red-400/35',
  },
];

// 5 paylines of 3x3 grid (row-major indices 0..8)
const PAYLINES: { id: number; cells: [number, number, number]; coords: [number, number, number, number] }[] = [
  { id: 0, cells: [0, 1, 2], coords: [16.6, 16.6, 83.4, 16.6] }, // Top row
  { id: 1, cells: [3, 4, 5], coords: [16.6, 50, 83.4, 50] },     // Middle row
  { id: 2, cells: [6, 7, 8], coords: [16.6, 83.4, 83.4, 83.4] }, // Bottom row
  { id: 3, cells: [0, 4, 8], coords: [16.6, 16.6, 83.4, 83.4] }, // Diagonal \
  { id: 4, cells: [6, 4, 2], coords: [16.6, 83.4, 83.4, 16.6] }, // Diagonal /
];

const REEL_BLUR_STRIP = [
  SYMBOLS[5], SYMBOLS[2], SYMBOLS[4], SYMBOLS[0], SYMBOLS[3], SYMBOLS[1],
  SYMBOLS[5], SYMBOLS[3], SYMBOLS[4], SYMBOLS[2], SYMBOLS[1], SYMBOLS[0],
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, sy) => s + sy.weight, 0);

function pickWeightedSymbol(): SymbolDef {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const sy of SYMBOLS) {
    if (r < sy.weight) return sy;
    r -= sy.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function evaluateGrid(flat: SymbolDef[]) {
  const wonLineIds: number[] = [];
  const wonCells = new Set<number>();
  let totalMult = 0;
  let bestSymbol: SymbolDef | null = null;

  for (const line of PAYLINES) {
    const lineSyms = line.cells.map((idx) => flat[idx]);
    const nonWild = lineSyms.filter((s) => !s.isWild);

    let lineMult = 0;
    let matchedSym: SymbolDef | null = null;

    if (nonWild.length === 0) {
      matchedSym = SYMBOLS[0];
      lineMult = matchedSym.linePayout;
    } else if (nonWild.every((s) => s.id === nonWild[0].id)) {
      matchedSym = nonWild[0];
      lineMult = matchedSym.linePayout;
    }

    if (lineMult > 0 && matchedSym) {
      wonLineIds.push(line.id);
      line.cells.forEach((c) => wonCells.add(c));
      totalMult += lineMult;
      if (!bestSymbol || matchedSym.linePayout > bestSymbol.linePayout) {
        bestSymbol = matchedSym;
      }
    }
  }

  // Tela Cheia x10: todas as 9 posições são do mesmo símbolo (+ Wilds) ou todas participaram de linha vencedora
  const flatNonWild = flat.filter((s) => !s.isWild);
  const allMatchSymbol = flatNonWild.length === 0 || flatNonWild.every((s) => s.id === flatNonWild[0].id);
  const isFullScreen = totalMult > 0 && (wonCells.size === 9 || allMatchSymbol);
  if (isFullScreen) {
    totalMult = Number((totalMult * 10).toFixed(2));
  } else {
    totalMult = Number(totalMult.toFixed(2));
  }

  return { wonLineIds, wonCells, totalMult, isFullScreen, bestSymbol };
}

export default function FortuneTiger({ balance, onUpdateBalance, onAddBetHistory, userId }: FortTigerProps) {
  const [grid, setGrid] = useState<SymbolDef[]>([
    SYMBOLS[1], SYMBOLS[0], SYMBOLS[1],
    SYMBOLS[2], SYMBOLS[0], SYMBOLS[2],
    SYMBOLS[3], SYMBOLS[4], SYMBOLS[3],
  ]);
  const [colSpinning, setColSpinning] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [stake, setStake] = useState('2');
  const [autoRemaining, setAutoRemaining] = useState(0);

  const [wonLineIds, setWonLineIds] = useState<number[]>([]);
  const [wonCells, setWonCells] = useState<Set<number>>(new Set());
  const [winAmount, setWinAmount] = useState(0);
  const [winMult, setWinMult] = useState(0);
  const [fullScreenBonus, setFullScreenBonus] = useState(false);
  const [showWinBanner, setShowWinBanner] = useState(false);

  const [stats, setStats] = useState({ spins: 0, wins: 0, biggestWin: 0 });
  const timersRef = useRef<number[]>([]);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const { play } = useSound();

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const triggerSpin = (fromAuto = false) => {
    if (isSpinning) return;
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) {
      if (!fromAuto) alert('Valor de aposta inválido.');
      setAutoRemaining(0);
      return;
    }
    if (playCost > balanceRef.current) {
      if (!fromAuto) alert('Saldo insuficiente.');
      setAutoRemaining(0);
      return;
    }

    play('spin');
    onUpdateBalance(-playCost);
    setIsSpinning(true);
    setColSpinning([true, true, true]);
    setWonLineIds([]);
    setWonCells(new Set());
    setWinAmount(0);
    setWinMult(0);
    setFullScreenBonus(false);
    setShowWinBanner(false);
    setStats((s) => ({ ...s, spins: s.spins + 1 }));
    updateMissionProgress(userId, 'fortune_spins', 1).catch(() => {});

    const finalFlat = Array.from({ length: 9 }, () => pickWeightedSymbol());
    const d1 = turboMode ? 150 : 310;
    const d2 = turboMode ? 260 : 540;
    const d3 = turboMode ? 370 : 790;

    // Column 0 locks
    const t1 = window.setTimeout(() => {
      setGrid((prev) => {
        const next = [...prev];
        next[0] = finalFlat[0];
        next[3] = finalFlat[3];
        next[6] = finalFlat[6];
        return next;
      });
      setColSpinning([false, true, true]);
      play('tick');
    }, d1);

    // Column 1 locks
    const t2 = window.setTimeout(() => {
      setGrid((prev) => {
        const next = [...prev];
        next[1] = finalFlat[1];
        next[4] = finalFlat[4];
        next[7] = finalFlat[7];
        return next;
      });
      setColSpinning([false, false, true]);
      play('tick');
    }, d2);

    // Column 2 locks & settles
    const t3 = window.setTimeout(() => {
      setGrid(finalFlat);
      setColSpinning([false, false, false]);
      setIsSpinning(false);
      play('tick');

      const res = evaluateGrid(finalFlat);
      if (res.totalMult > 0) {
        const payout = Number((playCost * res.totalMult).toFixed(2));
        onUpdateBalance(payout);
        setWonLineIds(res.wonLineIds);
        setWonCells(res.wonCells);
        setWinAmount(payout);
        setWinMult(res.totalMult);
        setFullScreenBonus(res.isFullScreen);
        setShowWinBanner(true);

        if (res.isFullScreen || res.totalMult >= 12) play('legendary');
        else play('win');

        setStats((s) => ({
          ...s,
          wins: s.wins + 1,
          biggestWin: Math.max(s.biggestWin, payout),
        }));

        onAddBetHistory({
          id: `bet-ft-${Date.now()}`,
          matchName: 'Fortune Tiger Imperial',
          selectionName: `${res.bestSymbol?.char || '🐯'} ${res.wonLineIds.length} linha(s)${res.isFullScreen ? ' • TELA CHEIA ×10' : ''}`,
          odds: res.totalMult,
          stake: playCost,
          potentialPayout: payout,
          status: 'won',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: `R$ ${payout.toFixed(2)}`,
        });
      } else {
        play('lose');
        onAddBetHistory({
          id: `bet-ft-${Date.now()}`,
          matchName: 'Fortune Tiger Imperial',
          selectionName: 'Sem linha premiada',
          odds: 0,
          stake: playCost,
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: 'PERDEU',
        });
      }
    }, d3);

    timersRef.current.push(t1, t2, t3);
  };

  // Trigger next auto spin smoothly once current spin settles
  useEffect(() => {
    if (isSpinning || autoRemaining <= 0) return;
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0 || playCost > balanceRef.current) {
      setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoRemaining((c) => c - 1);
      triggerSpin(true);
    }, winAmount > 0 ? 1100 : 420);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, autoRemaining]);

  const adjustStake = (factor: number) => {
    if (isSpinning || autoRemaining > 0) return;
    const curr = parseFloat(stake) || 2;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  const winRate = stats.spins > 0 ? ((stats.wins / stats.spins) * 100).toFixed(1) : '0.0';

  return (
    <div className="relative bg-gradient-to-b from-[#23090b] via-[#140608] to-[#090407] border-2 border-amber-500/35 rounded-2xl p-3.5 sm:p-5 space-y-4 shadow-[0_14px_42px_rgba(180,35,0,0.28)] overflow-hidden">
      <div className="absolute top-0 left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

      {/* Gabinete Imperial Header com Mascote */}
      <div className="bg-gradient-to-r from-[#2e0e10] via-[#1c080a] to-[#2e0e10] border border-amber-500/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 relative overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            animate={
              isSpinning
                ? { y: [-2, 2, -2], rotate: [-4, 4, -4] }
                : fullScreenBonus
                ? { scale: [1, 1.18, 1] }
                : { y: 0, rotate: 0 }
            }
            transition={{ repeat: isSpinning || fullScreenBonus ? Infinity : 0, duration: 0.45 }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-600 border-2 border-yellow-200/80 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(245,158,11,0.45)] shrink-0"
          >
            🐯
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black font-display text-amber-300 tracking-wide uppercase">
                🏮 Fortune Tiger Imperial
              </span>
              <span className="text-[8px] sm:text-[9px] font-mono font-black bg-amber-400/15 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full">
                5 LINHAS • TELA CHEIA ×10
              </span>
            </div>
            <p className="text-[10px] text-amber-100/65 mt-0.5 truncate">
              O Tigre Wild (🐯) substitui qualquer símbolo para fechar linhas de ouro!
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-lg shrink-0 select-none">🏮🏮</div>
      </div>

      {/* Paytable compacta e elegante */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {SYMBOLS.map((sy) => (
          <div
            key={sy.id}
            className={`bg-gradient-to-b ${sy.tileBg} border ${sy.ringColor} rounded-xl px-2 py-1.5 flex items-center justify-between gap-1`}
          >
            <span className="text-lg leading-none">{sy.char}</span>
            <div className="text-right leading-tight">
              <div className="text-[8px] font-bold text-amber-100/80 truncate">{sy.tag || sy.name.split(' ')[0]}</div>
              <div className="text-[10px] font-mono font-black text-amber-300">{sy.linePayout}×</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gabinete dos 3 Rolos 3×3 */}
      <div className="relative bg-gradient-to-b from-[#4e260e] via-[#2b1109] to-[#1a0807] p-2 rounded-2xl border-2 border-amber-500/45 shadow-[inset_0_0_32px_rgba(0,0,0,0.65)]">
        <div className="bg-[#0e0506] rounded-xl p-3 sm:p-4 border border-amber-500/25 relative overflow-hidden">
          <div className="relative max-w-[360px] mx-auto">
            {/* SVG Overlay para linhas vencedoras */}
            {wonLineIds.length > 0 && !isSpinning && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-20 pointer-events-none">
                {wonLineIds.map((lineId) => {
                  const line = PAYLINES.find((l) => l.id === lineId);
                  if (!line) return null;
                  const [x1, y1, x2, y2] = line.coords;
                  return (
                    <g key={lineId}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* 3 Colunas independentes para giro fluido a 60/120fps */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {[0, 1, 2].map((colIdx) => {
                const spinning = colSpinning[colIdx];
                const colCells = [colIdx, colIdx + 3, colIdx + 6];
                return (
                  <div
                    key={colIdx}
                    className="relative rounded-xl bg-[#080304] border border-amber-900/50 p-1 space-y-2 overflow-hidden"
                    style={{ contain: 'paint' }}
                  >
                    {spinning ? (
                      <div className="h-[240px] sm:h-[270px] overflow-hidden relative flex items-center justify-center">
                        <motion.div
                          initial={{ y: -120 }}
                          animate={{ y: 120 }}
                          transition={{ repeat: Infinity, duration: turboMode ? 0.14 : 0.22, ease: 'linear' }}
                          className="flex flex-col gap-3 items-center opacity-85 gpu-strip"
                        >
                          {REEL_BLUR_STRIP.map((sym, k) => (
                            <div
                              key={k}
                              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-b ${sym.tileBg} border ${sym.ringColor} flex items-center justify-center text-3xl sm:text-4xl`}
                            >
                              {sym.char}
                            </div>
                          ))}
                        </motion.div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {colCells.map((cellIdx) => {
                          const sym = grid[cellIdx];
                          const isHit = wonCells.has(cellIdx);
                          return (
                            <motion.div
                              key={cellIdx}
                              initial={{ y: -10, opacity: 0.7 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                              className={`aspect-square rounded-xl bg-gradient-to-b ${sym.tileBg} border-2 flex flex-col items-center justify-center relative select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
                                isHit
                                  ? 'border-yellow-300 ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                                  : sym.ringColor
                              }`}
                            >
                              {sym.tag && (
                                <span className="absolute top-1 right-1 text-[7px] font-black px-1 py-0.2 rounded bg-yellow-400 text-slate-950 leading-tight">
                                  {sym.tag}
                                </span>
                              )}
                              <span className={`text-3xl sm:text-4xl ${isHit ? 'scale-110 transition-transform' : ''}`}>
                                {sym.char}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Banner de Resultado / Tela Cheia */}
          <div className="min-h-[44px] flex items-center justify-center mt-3">
            <AnimatePresence mode="wait">
              {showWinBanner && winAmount > 0 && !isSpinning ? (
                <motion.div
                  key="win"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`py-2 px-5 rounded-full border text-xs sm:text-sm font-black font-mono flex items-center gap-2 ${
                    fullScreenBonus
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 border-yellow-200 shadow-[0_0_26px_rgba(251,191,36,0.6)]'
                      : 'bg-amber-500/15 border-amber-400/50 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.22)]'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    {fullScreenBonus ? '🐯 TELA CHEIA ×10! ' : `${wonLineIds.length} Linha(s) • `}
                    {winMult}× = R$ {winAmount.toFixed(2)}
                  </span>
                </motion.div>
              ) : !isSpinning && stats.spins > 0 && winAmount === 0 ? (
                <motion.span
                  key="loss"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] font-bold text-amber-200/45 bg-[#19090b] border border-amber-900/35 px-4 py-1.5 rounded-full"
                >
                  Gire novamente para despertar a fortuna 🐯
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Painel de Controle Moderno */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
        <div className="bg-[#160709] border border-amber-500/25 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] text-amber-400/80 uppercase font-bold tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Aposta Total (R$)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTurboMode((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  turboMode
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : 'bg-[#0b0405] border-amber-900/40 text-slate-400 hover:text-amber-300'
                }`}
              >
                <Zap className="w-3 h-3" /> Turbo
              </button>
              <button
                onClick={() => setAutoRemaining((c) => (c > 0 ? 0 : 10))}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  autoRemaining > 0
                    ? 'bg-brand/20 border-brand text-brand'
                    : 'bg-[#0b0405] border-amber-900/40 text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-3 h-3" /> {autoRemaining > 0 ? `Auto (${autoRemaining})` : 'Auto 10×'}
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <input
              type="number"
              disabled={isSpinning || autoRemaining > 0}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="flex-1 bg-[#0b0405] border border-amber-900/50 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
            />
            <button onClick={() => adjustStake(0.5)} disabled={isSpinning || autoRemaining > 0} className="px-3 rounded-xl bg-[#0b0405] border border-amber-900/50 text-xs font-bold text-amber-300 cursor-pointer disabled:opacity-40">
              1/2
            </button>
            <button onClick={() => adjustStake(2)} disabled={isSpinning || autoRemaining > 0} className="px-3 rounded-xl bg-[#0b0405] border border-amber-900/50 text-xs font-bold text-amber-300 cursor-pointer disabled:opacity-40">
              2×
            </button>
          </div>

          <div className="flex gap-1.5">
            {[1, 2, 5, 10, 25, 50].map((v) => (
              <button
                key={v}
                disabled={isSpinning || autoRemaining > 0}
                onClick={() => setStake(String(v))}
                className={`flex-1 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-40 ${
                  stake === String(v)
                    ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white'
                    : 'bg-[#0b0405] border border-amber-900/40 text-slate-400 hover:text-amber-300'
                }`}
              >
                R${v}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => (autoRemaining > 0 ? setAutoRemaining(0) : triggerSpin(false))}
          disabled={!autoRemaining && (isSpinning || !stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance)}
          className="md:w-52 bg-gradient-to-b from-yellow-400 via-amber-500 to-red-600 hover:brightness-110 disabled:from-[#1b1214] disabled:to-[#140d0e] disabled:text-slate-600 text-slate-950 font-black py-4 px-6 rounded-2xl text-sm uppercase tracking-wider flex flex-col items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_26px_rgba(245,158,11,0.35)] border border-yellow-200/50"
        >
          <span className="flex items-center gap-1.5">
            <Award className="w-5 h-5" />
            {autoRemaining > 0 ? 'Parar Auto' : isSpinning ? 'Girando...' : 'GIRAR TIGRE'}
          </span>
          <span className="text-[10px] font-mono opacity-85">R$ {parseFloat(stake || '0').toFixed(2)}</span>
        </motion.button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#140709] border border-amber-900/35 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-300/60 uppercase font-bold tracking-wider">Giros</p>
          <p className="text-sm font-bold text-white font-mono">{stats.spins}</p>
        </div>
        <div className="bg-[#140709] border border-amber-900/35 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-300/60 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-bold text-amber-300 font-mono">{stats.wins}</p>
        </div>
        <div className="bg-[#140709] border border-amber-900/35 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-300/60 uppercase font-bold tracking-wider">Win Rate</p>
          <p className="text-sm font-bold text-slate-300 font-mono">{winRate}%</p>
        </div>
        <div className="bg-[#140709] border border-amber-900/35 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-300/60 uppercase font-bold tracking-wider">Maior Ganho</p>
          <p className="text-sm font-bold text-brand font-mono">R$ {stats.biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
