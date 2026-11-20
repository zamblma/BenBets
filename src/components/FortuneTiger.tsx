import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, DollarSign, Zap, Repeat, RotateCw, Info, Flame, Trophy } from 'lucide-react';
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

type SymbolId = 'tiger' | 'envelope' | 'ingot' | 'jade' | 'orange' | 'firecracker';

interface SymbolDef {
  id: SymbolId;
  char: string;
  name: string;
  shortName: string;
  weight: number;
  linePayout: number;
  isWild?: boolean;
  tileBg: string;
  ringColor: string;
  glowColor: string;
  tag?: string;
}

const SYMBOLS: SymbolDef[] = [
  {
    id: 'tiger',
    char: '🐯',
    name: 'Tigre Wild',
    shortName: 'WILD',
    weight: 5,
    linePayout: 25,
    isWild: true,
    tag: 'WILD',
    tileBg: 'from-[#5a3208] via-[#2c1505] to-[#120703]',
    ringColor: 'border-amber-300/80',
    glowColor: 'rgba(251,191,36,0.55)',
  },
  {
    id: 'envelope',
    char: '🧧',
    name: 'Envelope Real',
    shortName: 'Envelope',
    weight: 8,
    linePayout: 12,
    tileBg: 'from-[#541019] via-[#2b080e] to-[#130406]',
    ringColor: 'border-rose-400/60',
    glowColor: 'rgba(244,63,94,0.45)',
  },
  {
    id: 'ingot',
    char: '💰',
    name: 'Lingote Sycee',
    shortName: 'Lingote',
    weight: 11,
    linePayout: 6,
    tileBg: 'from-[#473108] via-[#241705] to-[#110a03]',
    ringColor: 'border-amber-400/55',
    glowColor: 'rgba(245,158,11,0.4)',
  },
  {
    id: 'jade',
    char: '💎',
    name: 'Jade Imperial',
    shortName: 'Jade',
    weight: 16,
    linePayout: 3,
    tileBg: 'from-[#0b3b2c] via-[#062018] to-[#030f0b]',
    ringColor: 'border-emerald-400/55',
    glowColor: 'rgba(16,185,129,0.4)',
  },
  {
    id: 'orange',
    char: '🍊',
    name: 'Tangerina',
    shortName: 'Tangerina',
    weight: 24,
    linePayout: 1.5,
    tileBg: 'from-[#4a2209] via-[#261105] to-[#120703]',
    ringColor: 'border-orange-400/50',
    glowColor: 'rgba(249,115,22,0.35)',
  },
  {
    id: 'firecracker',
    char: '🧨',
    name: 'Fogos da Sorte',
    shortName: 'Fogos',
    weight: 36,
    linePayout: 0.8,
    tileBg: 'from-[#3c1216] via-[#21090c] to-[#100406]',
    ringColor: 'border-red-400/40',
    glowColor: 'rgba(239,68,68,0.3)',
  },
];

