import { useState, useMemo } from 'react';
import { Bomb, Diamond, DollarSign, Play, Sparkles, ShieldCheck, Shuffle } from 'lucide-react';
import { motion } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface MinesGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

const GRID_SIZE = 25;
const MINE_PRESETS = [1, 3, 5, 10, 15];

function calcMultiplier(mines: number, hits: number): number {
  if (hits <= 0) return 1;
  let prob = 1;
  for (let i = 0; i < hits; i++) {
    prob *= (GRID_SIZE - mines - i) / (GRID_SIZE - i);
  }
  const fairMult = 1 / prob;
  return Number((0.98 * fairMult).toFixed(2));
}

export default function MinesGame({ balance, onUpdateBalance, onAddBetHistory }: MinesGameProps) {
  const [stake, setStake] = useState('5');
  const [minesCount, setMinesCount] = useState(3);
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [minesPositions, setMinesPositions] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [explodedTile, setExplodedTile] = useState<number | null>(null);
  const [activeStake, setActiveStake] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [stats, setStats] = useState({ games: 0, wins: 0, biggestWin: 0 });
  const { play } = useSound();

  const hits = revealed.size;
  const currentMult = useMemo(() => calcMultiplier(minesCount, hits), [minesCount, hits]);
  const nextMult = useMemo(
    () => (hits < GRID_SIZE - minesCount ? calcMultiplier(minesCount, hits + 1) : currentMult),
    [minesCount, hits, currentMult]
  );

  const startRound = () => {
    const bet = parseFloat(stake);
    if (isNaN(bet) || bet <= 0) {
      alert('Insira um valor de aposta válido.');
      return;
    }
    if (bet > balance) {
      alert('Saldo insuficiente.');
      return;
    }

    const pool = Array.from({ length: GRID_SIZE }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    play('deal');
    onUpdateBalance(-bet);
    setActiveStake(bet);
    setMinesPositions(new Set(pool.slice(0, minesCount)));
    setRevealed(new Set());
    setExplodedTile(null);
    setLastWin(0);
    setStatus('playing');
    setStats((s) => ({ ...s, games: s.games + 1 }));
  };

  const handleCashout = (customHits?: number) => {
    if (status !== 'playing') return;
    const hitCount = customHits ?? revealed.size;
    if (hitCount <= 0) return;

    const finalMult = calcMultiplier(minesCount, hitCount);
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
      id: `mines-${Date.now()}`,
      matchName: 'Mines Omnitrix',
      selectionName: `${hitCount} diamantes (${minesCount} minas)`,
      odds: finalMult,
      stake: activeStake,
      potentialPayout: payout,
      status: 'won',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'casino',
      outcomeValue: `${finalMult.toFixed(2)}x`,
    });
  };

  const revealTile = (idx: number) => {
    if (status !== 'playing' || revealed.has(idx)) return;

    if (minesPositions.has(idx)) {
      play('crash');
      setExplodedTile(idx);
      setStatus('lost');
      onAddBetHistory({
        id: `mines-${Date.now()}`,
        matchName: 'Mines Omnitrix',
        selectionName: `Explodiu (${revealed.size} acertos / ${minesCount} minas)`,
        odds: 0,
        stake: activeStake,
        potentialPayout: 0,
        status: 'lost',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'BOMBA 💥',
      });
      return;
    }

    const nextRevealed = new Set(revealed);
    nextRevealed.add(idx);
    setRevealed(nextRevealed);
    play(nextRevealed.size >= 4 ? 'rare' : 'cardFlip');

    if (nextRevealed.size >= GRID_SIZE - minesCount) {
      handleCashout(nextRevealed.size);
    }
  };

  const handlePickRandom = () => {
    if (status !== 'playing') return;
    const available = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => !revealed.has(i));
    if (available.length === 0) return;
    const picked = available[Math.floor(Math.random() * available.length)];
    revealTile(picked);
  };

  const adjustStake = (factor: number) => {
    if (status === 'playing') return;
    const curr = parseFloat(stake) || 5;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent" />

      <div className="bg-[#070910] border border-brand/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand/15 border border-brand/30 text-brand">
            <Bomb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2">
              Mines Omnitrix
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                RTP 98% • 5×5
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Abra os cristais verdes e saque antes de acertar uma mina</p>
          </div>
        </div>
        <div className="text-right font-mono text-xs shrink-0">
          <div className="text-[9px] text-slate-500 uppercase">Próximo Passo</div>
          <div className="text-brand font-black">{nextMult.toFixed(2)}×</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-start">
        {/* Tabuleiro 5x5 */}
        <div className="bg-[#06070d] border border-[#1a1d2e] rounded-2xl p-3 sm:p-4 relative">
          <div className="grid grid-cols-5 gap-2 max-w-[380px] mx-auto">
            {Array.from({ length: GRID_SIZE }, (_, idx) => {
              const isRevealed = revealed.has(idx);
              const isMine = minesPositions.has(idx);
              const isExploded = explodedTile === idx;
              const boardEnded = status === 'won' || status === 'lost';

              let tileClass = 'bg-[#0e121f] border-[#1f243a] hover:border-brand/50 hover:bg-[#141a2d]';
              if (isRevealed) {
                tileClass = 'bg-brand/15 border-brand/70 shadow-[0_0_16px_rgba(0,255,135,0.28)]';
              } else if (isExploded) {
                tileClass = 'bg-rose-500/25 border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.5)]';
              } else if (boardEnded && isMine) {
                tileClass = 'bg-rose-950/35 border-rose-500/40 opacity-75';
              } else if (boardEnded && !isMine) {
                tileClass = 'bg-[#0b1514] border-brand/25 opacity-45';
              }

              return (
                <motion.button
                  key={idx}
                  whileHover={status === 'playing' && !isRevealed ? { scale: 1.04 } : {}}
                  whileTap={status === 'playing' && !isRevealed ? { scale: 0.94 } : {}}
                  onClick={() => revealTile(idx)}
                  disabled={status !== 'playing' || isRevealed}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all duration-150 ${
                    status === 'playing' && !isRevealed ? 'cursor-pointer' : 'cursor-default'
                  } ${tileClass}`}
                >
                  {isRevealed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-brand drop-shadow-[0_0_8px_rgba(0,255,135,0.8)]">
                      <Diamond className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
                    </motion.div>
                  ) : isExploded || (boardEnded && isMine) ? (
                    <span className="text-xl sm:text-2xl">{isExploded ? '💥' : '💣'}</span>
                  ) : boardEnded && !isMine ? (
                    <Diamond className="w-4 h-4 text-brand/60" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700/70" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {status === 'won' && (
            <div className="mt-3 text-center bg-brand/10 border border-brand/35 rounded-xl py-2 px-3 text-xs font-extrabold text-brand">
              🎉 Saque realizado! +{currentMult.toFixed(2)}× = R$ {lastWin.toFixed(2)}
            </div>
          )}
          {status === 'lost' && (
            <div className="mt-3 text-center bg-rose-500/10 border border-rose-500/35 rounded-xl py-2 px-3 text-xs font-extrabold text-rose-400">
              💥 Mina atingida! Tente novamente.
            </div>
          )}
        </div>

        {/* Controles laterais */}
        <div className="bg-[#080a12] border border-[#1a1d2e] rounded-2xl p-4 space-y-3.5">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-1.5">
              <DollarSign className="w-3 h-3 text-brand" /> Aposta (R$)
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                disabled={status === 'playing'}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="flex-1 bg-[#05060b] border border-[#1d2134] focus:border-brand rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => adjustStake(0.5)}
                disabled={status === 'playing'}
                className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 hover:border-brand/40 cursor-pointer disabled:opacity-40"
              >
                1/2
              </button>
              <button
                onClick={() => adjustStake(2)}
                disabled={status === 'playing'}
                className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 hover:border-brand/40 cursor-pointer disabled:opacity-40"
              >
                2×
              </button>
            </div>
            <div className="flex gap-1 mt-1.5">
              {[1, 5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  disabled={status === 'playing'}
                  onClick={() => setStake(String(v))}
                  className="flex-1 py-1 text-[9px] font-bold rounded-lg bg-[#05060b] border border-[#1c1f2e] text-slate-400 hover:text-white cursor-pointer disabled:opacity-40"
                >
                  R${v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between mb-1.5">
              <span>Quantidade de Minas</span>
              <span className="text-brand font-mono">{GRID_SIZE - minesCount} 💎 livres</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {MINE_PRESETS.map((m) => (
                <button
                  key={m}
                  disabled={status === 'playing'}
                  onClick={() => {
                    play('click');
                    setMinesCount(m);
                  }}
                  className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                    minesCount === m
                      ? 'bg-brand/20 border-brand text-brand shadow-[0_0_10px_rgba(0,255,135,0.2)]'
                      : 'bg-[#05060b] border-[#1d2134] text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {status === 'playing' ? (
            <div className="space-y-2">
              <div className="bg-[#05060b] border border-brand/25 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Multiplicador Atual</span>
                <span className="text-brand font-black">{currentMult.toFixed(2)}×</span>
              </div>
              <button
                onClick={handlePickRandom}
                className="w-full py-2.5 rounded-xl bg-[#101524] hover:bg-[#171d32] border border-cyan-500/35 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" /> Escolher Aleatório
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={hits <= 0}
                onClick={() => handleCashout()}
                className="w-full py-3.5 rounded-xl bg-brand hover:bg-[#00e074] disabled:bg-[#1a1c29] disabled:text-slate-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(0,255,135,0.4)]"
              >
                <Sparkles className="w-4 h-4" />
                {hits > 0 ? `SACAR R$ ${(activeStake * currentMult).toFixed(2)}` : 'Abra 1 Cristal'}
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={startRound}
              disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              <Play className="w-4 h-4" /> Começar Partida
            </motion.button>
          )}

          <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
            <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
              <div className="text-[8px] text-slate-500 uppercase">Jogos</div>
              <div className="text-xs font-mono font-bold text-white">{stats.games}</div>
            </div>
            <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
              <div className="text-[8px] text-slate-500 uppercase">Vitórias</div>
              <div className="text-xs font-mono font-bold text-brand">{stats.wins}</div>
            </div>
            <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
              <div className="text-[8px] text-slate-500 uppercase">Recorde</div>
              <div className="text-xs font-mono font-bold text-amber-400">R$ {stats.biggestWin.toFixed(0)}</div>
            </div>
          </div>

          <div className="text-[9px] text-slate-500 flex items-center gap-1 justify-center">
            <ShieldCheck className="w-3 h-3 text-brand" /> Campo Minado Justo · RTP 98%
          </div>
        </div>
      </div>
    </div>
  );
}
