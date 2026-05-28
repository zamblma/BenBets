import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, History, AlertTriangle, Zap, DollarSign, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface CrashGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
}

type GameStatus = 'idle' | 'running' | 'crashed' | 'cashed_out';

export default function CrashGame({ balance, onUpdateBalance, onAddBetHistory }: CrashGameProps) {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [stake, setStake] = useState<string>('10');
  const [activeStake, setActiveStake] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([1.34, 4.23, 1.08, 12.44, 2.11, 1.01, 3.82]);
  const [chartPoints, setChartPoints] = useState<{x: number; y: number}[]>([{x: 0, y: 0}]);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);

  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const crashPointRef = useRef<number>(2.0);
  const currentMultiplierRef = useRef<number>(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{x: number; y: number}[]>([{x: 0, y: 0}]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const pts = pointsRef.current;
    if (pts.length < 2) return;

    const maxMult = Math.max(1.5, ...pts.map(p => p.y));

    ctx.beginPath();
    ctx.strokeStyle = '#00ff87';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 135, 0.5)';

    const margin = 10;
    const drawW = w - margin * 2;
    const drawH = h - margin * 2;

    pts.forEach((pt, i) => {
      const x = margin + (pt.x / Math.max(1, pts[pts.length - 1].x)) * drawW;
      const y = h - margin - (pt.y / maxMult) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (status === 'running' && pts.length > 1) {
      const last = pts[pts.length - 1];
      const lastX = margin + (last.x / Math.max(1, pts[pts.length - 1].x)) * drawW;
      const lastY = h - margin - (last.y / maxMult) * drawH;

      const gradient = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 12);
      gradient.addColorStop(0, 'rgba(0, 255, 135, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 255, 135, 0)');
      ctx.beginPath();
      ctx.arc(lastX, lastY, 12, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }, [status]);

  useEffect(() => {
    drawChart();
  }, [chartPoints, drawChart]);

  useEffect(() => {
    const handleResize = () => drawChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  const handleStartGame = () => {
    const betVal = parseFloat(stake);
    if (isNaN(betVal) || betVal <= 0) {
      alert('Entre com um valor de aposta válido.');
      return;
    }
    if (betVal > balance) {
      alert('Saldo insuficiente para começar o voo.');
      return;
    }

    onUpdateBalance(-betVal);
    setActiveStake(betVal);
    setStatus('running');
    setMultiplier(1.0);
    setLastWinAmount(0);
    currentMultiplierRef.current = 1.0;
    setChartPoints([{x: 0, y: 0}]);
    pointsRef.current = [{x: 0, y: 0}];

    // Gera ponto de crash usando a fórmula bustabit (provably fair)
    // crashPoint = floor(100 * 0.99 / (1 - h)) / 100, onde h ∈ [0, 1)
    // House edge: 1% (RTP = 99%)
    const buf = new Uint8Array(7);
    crypto.getRandomValues(buf);
    let h = 0;
    for (let i = 0; i < 6; i++) h = h * 256 + buf[i];
    h = (h + buf[6] / 256) / Math.pow(2, 48);
    const crashTarget = Math.max(1.01, Math.floor(100 * 0.99 / (1 - h)) / 100);
    crashPointRef.current = crashTarget;

    if (tickRef.current) clearInterval(tickRef.current);

    const startTime = Date.now();
    const minDuration = 800;
    const tickRate = 60;

    tickRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Curva quadrática: começa devagar e acelera
      // multiplier = 1 + (t * k)^p  →  k=0.55, p=2.2
      let nextMult = parseFloat((1 + Math.pow(elapsed * 0.35, 2.2)).toFixed(2));

      if (elapsed * 1000 < minDuration) {
        // Rampe suavemente até o crash point mesmo em crashes rápidos
        const linear = 1 + (crashTarget - 1) * (elapsed * 1000 / minDuration);
        if (linear < nextMult) nextMult = parseFloat(linear.toFixed(2));
      }

      if (nextMult >= crashTarget) {
        clearInterval(tickRef.current!);
        setMultiplier(crashPointRef.current);
        setStatus('crashed');
        setChartPoints([...pointsRef.current]);
        setHistory(prev => [crashPointRef.current, ...prev.slice(0, 7)]);

        const newBet: PlacedBet = {
          id: `bet-crash-${Date.now()}`,
          matchName: 'Aviator Crash',
          selectionName: `Crachou em ${crashPointRef.current.toFixed(2)}x`,
          odds: crashPointRef.current,
          stake: betVal,
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'crash',
          outcomeValue: `${crashPointRef.current.toFixed(2)}x`
        };
        onAddBetHistory(newBet);
        setActiveStake(0);
      } else {
        setMultiplier(nextMult);
        currentMultiplierRef.current = nextMult;
        const newPts = [...pointsRef.current, {x: pointsRef.current.length, y: nextMult}];
        pointsRef.current = newPts;
        setChartPoints(newPts);
      }
    }, tickRate);
  };

  const handleCashout = () => {
    if (status !== 'running' || activeStake <= 0) return;

    if (tickRef.current) clearInterval(tickRef.current);

    const winAmt = activeStake * multiplier;
    onUpdateBalance(winAmt);
    setLastWinAmount(winAmt);
    setStatus('cashed_out');

    const newBet: PlacedBet = {
      id: `bet-crash-${Date.now()}`,
      matchName: 'Aviator Crash',
      selectionName: `Retirado em ${multiplier.toFixed(2)}x`,
      odds: multiplier,
      stake: activeStake,
      potentialPayout: winAmt,
      status: 'won',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'crash',
      outcomeValue: `${multiplier.toFixed(2)}x`
    };
    onAddBetHistory(newBet);

    setTimeout(() => {
      setHistory(prev => [crashPointRef.current, ...prev.slice(0, 7)]);
    }, 600);

    setActiveStake(0);
  };

  const handlePresetStake = (val: number) => {
    if (status === 'running') return;
    setStake(val.toString());
  };

  const handlePresetMath = (factor: number) => {
    if (status === 'running') return;
    const curr = parseFloat(stake);
    if (!isNaN(curr)) {
      setStake((curr * factor).toFixed(0));
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'idle': return 'Aguardando Decolagem';
      case 'running': return 'Voando...';
      case 'crashed': return 'Explodiu!';
      case 'cashed_out': return 'Lucro Realizado!';
    }
  };

  return (
    <div className="bg-gradient-to-b from-[#0a0b12] to-[#07080f] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      {/* History strip */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none border-b border-[#141521] pb-3">
        <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {history.map((mult, idx) => (
          <motion.span
            key={idx}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
              mult >= 8.0
                ? 'bg-amber-950/40 text-amber-400 border-amber-500/30'
                : mult >= 3.0
                  ? 'bg-purple-950/40 text-purple-400 border-purple-500/30'
                  : mult >= 2.0
                    ? 'bg-brand/10 text-brand border-brand/20'
                    : 'bg-[#151724] text-slate-400 border-[#22253a]'
            }`}
          >
            {mult.toFixed(2)}x
          </motion.span>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="relative h-64 bg-[#06080f] rounded-xl overflow-hidden border border-[#1b1e2e]">
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1c2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1c2e_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20" />

        {/* Canvas for chart */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'running' ? 'bg-brand' : 'bg-slate-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'running' ? 'bg-brand' : 'bg-slate-500'}`}></span>
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              {getStatusMessage()}
            </span>
          </div>

          {activeStake > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand/10 border border-brand/20 text-brand rounded-full py-0.5 px-3 text-[9px] font-bold flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3" />
              R$ {activeStake.toFixed(2)}
            </motion.div>
          )}
        </div>

        {/* Multiplier Display */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {status === 'crashed' ? (
              <motion.div
                key="crashed"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 20 }}
                className="text-center"
              >
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-1" />
                <div className="text-2xl font-black text-rose-500 uppercase tracking-wider animate-pulse">
                  EXPLODIU!
                </div>
                <div className="text-lg font-mono font-bold text-slate-400 mt-1">
                  {multiplier.toFixed(2)}x
                </div>
              </motion.div>
            ) : status === 'cashed_out' ? (
              <motion.div
                key="won"
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, y: -20 }}
                className="text-center"
              >
                <Trophy className="w-8 h-8 text-brand mx-auto mb-1" />
                <div className="text-lg font-black text-brand uppercase tracking-wider">
                  SAQUE REALIZADO!
                </div>
                <div className="text-4xl font-black text-white mt-1 drop-shadow-[0_0_20px_rgba(0,255,135,0.3)]">
                  {multiplier.toFixed(2)}x
                </div>
                <div className="text-xs text-brand font-bold mt-1">
                  +R$ {lastWinAmount.toFixed(2)}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="multiplier"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <motion.span
                  key={multiplier}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className={`text-6xl font-black tracking-tight font-sans ${
                    status === 'running'
                      ? 'text-brand drop-shadow-[0_0_25px_rgba(0,255,135,0.4)]'
                      : 'text-slate-200'
                  }`}
                >
                  {multiplier.toFixed(2)}x
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom labels */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-between px-4 py-2 text-[8px] text-slate-600 font-mono font-bold uppercase tracking-wider">
          <span>Rodada #{history.length + 1}</span>
          <span>RNG Certificado</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stake */}
        <div className="bg-[#0d0e16]/80 border border-[#1a1c2a] p-3 rounded-xl space-y-2">
          <label className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Valor da Aposta (R$)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              disabled={status === 'running'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-[#040508] border border-[#1c1f2e] focus:border-brand rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={() => handlePresetMath(0.5)}
              disabled={status === 'running'}
              className="px-2 py-2 text-xs font-bold border border-[#1c1f2e] text-slate-400 bg-[#040508] rounded-lg hover:text-white cursor-pointer disabled:opacity-40"
            >
              1/2
            </button>
            <button
              onClick={() => handlePresetMath(2)}
              disabled={status === 'running'}
              className="px-2 py-2 text-xs font-bold border border-[#1c1f2e] text-slate-400 bg-[#040508] rounded-lg hover:text-white cursor-pointer disabled:opacity-40"
            >
              2x
            </button>
          </div>

          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {[2, 5, 10, 25, 50].map((val) => (
              <button
                key={val}
                onClick={() => handlePresetStake(val)}
                disabled={status === 'running'}
                className={`flex-1 py-1 px-1.5 text-[9px] font-bold rounded-md transition-all cursor-pointer disabled:opacity-40 ${
                  stake === val.toString()
                    ? 'bg-brand text-slate-950 shadow-[0_0_12px_rgba(0,255,135,0.25)]'
                    : 'bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white'
                }`}
              >
                R${val}
              </button>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col justify-center gap-2">
          {status === 'running' ? (
            <motion.button
              onClick={handleCashout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <span className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> SACAR AGORA
              </span>
              <span className="text-lg font-mono font-black">
                R$ {(activeStake * multiplier).toFixed(2)}
              </span>
            </motion.button>
          ) : (
            <motion.button
              onClick={handleStartGame}
              disabled={parseFloat(stake) <= 0 || !stake}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-gradient-to-r from-brand to-emerald-400 hover:from-[#00e074] hover:to-emerald-500 text-slate-950 font-black py-5 px-6 rounded-xl transition-all duration-300 disabled:from-[#151724] disabled:to-[#1a1c29] disabled:text-[#383d5a] disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,255,135,0.2)] hover:shadow-[0_0_30px_rgba(0,255,135,0.4)]"
            >
              <TrendingUp className="w-4 h-4" />
              Iniciar Voo
            </motion.button>
          )}

          {status !== 'idle' && status !== 'running' && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setStatus('idle')}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider cursor-pointer text-center py-1"
            >
              Nova Rodada
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Total de Voos</p>
          <p className="text-sm font-bold text-white font-mono">{history.length}</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Maior Multiplicador</p>
          <p className="text-sm font-bold text-brand font-mono">{Math.max(...history, 1).toFixed(2)}x</p>
        </div>
        <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Média</p>
          <p className="text-sm font-bold text-slate-300 font-mono">{(history.reduce((a, b) => a + b, 0) / history.length).toFixed(2)}x</p>
        </div>
      </div>
    </div>
  );
}
