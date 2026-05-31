import React, { useState } from 'react';
import { Play, DollarSign, Sparkles, Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface DiceGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
}

const DICE_FACES: Record<number, string> = {
  1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

type BetTab = 'sum' | 'overunder' | 'double';

interface SumBet { type: 'sum'; value: number; label: string; payout: number }
interface OverUnderBet { type: 'overunder'; value: 'over' | 'under'; label: string; payout: number }
interface DoubleBet { type: 'double'; label: string; payout: number }

type BetSelection = SumBet | OverUnderBet | DoubleBet;

const SUM_BETS: SumBet[] = [
  { type: 'sum', value: 2, label: '2', payout: 35 },
  { type: 'sum', value: 3, label: '3', payout: 17 },
  { type: 'sum', value: 4, label: '4', payout: 11 },
  { type: 'sum', value: 5, label: '5', payout: 8 },
  { type: 'sum', value: 6, label: '6', payout: 6 },
  { type: 'sum', value: 7, label: '7', payout: 5 },
  { type: 'sum', value: 8, label: '8', payout: 6 },
  { type: 'sum', value: 9, label: '9', payout: 8 },
  { type: 'sum', value: 10, label: '10', payout: 11 },
  { type: 'sum', value: 11, label: '11', payout: 17 },
  { type: 'sum', value: 12, label: '12', payout: 35 },
];

function DiceFace({ value }: { value: number }) {
  return (
    <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-white via-slate-100 to-slate-300 rounded-2xl border-2 border-slate-300 flex items-center justify-center shadow-[0_6px_0_rgba(0,0,0,0.15),0_10px_25px_rgba(0,0,0,0.25)]">
      <span className="text-4xl md:text-5xl lg:text-6xl select-none">{DICE_FACES[value]}</span>
    </div>
  );
}

export default function DiceGame({ balance, onUpdateBalance, onAddBetHistory }: DiceGameProps) {
  const [stake, setStake] = useState('');
  const [betTab, setBetTab] = useState<BetTab>('overunder');
  const [selectedBet, setSelectedBet] = useState<BetSelection | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<string>('');
  const [payout, setPayout] = useState(0);
  const [lastSum, setLastSum] = useState<number | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalRolls: 0, biggestWin: 0 });

  const checkWin = (d1: number, d2: number, bet: BetSelection): number => {
    const sum = d1 + d2;
    switch (bet.type) {
      case 'sum':
        return sum === bet.value ? bet.payout : 0;
      case 'overunder':
        if (bet.value === 'over') return sum > 7 ? bet.payout : 0;
        return sum < 7 ? bet.payout : 0;
      case 'double':
        return d1 === d2 ? bet.payout : 0;
    }
  };

  const handleRoll = () => {
    if (!selectedBet) { alert('Selecione uma aposta'); return; }
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) { alert('Valor inválido'); return; }
    if (playCost > balance) { alert('Saldo insuficiente'); return; }

    onUpdateBalance(-playCost);
    setRolling(true);
    setResult('');
    setPayout(0);
    setStats(s => ({ ...s, totalRolls: s.totalRolls + 1 }));

    let rollCount = 0;
    const maxRolls = 20;
    const interval = setInterval(() => {
      setDice1(Math.floor(Math.random() * 6) + 1);
      setDice2(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount >= maxRolls) {
        clearInterval(interval);
        setRolling(false);
        
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        setDice1(d1);
        setDice2(d2);
        setLastSum(d1 + d2);

        const multiplier = checkWin(d1, d2, selectedBet);
        if (multiplier > 0) {
          const winAmount = playCost * multiplier;
          setPayout(winAmount);
          onUpdateBalance(winAmount);
          setResult(`🎉 ${d1 + d2}! ${multiplier}x = R$ ${winAmount.toFixed(2)}`);
          setStats(s => ({
            ...s,
            wins: s.wins + 1,
            biggestWin: Math.max(s.biggestWin, winAmount),
          }));

          if (onAddBetHistory) {
            onAddBetHistory({
              id: `dice-${Date.now()}`,
              matchName: 'Dados',
              selectionName: `${DICE_FACES[d1]} ${DICE_FACES[d2]} = ${d1 + d2}`,
              odds: multiplier,
              stake: playCost,
              potentialPayout: winAmount,
              status: 'won',
              placedAt: new Date().toLocaleTimeString('pt-BR'),
              type: 'casino',
              outcomeValue: 'GANHOU',
            });
          }
        } else {
          setResult(`😞 Perdeu! Total = ${d1 + d2}`);
          setStats(s => ({ ...s, losses: s.losses + 1 }));

          if (onAddBetHistory) {
            onAddBetHistory({
              id: `dice-${Date.now()}`,
              matchName: 'Dados',
              selectionName: `${DICE_FACES[d1]} ${DICE_FACES[d2]} = ${d1 + d2}`,
              odds: 0,
              stake: playCost,
              potentialPayout: 0,
              status: 'lost',
              placedAt: new Date().toLocaleTimeString('pt-BR'),
              type: 'casino',
              outcomeValue: 'PERDEU',
            });
          }
        }
      }
    }, 50);
  };

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1b2e] to-[#0d0e16] border border-[#2a2d4e] rounded-xl p-3 sm:p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-amber-500/5" />
        <div className="flex items-center justify-between relative z-10">
          <span className="text-xs sm:text-sm text-white font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="text-base">🎲</span> Jogo dos Dados
          </span>
          <span className="text-[9px] text-slate-500 font-mono bg-[#0a0b12]/60 px-2 py-1 rounded-md border border-[#1b1e2e]">2 DADOS 6 LADOS</span>
        </div>
      </div>

      {/* Dice Display */}
      <div className="bg-gradient-to-b from-[#0d0e16] to-[#06070d] rounded-2xl p-6 sm:p-8 border border-[#1a1c2a] flex flex-col items-center gap-4 sm:gap-5">
        <motion.div
          className="flex gap-6 sm:gap-8 items-center"
          animate={rolling ? {
            x: [0, -3, 3, -3, 3, -2, 2, -2, 0],
            rotate: [0, -2, 2, -2, 2, -1, 1, -1, 0],
          } : { x: 0, rotate: 0 }}
          transition={{ duration: 0.4, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
        >
          <DiceFace value={dice1} />
          <span className="text-2xl sm:text-3xl text-slate-500 font-bold">+</span>
          <DiceFace value={dice2} />
        </motion.div>
        {lastSum !== null && !rolling && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={lastSum}
            className="text-center"
          >
            <span className="text-3xl sm:text-4xl font-black text-white font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">{lastSum}</span>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {result && !rolling && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className={`text-base sm:text-lg font-black font-mono py-2.5 px-6 rounded-full ${
                payout > 0
                  ? 'bg-brand/10 border-2 border-brand/40 text-brand shadow-[0_0_25px_rgba(0,255,135,0.3)]'
                  : 'bg-rose-500/10 border-2 border-rose-500/40 text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
              }`}
            >
              {result}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bet Type Tabs */}
      <div className="flex gap-1.5 bg-[#0d0e16]/40 rounded-xl p-1 border border-[#1a1c2a]">
        {([{ id: 'overunder' as BetTab, label: 'Over/Under 7' },
           { id: 'sum' as BetTab, label: 'Soma Exata' },
           { id: 'double' as BetTab, label: 'Duplo' }] as const).map(tab => (
          <button key={tab.id} onClick={() => { setBetTab(tab.id); setSelectedBet(null); }}
            className={`flex-1 py-2.5 rounded-lg text-[9px] sm:text-[10px] font-bold border transition-all duration-150 cursor-pointer ${
              betTab === tab.id
                ? 'bg-brand/20 border-brand text-brand shadow-[0_0_10px_rgba(0,255,135,0.1)]'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-[#16182a]'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bet Options */}
      {betTab === 'sum' ? (
        <div className="grid grid-cols-6 gap-1.5">
          {SUM_BETS.map(bet => (
            <button key={bet.value} onClick={() => setSelectedBet(bet)}
              className={`py-2 rounded-lg text-[10px] font-bold border transition-all duration-150 cursor-pointer ${
                selectedBet?.type === 'sum' && (selectedBet as SumBet).value === bet.value
                  ? 'bg-brand/20 border-brand text-brand shadow-[0_0_10px_rgba(0,255,135,0.1)]'
                  : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400 hover:text-white hover:border-slate-500'
              }`}>
              <div>{bet.label}</div>
              <div className="text-[7px] opacity-60">{bet.payout}x</div>
            </button>
          ))}
        </div>
      ) : betTab === 'overunder' ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'overunder' as const, value: 'under' as const, label: 'Abaixo de 7 (2-6)', payout: 2 },
            { type: 'overunder' as const, value: 'over' as const, label: 'Acima de 7 (8-12)', payout: 2 },
          ].map(bet => (
            <button key={bet.value} onClick={() => setSelectedBet(bet)}
              className={`py-3 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer ${
                selectedBet?.type === 'overunder' && (selectedBet as OverUnderBet).value === bet.value
                  ? 'bg-brand/20 border-brand text-brand shadow-[0_0_10px_rgba(0,255,135,0.1)]'
                  : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400 hover:text-white hover:border-slate-500'
              }`}>
              {bet.label}
              <div className="text-[9px] opacity-60 mt-0.5">{bet.payout}x</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1">
          {[
            { type: 'double' as const, label: 'Duplo (mesmo número)', payout: 6 },
          ].map((bet, i) => (
            <button key={i} onClick={() => setSelectedBet(bet)}
              className={`py-3 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer ${
                selectedBet?.type === 'double'
                  ? 'bg-brand/20 border-brand text-brand shadow-[0_0_10px_rgba(0,255,135,0.1)]'
                  : 'bg-[#0d0e16]/60 border-[#1a1c2a] text-slate-400 hover:text-white hover:border-slate-500'
              }`}>
              {bet.label}
              <div className="text-[9px] opacity-60 mt-0.5">{bet.payout}x</div>
            </button>
          ))}
        </div>
      )}

      {/* Stake + Roll */}
      <div className="space-y-3">
        <div>
          <label className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1 mb-1.5">
            <DollarSign className="w-3 h-3" /> Valor da Aposta (R$)
          </label>
          <input type="number" value={stake} onChange={e => setStake(e.target.value)}
            className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-brand rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand transition-all duration-150" />
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 5, 10, 25].map(val => (
            <button key={val} onClick={() => setStake(val.toString())}
              className="flex-1 py-1.5 text-[9px] font-bold rounded-md bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white hover:border-slate-500 cursor-pointer transition-all duration-150">
              R${val}
            </button>
          ))}
        </div>
        <motion.button
          onClick={handleRoll}
          disabled={rolling || !selectedBet || !stake || parseFloat(stake) > balance}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-shadow duration-300"
        >
          <Play className="w-4 h-4" />
          {rolling ? 'Rolando...' : 'Lançar Dados'}
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center hover:border-slate-600/50 transition-colors duration-200">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Rodadas</p>
          <p className="text-sm font-bold text-white font-mono mt-0.5">{stats.totalRolls}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center hover:border-slate-600/50 transition-colors duration-200">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Vitórias</p>
          <p className="text-sm font-bold text-brand font-mono mt-0.5">{stats.wins}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center hover:border-slate-600/50 transition-colors duration-200">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Derrotas</p>
          <p className="text-sm font-bold text-rose-400 font-mono mt-0.5">{stats.losses}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center hover:border-slate-600/50 transition-colors duration-200">
          <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Maior</p>
          <p className="text-sm font-bold text-yellow-400 font-mono mt-0.5">R$ {stats.biggestWin.toFixed(0)}</p>
        </div>
      </div>
    </div>
  );
}
