import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, History, AlertTriangle, Zap, DollarSign, TrendingUp, Plane, BarChart3, ShieldCheck, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';
import { updateMissionProgress } from '../firebase/db';

interface CrashGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

type GameStatus = 'idle' | 'running' | 'crashed' | 'cashed_out';

interface StarParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

interface CrewMember {
  name: string;
  stake: number;
  targetMult: number;
}

const CREW_SEEDS = ['Ben_Omnitrix', 'Gwen_HUD', 'Kevin_Turbo', 'Rook_99'];

function drawJetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, angleRad: number, color: string, pulse: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Thruster exhaust flame
  const flameLen = 14 + pulse * 9;
  const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
  flameGrad.addColorStop(0, '#ffffff');
  flameGrad.addColorStop(0.35, color);
  flameGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(-7, -3.5);
  ctx.lineTo(-8 - flameLen, 0);
  ctx.lineTo(-7, 3.5);
  ctx.closePath();
  ctx.fillStyle = flameGrad;
  ctx.fill();

  // Outer wing silhouette
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-5, -9);
  ctx.lineTo(-9, -4);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-9, 4);
  ctx.lineTo(-5, 9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Inner metallic fuselage
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-4, -3.5);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-4, 3.5);
  ctx.closePath();
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  ctx.restore();
}

