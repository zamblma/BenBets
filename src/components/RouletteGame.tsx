import React, { useState, useRef } from 'react';
import { DollarSign, Play, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface RouletteGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
}

const NUMBERS: { n: number; color: 'red' | 'black' | 'green' }[] = [
  { n: 0, color: 'green' },
  ...Array.from({ length: 36 }, (_, i) => ({
    n: i + 1,
    color: (i % 2 === 0 ? 'red' : 'black') as 'red' | 'black',
  })),
];

// Fix red/black distribution per real roulette
NUMBERS[1] = { n: 1, color: 'red' };
NUMBERS[2] = { n: 2, color: 'black' };
NUMBERS[3] = { n: 3, color: 'red' };
NUMBERS[4] = { n: 4, color: 'black' };
NUMBERS[5] = { n: 5, color: 'red' };
NUMBERS[6] = { n: 6, color: 'black' };
NUMBERS[7] = { n: 7, color: 'red' };
NUMBERS[8] = { n: 8, color: 'black' };
NUMBERS[9] = { n: 9, color: 'red' };
NUMBERS[10] = { n: 10, color: 'black' };
NUMBERS[11] = { n: 11, color: 'red' };
NUMBERS[12] = { n: 12, color: 'black' };
NUMBERS[13] = { n: 13, color: 'black' };
NUMBERS[14] = { n: 14, color: 'red' };
NUMBERS[15] = { n: 15, color: 'black' };
NUMBERS[16] = { n: 16, color: 'red' };
NUMBERS[17] = { n: 17, color: 'black' };
NUMBERS[18] = { n: 18, color: 'red' };
NUMBERS[19] = { n: 19, color: 'red' };
NUMBERS[20] = { n: 20, color: 'black' };
NUMBERS[21] = { n: 21, color: 'red' };
NUMBERS[22] = { n: 22, color: 'black' };
NUMBERS[23] = { n: 23, color: 'red' };
NUMBERS[24] = { n: 24, color: 'black' };
NUMBERS[25] = { n: 25, color: 'red' };
NUMBERS[26] = { n: 26, color: 'black' };
NUMBERS[27] = { n: 27, color: 'red' };
NUMBERS[28] = { n: 28, color: 'black' };
NUMBERS[29] = { n: 29, color: 'black' };
NUMBERS[30] = { n: 30, color: 'red' };
NUMBERS[31] = { n: 31, color: 'black' };
NUMBERS[32] = { n: 32, color: 'red' };
NUMBERS[33] = { n: 33, color: 'black' };
NUMBERS[34] = { n: 34, color: 'red' };
NUMBERS[35] = { n: 35, color: 'black' };
NUMBERS[36] = { n: 36, color: 'red' };

type BetType =
  | { type: 'number'; number: number }
  | { type: 'red' }
  | { type: 'black' }
  | { type: 'odd' }
  | { type: 'even' }
  | { type: 'low' }
  | { type: 'high' }
  | { type: 'dozen'; dozen: 1 | 2 | 3 };

const BET_OPTIONS: { label: string; betType: BetType; payout: number; color: string }[] = [
  { label: 'Vermelho', betType: { type: 'red' }, payout: 2, color: 'text-red-400 border-red-500/40' },
  { label: 'Preto', betType: { type: 'black' }, payout: 2, color: 'text-slate-200 border-slate-400/40' },
  { label: 'Par', betType: { type: 'even' }, payout: 2, color: 'text-emerald-400 border-emerald-500/40' },
  { label: 'Ímpar', betType: { type: 'odd' }, payout: 2, color: 'text-amber-400 border-amber-500/40' },
  { label: '1-18', betType: { type: 'low' }, payout: 2, color: 'text-blue-400 border-blue-500/40' },
  { label: '19-36', betType: { type: 'high' }, payout: 2, color: 'text-purple-400 border-purple-500/40' },
  { label: '1ª Dúzia', betType: { type: 'dozen', dozen: 1 }, payout: 3, color: 'text-cyan-400 border-cyan-500/40' },
  { label: '2ª Dúzia', betType: { type: 'dozen', dozen: 2 }, payout: 3, color: 'text-pink-400 border-pink-500/40' },
  { label: '3ª Dúzia', betType: { type: 'dozen', dozen: 3 }, payout: 3, color: 'text-lime-400 border-lime-500/40' },
];