// 5 paylines of 3x3 grid (row-major indices 0..8)
const PAYLINES: {
  id: number;
  label: string;
  cells: [number, number, number];
  coords: [number, number, number, number];
}[] = [
  { id: 0, label: 'Topo', cells: [0, 1, 2], coords: [16.6, 16.6, 83.4, 16.6] },
  { id: 1, label: 'Centro', cells: [3, 4, 5], coords: [16.6, 50, 83.4, 50] },
  { id: 2, label: 'Base', cells: [6, 7, 8], coords: [16.6, 83.4, 83.4, 83.4] },
  { id: 3, label: 'Diag ↘', cells: [0, 4, 8], coords: [16.6, 16.6, 83.4, 83.4] },
  { id: 4, label: 'Diag ↗', cells: [6, 4, 2], coords: [16.6, 83.4, 83.4, 16.6] },
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

/** Arte vetorial customizada dos símbolos do Fortune Tiger */
function SymbolArt({ id, className = 'w-12 h-12 sm:w-14 sm:h-14' }: { id: SymbolId; className?: string }) {
  switch (id) {
    case 'tiger':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ft-tiger-face" cx="50%" cy="42%" r="54%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="48%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <linearGradient id="ft-tiger-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          {/* Orelhas */}
          <circle cx="20" cy="22" r="10" fill="#d97706" stroke="#fde68a" strokeWidth="2" />
          <circle cx="20" cy="22" r="5" fill="#7c2d12" />
          <circle cx="60" cy="22" r="10" fill="#d97706" stroke="#fde68a" strokeWidth="2" />
          <circle cx="60" cy="22" r="5" fill="#7c2d12" />
          {/* Cabeça */}
          <ellipse cx="40" cy="43" rx="27" ry="24" fill="url(#ft-tiger-face)" stroke="#fef08a" strokeWidth="2" />
          {/* Bochechas brancas */}
          <ellipse cx="29" cy="51" rx="9" ry="7" fill="#fffbeb" fillOpacity="0.92" />
          <ellipse cx="51" cy="51" rx="9" ry="7" fill="#fffbeb" fillOpacity="0.92" />
          {/* Listras imperiais + marca 王 na testa */}
          <path d="M33 24 H47 M35 28.5 H45 M34 33 H46 M40 24 V33" stroke="#451a03" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M16 39 L24 41 M17 45 L23 46 M64 39 L56 41 M63 45 L57 46" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />
          {/* Olhos esmeralda brilhantes */}
          <ellipse cx="29" cy="40" rx="4.2" ry="4.6" fill="#064e3b" />
          <ellipse cx="51" cy="40" rx="4.2" ry="4.6" fill="#064e3b" />
          <circle cx="29" cy="40" r="2.6" fill="#34d399" />
          <circle cx="51" cy="40" r="2.6" fill="#34d399" />
          <circle cx="30.2" cy="38.6" r="1.1" fill="#ffffff" />
          <circle cx="52.2" cy="38.6" r="1.1" fill="#ffffff" />
          {/* Nariz e sorriso */}
          <path d="M36 47 H44 L40 52 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" strokeLinejoin="round" />
          <path d="M40 52 Q36 57 32 54 M40 52 Q44 57 48 54" stroke="#451a03" strokeWidth="2" strokeLinecap="round" />
          {/* Óculos / coroa dourada sutil */}
          <path d="M31 15 L36 19 L40 12 L44 19 L49 15 L47 21 H33 Z" fill="url(#ft-tiger-gold)" stroke="#fef9c3" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );

    case 'envelope':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ft-env-body" x1="15" y1="10" x2="65" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <linearGradient id="ft-env-gold" x1="25" y1="20" x2="55" y2="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <rect x="17" y="10" width="46" height="60" rx="8" fill="url(#ft-env-body)" stroke="#fbbf24" strokeWidth="2.4" />
          <path d="M17 24 Q40 40 63 24" stroke="#fde047" strokeWidth="2.2" fill="#9f1239" />
          <rect x="22" y="15" width="36" height="50" rx="5" stroke="#fbbf24" strokeOpacity="0.35" strokeWidth="1.2" />
          {/* Selo dourado central */}
          <circle cx="40" cy="40" r="12" fill="url(#ft-env-gold)" stroke="#fef9c3" strokeWidth="1.8" />
          <rect x="35.5" y="35.5" width="9" height="9" rx="1.5" fill="#9f1239" stroke="#fef08a" strokeWidth="1.2" />
          <circle cx="40" cy="18" r="2.2" fill="#fde047" />
        </svg>
      );

    case 'ingot':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ft-ingot-top" x1="20" y1="22" x2="60" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="45%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="ft-ingot-base" x1="12" y1="36" x2="68" y2="62" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          {/* Cúpula central */}
          <ellipse cx="40" cy="36" rx="15" ry="12" fill="url(#ft-ingot-top)" stroke="#fef08a" strokeWidth="1.8" />
          {/* Corpo do barco Yuanbao */}
          <path
            d="M10 38 C14 58 26 63 40 63 C54 63 66 58 70 38 C60 44 50 45 40 45 C30 45 20 44 10 38 Z"
            fill="url(#ft-ingot-base)"
            stroke="#fde047"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Brilho especular */}
          <path d="M22 48 Q40 53 58 48" stroke="#fef9c3" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" />
          <circle cx="35" cy="31" r="3" fill="#ffffff" fillOpacity="0.55" />
        </svg>
      );

    case 'jade':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ft-jade-grad" x1="16" y1="14" x2="64" y2="66" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="45%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#065f46" />
            </linearGradient>
          </defs>
          {/* Aro dourado superior */}
          <circle cx="40" cy="14" r="5" stroke="#fbbf24" strokeWidth="2.4" />
          {/* Gema de Jade facetada */}
          <polygon
            points="40,18 62,32 56,58 40,68 24,58 18,32"
            fill="url(#ft-jade-grad)"
            stroke="#fbbf24"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <polygon points="40,25 53,35 49,53 40,60 31,53 27,35" fill="#34d399" fillOpacity="0.35" stroke="#a7f3d0" strokeWidth="1.2" />
          <path d="M40 18 V25 M62 32 L53 35 M18 32 L27 35 M40 68 V60" stroke="#fef08a" strokeOpacity="0.65" strokeWidth="1.2" />
          <circle cx="35" cy="34" r="3" fill="#ffffff" fillOpacity="0.55" />
        </svg>
      );

    case 'orange':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ft-orange-grad" cx="38%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="35%" stopColor="#fb923c" />
              <stop offset="85%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </radialGradient>
          </defs>
          {/* Folha verde */}
          <path d="M41 24 C45 12 60 11 61 20 C54 25 46 26 41 24 Z" fill="#22c55e" stroke="#86efac" strokeWidth="1.5" />
          <path d="M40 24 L37 16" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          {/* Fruto */}
          <ellipse cx="40" cy="46" rx="23" ry="21" fill="url(#ft-orange-grad)" stroke="#fdba74" strokeWidth="2" />
          {/* Brilho */}
          <ellipse cx="31" cy="37" rx="6" ry="3.5" transform="rotate(-25 31 37)" fill="#ffffff" fillOpacity="0.45" />
          <circle cx="48" cy="52" r="1.5" fill="#fde68a" fillOpacity="0.5" />
          <circle cx="52" cy="47" r="1.2" fill="#fde68a" fillOpacity="0.5" />
        </svg>
      );

    case 'firecracker':
    default:
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ft-fc-red" x1="20" y1="20" x2="60" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          {/* Pavio + faísca */}
          <path d="M40 25 Q42 15 51 14" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M52 10 L54 14 L58 14 L55 17 L56 21 L52 18 L48 21 L49 17 L46 14 L50 14 Z" fill="#fef08a" />
          {/* 3 cilindros de fogos */}
          <rect x="19" y="29" width="14" height="36" rx="4" transform="rotate(-10 19 29)" fill="url(#ft-fc-red)" stroke="#fbbf24" strokeWidth="1.8" />
          <rect x="47" y="27" width="14" height="36" rx="4" transform="rotate(10 47 27)" fill="url(#ft-fc-red)" stroke="#fbbf24" strokeWidth="1.8" />
          <rect x="33" y="24" width="14" height="40" rx="4" fill="url(#ft-fc-red)" stroke="#fde047" strokeWidth="2.2" />
          {/* Faixas douradas */}
          <path d="M33 34 H47 M33 54 H47" stroke="#fde047" strokeWidth="2.5" />
          <rect x="26" y="42" width="28" height="5" rx="2.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
        </svg>
      );
  }
}

