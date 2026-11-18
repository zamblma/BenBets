import { useState } from 'react';
import { Trophy, DollarSign, Play, Sparkles, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface PenaltyGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

type KeeperMode = 'normal' | 'hard';

const MODE_MULTS: Record<KeeperMode, number[]> = {
  normal: [1.60, 2.56, 4.10, 6.55, 10.49], // Goleiro defende 2 de 5 cantos (60% gol)
  hard: [2.40, 5.76, 13.82, 33.18, 79.63], // Goleiro defende 3 de 5 cantos (40% gol)
};

const GOAL_SPOTS = [
  { id: 0, label: 'Ângulo Esq.', short: '↖ Esq. Alto' },
  { id: 1, label: 'Centro Alto', short: '⬆ Gaveta' },
  { id: 2, label: 'Ângulo Dir.', short: '↗ Dir. Alto' },
  { id: 3, label: 'Canto Esq.', short: '↙ Rasteiro Esq.' },
  { id: 4, label: 'Canto Dir.', short: '↘ Rasteiro Dir.' },
];

export default function PenaltyGame({ balance, onUpdateBalance, onAddBetHistory }: PenaltyGameProps) {
  const [stake, setStake] = useState('5');
  const [mode, setMode] = useState<KeeperMode>('normal');
  const [status, setStatus] = useState<'idle' | 'playing' | 'kicking' | 'won' | 'saved'>('idle');
  const [stage, setStage] = useState(0); // 0..5 gols marcados
  const [activeStake, setActiveStake] = useState(0);
  const [chosenSpot, setChosenSpot] = useState<number | null>(null);
  const [keeperSpots, setKeeperSpots] = useState<number[]>([]);
  const [lastWin, setLastWin] = useState(0);
  const [stats, setStats] = useState({ goals: 0, wins: 0, biggestWin: 0 });
  const { play } = useSound();

  const mults = MODE_MULTS[mode];
  const currentMult = stage > 0 ? mults[stage - 1] : 1;

  const startMatch = () => {
    const bet = parseFloat(stake);
    if (isNaN(bet) || bet <= 0) {
      alert('Insira um valor válido.');
      return;
    }
    if (bet > balance) {
      alert('Saldo insuficiente.');
      return;
    }
    play('deal');
    onUpdateBalance(-bet);
    setActiveStake(bet);
    setStage(0);
    setChosenSpot(null);
    setKeeperSpots([]);
    setLastWin(0);
    setStatus('playing');
  };

  const finishCashout = (finalStage: number) => {
    const finalMult = mults[finalStage - 1];
    const payout = Number((activeStake * finalMult).toFixed(2));
    onUpdateBalance(payout);
    play('cashout');
    setLastWin(payout);
    setStatus('won');
    setStats((s) => ({
      ...s,
      wins: s.wins + 1,
      biggestWin: Math.max(s.biggestWin, payout),
    }));

    onAddBetHistory({
      id: `penalty-${Date.now()}`,
      matchName: `Pênalti Campeão (${mode === 'hard' ? 'Difícil' : 'Normal'})`,
      selectionName: `${finalStage} gol${finalStage > 1 ? 's' : ''} seguidos`,
      odds: finalMult,
      stake: activeStake,
      potentialPayout: payout,
      status: 'won',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'casino',
      outcomeValue: `${finalMult.toFixed(2)}×`,
    });
  };

  const kickSpot = (spotId: number) => {
    if (status !== 'playing') return;

    play('spin');
    setChosenSpot(spotId);
    setStatus('kicking');

    const blockCount = mode === 'hard' ? 3 : 2;
    const spotsPool = [0, 1, 2, 3, 4];
    for (let i = spotsPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spotsPool[i], spotsPool[j]] = [spotsPool[j], spotsPool[i]];
    }
    const defended = spotsPool.slice(0, blockCount);
    setKeeperSpots(defended);

    setTimeout(() => {
      const isSaved = defended.includes(spotId);
      if (isSaved) {
        play('crash');
        setStatus('saved');
        onAddBetHistory({
          id: `penalty-${Date.now()}`,
          matchName: `Pênalti Campeão (${mode === 'hard' ? 'Difícil' : 'Normal'})`,
          selectionName: `Defendido no chute ${stage + 1}`,
          odds: 0,
          stake: activeStake,
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: 'DEFENDEU 🧤',
        });
      } else {
        const nextStage = stage + 1;
        setStage(nextStage);
        setStats((s) => ({ ...s, goals: s.goals + 1 }));
        play(nextStage >= 4 ? 'legendary' : 'win');

        if (nextStage >= mults.length) {
          finishCashout(nextStage);
        } else {
          setStatus('playing');
        }
      }
    }, 450);
  };

  const adjustStake = (factor: number) => {
    if (status === 'playing' || status === 'kicking') return;
    const curr = parseFloat(stake) || 5;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

      <div className="bg-[#070910] border border-emerald-500/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-brand">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2">
              Pênalti Campeão
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                Max {mults[mults.length - 1].toFixed(2)}×
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Escolha o canto do gol — marque seguido ou saque quando quiser!</p>
          </div>
        </div>
        <div className="text-right font-mono text-xs shrink-0">
          <div className="text-[9px] text-slate-500">Sequência</div>
          <div className="text-brand font-black">{stage}/5 Gols</div>
        </div>
      </div>

      {/* Barra de Multiplicadores */}
      <div className="grid grid-cols-5 gap-1.5">
        {mults.map((m, idx) => {
          const passed = idx < stage;
          const isNext = idx === stage && status === 'playing';
          return (
            <div
              key={idx}
              className={`rounded-xl border p-2 text-center font-mono transition-all ${
                passed
                  ? 'bg-brand/20 border-brand text-brand shadow-[0_0_12px_rgba(0,255,135,0.2)]'
                  : isNext
                  ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                  : 'bg-[#080a12] border-[#1a1d2e] text-slate-500'
              }`}
            >
              <div className="text-[8px] uppercase">Gol {idx + 1}</div>
              <div className="text-xs font-black">{m.toFixed(2)}×</div>
            </div>
          );
        })}
      </div>

      {/* Campo & Gol */}
      <div className="bg-gradient-to-b from-[#072719] via-[#061c13] to-[#05120c] border-2 border-emerald-900/50 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
        {/* Traves do gol */}
        <div className="max-w-md mx-auto border-t-4 border-x-4 border-white/80 rounded-t-xl p-3 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:10px_10px] relative">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {GOAL_SPOTS.slice(0, 3).map((s) => {
              const isBall = chosenSpot === s.id;
              const isKeeper = keeperSpots.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => kickSpot(s.id)}
                  disabled={status !== 'playing'}
                  className={`py-4 rounded-xl border-2 text-xs font-bold transition-all relative flex flex-col items-center justify-center ${
                    isBall && status === 'saved'
                      ? 'bg-rose-500/30 border-rose-400 text-white'
                      : isBall
                      ? 'bg-brand/25 border-brand text-white'
                      : status === 'playing'
                      ? 'bg-black/35 border-white/20 hover:border-brand hover:bg-brand/15 text-slate-200 cursor-pointer'
                      : 'bg-black/25 border-white/10 text-slate-500'
                  }`}
                >
                  <span className="text-lg">
                    {isKeeper && isBall ? '🧤💥' : isBall ? '⚽' : isKeeper ? '🧤' : '🎯'}
                  </span>
                  <span className="text-[9px] mt-1">{s.short}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 max-w-[78%] mx-auto">
            {GOAL_SPOTS.slice(3).map((s) => {
              const isBall = chosenSpot === s.id;
              const isKeeper = keeperSpots.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => kickSpot(s.id)}
                  disabled={status !== 'playing'}
                  className={`py-4 rounded-xl border-2 text-xs font-bold transition-all relative flex flex-col items-center justify-center ${
                    isBall && status === 'saved'
                      ? 'bg-rose-500/30 border-rose-400 text-white'
                      : isBall
                      ? 'bg-brand/25 border-brand text-white'
                      : status === 'playing'
                      ? 'bg-black/35 border-white/20 hover:border-brand hover:bg-brand/15 text-slate-200 cursor-pointer'
                      : 'bg-black/25 border-white/10 text-slate-500'
                  }`}
                >
                  <span className="text-lg">
                    {isKeeper && isBall ? '🧤💥' : isBall ? '⚽' : isKeeper ? '🧤' : '🎯'}
                  </span>
                  <span className="text-[9px] mt-1">{s.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 text-center">
          {status === 'won' && (
            <span className="inline-block bg-brand/15 border border-brand/40 text-brand text-xs font-black px-4 py-1.5 rounded-full">
              🏆 GOLAÇO! Sacou R$ {lastWin.toFixed(2)} ({currentMult.toFixed(2)}×)
            </span>
          )}
          {status === 'saved' && (
            <span className="inline-block bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-black px-4 py-1.5 rounded-full">
              🧤 O goleiro defendeu! Tente novamente.
            </span>
          )}
          {status === 'playing' && (
            <span className="text-[11px] font-mono text-emerald-200">
              {stage === 0 ? 'Clique em um canto do gol para bater o 1º pênalti!' : `GOL! Prêmio atual: R$ ${(activeStake * currentMult).toFixed(2)} — Chute ou Saque!`}
            </span>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="bg-[#080a12] border border-[#1a1d2e] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-1.5">
              <DollarSign className="w-3 h-3 text-brand" /> Aposta (R$)
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                disabled={status === 'playing' || status === 'kicking'}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="flex-1 bg-[#05060b] border border-[#1d2134] focus:border-brand rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
              />
              <button onClick={() => adjustStake(0.5)} disabled={status === 'playing' || status === 'kicking'} className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">1/2</button>
              <button onClick={() => adjustStake(2)} disabled={status === 'playing' || status === 'kicking'} className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">2×</button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-1.5">
              <ShieldAlert className="w-3 h-3 text-amber-400" /> Dificuldade do Goleiro
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                disabled={status === 'playing' || status === 'kicking'}
                onClick={() => setMode('normal')}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-50 ${
                  mode === 'normal' ? 'bg-brand/20 border-brand text-brand' : 'bg-[#05060b] border-[#1d2134] text-slate-400'
                }`}
              >
                Normal (60% Gol)
              </button>
              <button
                disabled={status === 'playing' || status === 'kicking'}
                onClick={() => setMode('hard')}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-50 ${
                  mode === 'hard' ? 'bg-rose-500/20 border-rose-400 text-rose-300' : 'bg-[#05060b] border-[#1d2134] text-slate-400'
                }`}
              >
                Difícil (79× Max)
              </button>
            </div>
          </div>
        </div>

        {status === 'playing' ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={stage <= 0}
            onClick={() => finishCashout(stage)}
            className="w-full py-3.5 rounded-xl bg-brand hover:bg-[#00e074] disabled:bg-[#1a1c29] disabled:text-slate-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_rgba(0,255,135,0.35)]"
          >
            <Sparkles className="w-4 h-4" />
            {stage > 0 ? `SACAR R$ ${(activeStake * currentMult).toFixed(2)} (${currentMult.toFixed(2)}×)` : 'Escolha um canto no gol acima'}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={startMatch}
            disabled={status === 'kicking' || !stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <Play className="w-4 h-4" /> {status === 'kicking' ? 'Chutando...' : 'Iniciar Cobrança de Pênaltis'}
          </motion.button>
        )}

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Gols</div>
            <div className="text-xs font-mono font-bold text-white">{stats.goals}</div>
          </div>
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Saques</div>
            <div className="text-xs font-mono font-bold text-brand">{stats.wins}</div>
          </div>
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Recorde</div>
            <div className="text-xs font-mono font-bold text-amber-400">R$ {stats.biggestWin.toFixed(0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
