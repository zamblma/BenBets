import React, { useState } from 'react';
import { Ticket, Wallet, Play, CheckCircle2, XCircle, Clock, Percent, ShieldCheck, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BetSelection, PlacedBet } from '../types';

interface BetHistoryListProps {
  selections: BetSelection[];
  onRemoveSelection: (matchId: string) => void;
  onClearSelections: () => void;
  balance: number;
  onUpdateBalance: (amount: number) => void;
  placedBets: PlacedBet[];
  onAddPlacedBet: (bet: PlacedBet) => void;
  onSettleBet: (betId: string, status: 'won' | 'lost', payOut: number) => void;
}

export default function BetHistoryList({
  selections,
  onRemoveSelection,
  onClearSelections,
  balance,
  onUpdateBalance,
  placedBets,
  onAddPlacedBet,
  onSettleBet,
}: BetHistoryListProps) {
  const [activeTab, setActiveTab] = useState<'slip' | 'history'>('history');
  const [stakeInput, setStakeInput] = useState<string>('');

  // Compute multi accumulator odds
  const totalOdds = selections.reduce((accum, sel) => accum * sel.odds, 1.0);
  const formattedOdds = selections.length > 0 ? parseFloat(totalOdds.toFixed(2)) : 1.0;
  const stake = parseFloat(stakeInput) || 0;
  const potentialPayout = parseFloat((stake * formattedOdds).toFixed(2));

  const handlePlaceBet = (e: React.FormEvent) => {
    e.preventDefault();
    if (selections.length === 0) return;
    if (stake <= 0) {
      alert('Favor digitar o valor da aposta.');
      return;
    }
    if (stake > balance) {
      alert('Saldo insuficiente para efetivar esta aposta esportiva.');
      return;
    }

    // Deduct from balance
    onUpdateBalance(-stake);

    // Create unique bet
    const compositeName = selections.map(s => s.matchName).join(' + ');
    const compositeSelections = selections.map(s => `${s.selectionName} (${s.odds})`).join(' e ');

    const newBet: PlacedBet = {
      id: `bet-sports-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      matchName: selections.length > 1 ? `Acumulada (${selections.length} Seleções)` : selections[0].matchName,
      selectionName: compositeSelections,
      odds: formattedOdds,
      stake: stake,
      potentialPayout: potentialPayout,
      status: 'pending',
      placedAt: new Date().toLocaleTimeString('pt-BR'),
      type: 'sports',
    };

    onAddPlacedBet(newBet);
    onClearSelections();
    setStakeInput('20');
    setActiveTab('history');
  };

  const handleManualPayout = (bet: PlacedBet, outcome: 'won' | 'lost') => {
    const payout = outcome === 'won' ? bet.potentialPayout : 0;
    onSettleBet(bet.id, outcome, payout);
  };

  const handleEarlyCashout = (bet: PlacedBet) => {
    // Standard cashout takes stake * current odds * a minor discount factor
    const cashoutValue = parseFloat((bet.stake * bet.odds * 0.85).toFixed(2));
    onSettleBet(bet.id, 'won', cashoutValue);
  };

  return (
    <div className="bg-[#0b0c13] border border-[#1b1e2e] rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.45)] flex flex-col h-[520px]">
      {/* Header Tabs */}
      <div className="flex border-b border-[#1b1e2e] bg-[#07080f] p-1">
        <button
          onClick={() => setActiveTab('slip')}
          className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'slip'
              ? 'bg-brand text-slate-950 shadow-[0_0_15px_rgba(0,255,135,0.25)] font-black'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Cupom ({selections.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-[#181a29] text-brand border border-[#272b44]'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Minhas Apostas ({placedBets.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
        {/* SLIP Tab */}
        {activeTab === 'slip' && (
          <div className="flex-1 flex flex-col justify-between h-full">
            {selections.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                <Ticket className="w-10 h-10 text-slate-700 stroke-[1.5]" />
                <p className="text-xs">
                  Seu boletim está vazio.<br /> Selecione odds de qualquer partida para começar a montar sua aposta!
                </p>
              </div>
            ) : (
              <form onSubmit={handlePlaceBet} className="h-full flex flex-col justify-between flex-1 space-y-3">
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selections.map((val) => (
                    <div 
                      key={val.matchId}
                      className="bg-[#07080d] border border-[#1b1e2e] p-2.5 rounded-xl text-xs space-y-1 relative"
                    >
                      <button
                        type="button"
                        onClick={() => onRemoveSelection(val.matchId)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-rose-400 transition-colors text-sm"
                      >
                        ✕
                      </button>
                      <p className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                        {val.matchName}
                      </p>
                      <div className="flex justify-between items-center pr-5">
                        <span className="font-semibold text-white">{val.selectionName}</span>
                        <span className="font-mono text-brand font-bold">@{val.odds.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#141520] pt-3 space-y-3 bg-[#0b0c13]">
                  {/* Multiplier review */}
                  {selections.length > 1 && (
                    <div className="flex justify-between items-center text-xs bg-brand/5 border border-brand/20 p-2.5 rounded-xl">
                      <span className="text-brand font-bold flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5" /> Bônus de Acumulada Ativo
                      </span>
                      <span className="font-mono text-brand font-bold">@{formattedOdds}</span>
                    </div>
                  )}

                  {/* Currency Input section */}
                  <div className="space-y-1.5 p-3.5 bg-[#08090e] rounded-xl border border-[#181a27]">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Valor de Aposta (R$):</span>
                      <span>Disponível: R$ {balance.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-500 font-bold font-mono">R$</span>
                      <input
                        type="number"
                        min="1"
                        value={stakeInput}
                        onChange={(e) => setStakeInput(e.target.value)}
                        className="w-full bg-[#040508] border border-[#1b1e2e] rounded-lg p-2 text-sm font-bold text-white focus:outline-none focus:border-brand font-mono"
                      />
                    </div>
                    
                    {/* Shortcuts */}
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[5, 10, 20, 50].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setStakeInput(v.toString())}
                          className="bg-[#040508] hover:bg-[#111320] border border-[#1a1c2a] text-[10px] py-1 font-semibold text-slate-300 rounded transition-all cursor-pointer"
                        >
                          R$ {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Output potential payout */}
                  <div className="space-y-1 py-1 px-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Cotação total:</span>
                      <span className="font-mono text-slate-200 font-bold">@{formattedOdds}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-200">
                      <span>Retorno Potencial:</span>
                      <span className="font-mono text-brand font-black text-base">R$ {potentialPayout.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={balance < stake || stake <= 0}
                    className="w-full bg-brand hover:bg-[#00e074] text-slate-950 disabled:bg-[#1a1c29] disabled:text-[#383d5a] disabled:border-none font-bold py-3.5 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs cursor-pointer shadow-[0_0_15px_rgba(0,255,135,0.15)] hover:shadow-[0_0_22px_rgba(0,255,135,0.3)] border border-brand/10 hover:scale-[1.01]"
                  >
                    Efetivar Aposta Esportiva
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* HISTORY Tab */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Relatório de Apostas Efetuadas</h3>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
              {placedBets.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 text-slate-600 text-xs">
                  <ShieldCheck className="w-8 h-8 text-slate-800 mb-2" />
                  Nenhuma aposta registrada até o momento.
                </div>
              ) : (
                placedBets.map((bet) => (
                  <div 
                    key={bet.id} 
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                      bet.status === 'won'
                        ? 'bg-brand/5 border-brand/20'
                        : bet.status === 'lost'
                          ? 'bg-rose-950/10 border-rose-500/10'
                          : 'bg-[#0d0e16] border-[#1c1f2f]'
                    }`}
                  >
                    {/* Bet Top row */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-sans tracking-wide ${
                            bet.type === 'sports' 
                              ? 'bg-sky-950 text-sky-400' 
                              : bet.type === 'crash' 
                                ? 'bg-amber-950 text-amber-400' 
                                : 'bg-[#1b1731] text-[#b39eff]'
                          }`}>
                            {bet.type === 'sports' ? 'Esportes' : bet.type === 'crash' ? 'Crash' : 'Slots'}
                          </span>
                          <span className="text-slate-300 text-[11px] font-bold">{bet.matchName}</span>
                        </div>
                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                          {bet.selectionName}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div>
                        {bet.status === 'won' && (
                          <div className="flex items-center gap-1 text-brand text-xs font-bold">
                            <Trophy className="w-4 h-4" />
                            <span>VENCEU</span>
                          </div>
                        )}
                        {bet.status === 'lost' && (
                          <div className="flex items-center gap-1 text-rose-400 text-xs font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>PERDEU</span>
                          </div>
                        )}
                        {bet.status === 'pending' && (
                          <div className="flex items-center gap-1 text-amber-400 text-xs font-bold animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                            <span>PENDENTE</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Money & odds details */}
                    <div className="flex justify-between items-center mt-3 border-t border-slate-950/40 pt-2 text-[10px] text-slate-400 font-mono">
                      <div>Value: <span className="text-slate-200">R$ {bet.stake.toFixed(2)}</span></div>
                      <div>Cotação: <span className="text-slate-200 font-bold">@{bet.odds.toFixed(2)}</span></div>
                      <div>Retorno: <span className={bet.status === 'won' ? 'text-brand font-bold' : 'text-slate-300'}>
                        R$ {bet.status === 'won' ? bet.potentialPayout.toFixed(2) : bet.status === 'lost' ? '0.00' : bet.potentialPayout.toFixed(2)}
                      </span></div>
                    </div>

                    {/* Interactive action buttons for PENDING sports matches */}
                    {bet.status === 'pending' && bet.type === 'sports' && (
                      <div className="mt-3.5 flex gap-1.5 border-t border-[#1c1f2e] pt-2.5">
                        {/* Cash out button */}
                        <button
                          onClick={() => handleEarlyCashout(bet)}
                          className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 rounded-lg text-[10px] font-black text-slate-950 flex items-center justify-center gap-1 cursor-pointer"
                          title="Fazer cash out antecipado (com taxa de conveniência de 15%)"
                        >
                          <Percent className="w-3 h-3 stroke-[2.5]" /> Cashout (R$ {(bet.stake * bet.odds * 0.85).toFixed(2)})
                        </button>

                        {/* Force result buttons to demo winning/losing sports settling */}
                        <button
                          onClick={() => handleManualPayout(bet, 'won')}
                          className="bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 py-1 px-1.5 rounded-lg text-[9px] font-bold cursor-pointer"
                        >
                          Ganhar
                        </button>
                        <button
                          onClick={() => handleManualPayout(bet, 'lost')}
                          className="bg-rose-950 text-rose-400 border border-rose-800/40 hover:bg-rose-900 py-1 px-1.5 rounded-lg text-[9px] font-bold cursor-pointer"
                        >
                          Perder
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {/* Disclaimer policy */}
            <div className="border-t border-[#1b1e2e] pt-2 text-[9px] text-slate-500 leading-normal mb-1">
              Todos os prêmios esportivos acima são liquidados de forma simulada e imediata a fins de demonstração técnica de fluxos fiscais (SPA).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