/** Lanterna chinesa decorativa para o gabinete */
function HangingLantern({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      animate={{ rotate: [-3, 3, -3] }}
      transition={{ repeat: Infinity, duration: 3.6, delay, ease: 'easeInOut' }}
      className="origin-top select-none pointer-events-none"
    >
      <svg viewBox="0 0 36 58" className="w-7 h-11 sm:w-8 sm:h-12 drop-shadow-[0_0_10px_rgba(245,158,11,0.45)]" fill="none">
        <line x1="18" y1="0" x2="18" y2="8" stroke="#fbbf24" strokeWidth="2" />
        <rect x="12" y="8" width="12" height="4" rx="1.5" fill="#fbbf24" />
        <ellipse cx="18" cy="24" rx="13" ry="13" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.8" />
        <ellipse cx="18" cy="24" rx="6.5" ry="13" stroke="#fde047" strokeOpacity="0.6" strokeWidth="1.2" />
        <rect x="12" y="36" width="12" height="4" rx="1.5" fill="#fbbf24" />
        <path d="M15 40 V51 M18 40 V55 M21 40 V51" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
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
  const [showPaytable, setShowPaytable] = useState(false);

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
  const isBigWin = winAmount > 0 && (fullScreenBonus || winMult >= 8);
  const parsedStake = parseFloat(stake || '0') || 0;

  return (
    <div className="relative rounded-3xl p-3.5 sm:p-5 space-y-4 overflow-hidden border-2 border-amber-500/45 bg-[radial-gradient(ellipse_at_top,#4c1118_0%,#1c0609_48%,#0a0305_100%)] shadow-[0_20px_60px_rgba(140,20,10,0.42),inset_0_1px_0_rgba(253,224,71,0.28)]">
      {/* Brilho dourado no topo do gabinete */}
      <div className="absolute top-0 inset-x-10 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent pointer-events-none" />

      {/* Padrão sutil de nuvens/treliça oriental */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20px 20px, #fbbf24 1.2px, transparent 1.2px), radial-gradient(circle at 0 0, #fbbf24 1.2px, transparent 1.2px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Lanternas laterais (desktop/tablet) */}
      <div className="hidden sm:block absolute top-0 left-3 z-10">
        <HangingLantern delay={0} />
      </div>
      <div className="hidden sm:block absolute top-0 right-3 z-10">
        <HangingLantern delay={1.2} />
      </div>

      {/* Palco Imperial do Mascote + Header */}
      <div className="relative z-10 flex flex-col items-center text-center pt-1">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute inset-[-22%] rounded-full blur-2xl transition-opacity duration-500 pointer-events-none ${
              winAmount > 0 ? 'bg-amber-400/45 opacity-100' : 'bg-amber-500/20 opacity-75'
            }`}
          />
          <motion.div
            animate={
              isSpinning
                ? { y: [-3, 3, -3], rotate: [-5, 5, -5] }
                : isBigWin
                  ? { scale: [1, 1.14, 1], rotate: [-4, 4, 0] }
                  : { y: [0, -2, 0] }
            }
            transition={{
              repeat: Infinity,
              duration: isSpinning ? 0.35 : isBigWin ? 0.55 : 2.8,
              ease: 'easeInOut',
            }}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-red-700 p-[2px] shadow-[0_0_28px_rgba(245,158,11,0.5)]"
          >
            <div className="w-full h-full rounded-[14px] bg-gradient-to-b from-[#3d110e] to-[#170506] flex items-center justify-center">
              <SymbolArt id="tiger" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" />
            </div>
          </motion.div>
        </div>

        <div className="mt-2.5 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <h3 className="text-base sm:text-xl font-black font-display tracking-wide uppercase bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)]">
              Fortune Tiger Imperial
            </h3>
            <span className="text-[9px] font-mono font-black bg-amber-400/15 text-amber-200 border border-amber-400/45 px-2 py-0.5 rounded-full">
              5 LINHAS • ×10 TELA CHEIA
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-100/70">
            {isSpinning
              ? '✨ O Tigre Imperial está girando os rolos...'
              : fullScreenBonus
                ? '👑 BÊNÇÃO DO TIGRE! TELA CHEIA MULTIPLICADA POR 10×!'
                : winAmount > 0
                  ? `🎉 Linha premiada! Você faturou R$ ${winAmount.toFixed(2)}!`
                  : 'O Tigre Wild substitui qualquer símbolo para fechar linhas de ouro.'}
          </p>
        </div>

        {/* Toggle rápido da Tabela de Pagamentos */}
        <button
          type="button"
          onClick={() => setShowPaytable((v) => !v)}
          className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-200/85 hover:text-amber-200 bg-black/35 hover:bg-black/55 border border-amber-500/30 px-3 py-1 rounded-full cursor-pointer transition-colors"
        >
          <Info className="w-3 h-3 text-amber-400" />
          <span>{showPaytable ? 'Ocultar Tabela de Prêmios' : 'Ver Tabela de Prêmios (até 250×)'}</span>
        </button>
      </div>

      {/* Paytable Expansível (visual limpo e sem poluição no celular) */}
      <AnimatePresence>
        {showPaytable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {SYMBOLS.map((sy) => (
                <div
                  key={sy.id}
                  className={`bg-gradient-to-b ${sy.tileBg} border ${sy.ringColor} rounded-xl px-2 py-2 flex flex-col items-center text-center gap-1`}
                >
                  <SymbolArt id={sy.id} className="w-9 h-9" />
                  <div className="leading-tight">
                    <div className="text-[9px] font-bold text-amber-100/85 truncate">{sy.shortName}</div>
                    <div className="text-[11px] font-mono font-black text-amber-300">{sy.linePayout}×</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moldura Dourada do Gabinete 3×3 */}
      <div className="relative z-10 max-w-[430px] mx-auto">
        <div className="relative rounded-2xl p-[3px] bg-gradient-to-b from-yellow-300 via-amber-600 to-amber-900 shadow-[0_14px_40px_rgba(0,0,0,0.75),0_0_32px_rgba(245,158,11,0.22)]">
          {/* Ornamentos nos 4 cantos */}
          <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-200 to-amber-600 border border-amber-950 shadow z-20" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-200 to-amber-600 border border-amber-950 shadow z-20" />
          <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-200 to-amber-600 border border-amber-950 shadow z-20" />
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-yellow-200 to-amber-600 border border-amber-950 shadow z-20" />

          <div className="rounded-[14px] bg-gradient-to-b from-[#1a0709] via-[#0e0406] to-[#1a0709] p-2.5 sm:p-3.5 relative overflow-hidden">
            {/* Indicadores laterais das 5 linhas premiadas */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Trilho esquerdo (linhas 1, 2, 3) */}
              <div className="hidden sm:flex flex-col justify-around h-[280px] shrink-0">
                {[0, 1, 2].map((lid) => {
                  const active = wonLineIds.includes(lid) && !isSpinning;
                  return (
                    <span
                      key={lid}
                      className={`w-5 h-5 rounded-full text-[9px] font-mono font-black flex items-center justify-center border transition-all ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-yellow-100 shadow-[0_0_12px_rgba(251,191,36,0.9)] scale-110'
                          : 'bg-[#19080a] text-amber-500/50 border-amber-900/50'
                      }`}
                    >
                      {lid + 1}
                    </span>
                  );
                })}
              </div>

              {/* Janela dos 3 Rolos */}
              <div className="relative flex-1 rounded-xl bg-[#070203] border border-amber-500/30 p-1.5 sm:p-2 overflow-hidden shadow-[inset_0_0_28px_rgba(0,0,0,0.85)]">
                {/* Vinheta cilíndrica superior/inferior simulando tambor 3D */}
                <div className="absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-black/75 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/75 to-transparent z-10 pointer-events-none" />

                {/* SVG Overlay para linhas vencedoras com glow */}
                {wonLineIds.length > 0 && !isSpinning && (
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-20 pointer-events-none">
                    <defs>
                      <filter id="ft-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.6" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {wonLineIds.map((lineId) => {
                      const line = PAYLINES.find((l) => l.id === lineId);
                      if (!line) return null;
                      const [x1, y1, x2, y2] = line.coords;
                      return (
                        <g key={lineId} filter="url(#ft-line-glow)">
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" opacity="0.92" />
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fef9c3" strokeWidth="1.1" strokeLinecap="round" />
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* 3 Colunas independentes */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[0, 1, 2].map((colIdx) => {
                    const spinning = colSpinning[colIdx];
                    const colCells = [colIdx, colIdx + 3, colIdx + 6];
                    return (
                      <div
                        key={colIdx}
                        className="relative rounded-lg bg-[#0c0405] border border-amber-900/45 p-1 overflow-hidden"
                        style={{ contain: 'paint' }}
                      >
                        {spinning ? (
                          <div className="h-[246px] sm:h-[282px] overflow-hidden relative flex items-center justify-center">
                            <motion.div
                              initial={{ y: -130 }}
                              animate={{ y: 130 }}
                              transition={{ repeat: Infinity, duration: turboMode ? 0.13 : 0.2, ease: 'linear' }}
                              className="flex flex-col gap-2.5 items-center opacity-85 blur-[0.8px] gpu-strip"
                            >
                              {REEL_BLUR_STRIP.map((sym, k) => (
                                <div
                                  key={k}
                                  className={`w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-xl bg-gradient-to-b ${sym.tileBg} border ${sym.ringColor} flex items-center justify-center`}
                                >
                                  <SymbolArt id={sym.id} className="w-12 h-12 sm:w-14 sm:h-14" />
                                </div>
                              ))}
                            </motion.div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 sm:gap-2">
                            {colCells.map((cellIdx) => {
                              const sym = grid[cellIdx];
                              const isHit = wonCells.has(cellIdx);
                              const dimOthers = wonCells.size > 0 && !isHit && !isSpinning;
                              return (
                                <motion.div
                                  key={cellIdx}
                                  initial={{ y: -12, scale: 0.96, opacity: 0.75 }}
                                  animate={{
                                    y: 0,
                                    scale: isHit ? [1, 1.05, 1] : 1,
                                    opacity: dimOthers ? 0.48 : 1,
                                  }}
                                  transition={{
                                    y: { type: 'spring', stiffness: 360, damping: 24 },
                                    scale: isHit ? { repeat: Infinity, duration: 0.9 } : { duration: 0.2 },
                                  }}
                                  style={
                                    isHit
                                      ? { boxShadow: `0 0 22px ${sym.glowColor}, inset 0 1px 0 rgba(255,255,255,0.28)` }
                                      : undefined
                                  }
                                  className={`aspect-square rounded-xl bg-gradient-to-b ${sym.tileBg} border-2 flex flex-col items-center justify-center relative select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${
                                    isHit ? 'border-yellow-300 ring-2 ring-amber-400/80 z-10' : sym.ringColor
                                  }`}
                                >
                                  {sym.tag && (
                                    <span className="absolute -bottom-0.5 inset-x-2 text-center text-[8px] font-black tracking-widest py-0.5 rounded-t-md bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 shadow">
                                      {sym.tag}
                                    </span>
                                  )}
                                  <SymbolArt
                                    id={sym.id}
                                    className={`w-12 h-12 sm:w-14 sm:h-14 drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)] transition-transform ${
                                      isHit ? 'scale-110' : ''
                                    }`}
                                  />
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

              {/* Trilho direito (diagonais 4 e 5) */}
              <div className="hidden sm:flex flex-col justify-between py-6 h-[280px] shrink-0">
                {[3, 4].map((lid) => {
                  const active = wonLineIds.includes(lid) && !isSpinning;
                  return (
                    <span
                      key={lid}
                      className={`w-5 h-5 rounded-full text-[9px] font-mono font-black flex items-center justify-center border transition-all ${
                        active
                          ? 'bg-amber-400 text-slate-950 border-yellow-100 shadow-[0_0_12px_rgba(251,191,36,0.9)] scale-110'
                          : 'bg-[#19080a] text-amber-500/50 border-amber-900/50'
                      }`}
                    >
                      {lid + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Placar / Banner de Vitória integrado ao gabinete */}
            <div className="min-h-[50px] flex items-center justify-center mt-2.5">
              <AnimatePresence mode="wait">
                {showWinBanner && winAmount > 0 && !isSpinning ? (
                  <motion.div
                    key="win"
                    initial={{ scale: 0.78, y: 6, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`py-2 px-5 rounded-2xl border text-xs sm:text-sm font-black font-mono flex items-center gap-2 ${
                      fullScreenBonus
                        ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-slate-950 border-yellow-100 shadow-[0_0_32px_rgba(251,191,36,0.75)]'
                        : isBigWin
                          ? 'bg-gradient-to-r from-amber-500/30 via-yellow-500/25 to-amber-500/30 border-yellow-300/75 text-yellow-200 shadow-[0_0_24px_rgba(251,191,36,0.4)]'
                          : 'bg-amber-500/15 border-amber-400/55 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.22)]'
                    }`}
                  >
                    {fullScreenBonus || isBigWin ? (
                      <Trophy className="w-4 h-4 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
                    )}
                    <span>
                      {fullScreenBonus
                        ? 'TELA CHEIA ×10! '
                        : isBigWin
                          ? 'GRANDE GANHO! '
                          : `${wonLineIds.length} Linha(s) • `}
                      {winMult}× = R$ {winAmount.toFixed(2)}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-[11px] font-mono text-amber-200/55 bg-black/35 border border-amber-900/40 px-4 py-1.5 rounded-full"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500/70" />
                    <span>
                      {isSpinning
                        ? 'Boa sorte...'
                        : stats.spins > 0
                          ? 'Gire novamente para despertar a fortuna'
                          : 'Escolha a aposta e toque em GIRAR'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Console de Controle Estilo Arcade */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
        <div className="bg-[#160609]/90 border border-amber-500/25 rounded-2xl p-3.5 space-y-2.5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-[10px] text-amber-300/85 uppercase font-bold tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Aposta (R$)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTurboMode((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  turboMode
                    ? 'bg-amber-400/20 border-amber-300 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                    : 'bg-[#0a0305] border-amber-900/50 text-slate-400 hover:text-amber-200'
                }`}
              >
                <Zap className="w-3 h-3" /> Turbo
              </button>
              <button
                type="button"
                onClick={() => setAutoRemaining((c) => (c > 0 ? 0 : 10))}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  autoRemaining > 0
                    ? 'bg-brand/20 border-brand text-brand shadow-[0_0_12px_rgba(0,255,135,0.2)]'
                    : 'bg-[#0a0305] border-amber-900/50 text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-3 h-3" /> {autoRemaining > 0 ? `Auto (${autoRemaining})` : 'Auto 10×'}
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              step="1"
              disabled={isSpinning || autoRemaining > 0}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="flex-1 bg-[#090304] border border-amber-800/60 focus:border-amber-400 rounded-xl px-3 py-2 text-base sm:text-sm font-mono font-bold text-white focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => adjustStake(0.5)}
              disabled={isSpinning || autoRemaining > 0}
              className="px-3.5 rounded-xl bg-[#090304] hover:bg-amber-950/50 border border-amber-800/60 text-xs font-mono font-bold text-amber-300 cursor-pointer disabled:opacity-40 transition-colors"
            >
              ½
            </button>
            <button
              type="button"
              onClick={() => adjustStake(2)}
              disabled={isSpinning || autoRemaining > 0}
              className="px-3.5 rounded-xl bg-[#090304] hover:bg-amber-950/50 border border-amber-800/60 text-xs font-mono font-bold text-amber-300 cursor-pointer disabled:opacity-40 transition-colors"
            >
              2×
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 5, 10, 25, 50].map((v) => (
              <button
                key={v}
                type="button"
                disabled={isSpinning || autoRemaining > 0}
                onClick={() => setStake(String(v))}
                className={`py-1.5 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer disabled:opacity-40 ${
                  stake === String(v)
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'bg-[#090304] border border-amber-900/50 text-slate-300 hover:border-amber-500/60 hover:text-amber-200'
                }`}
              >
                R${v}
              </button>
            ))}
          </div>
        </div>

        {/* Botão Imperial de Giro */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => (autoRemaining > 0 ? setAutoRemaining(0) : triggerSpin(false))}
          disabled={!autoRemaining && (isSpinning || parsedStake <= 0 || parsedStake > balance)}
          className="md:w-52 relative overflow-hidden bg-gradient-to-b from-yellow-300 via-amber-500 to-red-600 hover:brightness-110 disabled:from-[#221215] disabled:to-[#13090b] disabled:text-slate-500 text-slate-950 font-black py-4 px-6 rounded-2xl text-sm uppercase tracking-wider flex flex-col items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(245,158,11,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] border-2 border-yellow-200/70 disabled:border-white/10"
        >
          <span className="flex items-center gap-2 text-base font-display">
            <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
            {autoRemaining > 0 ? 'Parar Auto' : isSpinning ? 'Girando...' : 'GIRAR'}
          </span>
          <span className="text-[11px] font-mono font-extrabold opacity-85">
            R$ {parsedStake.toFixed(2)}
          </span>
        </motion.button>
      </div>

      {/* Estatísticas da Sessão */}
      <div className="relative z-10 grid grid-cols-4 gap-2">
        <div className="bg-black/35 border border-amber-900/45 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-200/60 uppercase font-bold tracking-wider">Giros</p>
          <p className="text-sm font-black text-white font-mono">{stats.spins}</p>
        </div>
        <div className="bg-black/35 border border-amber-900/45 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-200/60 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-black text-amber-300 font-mono">{stats.wins}</p>
        </div>
        <div className="bg-black/35 border border-amber-900/45 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-200/60 uppercase font-bold tracking-wider">Win Rate</p>
          <p className="text-sm font-black text-slate-200 font-mono">{winRate}%</p>
        </div>
        <div className="bg-black/35 border border-amber-900/45 rounded-xl p-2.5 text-center">
          <p className="text-[8px] text-amber-200/60 uppercase font-bold tracking-wider">Maior Ganho</p>
          <p className="text-sm font-black text-brand font-mono">R$ {stats.biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