export default function CrashGame({ balance, onUpdateBalance, onAddBetHistory, userId }: CrashGameProps) {
  const [status, setStatus] = useState<GameStatus>('idle');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [stake, setStake] = useState<string>('5');
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);
  const [autoCashout, setAutoCashout] = useState<string>('2.00');
  const [activeStake, setActiveStake] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([1.34, 4.23, 1.08, 12.44, 2.11, 1.01, 3.82, 2.55]);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [crew, setCrew] = useState<CrewMember[]>(() =>
    CREW_SEEDS.map((name, i) => ({
      name,
      stake: [15, 25, 10, 40][i],
      targetMult: [1.5, 2.2, 3.1, 1.8][i],
    }))
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 600, h: 260, dpr: 1 });
  const starsRef = useRef<StarParticle[]>(
    Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.12 + Math.random() * 0.38,
      size: 1 + Math.random() * 1.6,
      alpha: 0.18 + Math.random() * 0.45,
    }))
  );

  const multDisplayRef = useRef<HTMLSpanElement>(null);
  const cashoutBtnValueRef = useRef<HTMLSpanElement>(null);
  const crewStatusRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const crewCashedRef = useRef<boolean[]>([false, false, false, false]);
  const crewRef = useRef<CrewMember[]>(crew);

  const animFrameRef = useRef<number>(0);
  const statusRef = useRef<GameStatus>('idle');
  const crashPointRef = useRef<number>(2.0);
  const currentMultiplierRef = useRef<number>(1.0);
  const activeStakeRef = useRef<number>(0);
  const pointsRef = useRef<{ t: number; m: number }[]>([{ t: 0, m: 1.0 }]);
  const startTimeRef = useRef<number>(0);
  const autoTargetRef = useRef<number>(0);
  const lastAudioUpdateRef = useRef<number>(0);
  const prevTierColorRef = useRef<string>('text-brand');

  const { play, engine } = useSound();

  const drawScene = useCallback((phase: GameStatus, mult: number, crashVal?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, dpr } = canvasSizeRef.current;
    if (w <= 0 || h <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const safeMult = Number.isFinite(mult) && mult >= 1 ? mult : 1.0;
    const safeCrash = crashVal && Number.isFinite(crashVal) && crashVal >= 1 ? crashVal : undefined;

    // Theme color according to phase & altitude
    const isCrashed = phase === 'crashed';
    const isHigh = safeMult >= 8.0;
    const isMid = safeMult >= 2.0;
    const lineColor = isCrashed ? '#f43f5e' : isHigh ? '#f59e0b' : isMid ? '#a855f7' : '#00ff87';
    const fillRgb = isCrashed
      ? '244, 63, 94'
      : isHigh
      ? '245, 158, 11'
      : isMid
      ? '168, 85, 247'
      : '0, 255, 135';

    // 1. Parallax starfield
    const speedFactor = phase === 'running' ? Math.min(4.5, 0.5 + (safeMult - 1) * 0.45) : 0.08;
    for (const s of starsRef.current) {
      if (phase === 'running' || phase === 'idle') {
        s.x -= s.speed * 0.0022 * speedFactor;
        s.y += s.speed * 0.0008 * speedFactor;
        if (s.x < 0) s.x = 1;
        if (s.y > 1) s.y = 0;
      }
      ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
      ctx.fillRect(s.x * w, s.y * h, s.size, s.size);
    }

    // 2. Subtle cockpit radar grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const gy = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const gx = (w / 6) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    const pts = pointsRef.current;
    if (pts.length < 2) {
      if (phase === 'idle') {
        drawJetIcon(ctx, 28, h - 24, -0.35, '#00ff87', 0.4);
      }
      return;
    }

    const padL = 16;
    const padR = 46;
    const padT = 22;
    const padB = 18;
    const drawW = Math.max(40, w - padL - padR);
    const drawH = Math.max(40, h - padT - padB);

    const lastT = Math.max(3.2, pts[pts.length - 1].t);
    const maxM = Math.max(1.85, (safeCrash || safeMult) * 1.12);

    // Y-axis altitude labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    [0.25, 0.55, 0.85].forEach((ratio) => {
      const val = 1 + (maxM - 1) * ratio;
      const y = h - padB - ratio * drawH;
      ctx.fillText(`${val.toFixed(1)}x`, w - 8, y + 3);
    });

    const toXY = (pt: { t: number; m: number }) => {
      const safePtM = Number.isFinite(pt.m) ? pt.m : 1.0;
      const safePtT = Number.isFinite(pt.t) ? Math.max(0, pt.t) : 0;
      return {
        x: padL + (safePtT / lastT) * drawW,
        y: h - padB - ((safePtM - 1) / (maxM - 1)) * drawH,
      };
    };

    const firstXY = toXY(pts[0]);
    const lastXY = toXY(pts[pts.length - 1]);
    const prevXY = toXY(pts[Math.max(0, pts.length - 2)]);
    if (!Number.isFinite(lastXY.x) || !Number.isFinite(lastXY.y)) return;

    // 3. Area gradient under curve
    ctx.beginPath();
    ctx.moveTo(firstXY.x, h - padB);
    for (let i = 0; i < pts.length; i++) {
      const { x, y } = toXY(pts[i]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(lastXY.x, h - padB);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, `rgba(${fillRgb}, 0.24)`);
    grad.addColorStop(1, `rgba(${fillRgb}, 0.01)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Crisp Neon Stroke
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length; i++) {
      const { x, y } = toXY(pts[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Jet at trajectory tip or explosion shockwave
    if (isCrashed) {
      const boomGrad = ctx.createRadialGradient(lastXY.x, lastXY.y, 2, lastXY.x, lastXY.y, 34);
      boomGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      boomGrad.addColorStop(0.35, 'rgba(244, 63, 94, 0.65)');
      boomGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.beginPath();
      ctx.arc(lastXY.x, lastXY.y, 34, 0, Math.PI * 2);
      ctx.fillStyle = boomGrad;
      ctx.fill();
    } else {
      const dx = lastXY.x - prevXY.x;
      const dy = lastXY.y - prevXY.y;
      const rawAngle = Math.atan2(dy, Math.max(1, dx));
      const clampedAngle = Math.max(-0.95, Math.min(-0.15, rawAngle));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.025);
      drawJetIcon(ctx, lastXY.x, lastXY.y, clampedAngle, lineColor, pulse);
    }
  }, []);

  // Measure canvas once & on ResizeObserver only (no reflow inside rAF!)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(220, Math.floor(rect.height));
      canvasSizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      drawScene(statusRef.current, currentMultiplierRef.current);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [drawScene]);

  // Preserve exact engine cleanup dependency contract
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      engine.stop();
    };
  }, [engine]);

  // Subtle idle star drift at ~30fps when awaiting takeoff
  useEffect(() => {
    if (status !== 'idle') return;
    let raf = 0;
    let lastDraw = 0;
    const idleLoop = (now: number) => {
      if (now - lastDraw >= 33) {
        lastDraw = now;
        drawScene('idle', 1.0);
      }
      raf = requestAnimationFrame(idleLoop);
    };
    raf = requestAnimationFrame(idleLoop);
    return () => cancelAnimationFrame(raf);
  }, [status, drawScene]);

  const settleCashout = useCallback((finalMult: number, isAuto = false) => {
    if (statusRef.current !== 'running' || activeStakeRef.current <= 0) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    statusRef.current = 'cashed_out';
    play('cashout');
    engine.stop();

    const betVal = activeStakeRef.current;
    const safeMult = Number.isFinite(finalMult) && finalMult >= 1 ? finalMult : 1.0;
    const winAmt = Number((betVal * safeMult).toFixed(2));
    if (Number.isFinite(winAmt) && winAmt >= 0) {
      onUpdateBalance(winAmt);
    }
    setMultiplier(safeMult);
    setLastWinAmount(Number.isFinite(winAmt) ? winAmt : 0);
    setStatus('cashed_out');
    setActiveStake(0);
    activeStakeRef.current = 0;
    updateMissionProgress(userId, 'crash_cashout', 1).catch(() => {});

    drawScene('cashed_out', safeMult);

    onAddBetHistory({
      id: `bet-crash-${Date.now()}`,
      matchName: 'Aviator Crash',
      selectionName: `${isAuto ? 'Auto Cashout' : 'Retirado'} em ${safeMult.toFixed(2)}x`,
      odds: safeMult,
      stake: betVal,
      potentialPayout: Number.isFinite(winAmt) ? winAmt : betVal,
      status: 'won',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'crash',
      outcomeValue: `${safeMult.toFixed(2)}x`,
    });

    const cp = crashPointRef.current;
    setTimeout(() => {
      setHistory((prev) => [cp, ...prev.slice(0, 9)]);
    }, 550);
  }, [drawScene, engine, onAddBetHistory, onUpdateBalance, play, userId]);

  const handleStartGame = () => {
    if (statusRef.current === 'running') return;
    const betVal = parseFloat(stake);
    if (isNaN(betVal) || betVal <= 0) {
      alert('Entre com um valor de aposta válido.');
      return;
    }
    if (betVal > balance) {
      alert('Saldo insuficiente para começar o voo.');
      return;
    }

    const parsedAuto = autoEnabled ? parseFloat(autoCashout) : 0;
    autoTargetRef.current = !isNaN(parsedAuto) && parsedAuto >= 1.05 ? parsedAuto : 0;

    // Generate next crew targets for flight immersion
    const nextCrew: CrewMember[] = CREW_SEEDS.map((name) => ({
      name,
      stake: [10, 20, 35, 50, 100][Math.floor(Math.random() * 5)],
      targetMult: Number((1.25 + Math.random() * 3.8).toFixed(2)),
    }));
    crewRef.current = nextCrew;
    crewCashedRef.current = [false, false, false, false];
    setCrew(nextCrew);
    nextCrew.forEach((_, idx) => {
      const el = crewStatusRefs.current[idx];
      if (el) {
        el.textContent = 'No voo';
        el.className = 'text-[9px] font-mono text-sky-300';
      }
    });

    play('spin');
    engine.start(80);
    onUpdateBalance(-betVal);

    activeStakeRef.current = betVal;
    setActiveStake(betVal);
    statusRef.current = 'running';
    setStatus('running');
    setMultiplier(1.0);
    setLastWinAmount(0);
    currentMultiplierRef.current = 1.0;
    pointsRef.current = [{ t: 0, m: 1.0 }];
    prevTierColorRef.current = 'text-brand';

    if (multDisplayRef.current) {
      multDisplayRef.current.textContent = '1.00x';
      multDisplayRef.current.className = 'text-5xl sm:text-6xl font-black font-mono tracking-tight text-brand transition-colors';
    }
    if (cashoutBtnValueRef.current) {
      cashoutBtnValueRef.current.textContent = `R$ ${betVal.toFixed(2)}`;
    }

    // Provably fair cryptographic crash target (99% curve)
    const buf = new Uint8Array(7);
    crypto.getRandomValues(buf);
    let h = 0;
    for (let i = 0; i < 6; i++) h = h * 256 + buf[i];
    h = (h + buf[6] / 256) / Math.pow(2, 48);
    const h2 = Math.pow(h, 0.5);
    const crashTarget = Math.max(1.01, Math.floor((100 * 0.99) / (1 - h2)) / 100);
    crashPointRef.current = crashTarget;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    startTimeRef.current = performance.now();
    lastAudioUpdateRef.current = 0;

    const minDuration = 1100;

    const frameLoop = (now: number) => {
      if (statusRef.current !== 'running') return;

      if (now < startTimeRef.current) {
        startTimeRef.current = now;
      }
      const elapsedSec = Math.max(0, (now - startTimeRef.current) / 1000);
      let nextMult = 1 + Math.pow(elapsedSec * 0.25, 2.2);

      if (elapsedSec * 1000 < minDuration) {
        const linear = 1 + (crashTarget - 1) * ((elapsedSec * 1000) / minDuration);
        if (linear < nextMult) nextMult = linear;
      }
      if (!Number.isFinite(nextMult) || nextMult < 1) {
        nextMult = 1.0;
      }

      // Check auto-cashout before crash check if crash >= autoTarget
      const autoT = autoTargetRef.current;
      if (autoT > 0 && nextMult >= autoT && crashTarget >= autoT) {
        pointsRef.current.push({ t: elapsedSec, m: autoT });
        currentMultiplierRef.current = autoT;
        settleCashout(autoT, true);
        return;
      }

      if (nextMult >= crashTarget) {
        statusRef.current = 'crashed';
        currentMultiplierRef.current = crashTarget;
        pointsRef.current.push({ t: elapsedSec, m: crashTarget });
        drawScene('crashed', crashTarget, crashTarget);

        play('crash');
        engine.stop();
        setMultiplier(crashTarget);
        setStatus('crashed');
        setHistory((prev) => [crashTarget, ...prev.slice(0, 9)]);

        crewRef.current.forEach((_, idx) => {
          const el = crewStatusRefs.current[idx];
          if (el && !crewCashedRef.current[idx]) {
            el.textContent = 'Perdeu';
            el.className = 'text-[9px] font-mono text-rose-400';
          }
        });

        onAddBetHistory({
          id: `bet-crash-${Date.now()}`,
          matchName: 'Aviator Crash',
          selectionName: `Crachou em ${crashTarget.toFixed(2)}x`,
          odds: crashTarget,
          stake: betVal,
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'crash',
          outcomeValue: `${crashTarget.toFixed(2)}x`,
        });

        setActiveStake(0);
        activeStakeRef.current = 0;
        return;
      }

      // 120fps DOM direct updates (zero React re-renders!)
      currentMultiplierRef.current = nextMult;
      pointsRef.current.push({ t: elapsedSec, m: nextMult });

      if (multDisplayRef.current) {
        multDisplayRef.current.textContent = `${nextMult.toFixed(2)}x`;
        const nextTierCls =
          nextMult >= 8 ? 'text-amber-300' : nextMult >= 2 ? 'text-purple-400' : 'text-brand';
        if (nextTierCls !== prevTierColorRef.current) {
          prevTierColorRef.current = nextTierCls;
          multDisplayRef.current.className = `text-5xl sm:text-6xl font-black font-mono tracking-tight transition-colors ${nextTierCls}`;
        }
      }

      if (cashoutBtnValueRef.current) {
        cashoutBtnValueRef.current.textContent = `R$ ${(betVal * nextMult).toFixed(2)}`;
      }

      // Live crew simulated cashouts via direct DOM updates
      crewRef.current.forEach((member, idx) => {
        if (!crewCashedRef.current[idx] && nextMult >= member.targetMult) {
          crewCashedRef.current[idx] = true;
          const el = crewStatusRefs.current[idx];
          if (el) {
            el.textContent = `+R$ ${(member.stake * member.targetMult).toFixed(0)} (${member.targetMult.toFixed(2)}×)`;
            el.className = 'text-[9px] font-mono font-bold text-brand';
          }
        }
      });

      // Throttle oscillator freq updates to ~12/s
      if (now - lastAudioUpdateRef.current >= 80) {
        lastAudioUpdateRef.current = now;
        engine.setFreq(Math.min(600, 80 + (nextMult - 1) * 80));
      }

      drawScene('running', nextMult);
      animFrameRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameRef.current = requestAnimationFrame(frameLoop);
  };

  const handleCashout = () => {
    settleCashout(currentMultiplierRef.current, false);
  };

  const handlePresetMath = (factor: number) => {
    if (status === 'running') return;
    const curr = parseFloat(stake) || 5;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'idle': return 'Radar Pronto • Aguardando Decolagem';
      case 'running': return 'Em Voo Supersônico...';
      case 'crashed': return 'Radar Perdido (Explodiu)';
      case 'cashed_out': return 'Resgate Confirmado!';
    }
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

      {/* Header Cockpit */}
      <div className="bg-[#070910] border border-cyan-500/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black font-display text-white uppercase tracking-wider flex items-center gap-2">
              Aviator Omnitrix HUD
              <span className="text-[9px] font-mono bg-brand/10 text-brand border border-brand/25 px-2 py-0.5 rounded-full">
                120 FPS Canvas
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Saia manualmente ou ative o Auto Cashout antes da explosão</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0">
          <span>Voo #{history.length + 1}</span>
          <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
        </div>
      </div>

      {/* Histórico de voos */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <History className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
        {history.map((mult, idx) => (
          <span
            key={idx}
            className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
              mult >= 10.0
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                : mult >= 3.0
                ? 'bg-purple-500/20 text-purple-300 border-purple-400/45'
                : mult >= 2.0
                ? 'bg-brand/15 text-brand border-brand/35'
                : 'bg-[#121521] text-slate-400 border-[#22273c]'
            }`}
          >
            {mult >= 10 ? '👑 ' : ''}{mult.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Arena Radar 120 FPS */}
      <div className="relative h-64 sm:h-72 bg-gradient-to-b from-[#050812] via-[#060913] to-[#04060c] rounded-2xl overflow-hidden border border-[#1d233a]" style={{ contain: 'paint' }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-2 bg-black/45 border border-white/10 rounded-full px-2.5 py-1">
            <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'bg-brand animate-ping' : 'bg-slate-500'}`} />
            <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
              {getStatusMessage()}
            </span>
          </div>

          {activeStake > 0 && (
            <div className="bg-brand/15 border border-brand/35 text-brand rounded-full py-1 px-3 text-[10px] font-mono font-bold flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> R$ {activeStake.toFixed(2)}
            </div>
          )}
        </div>

        {/* Display central de multiplicador (atualizado por DOM ref no voo) */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {status === 'crashed' ? (
              <motion.div key="crashed" initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                <AlertTriangle className="w-9 h-9 text-rose-500 mx-auto mb-1" />
                <div className="text-3xl sm:text-4xl font-black text-rose-500 uppercase tracking-wider">EXPLODIU!</div>
                <div className="text-2xl font-mono font-black text-rose-300 mt-1">{multiplier.toFixed(2)}x</div>
              </motion.div>
            ) : status === 'cashed_out' ? (
              <motion.div key="won" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                <Trophy className="w-8 h-8 text-brand mx-auto mb-1" />
                <div className="text-sm sm:text-base font-black text-brand uppercase tracking-wider">SAQUE REALIZADO!</div>
                <div className="text-4xl sm:text-5xl font-black font-mono text-white mt-0.5">{multiplier.toFixed(2)}x</div>
                <div className="text-xs sm:text-sm text-brand font-mono font-extrabold mt-1">+R$ {lastWinAmount.toFixed(2)}</div>
              </motion.div>
            ) : (
              <div key="live-mult" className="text-center">
                <span
                  ref={multDisplayRef}
                  className={`text-5xl sm:text-6xl font-black font-mono tracking-tight ${
                    status === 'running' ? 'text-brand' : 'text-slate-200'
                  }`}
                >
                  {multiplier.toFixed(2)}x
                </span>
                {autoEnabled && parseFloat(autoCashout) >= 1.05 && (
                  <div className="text-[10px] font-mono text-cyan-300/80 mt-1">
                    Auto Saque em {parseFloat(autoCashout).toFixed(2)}x
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-2 left-4 right-4 z-10 flex justify-between text-[9px] text-slate-500 font-mono uppercase">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-brand" /> Provably Fair 99%</span>
          <span>Alta Taxa de Quadros</span>
        </div>
      </div>

      {/* Tripulação no Voo */}
      <div className="bg-[#070910] border border-[#1a1d2e] rounded-xl p-2.5">
        <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 px-1">
          <span className="flex items-center gap-1"><Users className="w-3 h-3 text-cyan-400" /> Tripulação no Voo (Simulação)</span>
          <span>Ao Vivo</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {crew.map((member, idx) => (
            <div key={member.name} className="bg-[#0b0e18] border border-[#1a1f32] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-200 truncate">{member.name}</div>
                <div className="text-[8px] font-mono text-slate-500">R$ {member.stake}</div>
              </div>
              <span
                ref={(el) => { crewStatusRefs.current[idx] = el; }}
                className="text-[9px] font-mono text-slate-400 shrink-0"
              >
                {status === 'idle' ? 'Pronto' : 'No voo'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Painel de Controle Cockpit */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
        {/* Card de Aposta */}
        <div className="bg-[#080a12] border border-[#1a1d2e] p-3.5 rounded-xl space-y-2.5">
          <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-brand" /> Valor da Aposta (R$)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              disabled={status === 'running'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="flex-1 bg-[#05060b] border border-[#1d2134] focus:border-brand rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
            />
            <button onClick={() => handlePresetMath(0.5)} disabled={status === 'running'} className="px-2.5 py-2 text-xs font-bold border border-[#1d2134] text-slate-300 bg-[#0d101b] rounded-xl hover:border-brand/40 cursor-pointer disabled:opacity-40">
              1/2
            </button>
            <button onClick={() => handlePresetMath(2)} disabled={status === 'running'} className="px-2.5 py-2 text-xs font-bold border border-[#1d2134] text-slate-300 bg-[#0d101b] rounded-xl hover:border-brand/40 cursor-pointer disabled:opacity-40">
              2×
            </button>
          </div>
          <div className="flex gap-1.5">
            {[2, 5, 10, 25, 50].map((val) => (
              <button
                key={val}
                onClick={() => status !== 'running' && setStake(String(val))}
                disabled={status === 'running'}
                className={`flex-1 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-40 ${
                  stake === String(val)
                    ? 'bg-brand text-slate-950 font-black'
                    : 'bg-[#05060b] border border-[#1c1f2e] text-slate-400 hover:text-white'
                }`}
              >
                R${val}
              </button>
            ))}
          </div>
        </div>

        {/* Card Auto Cashout + Botão Principal */}
        <div className="bg-[#080a12] border border-[#1a1d2e] p-3.5 rounded-xl flex flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={status === 'running'}
                onClick={() => setAutoEnabled((v) => !v)}
                className="flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${autoEnabled ? 'bg-brand justify-end' : 'bg-[#1a1f32] justify-start'}`}>
                  <span className="w-3 h-3 rounded-full bg-slate-950 shadow" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Auto Cashout</span>
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="1.05"
                  disabled={status === 'running' || !autoEnabled}
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(e.target.value)}
                  className="w-20 bg-[#05060b] border border-[#1d2134] focus:border-cyan-400 rounded-lg px-2 py-1 text-xs font-mono font-bold text-cyan-300 focus:outline-none disabled:opacity-40"
                />
                <span className="text-[10px] font-mono text-slate-500">×</span>
              </div>
            </div>
            <div className="flex gap-1">
              {['1.50', '2.00', '3.00', '5.00', '10.00'].map((preset) => (
                <button
                  key={preset}
                  disabled={status === 'running'}
                  onClick={() => { setAutoEnabled(true); setAutoCashout(preset); }}
                  className={`flex-1 py-1 text-[9px] font-mono font-bold rounded-md border cursor-pointer disabled:opacity-40 ${
                    autoEnabled && autoCashout === preset
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-[#05060b] border-[#1c1f2e] text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {preset}×
                </button>
              ))}
            </div>
          </div>

          {status === 'running' ? (
            <motion.button
              onClick={handleCashout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black py-3 px-6 rounded-xl shadow-[0_0_26px_rgba(245,158,11,0.4)] flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <span className="text-[10px] uppercase tracking-widest font-black flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> SACAR AGORA
              </span>
              <span ref={cashoutBtnValueRef} className="text-lg font-mono font-black">
                R$ {activeStake.toFixed(2)}
              </span>
            </motion.button>
          ) : (
            <motion.button
              onClick={handleStartGame}
              disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-gradient-to-r from-brand to-emerald-400 hover:brightness-105 text-slate-950 font-black py-3.5 px-6 rounded-xl disabled:from-[#151724] disabled:to-[#1a1c29] disabled:text-[#383d5a] disabled:cursor-not-allowed uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_rgba(0,255,135,0.28)]"
            >
              <TrendingUp className="w-4 h-4" /> Decolar Agora
            </motion.button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-2.5 text-center">
          <Plane className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Voos</p>
          <p className="text-sm font-bold text-white font-mono">{history.length}</p>
        </div>
        <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-2.5 text-center">
          <TrendingUp className="w-3.5 h-3.5 text-brand mx-auto mb-1" />
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Recorde</p>
          <p className="text-sm font-bold text-brand font-mono">{Math.max(...history, 1).toFixed(2)}x</p>
        </div>
        <div className="bg-[#080a12] border border-[#1a1c2a] rounded-xl p-2.5 text-center">
          <BarChart3 className="w-3.5 h-3.5 text-yellow-500 mx-auto mb-1" />
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Média</p>
          <p className="text-sm font-bold text-slate-300 font-mono">
            {(history.reduce((a, b) => a + b, 0) / history.length).toFixed(2)}x
          </p>
        </div>
      </div>
    </div>
  );
}
