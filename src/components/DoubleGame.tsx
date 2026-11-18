import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Disc3, DollarSign, Play, Trash2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface DoubleGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

type DoubleColor = 'red' | 'black' | 'white';

interface TileSpec {
  num: number;
  color: DoubleColor;
}

// 15 casas oficiais: 1 Omnitrix Branco (14x), 7 Vermelhas (2x), 7 Pretas (2x)
const WHEEL_TILES: TileSpec[] = [
  { num: 0, color: 'white' },
  { num: 11, color: 'black' },
  { num: 5, color: 'red' },
  { num: 10, color: 'black' },
  { num: 6, color: 'red' },
  { num: 9, color: 'black' },
  { num: 7, color: 'red' },
  { num: 8, color: 'black' },
  { num: 1, color: 'red' },
  { num: 14, color: 'black' },
  { num: 2, color: 'red' },
  { num: 13, color: 'black' },
  { num: 3, color: 'red' },
  { num: 12, color: 'black' },
  { num: 4, color: 'red' },
];

const REPEATED_STRIP: TileSpec[] = Array.from({ length: 6 }, () => WHEEL_TILES).flat();

const INITIAL_HISTORY: TileSpec[] = [
  { num: 5, color: 'red' },
  { num: 10, color: 'black' },
  { num: 0, color: 'white' },
  { num: 3, color: 'red' },
  { num: 12, color: 'black' },
  { num: 7, color: 'red' },
  { num: 8, color: 'black' },
];

