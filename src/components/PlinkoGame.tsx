import { useState, useEffect, useRef } from 'react';
import { CircleDot, DollarSign, Play, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface PlinkoGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

type RiskLevel = 'low' | 'medium' | 'high';
type RowCount = 8 | 12 | 16;

const MULTIPLIERS: Record<RowCount, Record<RiskLevel, number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    high: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
  },
  12: {
    low: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    medium: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    high: [76, 18, 5.0, 1.8, 0.7, 0.2, 0.2, 0.2, 0.7, 1.8, 5.0, 18, 76],
  },
  16: {
    low: [16, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
    medium: [58, 15, 7.0, 4.0, 2.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 2.0, 4.0, 7.0, 15, 58],
    high: [130, 41, 10, 5.0, 2.0, 0.9, 0.4, 0.2, 0.2, 0.2, 0.4, 0.9, 2.0, 5.0, 10, 41, 130],
  },
};

interface ActiveBall {
  id: string;
  path: number[];
  step: number;
  targetBucket: number;
  mult: number;
  stake: number;
}

export default function PlinkoGame({ balance, onUpdateBalance, onAddBetHistory }: PlinkoGameProps) {
  const [stake, setStake] = useState('5');
  const [risk, setRisk] = useState<RiskLevel>('medium');
  const [rows, setRows] = useState<RowCount>(12);
  const [balls, setBalls] = useState<ActiveBall[]>([]);
  const [highlightedBucket, setHighlightedBucket] = useState<number | null>(null);
  const [recentHits, setRecentHits] = useState<{ mult: number; payout: number; id: string }[]>([]);
  const timersRef = useRef<number[]>([]);
  const { play } = useSound();

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const buckets = MULTIPLIERS[rows][risk];

  const dropBall = () => {
    const bet = parseFloat(stake);
    if (isNaN(bet) || bet <= 0) {
      alert('Insira um valor válido.');
      return;
    }
    if (bet > balance) {
      alert('Saldo insuficiente.');
      return;
    }

    onUpdateBalance(-bet);
    play('click');

    // Trajetória binomial: cada linha escolhe -0.5 (esq) ou +0.5 (dir)
    const path: number[] = [0];
    let pos = 0;
    let rightCount = 0;
    for (let r = 0; r < rows; r++) {
      const goRight = Math.random() >= 0.5;
      if (goRight) rightCount += 1;
      pos += goRight ? 0.5 : -0.5;
      path.push(pos);
    }

    const mult = buckets[rightCount] ?? 0.5;
    const ballId = `plk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newBall: ActiveBall = {
      id: ballId,
      path,
      step: 0,
      targetBucket: rightCount,
      mult,
      stake: bet,
    };

    setBalls((prev) => [...prev, newBall]);

    for (let step = 1; step <= rows; step++) {
      const tid = window.setTimeout(() => {
        setBalls((prev) =>
          prev.map((b) => (b.id === ballId ? { ...b, step } : b))
        );
        if (step % 2 === 1) play('tick');

        if (step === rows) {
          const payout = Number((bet * mult).toFixed(2));
          onUpdateBalance(payout);
          setHighlightedBucket(rightCount);
          setRecentHits((prev) => [{ mult, payout, id: ballId }, ...prev.slice(0, 9)]);

          if (mult >= 10) play('legendary');
          else if (mult >= 2) play('win');
          else if (mult < 1) play('lose');
          else play('reveal');

          onAddBetHistory({
            id: ballId,
            matchName: `Plinko (${rows}L · ${risk === 'high' ? 'Alto' : risk === 'medium' ? 'Médio' : 'Baixo'})`,
            selectionName: `Caiu em ${mult}×`,
            odds: mult,
            stake: bet,
            potentialPayout: payout,
            status: payout >= bet ? 'won' : 'lost',
            placedAt: new Date().toLocaleTimeString('pt-BR'),
            type: 'casino',
            outcomeValue: `${mult}x`,
          });

          const removeTimer = window.setTimeout(() => {
            setBalls((prev) => prev.filter((b) => b.id !== ballId));
            setHighlightedBucket((cur) => (cur === rightCount ? null : cur));
          }, 260);
          timersRef.current.push(removeTimer);
        }
      }, step * 68);
      timersRef.current.push(tid);
    }
  };

  // Coordenadas do SVG da pirâmide
  const svgW = 520;
  const svgH = 340;
  const topPad = 24;
  const bottomPad = 48;
  const usableH = svgH - topPad - bottomPad;
  const rowGap = usableH / rows;
  const pegGap = Math.min(28, (svgW - 64) / (rows + 1));

  const getCoord = (rowIdx: number, offsetSteps: number) => ({
    x: svgW / 2 + offsetSteps * pegGap,
    y: topPad + rowIdx * rowGap,
  });

  const adjustStake = (factor: number) => {
    const curr = parseFloat(stake) || 5;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  const bucketStyle = (m: number, idx: number) => {
    const isHit = highlightedBucket === idx;
    const base =
      m >= 15
        ? 'bg-rose-500 text-white border-rose-300'
        : m >= 3
        ? 'bg-amber-500 text-slate-950 border-amber-300'
        : m >= 1.1
        ? 'bg-brand text-slate-950 border-emerald-300'
        : 'bg-[#1a1f32] text-slate-300 border-[#2b324e]';
    return `${base} ${isHit ? 'scale-110 ring-2 ring-white brightness-125' : ''}`;
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />

      <div className="bg-[#070910] border border-fuchsia-500/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
            <CircleDot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2">
              Pirâmide Plinko
              <span className="text-[9px] font-mono bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 px-2 py-0.5 rounded-full">
                Max {Math.max(...buckets)}×
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Solte várias bolas ao mesmo tempo e acerte os cantos multiplicadores</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-[#0d101b] border border-[#1d2134] px-2.5 py-1 rounded-lg shrink-0">
          {balls.length} ativa{balls.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Histórico recente */}
      {recentHits.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[9px] font-mono text-slate-500 uppercase shrink-0">Últimas:</span>
          {recentHits.map((h) => (
            <span
              key={h.id}
              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border shrink-0 ${
                h.mult >= 10
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                  : h.mult >= 2
                  ? 'bg-brand/15 border-brand/40 text-brand'
                  : 'bg-[#121625] border-[#252a40] text-slate-400'
              }`}
            >
              {h.mult}×
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_250px] gap-4 items-start">
        {/* Board SVG + Buckets */}
        <div className="bg-[#05070e] border border-[#1a1d2e] rounded-2xl p-2.5 sm:p-4">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[340px] select-none overflow-visible">
            {/* Pinos */}
            {Array.from({ length: rows }, (_, r) => {
              const colsInRow = r + 3;
              return Array.from({ length: colsInRow }, (__, c) => {
                const offsetSteps = -(colsInRow - 1) / 2 + c;
                const { x, y } = getCoord(r, offsetSteps);
                return (
                  <circle
                    key={`p-${r}-${c}`}
                    cx={x}
                    cy={y}
                    r={rows === 16 ? 2.8 : 3.6}
                    fill="#94a3b8"
                    opacity={0.78}
                  />
                );
              });
            })}

            {/* Bolas animadas */}
            {balls.map((ball) => {
              const offset = ball.path[ball.step] ?? 0;
              const coord = getCoord(ball.step, offset);
              return (
                <motion.g
                  key={ball.id}
                  animate={{ x: coord.x, y: coord.y - 6 }}
                  transition={{ duration: 0.06, ease: 'easeOut' }}
                >
                  <circle r={rows === 16 ? 5.2 : 6.4} fill="#00ff87" />
                  <circle r={rows === 16 ? 8.5 : 10} fill="#00ff87" opacity={0.28} />
                </motion.g>
              );
            })}
          </svg>

          {/* Buckets na base */}
          <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
            {buckets.map((m, idx) => (
              <div
                key={idx}
                className={`py-1.5 rounded-md border text-center font-mono font-black transition-transform duration-150 ${
                  rows === 16 ? 'text-[7px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'
                } ${bucketStyle(m, idx)}`}
              >
                {m}×
              </div>
            ))}
          </div>
        </div>

        {/* Controles */}
        <div className="bg-[#080a12] border border-[#1a1d2e] rounded-2xl p-4 space-y-3.5">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-1.5">
              <DollarSign className="w-3 h-3 text-fuchsia-400" /> Aposta por Bola (R$)
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="flex-1 bg-[#05060b] border border-[#1d2134] focus:border-fuchsia-400 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
              />
              <button onClick={() => adjustStake(0.5)} className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">
                1/2
              </button>
              <button onClick={() => adjustStake(2)} className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">
                2×
              </button>
            </div>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 5, 10, 25].map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(String(v))}
                  className="flex-1 py-1 text-[9px] font-bold rounded-lg bg-[#05060b] border border-[#1c1f2e] text-slate-400 hover:text-white cursor-pointer"
                >
                  R${v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1.5">
              Nível de Risco
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: 'low' as const, label: 'Baixo' },
                { id: 'medium' as const, label: 'Médio' },
                { id: 'high' as const, label: 'Alto' },
              ]).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    play('click');
                    setRisk(r.id);
                  }}
                  className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                    risk === r.id
                      ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-300'
                      : 'bg-[#05060b] border-[#1d2134] text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1.5">
              Linhas de Pinos
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {([8, 12, 16] as RowCount[]).map((rc) => (
                <button
                  key={rc}
                  onClick={() => {
                    play('click');
                    setRows(rc);
                  }}
                  className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                    rows === rc
                      ? 'bg-brand/20 border-brand text-brand'
                      : 'bg-[#05060b] border-[#1d2134] text-slate-400 hover:text-white'
                  }`}
                >
                  {rc}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={dropBall}
            disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_rgba(217,70,239,0.35)]"
          >
            <Play className="w-4 h-4" /> Soltar Bola Plinko
          </motion.button>

          <div className="text-[9px] text-slate-500 flex items-center gap-1 justify-center">
            <Flame className="w-3 h-3 text-fuchsia-400" /> Clique várias vezes para soltar em rajada!
          </div>
        </div>
      </div>
    </div>
  );
}
