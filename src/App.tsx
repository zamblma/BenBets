import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  HelpCircle, 
  Wallet, 
  ArrowDownCircle, 
  Play, 
  Percent, 
  Search, 
  Dribbble, 
  Activity, 
  Gamepad2, 
  Cpu, 
  Menu, 
  ChevronRight, 
  TrendingUp, 
  Check, 
  AlertTriangle,
  Flame,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
import { Match, BetSelection, PlacedBet, Transaction } from './types';
// Source data
import { INITIAL_MATCHES } from './data/mockMatches';
// Subcomponents
import ApostasInfo from './components/ApostasInfo';
import PixModal from './components/PixModal';
import CrashGame from './components/CrashGame';
import SlotGame from './components/SlotGame';
import BetHistoryList from './components/BetHistoryList';

export default function App() {
  // Navigation & Category states
  const [selectedSport, setSelectedSport] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom modals/drawers
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isPixOpen, setIsPixOpen] = useState<boolean>(false);

  // Active user data
  const [balance, setBalance] = useState<number>(250.00);
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "tx-init",
      type: "deposito",
      amount: 250.00,
      status: "concluido",
      date: new Date().toLocaleString('pt-BR'),
    }
  ]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);

  // Dynamic Live Matches State Feed
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);

  // Periodic score updates and minor odds drifting (Simulation of feed data)
  useEffect(() => {
    const scoreInterval = setInterval(() => {
      setMatches((prevMatches) => 
        prevMatches.map((match) => {
          if (!match.isLive) return match;
          
          let hScore = match.scoreHome;
          let aScore = match.scoreAway;
          let elapsed = match.timeElapsed;
          const probability = Math.random();

          // Sport specific progress rules
          if (match.sport === 'Futebol') {
            if (probability < 0.1) {
              if (Math.random() > 0.5) {
                hScore = (hScore ?? 0) + 1;
              } else {
                aScore = (aScore ?? 0) + 1;
              }
            }
            if (elapsed) {
              const minutes = parseInt(elapsed.replace("'", ""));
              if (!isNaN(minutes)) {
                elapsed = minutes < 90 ? `${minutes + 1}'` : "90'";
              }
            }
          } else if (match.sport === 'Basquete') {
            if (probability < 0.5) {
              hScore = (hScore ?? 100) + Math.floor(Math.random() * 3) + 1;
              aScore = (aScore ?? 100) + Math.floor(Math.random() * 3) + 1;
            }
          } else if (match.sport === 'Tênis') {
            if (probability < 0.15) {
              // Drift games score within set
              elapsed = `Set 4 - G: ${Math.floor(Math.random() * 6)}-${Math.floor(Math.random() * 6)}`;
            }
          } else if (match.sport === 'E-Sports') {
            if (probability < 0.25) {
              if (Math.random() > 0.5) {
                hScore = (hScore ?? 0) + 1;
              } else {
                aScore = (aScore ?? 0) + 1;
              }
              // Reset CS match cap
              if ((hScore ?? 0) > 13 || (aScore ?? 0) > 13) {
                hScore = 0;
                aScore = 0;
              }
            }
          }

          // Random odds drift (fluctuations up/down 4%)
          const drift = () => 0.98 + Math.random() * 0.04;
          const newOdds = {
            home: parseFloat(Math.max(1.01, match.odds.home * drift()).toFixed(2)),
            draw: match.odds.draw ? parseFloat(Math.max(1.01, match.odds.draw * drift()).toFixed(2)) : undefined,
            away: parseFloat(Math.max(1.01, match.odds.away * drift()).toFixed(2))
          };

          return {
            ...match,
            scoreHome: hScore,
            scoreAway: aScore,
            timeElapsed: elapsed,
            odds: newOdds
          };
        })
      );
    }, 7500);

    return () => clearInterval(scoreInterval);
  }, []);

  // Periodic sports betting simulation settlement engine (Resolves a pending sports bet every 20 seconds)
  useEffect(() => {
    const settleInterval = setInterval(() => {
      setPlacedBets((prevBets) => {
        const pendingSportsIdx = prevBets.findIndex(b => b.status === 'pending' && b.type === 'sports');
        if (pendingSportsIdx === -1) return prevBets;

        const updated = [...prevBets];
        const bet = updated[pendingSportsIdx];
        const playerWon = Math.random() > 0.45; // 55% chance to win for playful satisfaction

        if (playerWon) {
          updated[pendingSportsIdx] = {
            ...bet,
            status: 'won',
          };
          setBalance((b) => b + bet.potentialPayout);
        } else {
          updated[pendingSportsIdx] = {
            ...bet,
            status: 'lost'
          };
        }
        return updated;
      });
    }, 22000);

    return () => clearInterval(settleInterval);
  }, []);

  // Handler to toggle selection in the slip
  const handleOddsClick = (match: Match, outcomeType: 'home' | 'draw' | 'away', oddsValue: number) => {
    let outcomeLabel = '';
    if (outcomeType === 'home') outcomeLabel = `${match.teamHome} (Vence)`;
    else if (outcomeType === 'away') outcomeLabel = `${match.teamAway} (Vence)`;
    else outcomeLabel = 'Empate';

    // Check if match already has selection
    const existingIndex = selections.findIndex(s => s.matchId === match.id);

    if (existingIndex !== -1) {
      const existingSelection = selections[existingIndex];
      // If same selection, remove it. If different, update odds.
      if (existingSelection.type === outcomeType) {
        setSelections(prev => prev.filter(s => s.matchId !== match.id));
      } else {
        setSelections(prev => prev.map(s => s.matchId === match.id ? {
          matchId: match.id,
          matchName: `${match.teamHome} x ${match.teamAway}`,
          type: outcomeType,
          selectionName: outcomeLabel,
          odds: oddsValue,
        } : s));
      }
    } else {
      // Add new selection
      const newSel: BetSelection = {
        matchId: match.id,
        matchName: `${match.teamHome} x ${match.teamAway}`,
        type: outcomeType,
        selectionName: outcomeLabel,
        odds: oddsValue,
      };
      setSelections(prev => [...prev, newSel]);
    }
  };

  const handleRemoveSelection = (matchId: string) => {
    setSelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleClearSelections = () => {
    setSelections([]);
  };

  const handleDepositSuccess = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  const handleWithdrawSuccess = (amount: number): boolean => {
    if (balance >= amount) {
      setBalance(prev => prev - amount);
      return true;
    }
    return false;
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
  };

  const handleAddPlacedBet = (newBet: PlacedBet) => {
    setPlacedBets(prev => [newBet, ...prev]);
  };

  const handleSettleAction = (betId: string, status: 'won' | 'lost', payOut: number) => {
    setPlacedBets(prev => prev.map(b => b.id === betId ? { ...b, status, potentialPayout: payOut } : b));
    if (status === 'won' && payOut > 0) {
      setBalance(prev => prev + payOut);
    }
  };

  // Filtered Matches selector
  const filteredMatches = matches.filter(match => {
    const matchesSearch = 
      match.teamHome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teamAway.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.league.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedSport === 'Todos') {
      return matchesSearch;
    }
    return match.sport === selectedSport && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#06070d] font-sans text-slate-100 flex flex-col justify-between">
      
      {/* 🇧🇷 NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0c0d14]/90 border-b border-[#1c1e2d] backdrop-blur-md px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-brand to-emerald-400 text-slate-950 p-2.5 rounded-xl font-black tracking-tighter text-sm font-display leading-none rotate-2 shadow-[0_0_15px_rgba(0,255,135,0.3)]">
              B.BR
            </div>
            <div>
              <h1 className="font-extrabold text-brand font-sans text-lg tracking-tight leading-none flex items-center gap-1">
                ArenaBet<span className="text-white text-[9px] font-bold px-1.5 py-0.5 bg-[#171a29] border border-[#272b44] rounded uppercase tracking-wider">.bet.br</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-medium">Ambiente Demonstração Legal • Lei 14.790/2023</p>
            </div>
          </div>

          {/* User Account Controls */}
          <div className="flex items-center gap-4">
            
            {/* Balance Component */}
            <div className="bg-[#07080f] px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-[#1b1e2e] flex items-center gap-2.5">
              <div className="p-1 bg-brand/10 rounded-lg text-brand md:block hidden animate-pulse">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Minha Conta</span>
                <span className="font-mono text-brand font-extrabold text-sm md:text-base tracking-tight select-none">
                  R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Pix CTA */}
            <button 
              onClick={() => setIsPixOpen(true)}
              className="bg-brand hover:bg-[#00e074] text-slate-950 font-black py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,255,135,0.25)] hover:shadow-[0_0_20px_rgba(0,255,135,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-95 text-center shrink-0"
            >
              <ArrowDownCircle className="w-4 h-4 text-slate-950" />
              Depositar
            </button>

            {/* Regulation Manual */}
            <button 
              onClick={() => setIsInfoOpen(true)}
              className="p-2 border border-[#1c1e2d] text-slate-400 hover:text-brand rounded-xl hover:bg-[#161826] transition-colors cursor-pointer block"
              title="Ler Legislação das Bets"
            >
              <ShieldCheck className="w-5 h-5 text-brand" />
            </button>
          </div>

        </div>
      </header>

      {/* Hero Brazil Regulatory Header Notice */}
      <div className="bg-[#0b0c13] border-b border-[#1b1d2c]/60 py-2.5 px-4 text-xs text-center text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <span className="bg-brand/10 border border-brand/20 text-brand px-2 py-0.5 rounded text-[10px] font-bold font-mono">COMPLIANCE NACIONAL</span>
          <p className="text-[11px] font-medium text-slate-300">
            Apostas operadas de acordo com as regras de Jogo Seguro. Domínio exclusivo <span className="font-bold text-brand">.bet.br</span> outorga SPA/MF.
          </p>
        </div>
      </div>

      {/* MAIN CONTAINER GRID */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:px-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* LEFT COLUMN: FILTERS & MATCHES/CASINO SELECT (COLS-8) */}
        <section className="col-span-1 lg:col-span-8 space-y-6">
          
          {/* Main Visual Category Switchers */}
          <div className="flex border-b border-[#1a1c2a] overflow-x-auto gap-3 py-1 pb-2 md:pb-3 justify-start scrollbar-thin">
            {[
              { id: 'Todos', label: 'Todos Esportes', icon: '⚽' },
              { id: 'Futebol', label: 'Futebol', icon: '⚽' },
              { id: 'Basquete', label: 'Basquete', icon: '🏀' },
              { id: 'Tênis', label: 'Tênis', icon: '🎾' },
              { id: 'E-Sports', label: 'E-Sports', icon: '🎮' },
              { id: 'Cassino', label: 'Jogos de Cassino', icon: '🚀' }
            ].map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap cursor-pointer flex items-center gap-2 border leading-none ${
                  selectedSport === sport.id
                    ? 'bg-brand text-slate-950 border-brand font-extrabold shadow-[0_0_15px_rgba(0,255,135,0.2)]'
                    : 'bg-[#0d0e16] hover:bg-[#141624] text-slate-300 border-[#1a1d2d]'
                }`}
              >
                <span>{sport.icon}</span>
                {sport.label}
              </button>
            ))}
          </div>

          {/* Sub Panels Based on Category */}
          {selectedSport === 'Cassino' ? (
            <div className="space-y-6">
              
              {/* Nested Intro Header */}
              <div className="bg-gradient-to-r from-[#161a2b]/40 via-[#0e1017] to-[#161a2b]/20 p-5 rounded-2xl border border-indigo-950/45 flex items-center gap-4">
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <Flame className="w-6 h-6 animate-pulse text-brand" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Arena de Cassino e Jogos Crash</h3>
                  <p className="text-slate-400 text-xs">Simulador regulado de geradores de números (RNG). Teste jogos de slots e crash de forma auditada.</p>
                </div>
              </div>

              {/* Dynamic Game Toggles (Slot vs Crash) Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand inline-block animate-ping" />
                    Crash Game (Foguete)
                  </h4>
                  <CrashGame 
                    balance={balance} 
                    onUpdateBalance={handleDepositSuccess} 
                    onAddBetHistory={handleAddPlacedBet} 
                  />
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block animate-ping" />
                    Slots Caça-Níqueis
                  </h4>
                  <SlotGame 
                    balance={balance} 
                    onUpdateBalance={handleDepositSuccess} 
                    onAddBetHistory={handleAddPlacedBet} 
                  />
                </div>
              </div>

            </div>
          ) : (
            // SPORTS BOOK LIST DISPLAY
            <div className="space-y-4">
              
              {/* Search match input */}
              <div className="flex gap-2.5 items-center bg-[#0d0e16] rounded-xl p-3 border border-[#1a1c2a]">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar partida, time ou campeonato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Header Titles */}
              <div className="flex justify-between items-center px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand shrink-0 animate-pulse" />
                  Próximos Confrontos ({filteredMatches.length})
                </h2>
                <span className="text-[10px] text-slate-500 uppercase font-mono">FEED AO VIVO EM TEMPO REAL</span>
              </div>

              {/* Match Cards Feed Grid */}
              <div className="space-y-3.5">
                {filteredMatches.length === 0 ? (
                  <div className="bg-[#0d0e16] p-12 rounded-2xl border border-[#1a1c2a] text-center text-slate-500 text-xs">
                     Nenhuma partida encontrada para os critérios selecionados.
                  </div>
                ) : (
                  filteredMatches.map((match) => (
                    <div 
                      key={match.id}
                      className="bg-[#0b0c13]/90 border border-[#1b1e2e]/90 hover:border-[#2b2f47] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 shadow-lg"
                    >
                      {/* Left: League & Teams labels */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#171a29] text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded border border-[#23273e] font-mono uppercase">
                            {match.sport}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {match.league}
                          </span>
                          {match.isLive && (
                            <span className="bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded text-[8px] animate-pulse uppercase shrink-0">
                              Ao vivo
                            </span>
                          )}
                        </div>

                        {/* Teams Name and Live Score */}
                        <div className="flex items-center justify-between md:justify-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100 text-sm">{match.teamHome}</span>
                              {match.isLive && (
                                <span className="font-mono font-black text-rose-500 bg-[#07080f] px-1.5 py-0.5 rounded text-xs border border-rose-950/40">{match.scoreHome}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100 text-sm">{match.teamAway}</span>
                              {match.isLive && (
                                <span className="font-mono font-black text-rose-500 bg-[#07080f] px-1.5 py-0.5 rounded text-xs border border-rose-950/40">{match.scoreAway}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <span>{match.time}</span>
                          {match.isLive && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-rose-400 font-mono text-xs">{match.timeElapsed}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Interactive Odds Buttons */}
                      <div className="flex gap-2 md:self-center">
                        {/* 1 (Vence Home) */}
                        <button
                          onClick={() => handleOddsClick(match, 'home', match.odds.home)}
                          className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                            selections.some(s => s.matchId === match.id && s.type === 'home')
                              ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                              : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                          }`}
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-500">1</span>
                          <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.home.toFixed(2)}</span>
                          <span className="text-[8px] block opacity-50 font-sans tracking-wide">Casa</span>
                        </button>

                        {/* X (Draw Selection - Only if Draw Odds exist) */}
                        {match.odds.draw !== undefined && (
                          <button
                            onClick={() => handleOddsClick(match, 'draw', match.odds.draw!)}
                            className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                              selections.some(s => s.matchId === match.id && s.type === 'draw')
                                ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                                : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                            }`}
                          >
                            <span className="text-[9px] uppercase font-bold text-slate-500">X</span>
                            <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.draw.toFixed(2)}</span>
                            <span className="text-[8px] block opacity-50 font-sans tracking-wide">Empate</span>
                          </button>
                        )}

                        {/* 2 (Vence Away) */}
                        <button
                          onClick={() => handleOddsClick(match, 'away', match.odds.away)}
                          className={`flex-1 md:w-24 p-3 rounded-xl border text-center transition-all duration-300 cursor-pointer flex flex-col justify-center items-center ${
                            selections.some(s => s.matchId === match.id && s.type === 'away')
                              ? 'bg-brand border-brand text-slate-950 font-extrabold font-mono shadow-[0_0_12px_rgba(0,255,135,0.35)]'
                              : 'bg-[#07080d] hover:bg-[#111320] hover:border-brand/35 text-slate-300 border-[#1c1e2d]'
                          }`}
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-500">2</span>
                          <span className="text-sm font-mono font-bold leading-none mt-1">{match.odds.away.toFixed(2)}</span>
                          <span className="text-[8px] block opacity-50 font-sans tracking-wide">Fora</span>
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* Dynamic Promotion card */}
              <div className="bg-gradient-to-r from-brand/5 to-teal-950/10 p-5 border border-brand/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> Bônus Relâmpago Ativo
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Crie apostas acumuladas com mais de 2 seleções e ganhe acréscimo automático de até <span className="font-bold text-brand">+15% de retorno</span> sem custo adicional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('Flamengo');
                    setSelectedSport('Todos');
                  }}
                  className="bg-brand hover:bg-[#00e074] text-slate-950 font-black text-[10px] uppercase tracking-wider py-2.5 px-3.5 rounded-lg shrink-0 cursor-pointer shadow-md transition-all hover:scale-[1.02]"
                >
                  Ver Jogos Relevantes
                </button>
              </div>

            </div>
          )}

        </section>

        {/* RIGHT COLUMN: ACTIVE BET SLIP & PLACED HISTORY LEDGER */}
        <section className="col-span-1 lg:col-span-4 space-y-6">
          <BetHistoryList
            selections={selections}
            onRemoveSelection={handleRemoveSelection}
            onClearSelections={handleClearSelections}
            balance={balance}
            onUpdateBalance={handleDepositSuccess}
            placedBets={placedBets}
            onAddPlacedBet={handleAddPlacedBet}
            onSettleBet={handleSettleAction}
          />
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#0b0c13] border-t border-[#1b1e2e] text-slate-500 py-8 px-4 mt-12 text-center text-[11px] leading-relaxed">
        <div className="max-w-7xl mx-auto space-y-4">
          
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-slate-400 uppercase font-sans font-bold tracking-wider">
            <a href="#rules" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Regras de Jogo</a>
            <span>•</span>
            <a href="#compliance" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Tributação Federal</a>
            <span>•</span>
            <a href="#responsible" onClick={(e) => { e.preventDefault(); setIsInfoOpen(true); }} className="hover:text-brand transition-colors">Jogo Responsável 18+</a>
          </div>

          <p className="max-w-3xl mx-auto">
            Este simulador de apostas esportivas e jogos de cassino foi desenvolvido exclusivamente para fins de demonstração regulatória e prototipação de UI, de acordo com o arcabouço técnico brasileiro instituído pela Lei Federal nº 14.790/2023. As transações financeiras, depósitos e saques realizados nesta aplicação são fictícios e simulados localmente.
          </p>

          <div className="text-slate-600 flex justify-center items-center gap-3">
            <span>© {new Date().getFullYear()} ArenaBet Registrada. Todos os direitos reservados.</span>
            <span>•</span>
            <span className="border border-[#1f2334] px-1.5 py-0.2 rounded font-mono text-[9px]">CNPJ SIMULADO OK</span>
          </div>

        </div>
      </footer>

      {/* DYNAMIC TRANSITION SLIDING GUEST DRAWERS */}
      <AnimatePresence>
        {isInfoOpen && (
          <ApostasInfo isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPixOpen && (
          <PixModal 
            isOpen={isPixOpen} 
            onClose={() => setIsPixOpen(false)} 
            balance={balance}
            onDeposit={handleDepositSuccess}
            onWithdraw={handleWithdrawSuccess}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