export default function DoubleGame({ balance, onUpdateBalance, onAddBetHistory }: DoubleGameProps) {
  const [chipAmount, setChipAmount] = useState('5');
  const [bets, setBets] = useState<{ red: number; black: number; white: number }>({
    red: 0,
    black: 0,
    white: 0,
  });
  const [spinning, setSpinning] = useState(false);
  const [stripX, setStripX] = useState(0);
  const [containerWidth, setContainerWidth] = useState(600);
  const [history, setHistory] = useState<TileSpec[]>(INITIAL_HISTORY);
  const [lastOutcome, setLastOutcome] = useState<{ tile: TileSpec; payout: number; staked: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const winnerStripIdxRef = useRef<number>(45);
  const activeBetsRef = useRef(bets);
  const lastTickRef = useRef(-1);
  const { play } = useSound();

  const totalStaked = bets.red + bets.black + bets.white;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const addBetToColor = (color: DoubleColor) => {
    if (spinning) return;
    const chip = parseFloat(chipAmount);
    if (isNaN(chip) || chip <= 0) {
      alert('Insira um valor de ficha válido.');
      return;
    }
    if (totalStaked + chip > balance) {
      alert('Saldo insuficiente para adicionar mais fichas.');
      return;
    }
    play('click');
    setBets((prev) => ({
      ...prev,
      [color]: Number((prev[color] + chip).toFixed(2)),
    }));
  };

  const clearBets = () => {
    if (spinning) return;
    setBets({ red: 0, black: 0, white: 0 });
  };

  const handleSpin = () => {
    if (spinning) return;
    if (totalStaked <= 0) {
      alert('Coloque uma aposta em Vermelho, Preto ou Omnitrix Branco.');
      return;
    }
    if (totalStaked > balance) {
      alert('Saldo insuficiente.');
      return;
    }

    play('spin');
    onUpdateBalance(-totalStaked);
    activeBetsRef.current = { ...bets };
    setLastOutcome(null);

    const tileOffset = Math.floor(Math.random() * WHEEL_TILES.length); // 0..14 (1/15 branco, 7/15 verm, 7/15 preto)
    winnerStripIdxRef.current = 45 + tileOffset;
    setStripX(containerWidth * 0.25);
    lastTickRef.current = -1;
    setSpinning(true);
  };

  useLayoutEffect(() => {
    if (!spinning || !containerRef.current || !innerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const arrowX = containerRect.left + containerRect.width / 2;
    const inner = innerRef.current;
    const targetIdx = winnerStripIdxRef.current;
    const targetEl = inner.children[targetIdx] as HTMLElement | undefined;
    const firstEl = inner.children[0] as HTMLElement | undefined;
    if (!targetEl || !firstEl) return;

    const firstCenter = firstEl.getBoundingClientRect().left + firstEl.getBoundingClientRect().width / 2;
    const targetCenter = targetEl.getBoundingClientRect().left + targetEl.getBoundingClientRect().width / 2;
    const pitch = targetIdx > 0 ? (targetCenter - firstCenter) / targetIdx : 64;

    const startX = containerWidth * 0.25;
    const jitter = (Math.random() - 0.5) * 20;
    const endX = startX - (targetCenter - arrowX) + jitter;
    const duration = 2650;
    const startTime = performance.now();

    let rafId = 0;
    const step = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const curX = startX + (endX - startX) * eased;
      setStripX(curX);

      const curIdx = Math.round((arrowX - (firstCenter + (curX - startX))) / (pitch || 64));
      if (curIdx !== lastTickRef.current && curIdx >= 0 && curIdx < REPEATED_STRIP.length) {
        lastTickRef.current = curIdx;
        play('tick');
      }

      if (p < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setStripX(endX);
        setSpinning(false);
        const winningTile = REPEATED_STRIP[targetIdx];
        const placed = activeBetsRef.current;
        const total = placed.red + placed.black + placed.white;
        const winAmt =
          winningTile.color === 'white'
            ? placed.white * 14
            : winningTile.color === 'red'
            ? placed.red * 2
            : placed.black * 2;
        const roundedWin = Number(winAmt.toFixed(2));

        if (roundedWin > 0) {
          onUpdateBalance(roundedWin);
          play(winningTile.color === 'white' ? 'legendary' : 'win');
        } else {
          play('lose');
        }

        setHistory((prev) => [winningTile, ...prev.slice(0, 13)]);
        setLastOutcome({ tile: winningTile, payout: roundedWin, staked: total });

        onAddBetHistory({
          id: `double-${Date.now()}`,
          matchName: 'Double 14×',
          selectionName: `Caiu ${winningTile.num} (${winningTile.color === 'white' ? 'BRANCO 14×' : winningTile.color === 'red' ? 'Vermelho' : 'Preto'})`,
          odds: roundedWin > 0 ? Number((roundedWin / total).toFixed(2)) : 0,
          stake: total,
          potentialPayout: roundedWin,
          status: roundedWin >= total ? 'won' : 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: roundedWin > 0 ? `R$ ${roundedWin.toFixed(2)}` : 'PERDEU',
        });
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [spinning, containerWidth, onAddBetHistory, onUpdateBalance, play]);

  const tileClasses = (color: DoubleColor) => {
    if (color === 'white') return 'bg-gradient-to-b from-white to-emerald-100 text-slate-950 border-brand shadow-[0_0_14px_rgba(0,255,135,0.45)]';
    if (color === 'red') return 'bg-gradient-to-b from-rose-500 to-red-700 text-white border-rose-400/60';
    return 'bg-gradient-to-b from-slate-800 to-[#090b12] text-slate-100 border-slate-500/50';
  };

  const adjustChip = (factor: number) => {
    if (spinning) return;
    const curr = parseFloat(chipAmount) || 5;
    setChipAmount(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-rose-500/70 to-transparent" />

      <div className="bg-[#070910] border border-rose-500/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <Disc3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2">
              Double 14×
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                Branco Paga 14×
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Roleta rápida de cores — aposte em Vermelho (2×), Preto (2×) ou Omnitrix (14×)</p>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-[9px] font-mono text-slate-500 uppercase shrink-0 mr-1">Anteriores:</span>
        {history.map((h, i) => (
          <div
            key={`${h.num}-${i}`}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[10px] font-mono font-black shrink-0 ${tileClasses(h.color)}`}
          >
            {h.color === 'white' ? '⏳' : h.num}
          </div>
        ))}
      </div>

      {/* Faixa da roleta */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-[#1d2136] bg-[#05060b] h-28 flex items-center"
      >
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-brand z-20 shadow-[0_0_12px_rgba(0,255,135,0.9)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[11px] border-l-transparent border-r-transparent border-t-brand" />
        <div
          ref={innerRef}
          className="flex gap-2 items-center absolute left-0"
          style={{ transform: `translateX(${stripX}px)`, transition: 'none', willChange: 'transform' }}
        >
          {REPEATED_STRIP.map((t, idx) => (
            <div
              key={idx}
              className={`shrink-0 w-14 h-16 rounded-xl border-2 flex flex-col items-center justify-center font-mono font-black ${tileClasses(t.color)}`}
            >
              <span className="text-base">{t.color === 'white' ? '⏳' : t.num}</span>
              <span className="text-[7px] opacity-75 uppercase">{t.color === 'white' ? '14×' : '2×'}</span>
            </div>
          ))}
        </div>
      </div>

      {lastOutcome && (
        <div
          className={`text-center py-2.5 px-4 rounded-xl border text-xs font-extrabold ${
            lastOutcome.payout > 0
              ? 'bg-brand/10 border-brand/35 text-brand'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {lastOutcome.payout > 0
            ? `🎉 Deu ${lastOutcome.tile.num} (${lastOutcome.tile.color === 'white' ? 'OMNITRIX 14×' : lastOutcome.tile.color === 'red' ? 'Vermelho' : 'Preto'})! Você ganhou R$ ${lastOutcome.payout.toFixed(2)}`
            : `😞 Deu ${lastOutcome.tile.num} (${lastOutcome.tile.color === 'red' ? 'Vermelho' : lastOutcome.tile.color === 'black' ? 'Preto' : 'Branco'}) — tente de novo!`}
        </div>
      )}

      {/* Fichas e Cores */}
      <div className="bg-[#080a12] border border-[#1a1d2e] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <DollarSign className="w-3.5 h-3.5 text-brand shrink-0" />
            <input
              type="number"
              disabled={spinning}
              value={chipAmount}
              onChange={(e) => setChipAmount(e.target.value)}
              className="w-24 bg-[#05060b] border border-[#1d2134] focus:border-brand rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
            />
            <button onClick={() => adjustChip(0.5)} disabled={spinning} className="px-2 py-1.5 rounded-lg bg-[#0d101b] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">1/2</button>
            <button onClick={() => adjustChip(2)} disabled={spinning} className="px-2 py-1.5 rounded-lg bg-[#0d101b] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer">2×</button>
            {[2, 5, 10, 25].map((v) => (
              <button key={v} disabled={spinning} onClick={() => setChipAmount(String(v))} className="hidden sm:inline-block px-2 py-1.5 rounded-lg bg-[#05060b] border border-[#1d2134] text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer">
                R${v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Total: <strong className="text-white">R$ {totalStaked.toFixed(2)}</strong></span>
            {totalStaked > 0 && !spinning && (
              <button onClick={clearBets} className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 cursor-pointer" title="Limpar apostas">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => addBetToColor('red')}
            disabled={spinning}
            className="py-3 px-2 rounded-xl border-2 border-rose-500/50 bg-rose-600/20 hover:bg-rose-600/35 text-white font-black text-xs transition-all cursor-pointer"
          >
            <div>🔴 Vermelho (2×)</div>
            <div className="text-[10px] font-mono text-rose-200 mt-0.5">
              {bets.red > 0 ? `R$ ${bets.red.toFixed(2)}` : '+ Adicionar'}
            </div>
          </button>

          <button
            onClick={() => addBetToColor('white')}
            disabled={spinning}
            className="py-3 px-2 rounded-xl border-2 border-brand/70 bg-brand/15 hover:bg-brand/25 text-white font-black text-xs transition-all cursor-pointer shadow-[0_0_14px_rgba(0,255,135,0.18)]"
          >
            <div>⏳ Branco (14×)</div>
            <div className="text-[10px] font-mono text-brand mt-0.5">
              {bets.white > 0 ? `R$ ${bets.white.toFixed(2)}` : '+ Adicionar'}
            </div>
          </button>

          <button
            onClick={() => addBetToColor('black')}
            disabled={spinning}
            className="py-3 px-2 rounded-xl border-2 border-slate-500/50 bg-slate-800/45 hover:bg-slate-800/75 text-white font-black text-xs transition-all cursor-pointer"
          >
            <div>⚫ Preto (2×)</div>
            <div className="text-[10px] font-mono text-slate-300 mt-0.5">
              {bets.black > 0 ? `R$ ${bets.black.toFixed(2)}` : '+ Adicionar'}
            </div>
          </button>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSpin}
          disabled={spinning || totalStaked <= 0 || totalStaked > balance}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
        >
          {spinning ? <Sparkles className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {spinning ? 'Girando Double...' : totalStaked > 0 ? `Girar Double — R$ ${totalStaked.toFixed(2)}` : 'Selecione uma cor acima'}
        </motion.button>
      </div>
    </div>
  );
}
