import { useState, useRef, useEffect } from 'react';
import { Trophy, DollarSign, Play, Sparkles, Flame, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { PlacedBet } from '../types';
import { useSound } from '../hooks/useSound';

interface BasketballGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
  userId: string;
}

type ZoneId = 'layup' | 'freethrow' | 'threepoint' | 'halfcourt';

interface CourtZone {
  id: ZoneId;
  name: string;
  short: string;
  prob: number;
  baseMult: number;
  swishMult: number;
  startX: number; // % in court SVG/container
  startY: number;
  badgeColor: string;
}

const COURT_ZONES: CourtZone[] = [
  {
    id: 'layup',
    name: 'Garrafão / Bandeja',
    short: 'Bandeja',
    prob: 0.72,
    baseMult: 1.32,
    swishMult: 1.48,
    startX: 28,
    startY: 58,
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15',
  },
  {
    id: 'freethrow',
    name: 'Lance Livre',
    short: 'Lance Livre',
    prob: 0.52,
    baseMult: 1.82,
    swishMult: 2.10,
    startX: 46,
    startY: 66,
    badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/15',
  },
  {
    id: 'threepoint',
    name: 'Linha de 3 Pontos',
    short: '3 Pontos',
    prob: 0.34,
    baseMult: 2.75,
    swishMult: 3.30,
    startX: 70,
    startY: 42,
    badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
  },
  {
    id: 'halfcourt',
    name: 'Meio da Quadra',
    short: 'Logo Shot',
    prob: 0.14,
    baseMult: 6.50,
    swishMult: 8.50,
    startX: 86,
    startY: 74,
    badgeColor: 'text-fuchsia-300 border-fuchsia-500/45 bg-fuchsia-500/15',
  },
];

const MISS_FEEDBACKS = [
  'Bateu no aro frontal!',
  'Tabela e saiu!',
  'Airball!',
];

const HOOP_POS = { x: 18, y: 31 };

type BallSlotState = 'pending' | 'made' | 'swish' | 'missed';

interface ShotHistoryEntry {
  id: string;
  zone: string;
  made: boolean;
  swish: boolean;
  mult: number;
}