export default function RouletteGame({ balance, onUpdateBalance, onAddBetHistory }: RouletteGameProps) {
  const [stake, setStake] = useState('');
  const [selectedBet, setSelectedBet] = useState<BetType | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ number: number; color: string } | null>(null);
  const [payout, setPayout] = useState(0);
  const [lastResult, setLastResult] = useState<{ number: number; color: string } | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalBets: 0, biggestWin: 0 });
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [spinAngle, setSpinAngle] = useState(0);

  const getPayoutForBet = (bet: BetType, num: number): number => {
    const entry = NUMBERS.find(n => n.n === num)!;
    switch (bet.type) {
      case 'number':
        return bet.number === num ? 36 : 0;
      case 'red': return entry.color === 'red' ? 2 : 0;
      case 'black': return entry.color === 'black' ? 2 : 0;
      case 'odd': return num !== 0 && num % 2 === 1 ? 2 : 0;
      case 'even': return num !== 0 && num % 2 === 0 ? 2 : 0;
      case 'low': return num >= 1 && num <= 18 ? 2 : 0;
      case 'high': return num >= 19 && num <= 36 ? 2 : 0;
      case 'dozen':
        if (num === 0) return 0;
        if (bet.dozen === 1) return num <= 12 ? 3 : 0;
        if (bet.dozen === 2) return num >= 13 && num <= 24 ? 3 : 0;
        if (bet.dozen === 3) return num >= 25 && num <= 36 ? 3 : 0;
        return 0;
    }
  };

  const handleSpin = () => {
    if (!selectedBet && selectedNumber === null) { alert('Selecione uma aposta'); return; }
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) { alert('Valor inválido'); return; }
    if (playCost > balance) { alert('Saldo insuficiente'); return; }

    const actualBet: BetType = selectedBet || { type: 'number', number: selectedNumber! };
    onUpdateBalance(-playCost);
    setSpinning(true);
    setResult(null);
    setPayout(0);
    setStats(s => ({ ...s, totalBets: s.totalBets + 1 }));

    const targetNum = Math.floor(Math.random() * 37);
    const targetEntry = NUMBERS.find(n => n.n === targetNum)!;
    const targetColor = targetEntry.color;
    const colorMap: Record<string, string> = { red: '#dc2626', black: '#1e293b', green: '#16a34a' };

    // spin animation
    const angle = 1080 + (targetNum * (360 / 37));
    setSpinAngle(prev => prev + angle + Math.random() * 360);

    setTimeout(() => {
      setSpinning(false);
      setResult({ number: targetNum, color: targetColor });
      setLastResult({ number: targetNum, color: targetColor });

      const multiplier = getPayoutForBet(actualBet, targetNum);
      if (multiplier > 0) {
        const winAmount = playCost * multiplier;
        setPayout(winAmount);
        onUpdateBalance(winAmount);
          winAmount > stats.biggestWin ? { ...s, wins: s.wins + 1, biggestWin: winAmount } : { ...s, wins: s.wins + 1 }

        if (onAddBetHistory) {
          onAddBetHistory({
            id: `roulette-${Date.now()}`,
            matchName: 'Roleta Europeia',
            selectionName: `${targetNum} ${targetColor === 'red' ? '🔴' : targetColor === 'black' ? '⚫' : '🟢'}`,
            odds: multiplier,
            stake: playCost,
            potentialPayout: winAmount,
            status: 'won',
            placedAt: new Date().toLocaleTimeString('pt-BR'),
            type: 'casino',
            outcomeValue: 'GANHOU'
          });
        }
      } else {
        setStats(s => ({ ...s, losses: s.losses + 1 }));
        if (onAddBetHistory) {
          onAddBetHistory({
            id: `roulette-${Date.now()}`,
            matchName: 'Roleta Europeia',
            selectionName: `${targetNum} ${targetColor === 'red' ? '🔴' : targetColor === 'black' ? '⚫' : '🟢'}`,
            odds: 0,
            stake: playCost,
            potentialPayout: 0,
            status: 'lost',
            placedAt: new Date().toLocaleTimeString('pt-BR'),
            type: 'casino',
            outcomeValue: 'PERDEU'
          });
        }
      }
    }, 2500);
  };

  const handleBetSelect = (bet: BetType) => {
    if (spinning) return;
    setSelectedBet(bet);
    setSelectedNumber(null);
  };

  const handleNumberSelect = (num: number) => {
    if (spinning) return;
    setSelectedNumber(num);
    setSelectedBet(null);
  };

  const colorBgClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-600 border-red-400';
      case 'black': return 'bg-slate-800 border-slate-400';
      case 'green': return 'bg-green-700 border-green-500';
      default: return 'bg-slate-700 border-slate-400';
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0d0e16] to-[#0a0b12] border border-[#1b1e2e] rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">🎡 Roleta Europeia</span>
          <span className="text-[8px] text-slate-500 font-mono">0-36 · PAGAMENTO 35:1</span>
        </div>
      </div>

      {/* Wheel + Last Result */}
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0">
          <motion.div
            ref={wheelRef}
            animate={{ rotate: spinAngle }}
            transition={{ duration: 2.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full h-full rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-500 flex items-center justify-center"
          >
            <div className="w-full h-full rounded-full relative overflow-hidden">
              {Array.from({ length: 37 }, (_, i) => {
                const angle = (i / 37) * 360;
                const entry = NUMBERS[i];
                const colorMap: Record<string, string> = { red: '#dc2626', black: '#1e293b', green: '#16a34a' };
                return (
                  <div key={i}
                    className="absolute top-0 left-1/2 w-[2px] origin-bottom"
                    style={{
                      height: '50%',
                      transform: `rotate(${angle}deg)`,
                      backgroundColor: colorMap[entry.color],
                    }}
                  />
                );
              })}
              <div className="absolute inset-2 rounded-full bg-[#0a0b12] flex items-center justify-center">
                <span className="text-xs font-bold text-slate-400">Roleta</span>
              </div>
            </div>
          </motion.div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
        </div>
        <div className="flex-1">
          {lastResult && (
            <div className="bg-[#0d0e16] border border-[#1a1c2a] rounded-xl p-3 text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Último Resultado</p>
              <div className={`inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-full ${colorBgClass(lastResult.color)}`}>
                <span className="text-lg font-black text-white">{lastResult.number}</span>
                <span className="text-xs text-white/80">{lastResult.color === 'red' ? '🔴' : lastResult.color === 'black' ? '⚫' : '🟢'}</span>
              </div>
            </div>
          )}
          {payout > 0 && (
            <div className="mt-2 text-center text-brand font-bold text-sm">+R$ {payout.toFixed(2)}</div>
          )}
        </div>
      </div>

      {/* Number Grid */}
      <div className="bg-[#0d0e16]/60 rounded-xl p-2 border border-[#1a1c2a]">
        <div className="grid grid-cols-12 gap-1">
          {/* 0 */}
          <button onClick={() => handleNumberSelect(0)}
            className={`col-span-1 aspect-square rounded-lg text-xs font-bold border ${selectedNumber === 0 ? 'ring-2 ring-yellow-400' : ''} bg-green-700 border-green-500 text-white cursor-pointer hover:brightness-110`}>
            0
          </button>
          {/* 1-36 */}
          {Array.from({ length: 36 }, (_, i) => {
            const num = i + 1;
            const entry = NUMBERS[num];
            const isSelected = selectedNumber === num;
            return (
              <button key={num} onClick={() => handleNumberSelect(num)}
                className={`aspect-square rounded-lg text-[9px] font-bold border ${isSelected ? 'ring-2 ring-yellow-400' : ''} ${entry.color === 'red' ? 'bg-red-600 border-red-400' : 'bg-slate-800 border-slate-400'} text-white cursor-pointer hover:brightness-110`}>
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Outside Bets */}
      <div className="grid grid-cols-3 gap-1.5">
        {BET_OPTIONS.map((opt, i) => (
          <button key={i} onClick={() => handleBetSelect(opt.betType)}
            className={`py-2 rounded-lg text-[9px] font-bold border cursor-pointer transition-all ${
              selectedBet === opt.betType
                ? 'bg-brand/20 border-brand text-brand'
                : `${opt.color} bg-[#0d0e16]/60 hover:bg-[#16182a]`
            }`}>
            {opt.label}
            <span className="block text-[8px] opacity-60">{opt.payout}x</span>
          </button>
        ))}
      </div>

      {/* Stake + Spin */}
      <div className="space-y-3">
        <div>
          <label className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1 mb-1.5">
            <DollarSign className="w-3 h-3" /> Valor da Aposta (R$)
          </label>
          <input type="number" value={stake} onChange={e => setStake(e.target.value)}
            className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-brand rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 5, 10, 25].map(val => (
            <button key={val} onClick={() => setStake(val.toString())}
              className="flex-1 py-1.5 text-[9px] font-bold rounded-md bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white cursor-pointer transition-colors">
              R${val}
            </button>
          ))}
        </div>
        <motion.button
          onClick={handleSpin}
          disabled={spinning || (!selectedBet && selectedNumber === null) || !stake || parseFloat(stake) > balance}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-gradient-to-r from-brand to-emerald-500 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,135,0.2)]"
        >
          <Play className="w-4 h-4" />
          {spinning ? 'Girando...' : 'Girar Roleta'}
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Rodadas</p>
          <p className="text-sm font-bold text-white font-mono">{stats.totalBets}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-bold text-brand font-mono">{stats.wins}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Derrotas</p>
          <p className="text-sm font-bold text-rose-400 font-mono">{stats.losses}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2 text-center">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Maior</p>
          <p className="text-sm font-bold text-yellow-400 font-mono">R$ {stats.biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
