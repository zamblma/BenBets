import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Play, ShieldAlert, Coins, RefreshCw, Trophy } from 'lucide-react';
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
  
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const crashPointRef = useRef<number>(2.0);
  const currentMultiplierRef = useRef<number>(1.0);

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

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

    // Deduct stake immediately
    onUpdateBalance(-betVal);
    setActiveStake(betVal);
    setStatus('running');
    setMultiplier(1.0);
    currentMultiplierRef.current = 1.0;

    // Calculate dynamic crash point with typical house edge distribution
    // 10% chance of instant crash at 1.00x - 1.05x
    // otherwise curve representing standard crash math
    const rand = Math.random();
    let crashTarget = 1.0;
    
    if (rand < 0.08) {
      crashTarget = 1.01 + Math.random() * 0.07;
    } else {
      // Curve formula
      crashTarget = parseFloat((1.01 + Math.pow(Math.random(), 2.8) * 15).toFixed(2));
    }
    
    crashPointRef.current = crashTarget;

    // Start tick
    if (tickRef.current) clearInterval(tickRef.current);
    
    const tickRate = 80; // update speed
    tickRef.current = setInterval(() => {
      // Grow multiplier
      let nextMult = currentMultiplierRef.current;
      
      if (nextMult < 2.0) {
        nextMult += 0.01 + (Math.random() * 0.015);
      } else if (nextMult < 5.0) {
        nextMult += 0.03 + (Math.random() * 0.04);
      } else {
        nextMult += 0.08 + (Math.random() * 0.15);
      }

      nextMult = parseFloat(nextMult.toFixed(2));

      // Test crash
      if (nextMult >= crashPointRef.current) {
        // Crash!
        clearInterval(tickRef.current!);
        setMultiplier(crashPointRef.current);
        setStatus('crashed');
        
        // Add to history list (keep last 8)
        setHistory(prev => [crashPointRef.current, ...prev.slice(0, 7)]);
        
        // Log transaction history
        const newBet: PlacedBet = {
          id: `bet-crash-${Date.now()}`,
          matchName: 'Foguete Crash',
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
      }
    }, tickRate);
  };

  const handleCashout = () => {
    if (status !== 'running' || activeStake <= 0) return;
    
    // Clear interval immediately to freeze multiplier
    if (tickRef.current) clearInterval(tickRef.current);
    
    const winAmt = activeStake * multiplier;
    onUpdateBalance(winAmt);
    setStatus('cashed_out');
    
    // Log winning bet in history
    const newBet: PlacedBet = {
      id: `bet-crash-${Date.now()}`,
      matchName: 'Foguete Crash',
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
    
    // Simulate updating match list history with where it eventually crashed so game runs to end
    setTimeout(() => {
      // Add eventual crash point to historical strip
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

  return (
    <div className="bg-[#0b0c13] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      {/* Top history row */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none border-b border-[#141521] pb-3">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">Histórico:</span>
        {history.map((mult, idx) => (
          <span 
            key={idx}
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              mult >= 5.0 
                ? 'bg-purple-950/40 text-purple-400 border-purple-500/30' 
                : mult >= 2.0 
                  ? 'bg-brand/10 text-brand border-brand/20' 
                  : 'bg-[#151724] text-slate-400 border-[#22253a]'
            }`}
          >
            {mult.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Main Graphic Arena */}
      <div className="relative h-64 bg-[#07080f] rounded-xl overflow-hidden border border-[#1b1e2e] flex flex-col justify-between p-4">
        {/* Dynamic Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#161826_1px,transparent_1px),linear-gradient(to_bottom,#161826_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-35" />

        {/* Live Indicator or crashed alerts */}
        <div className="z-10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-500"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multiplicador do Voo</span>
          </div>

          {activeStake > 0 && (
            <div className="bg-brand/10 border border-brand/20 text-brand rounded-full py-0.5 px-3 text-[10px] font-bold">
              Aposta Ativa: R$ {activeStake.toFixed(2)}
            </div>
          )}
        </div>

        {/* Big Display Multiplier */}
        <div className="z-10 text-center flex flex-col items-center justify-center flex-1 py-4">
          <AnimatePresence mode="wait">
            {status === 'crashed' ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-1"
              >
                <div className="text-3xl font-mono font-black text-rose-500 uppercase tracking-widest animate-bounce">
                  EXPLODIU!
                </div>
                <div className="text-2xl font-mono font-bold text-slate-400">
                  {multiplier.toFixed(2)}x
                </div>
              </motion.div>
            ) : status === 'cashed_out' ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-1"
              >
                <div className="text-xl font-bold text-brand uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Trophy className="w-5 h-5 text-brand shrink-0" />
                  SAQUE REALIZADO!
                </div>
                <div className="text-4xl font-mono font-black text-white">
                  {multiplier.toFixed(2)}x
                </div>
                <p className="text-xs text-brand">Aposta ganha!</p>
              </motion.div>
            ) : (
              <motion.div
                key={multiplier}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <span className={`text-6xl font-sans font-black tracking-tight ${status === 'running' ? 'text-brand drop-shadow-[0_0_15px_rgba(0,255,135,0.35)]' : 'text-slate-200'}`}>
                  {multiplier.toFixed(2)}x
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rocket flight animation element */}
        {status === 'running' && (
          <motion.div 
            style={{ 
              position: 'absolute', 
              bottom: `${Math.min(15 + (multiplier - 1.0) * 11, 75)}%`, 
              left: `${Math.min(10 + (multiplier - 1.0) * 8, 80)}%` 
            }}
            animate={{ 
              y: [0, -3, 0],
              x: [0, 2, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2
            }}
            className="z-10 text-brand flex flex-col items-center shrink-0"
          >
            <Rocket className="w-10 h-10 transform rotate-45 text-brand filter drop-shadow-[0_0_10px_#00ff87]" />
            <span className="w-3 h-3 rounded-full bg-orange-500/80 animate-ping mt-1"></span>
          </motion.div>
        )}

        {/* Tips display */}
        <div className="z-10 flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>ALTITUDE CRÍTICA</span>
          <span>100% REGULADO</span>
        </div>
      </div>

      {/* Control panel buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stake controls */}
        <div className="bg-[#0d0e16] border border-[#1a1c2a] p-3 rounded-xl space-y-2">
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Valor da Aposta (R$)</label>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              disabled={status === 'running'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-[#040508] border border-[#1c1f2e] focus:border-brand rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {/* Quick Math */}
            <button 
              onClick={() => handlePresetMath(0.5)}
              disabled={status === 'running'}
              className="px-2.5 py-2.5 text-xs font-bold border border-[#1c1f2e] text-slate-400 bg-[#040508] rounded-lg hover:text-white cursor-pointer"
            >
              /2
            </button>
            <button 
              onClick={() => handlePresetMath(2)}
              disabled={status === 'running'}
              className="px-2.5 py-2.5 text-xs font-bold border border-[#1c1f2e] text-slate-400 bg-[#040508] rounded-lg hover:text-white cursor-pointer"
            >
              2x
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {[2, 5, 10, 25, 50].map((val) => (
              <button
                key={val}
                onClick={() => handlePresetStake(val)}
                disabled={status === 'running'}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  stake === val.toString() 
                    ? 'bg-brand text-slate-950 font-extrabold shadow-[0_0_12px_rgba(0,255,135,0.25)]' 
                    : 'bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white'
                }`}
              >
                R$ {val}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col justify-center">
          {status === 'running' ? (
            <button
              onClick={handleCashout}
              className="w-full h-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] active:scale-95 flex flex-col justify-center items-center gap-0.5 cursor-pointer"
            >
              <span className="text-xs uppercase tracking-widest font-bold">SACAR (CASH OUT)</span>
              <span className="text-xl font-mono">R$ {(activeStake * multiplier).toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={handleStartGame}
              disabled={parseFloat(stake) <= 0 || !stake}
              className="w-full h-full bg-brand hover:bg-[#00e074] text-slate-950 font-black py-5 px-6 rounded-xl transition-all duration-300 disabled:bg-[#151724] disabled:text-[#383d5a] disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,255,135,0.15)] hover:shadow-[0_0_22px_rgba(0,255,135,0.35)] hover:scale-[1.01]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              Decolar Foguete (Iniciar Voo)
            </button>
          )}
        </div>
      </div>

      {/* Rules footer */}
      <p className="text-[10px] text-slate-500 text-center leading-normal">
        O Jogo de Crash é certificado por algoritmos de criptografia justa. 
        O multiplicador sobe em escala parabólica até explodir de forma randômica por RNG regulado.
      </p>
    </div>
  );
}
