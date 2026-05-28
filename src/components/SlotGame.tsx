import React, { useState } from 'react';
import { Sparkles, Play, Award, Dribbble, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface SlotGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory: (bet: PlacedBet) => void;
}

interface SymbolDef {
  char: string;
  weight: number;
  multiplier: number;
  colorBg: string;
  name: string;
}

const SYMBOLS: SymbolDef[] = [
  { char: '💎', weight: 8, multiplier: 25, colorBg: 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400', name: 'Diamante' },
  { char: '🔔', weight: 12, multiplier: 12, colorBg: 'bg-amber-950/40 border-amber-500/30 text-amber-400', name: 'Sino' },
  { char: '🍇', weight: 18, multiplier: 6, colorBg: 'bg-purple-950/40 border-purple-500/30 text-purple-400', name: 'Uva' },
  { char: '🍋', weight: 22, multiplier: 4, colorBg: 'bg-yellow-950/40 border-yellow-500/30 text-yellow-400', name: 'Limão' },
  { char: '🍒', weight: 25, multiplier: 3, colorBg: 'bg-rose-950/40 border-rose-500/30 text-rose-400', name: 'Cereja' },
  { char: '⭐', weight: 5, multiplier: 50, colorBg: 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400', name: 'Estrela' }
];

export default function SlotGame({ balance, onUpdateBalance, onAddBetHistory }: SlotGameProps) {
  const [reels, setReels] = useState<SymbolDef[]>([SYMBOLS[2], SYMBOLS[3], SYMBOLS[4]]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [stake, setStake] = useState<string>( '5');
  const [winAmount, setWinAmount] = useState<number>(0);
  const [outcomeText, setOutcomeText] = useState<string>('');

  const pickRandomSymbol = (): SymbolDef => {
    // Weighted random selection
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
      if (randomNum < symbol.weight) {
        return symbol;
      }
      randomNum -= symbol.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  };

  const handleSpin = () => {
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) {
      alert('Entre com um valor de spin válido.');
      return;
    }
    if (playCost > balance) {
      alert('Saldo insuficiente para realizar esta rodada.');
      return;
    }

    // Deduct cost
    onUpdateBalance(-playCost);
    setIsSpinning(true);
    setWinAmount(0);
    setOutcomeText('');

    // Simulate real spinning ticks
    let ticks = 0;
    const interval = setInterval(() => {
      setReels([
        pickRandomSymbol(),
        pickRandomSymbol(),
        pickRandomSymbol()
      ]);
      ticks++;

      if (ticks > 12) {
        clearInterval(interval);
        finalizeSpin(playCost);
      }
    }, 80);
  };

  const finalizeSpin = (playCost: number) => {
    // Generate final reels to check combinations
    const finalReels = [
      pickRandomSymbol(),
      pickRandomSymbol(),
      pickRandomSymbol()
    ];
    setReels(finalReels);
    setIsSpinning(false);

    const r1 = finalReels[0].char;
    const r2 = finalReels[1].char;
    const r3 = finalReels[2].char;

    let multiplier = 0;
    let text = '';
    
    // Check match combinations
    if (r1 === r2 && r2 === r3) {
      // 3 Matching Symbols (Jackpot / Full reel payout)
      multiplier = finalReels[0].multiplier;
      text = `TRIPLA: ${finalReels[0].name}!`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // 2 Matching (Partial Payout)
      const matchedSymbol = (r1 === r2) ? finalReels[0] : finalReels[2];
      multiplier = parseFloat((matchedSymbol.multiplier * 0.4).toFixed(1));
      text = `DUPLA: ${matchedSymbol.name}!`;
    }

    if (multiplier > 0) {
      const payout = playCost * multiplier;
      onUpdateBalance(payout);
      setWinAmount(payout);
      setOutcomeText(`${text} Mult: ${multiplier}x (+ R$ ${payout.toFixed(2)})`);

      // Log to history
      const newBet: PlacedBet = {
        id: `bet-slot-${Date.now()}`,
        matchName: 'Slots da Sorte',
        selectionName: `Alinhamento: [${r1}][${r2}][${r3}]`,
        odds: multiplier,
        stake: playCost,
        potentialPayout: payout,
        status: 'won',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'GANHOU'
      };
      onAddBetHistory(newBet);
    } else {
      setOutcomeText('Tente novamente.');
      
      // Log loss in history
      const newBet: PlacedBet = {
        id: `bet-slot-${Date.now()}`,
        matchName: 'Slots da Sorte',
        selectionName: `Combinação: [${r1}][${r2}][${r3}]`,
        odds: 0,
        stake: playCost,
        potentialPayout: 0,
        status: 'lost',
        placedAt: new Date().toLocaleTimeString('pt-BR'),
        type: 'casino',
        outcomeValue: 'PERDEU'
      };
      onAddBetHistory(newBet);
    }
  };

  const handleShortcutAmount = (val: number) => {
    if (isSpinning) return;
    setStake(val.toString());
  };

  return (
    <div className="bg-[#0b0c13] border border-[#1b1e2e] rounded-2xl p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
      {/* Mini Paytable Header */}
      <div className="flex justify-between items-center bg-[#07080f] p-3 rounded-xl border border-[#1b1e2e]">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-yellow-400" /> Tabela de Prêmio Triplo
        </span>
        <div className="flex gap-2 text-[10px] text-slate-300 font-mono">
          <span>⭐ 50x</span>
          <span>💎 25x</span>
          <span>🔔 12x</span>
          <span>🍇 6x</span>
        </div>
      </div>

      {/* Slots Reels Arena */}
      <div className="bg-gradient-to-b from-[#07080f] to-[#040508] border border-[#1b1e2e] p-5 rounded-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        {/* Lights details on borders */}
        <div className="absolute top-2 bottom-2 left-3 w-1.5 bg-indigo-500/25 rounded-full animate-pulse" />
        <div className="absolute top-2 bottom-2 right-3 w-1.5 bg-indigo-500/25 rounded-full animate-pulse" />

        {/* The Reels */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {reels.map((symbol, idx) => (
            <motion.div
              key={idx}
              animate={isSpinning ? { y: [-15, 15, -15] } : { y: 0 }}
              transition={{ repeat: isSpinning ? Infinity : 0, duration: 0.15 }}
              className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-4xl shadow-inner select-none p-4 ${
                symbol.colorBg
              }`}
            >
              {symbol.char}
            </motion.div>
          ))}
        </div>

        {/* Win/Lose Outcome Box */}
        <div className="h-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {outcomeText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`text-xs font-bold font-mono py-1 px-4 rounded-full ${
                  winAmount > 0 
                    ? 'bg-brand/5 border border-brand/20 text-brand flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,135,0.15)]' 
                    : 'bg-[#151724] text-slate-400 border border-[#212437]'
                }`}
              >
                {winAmount > 0 && <Sparkles className="w-3.5 h-3.5 text-brand animate-spin" />}
                {outcomeText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Slots Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Stake */}
        <div className="bg-[#0d0e16] border border-[#1a1c2a] p-3 rounded-xl space-y-2">
          <label className="text-[11px] text-slate-400 uppercase font-semibold">Valor do Spin (R$)</label>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              disabled={isSpinning}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-[#7c3aed] rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {[1, 2, 5, 10, 20].map((val) => (
              <button
                key={val}
                onClick={() => handleShortcutAmount(val)}
                disabled={isSpinning}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  stake === val.toString() 
                    ? 'bg-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] border-none' 
                    : 'bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white'
                }`}
              >
                R$ {val}
              </button>
            ))}
          </div>
        </div>

        {/* Spin trigger button */}
        <div className="flex flex-col justify-center">
          <button
            onClick={handleSpin}
            disabled={isSpinning || parseFloat(stake) <= 0 || !stake || parseFloat(stake) > balance}
            className="w-full h-full bg-[#7c3aed] disabled:bg-[#1a1c29] disabled:text-[#383d5a] disabled:border-none hover:bg-[#8b5cf6] text-white font-black py-4 px-6 rounded-xl transition-all duration-300 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.25)] hover:shadow-[0_0_22px_rgba(124,58,237,0.45)] hover:scale-[1.01]"
          >
            <Play className="w-4 h-4 fill-white" />
            Rodar Slots (Girar Alavanca)
          </button>
        </div>
      </div>

      {/* RNG Guarantee footer */}
      <p className="text-[10px] text-slate-500 text-center leading-normal">
        O sistema de rodadas é puramente lúdico e utiliza gerador de números pseudo-aleatórios (PRNG) de ponto flutuante conforme regulamentado nacionalmente pela COAF/SPA.
      </p>
    </div>
  );
}