export default function BasketballGame({
  balance,
  onUpdateBalance,
  onAddBetHistory,
}: BasketballGameProps) {
  const [stake, setStake] = useState('5');
  const [status, setStatus] = useState<'idle' | 'playing' | 'shooting' | 'won' | 'missed'>('idle');
  const [activeStake, setActiveStake] = useState(0);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [ballRack, setBallRack] = useState<BallSlotState[]>(['pending', 'pending', 'pending', 'pending', 'pending']);
  const [selectedZone, setSelectedZone] = useState<CourtZone>(COURT_ZONES[1]);
  const [shotClock, setShotClock] = useState(24);
  const [lastOutcomeText, setLastOutcomeText] = useState<string>('Defina a aposta e entre na quadra!');
  const [lastWin, setLastWin] = useState(0);
  const [netShake, setNetShake] = useState(false);
  const [ballAnim, setBallAnim] = useState<{
    active: boolean;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    isMoneyBall: boolean;
    outcome: 'swish' | 'made' | 'missed';
  } | null>(null);
  const [recentShots, setRecentShots] = useState<ShotHistoryEntry[]>([]);
  const [stats, setStats] = useState({ makes: 0, wins: 0, biggestWin: 0 });

  const timersRef = useRef<number[]>([]);
  const { play } = useSound();

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // Visual 24s Shot Clock tick while aiming
  useEffect(() => {
    if (status !== 'playing') return;
    const interval = window.setInterval(() => {
      setShotClock((c) => (c > 1 ? c - 1 : 24));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const isOnFire = shotsTaken >= 2 && (status === 'playing' || status === 'shooting' || status === 'won');
  const isMoneyBallNext = shotsTaken === 4;

  const startPossession = () => {
    if (status === 'playing' || status === 'shooting') return;
    const bet = parseFloat(stake);
    if (!Number.isFinite(bet) || bet <= 0) {
      alert('Insira um valor de aposta válido.');
      return;
    }
    if (bet > balance) {
      alert('Saldo insuficiente.');
      return;
    }

    play('deal');
    onUpdateBalance(-bet);
    setActiveStake(bet);
    setCurrentMult(1.0);
    setShotsTaken(0);
    setBallRack(['pending', 'pending', 'pending', 'pending', 'pending']);
    setShotClock(24);
    setLastWin(0);
    setBallAnim(null);
    setNetShake(false);
    setLastOutcomeText('Escolha uma zona da quadra para arremessar!');
    setStatus('playing');
  };

  const settleWin = (finalMult: number, madeCount: number, isFullSeries = false) => {
    const safeMult = Number.isFinite(finalMult) && finalMult >= 1 ? finalMult : 1.0;
    const payout = Number((activeStake * safeMult).toFixed(2));
    if (Number.isFinite(payout) && payout > 0) {
      onUpdateBalance(payout);
    }
    play(isFullSeries ? 'legendary' : 'cashout');
    setLastWin(payout);
    setStatus('won');
    setLastOutcomeText(
      isFullSeries
        ? `🏆 MONEY BALL PERFEITA 5/5! Sacou R$ ${payout.toFixed(2)} (${safeMult.toFixed(2)}×)`
        : `🏀 Saque confirmado! R$ ${payout.toFixed(2)} (${safeMult.toFixed(2)}×)`
    );
    setStats((s) => ({
      ...s,
      wins: s.wins + 1,
      biggestWin: Math.max(s.biggestWin, payout),
    }));

    onAddBetHistory({
      id: `bball-${Date.now()}`,
      matchName: 'Basquete Street 3×',
      selectionName: `${madeCount}/5 cesta${madeCount > 1 ? 's' : ''} convertida${madeCount > 1 ? 's' : ''}`,
      odds: safeMult,
      stake: activeStake,
      potentialPayout: payout,
      status: 'won',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'casino',
      outcomeValue: `${safeMult.toFixed(2)}×`,
    });
  };

  const shootFromZone = (zone: CourtZone) => {
    if (status !== 'playing') return;

    setSelectedZone(zone);
    setStatus('shooting');
    play('spin');

    const ballIndex = shotsTaken;
    const isMoneyBall = ballIndex === 4;

    // Provably fair RNG roll via crypto
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    const roll = arr[0] / 4294967296;
    const styleRoll = arr[1] / 4294967296;

    const made = roll < zone.prob;
    const isSwish = made && styleRoll < 0.28; // Chuá perfeito!
    const rawZoneMult = isSwish ? zone.swishMult : zone.baseMult;
    const shotMult = isMoneyBall ? Number((rawZoneMult * 1.25).toFixed(2)) : rawZoneMult;

    setBallAnim({
      active: true,
      fromX: zone.startX,
      fromY: zone.startY,
      toX: HOOP_POS.x + (made ? 0 : styleRoll < 0.5 ? 5 : -4),
      toY: HOOP_POS.y + (made ? 2 : styleRoll > 0.66 ? 12 : -4),
      isMoneyBall,
      outcome: isSwish ? 'swish' : made ? 'made' : 'missed',
    });

    const tId = window.setTimeout(() => {
      setBallAnim(null);

      setRecentShots((prev) => [
        {
          id: `shot-${Date.now()}-${ballIndex}`,
          zone: zone.short,
          made,
          swish: isSwish,
          mult: made ? shotMult : 0,
        },
        ...prev.slice(0, 9),
      ]);

      if (made) {
        setNetShake(true);
        const shakeReset = window.setTimeout(() => setNetShake(false), 450);
        timersRef.current.push(shakeReset);

        const nextShots = ballIndex + 1;
        const nextTotalMult = Number((currentMult * shotMult).toFixed(2));
        setBallRack((prev) => prev.map((slot, idx) => (idx === ballIndex ? (isSwish ? 'swish' : 'made') : slot)));
        setShotsTaken(nextShots);
        setCurrentMult(nextTotalMult);
        setShotClock(24);
        setStats((s) => ({ ...s, makes: s.makes + 1 }));

        if (nextShots >= 5) {
          settleWin(nextTotalMult, 5, true);
        } else {
          play(isSwish || nextShots >= 3 ? 'legendary' : 'win');
          const prefix = isSwish ? '🔥 CHUÁ PERFEITO!' : '🏀 CESTA!';
          const moneyTag = isMoneyBall ? ' (MONEY BALL +25%)' : '';
          setLastOutcomeText(`${prefix}${moneyTag} ${zone.short} (${shotMult.toFixed(2)}×) → Total ${nextTotalMult.toFixed(2)}×`);
          setStatus('playing');
        }
      } else {
        play('lose');
        const missText = MISS_FEEDBACKS[Math.floor(styleRoll * MISS_FEEDBACKS.length)] || MISS_FEEDBACKS[0];
        setBallRack((prev) => prev.map((slot, idx) => (idx === ballIndex ? 'missed' : slot)));
        setShotsTaken(ballIndex + 1);
        setStatus('missed');
        setLastOutcomeText(`❌ ${missText} (${zone.name}) — Posse encerrada.`);

        onAddBetHistory({
          id: `bball-${Date.now()}`,
          matchName: 'Basquete Street 3×',
          selectionName: `Errou ${zone.short} na bola ${ballIndex + 1}/5`,
          odds: 0,
          stake: activeStake,
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: missText.toUpperCase(),
        });
      }
    }, 620);

    timersRef.current.push(tId);
  };

  const adjustStake = (factor: number) => {
    if (status === 'playing' || status === 'shooting') return;
    const curr = parseFloat(stake) || 5;
    setStake(Math.max(1, Number((curr * factor).toFixed(2))).toString());
  };

  return (
    <div className="omnitrix-panel rounded-2xl p-3.5 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-400/75 to-transparent" />

      {/* Header Arena Scoreboard */}
      <div className="bg-[#070910] border border-orange-500/25 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/15 border border-orange-500/35 text-orange-400 shadow-[0_0_16px_rgba(249,115,22,0.2)]">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold font-display text-white flex items-center gap-2 flex-wrap">
              Basquete Street 3×
              <span className="text-[9px] font-mono bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                RNG • Chuá & Money Ball
              </span>
              {isOnFire && (
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                  <Flame className="w-3 h-3" /> ON FIRE
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">
              Escolha a distância, converta cestas em sequência e saque antes de errar!
            </p>
          </div>
        </div>

        {/* Shot Clock & Multiplier HUD */}
        <div className="flex items-center gap-2.5 font-mono text-xs shrink-0 self-end sm:self-auto">
          <div className="bg-[#0b0f1b] border border-white/10 rounded-lg px-2.5 py-1 text-center">
            <div className="text-[8px] text-slate-500 uppercase">Clock</div>
            <div className="text-rose-400 font-black">{shotClock}s</div>
          </div>
          <div className="bg-[#0b0f1b] border border-brand/25 rounded-lg px-3 py-1 text-right">
            <div className="text-[8px] text-slate-500 uppercase">Multiplicador</div>
            <div className="text-brand font-black text-sm">{currentMult.toFixed(2)}×</div>
          </div>
        </div>
      </div>

      {/* Rack de 5 Bolas + Money Ball Omnitrix */}
      <div className="bg-[#080a12] border border-[#1a1d2e] rounded-xl p-2.5 flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Rack da Série <span className="text-white font-bold">({Math.min(shotsTaken, 5)}/5)</span>
        </div>
        <div className="flex items-center gap-2">
          {ballRack.map((slot, idx) => {
            const isFifth = idx === 4;
            const isCurrent = idx === shotsTaken && (status === 'playing' || status === 'shooting');
            return (
              <div
                key={idx}
                title={isFifth ? '5ª Bola: Money Ball Omnitrix (+25% Bônus)' : `Arremesso ${idx + 1}`}
                className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                  slot === 'swish'
                    ? 'bg-brand/25 border-brand text-brand shadow-[0_0_12px_rgba(0,255,135,0.45)]'
                    : slot === 'made'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : slot === 'missed'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : isCurrent
                    ? isFifth
                      ? 'bg-brand/15 border-brand animate-pulse shadow-[0_0_14px_rgba(0,255,135,0.45)]'
                      : 'bg-orange-500/20 border-orange-400 animate-pulse'
                    : isFifth
                    ? 'bg-[#0c1317] border-brand/45'
                    : 'bg-[#05060b] border-[#22263b] opacity-65'
                }`}
              >
                <span>{slot === 'missed' ? '✕' : isFifth ? '🟢' : '🏀'}</span>
                {isFifth && (
                  <span className="absolute -top-1.5 -right-1 text-[7px] font-mono font-black bg-brand text-slate-950 px-1 rounded">
                    +25%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Night Street Court */}
      <div className="relative rounded-2xl border-2 border-orange-500/30 bg-gradient-to-br from-[#0b101d] via-[#0e1526] to-[#080b14] overflow-hidden p-3 sm:p-4">
        {/* SVG Court floor markings & Backboard */}
        <div className="relative h-56 sm:h-64 w-full rounded-xl border border-white/10 bg-[radial-gradient(circle_at_18%_32%,rgba(249,115,22,0.18),transparent_52%),linear-gradient(135deg,#12182b_0%,#0a0e1a_100%)] overflow-hidden">
          <svg
            viewBox="0 0 400 220"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {/* Court parquet subtle lines */}
            <rect x="4" y="4" width="392" height="212" rx="8" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            {/* Center court line & Omnitrix center circle */}
            <line x1="340" y1="4" x2="340" y2="216" stroke="rgba(0,255,135,0.2)" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="340" cy="110" r="34" fill="rgba(0,255,135,0.03)" stroke="rgba(0,255,135,0.22)" strokeWidth="1.5" />
            {/* 3-Point Arc */}
            <path
              d="M 4 22 L 130 22 A 118 118 0 0 1 130 198 L 4 198"
              fill="rgba(249,115,22,0.04)"
              stroke="rgba(249,115,22,0.4)"
              strokeWidth="2"
            />
            {/* Painted Key (Garrafão) */}
            <rect
              x="4"
              y="62"
              width="124"
              height="96"
              fill="rgba(0,255,135,0.06)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.5"
            />
            <circle cx="128" cy="110" r="32" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

            {/* Backboard & Rim at left/top perspective */}
            <g transform="translate(36, 46)">
              {/* Stanchion pole */}
              <line x1="-22" y1="22" x2="-4" y2="22" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              {/* Glass Backboard */}
              <rect x="-4" y="0" width="8" height="44" rx="2" fill="rgba(226,232,240,0.22)" stroke="#e2e8f0" strokeWidth="2" />
              {/* Shooter's square */}
              <rect x="-2" y="14" width="4" height="16" fill="none" stroke="#f97316" strokeWidth="1.5" />
              {/* Orange Rim */}
              <ellipse cx="18" cy="24" rx="15" ry="5" fill="none" stroke="#f97316" strokeWidth="3.5" />
              {/* Animated Net */}
              <g
                style={{
                  transformOrigin: '18px 24px',
                  transform: netShake ? 'scaleY(1.22) skewX(-8deg)' : 'scaleY(1)',
                  transition: 'transform 180ms ease-out',
                }}
              >
                <path
                  d="M 5 26 L 10 46 L 26 46 L 31 26 M 10 28 L 14 46 M 18 29 L 18 46 M 26 28 L 22 46 M 7 35 L 29 35"
                  fill="none"
                  stroke="rgba(248,250,252,0.72)"
                  strokeWidth="1.3"
                />
              </g>
            </g>
          </svg>

          {/* Clickable Shot Zone Hotspots on Court */}
          {COURT_ZONES.map((z) => {
            const isSelected = selectedZone.id === z.id;
            const canShoot = status === 'playing';
            const displayMult = isMoneyBallNext ? Number((z.baseMult * 1.25).toFixed(2)) : z.baseMult;
            return (
              <button
                key={z.id}
                type="button"
                disabled={!canShoot}
                onClick={() => shootFromZone(z)}
                style={{ left: `${z.startX}%`, top: `${z.startY}%` }}
                className={`-translate-x-1/2 -translate-y-1/2 absolute px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold transition-all flex flex-col items-center gap-0.5 backdrop-blur-xs ${
                  canShoot
                    ? `${z.badgeColor} hover:scale-110 cursor-pointer shadow-lg`
                    : isSelected
                    ? `${z.badgeColor} opacity-90`
                    : 'bg-black/40 border-white/10 text-slate-500 opacity-60'
                }`}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Target className="w-3 h-3" /> {z.short}
                </span>
                <span className="text-[9px] text-white font-black">
                  {displayMult.toFixed(2)}× <span className="opacity-70 font-normal">({Math.round(z.prob * 100)}%)</span>
                </span>
              </button>
            );
          })}

          {/* Flying Basketball Arc Animation */}
          {ballAnim && ballAnim.active && (
            <motion.div
              initial={{
                left: `${ballAnim.fromX}%`,
                top: `${ballAnim.fromY}%`,
                scale: 1.2,
                rotate: 0,
              }}
              animate={{
                left: [`${ballAnim.fromX}%`, `${(ballAnim.fromX + ballAnim.toX) / 2}%`, `${ballAnim.toX}%`],
                top: [`${ballAnim.fromY}%`, `${Math.min(ballAnim.fromY, ballAnim.toY) - 24}%`, `${ballAnim.toY}%`],
                scale: [1.2, 1.45, 0.85],
                rotate: 360,
              }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 text-2xl sm:text-3xl pointer-events-none drop-shadow-[0_4px_12px_rgba(249,115,22,0.75)]"
            >
              {ballAnim.isMoneyBall ? '🟢' : '🏀'}
            </motion.div>
          )}
        </div>

        {/* Zone Quick Buttons Grid (Mobile Friendly & Detailed Odds) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {COURT_ZONES.map((z) => {
            const canShoot = status === 'playing';
            const factor = isMoneyBallNext ? 1.25 : 1;
            const bMult = Number((z.baseMult * factor).toFixed(2));
            const sMult = Number((z.swishMult * factor).toFixed(2));
            return (
              <button
                key={z.id}
                type="button"
                disabled={!canShoot}
                onClick={() => shootFromZone(z)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  canShoot
                    ? 'bg-[#090c16] hover:bg-[#11172a] border-orange-500/35 hover:border-brand cursor-pointer'
                    : 'bg-[#070910] border-[#191c2b] opacity-55'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-white mb-0.5">
                  <span className="truncate">{z.name}</span>
                  <span className="text-orange-300 font-mono">{Math.round(z.prob * 100)}%</span>
                </div>
                <div className="text-[10px] font-mono text-brand font-black">
                  {bMult.toFixed(2)}× <span className="text-[8px] text-amber-300 font-normal">/ Chuá {sMult.toFixed(2)}×</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status Banner */}
        <div className="mt-3 text-center">
          <span
            className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border ${
              status === 'won'
                ? 'bg-brand/15 border-brand/40 text-brand'
                : status === 'missed'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : status === 'playing' || status === 'shooting'
                ? 'bg-orange-500/15 border-orange-500/35 text-orange-200'
                : 'bg-[#06070d] border-white/10 text-slate-400'
            }`}
          >
            {lastOutcomeText}
          </span>
        </div>
      </div>

      {/* Last 10 Shots Ribbon */}
      {recentShots.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[9px] font-mono uppercase text-slate-500 shrink-0">Últimos tiros:</span>
          {recentShots.map((s) => (
            <span
              key={s.id}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 ${
                s.swish
                  ? 'bg-brand/15 border-brand/45 text-brand'
                  : s.made
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {s.made ? `✓ ${s.zone} ${s.mult.toFixed(2)}×` : `✕ ${s.zone}`}
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="bg-[#080a12] border border-[#1a1d2e] rounded-2xl p-4 space-y-3">
        <div>
          <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-brand" /> Aposta (R$)
            </span>
            <div className="flex gap-1">
              {[5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={status === 'playing' || status === 'shooting'}
                  onClick={() => {
                    play('click');
                    setStake(v.toString());
                  }}
                  className="px-2 py-0.5 rounded bg-[#0c0f1a] border border-[#1d2134] text-[9px] font-mono text-slate-300 hover:border-brand/40 cursor-pointer disabled:opacity-50"
                >
                  R$ {v}
                </button>
              ))}
            </div>
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              disabled={status === 'playing' || status === 'shooting'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="flex-1 bg-[#05060b] border border-[#1d2134] focus:border-brand rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => adjustStake(0.5)}
              disabled={status === 'playing' || status === 'shooting'}
              className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer disabled:opacity-50"
            >
              1/2
            </button>
            <button
              type="button"
              onClick={() => adjustStake(2)}
              disabled={status === 'playing' || status === 'shooting'}
              className="px-2.5 rounded-xl bg-[#0c0f1a] border border-[#1d2134] text-[10px] font-bold text-slate-300 cursor-pointer disabled:opacity-50"
            >
              2×
            </button>
          </div>
        </div>

        {status === 'playing' || status === 'shooting' ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={shotsTaken <= 0 || status === 'shooting'}
            onClick={() => settleWin(currentMult, shotsTaken, false)}
            className="w-full py-3.5 rounded-xl bg-brand hover:bg-[#00e074] disabled:bg-[#1a1c29] disabled:text-slate-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_rgba(0,255,135,0.35)]"
          >
            <Sparkles className="w-4 h-4" />
            {shotsTaken > 0
              ? `SACAR R$ ${(activeStake * currentMult).toFixed(2)} (${currentMult.toFixed(2)}×)`
              : 'Converta 1 cesta na quadra acima para liberar saque'}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={startPossession}
            disabled={!stake || parseFloat(stake) <= 0 || parseFloat(stake) > balance}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(249,115,22,0.35)]"
          >
            <Play className="w-4 h-4" /> Iniciar Posse de Bola
          </motion.button>
        )}

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Cestas</div>
            <div className="text-xs font-mono font-bold text-white">{stats.makes}</div>
          </div>
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Saques</div>
            <div className="text-xs font-mono font-bold text-brand">{stats.wins}</div>
          </div>
          <div className="bg-[#05060b] border border-[#1a1c2a] rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase">Recorde</div>
            <div className="text-xs font-mono font-bold text-amber-400">
              R$ {Math.max(stats.biggestWin, lastWin).toFixed(0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
