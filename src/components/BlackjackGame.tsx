import React, { useState, useCallback } from 'react';
import { Play, DollarSign, Zap, Sparkles, Swords, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedBet } from '../types';

interface BlackjackGameProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  onAddBetHistory?: (bet: PlacedBet) => void;
}

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
  hidden?: boolean;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value: number;
      if (rank === 'A') value = 11;
      else if (['J', 'Q', 'K'].includes(rank)) value = 10;
      else value = parseInt(rank);
      deck.push({ suit, rank, value });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + c.value, 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-red-400', diamonds: 'text-red-400', clubs: 'text-slate-200', spades: 'text-slate-200',
};

function CardView({ card, index }: { card: Card; index: number; key?: string | number }) {
  if (card.hidden) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="w-16 h-24 md:w-20 md:h-28 rounded-xl bg-gradient-to-b from-indigo-800 to-indigo-950 border border-indigo-400/30 flex items-center justify-center shadow-xl shadow-black/40"
      >
        <div className="w-10 h-14 rounded-lg border-2 border-indigo-400/40 flex items-center justify-center">
          <span className="text-indigo-300 text-lg font-bold">?</span>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="w-16 h-24 md:w-20 md:h-28 rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 border border-slate-400/40 flex flex-col items-center justify-center shadow-xl shadow-black/35 relative"
    >
      <span className={`absolute top-1 left-1.5 text-xs font-bold leading-none ${SUIT_COLORS[card.suit]}`}>
        {card.rank}
      </span>
      <span className={`text-xl ${SUIT_COLORS[card.suit]}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={`absolute bottom-1 right-1.5 text-xs font-bold leading-none ${SUIT_COLORS[card.suit]}`}>
        {card.rank}
      </span>
    </motion.div>
  );
}

export default function BlackjackGame({ balance, onUpdateBalance, onAddBetHistory }: BlackjackGameProps) {
  const [stake, setStake] = useState('');
  const [status, setStatus] = useState<'betting' | 'playing' | 'dealer_turn' | 'settled'>('betting');
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [result, setResult] = useState<string>('');
  const [payout, setPayout] = useState(0);
  const [stats, setStats] = useState({ wins: 0, losses: 0, pushes: 0, blackjacks: 0 });

  const deal = useCallback(() => {
    const playCost = parseFloat(stake);
    if (isNaN(playCost) || playCost <= 0) { alert('Valor inválido'); return; }
    if (playCost > balance) { alert('Saldo insuficiente'); return; }
    onUpdateBalance(-playCost);

    const d = shuffleDeck(createDeck());
    const p: Card[] = [];
    const dl: Card[] = [];
    p.push(d.pop()!);
    dl.push({ ...d.pop()!, hidden: true });
    p.push(d.pop()!);
    dl.push(d.pop()!);

    setDeck(d);
    setPlayerHand(p);
    setDealerHand(dl);
    setResult('');
    setPayout(0);
    setStatus('playing');
  }, [stake, balance, onUpdateBalance]);

  const hit = useCallback(() => {
    if (status !== 'playing') return;
    const d = [...deck];
    const p = [...playerHand];
    p.push(d.pop()!);
    setDeck(d);
    setPlayerHand(p);

    if (handValue(p) > 21) {
      setDealerHand(prev => prev.map(c => ({ ...c, hidden: false })));
      setStatus('settled');
      setResult('💥 Estourou! Dealer vence.');
      setPayout(0);
      setStats(s => ({ ...s, losses: s.losses + 1 }));
      if (onAddBetHistory) {
        onAddBetHistory({
          id: `bj-${Date.now()}`,
          matchName: 'Blackjack 21',
          selectionName: `${p.map(c => c.rank + SUIT_SYMBOLS[c.suit]).join(' ')} (${handValue(p)})`,
          odds: 0,
          stake: parseFloat(stake),
          potentialPayout: 0,
          status: 'lost',
          placedAt: new Date().toLocaleTimeString('pt-BR'),
          type: 'casino',
          outcomeValue: 'PERDEU'
        });
      }
    }
  }, [status, deck, playerHand, stake, onAddBetHistory]);

  const stand = useCallback(() => {
    if (status !== 'playing') return;
    const d = [...deck];
    let dl = dealerHand.map(c => ({ ...c, hidden: false }));
    setDealerHand(dl);
    setStatus('dealer_turn');

    const interval = setInterval(() => {
      const dv = handValue(dl);
      if (dv < 17) {
        const card = d.pop()!;
        dl = [...dl, card];
        setDeck([...d]);
        setDealerHand([...dl]);
      } else {
        clearInterval(interval);
        const pv = handValue(playerHand);
        const finalDv = handValue(dl);
        setStatus('settled');
        const playCost = parseFloat(stake);

        let resultText = '';
        let payoutAmt = 0;
        let isWin = false;
        let isBj1 = false;
        let isBj2 = false;

        if (finalDv > 21) {
          resultText = '🎉 Dealer estourou! Você venceu!';
          payoutAmt = playCost * 2;
          isWin = true;
        } else if (finalDv > pv) {
          resultText = '😞 Dealer vence.';
          payoutAmt = 0;
          setStats(s => ({ ...s, losses: s.losses + 1 }));
        } else if (finalDv < pv) {
          resultText = '🎉 Você venceu!';
          payoutAmt = playCost * 2;
          isWin = true;
        } else {
          resultText = '🤝 Push! Empate.';
          payoutAmt = playCost;
          setStats(s => ({ ...s, pushes: s.pushes + 1 }));
        }

        if (pv === 21 && playerHand.length === 2 && finalDv !== 21) {
          resultText = '🃏 Blackjack! Vitória!';
          payoutAmt = Math.floor(playCost * 2.5);
          isWin = true;
          isBj1 = true;
        }

        if (isWin) {
          setPayout(payoutAmt);
          onUpdateBalance(payoutAmt);
          setStats(s => ({
            ...s,
            wins: s.wins + 1,
            blackjacks: isBj1 ? s.blackjacks + 1 : s.blackjacks,
          }));
        }

        if (isBj1) {
          setStats(s => ({ ...s, blackjacks: s.blackjacks + 1 }));
        }

        if (onAddBetHistory) {
          onAddBetHistory({
            id: `bj-${Date.now()}`,
            matchName: 'Blackjack 21',
            selectionName: `J:${pv} D:${finalDv}`,
            odds: payoutAmt > 0 ? (payoutAmt / playCost) : 0,
            stake: playCost,
            potentialPayout: payoutAmt,
            status: isWin ? 'won' : 'lost',
            placedAt: new Date().toLocaleTimeString('pt-BR'),
            type: 'casino',
            outcomeValue: isWin ? 'GANHOU' : 'PERDEU'
          });
        }

        setResult(resultText);
      }
    }, 500);
  }, [status, deck, dealerHand, playerHand, stake, onUpdateBalance, onAddBetHistory]);

  const double = useCallback(() => {
    if (status !== 'playing' || playerHand.length !== 2) return;
    const playCost = parseFloat(stake);
    if (playCost > balance) { alert('Saldo insuficiente para dobrar'); return; }
    onUpdateBalance(-playCost);
    const d = [...deck];
    const p = [...playerHand];
    p.push(d.pop()!);
    setDeck(d);
    setPlayerHand(p);

    const pv = handValue(p);
    if (pv > 21) {
      setDealerHand(prev => prev.map(c => ({ ...c, hidden: false })));
      setStatus('settled');
      setResult('💥 Estourou! Dealer vence.');
      setPayout(0);
      setStats(s => ({ ...s, losses: s.losses + 1 }));
      return;
    }

    let dl = dealerHand.map(c => ({ ...c, hidden: false }));
    setDealerHand(dl);
    setStatus('dealer_turn');

    const standInterval = setInterval(() => {
      const dv = handValue(dl);
      if (dv < 17) {
        const card = d.pop()!;
        dl = [...dl, card];
        setDeck([...d]);
        setDealerHand([...dl]);
      } else {
        clearInterval(standInterval);
        const finalDv = handValue(dl);
        setStatus('settled');
        const totalStake = playCost * 2;

        let resultText = '';
        let payoutAmt = 0;
        let isWin = false;

        if (finalDv > 21) {
          resultText = '🎉 Dealer estourou! Vitória dobrada!';
          payoutAmt = totalStake * 2;
          isWin = true;
        } else if (finalDv > pv) {
          resultText = '😞 Dealer vence.';
          payoutAmt = 0;
          setStats(s => ({ ...s, losses: s.losses + 1 }));
        } else if (finalDv < pv) {
          resultText = '🎉 Vitória dobrada!';
          payoutAmt = totalStake * 2;
          isWin = true;
        } else {
          resultText = '🤝 Push!';
          payoutAmt = totalStake;
          setStats(s => ({ ...s, pushes: s.pushes + 1 }));
        }

        if (isWin) {
          setPayout(payoutAmt);
          onUpdateBalance(payoutAmt);
          setStats(s => ({ ...s, wins: s.wins + 1 }));
        }

        setResult(resultText);
      }
    }, 500);
  }, [status, playerHand, deck, dealerHand, stake, balance, onUpdateBalance, onAddBetHistory]);

  const newGame = () => {
    setStatus('betting');
    setPlayerHand([]);
    setDealerHand([]);
    setResult('');
    setPayout(0);
    setStake('');
  };

  const pv = playerHand.length > 0 ? handValue(playerHand) : 0;
  const dv = dealerHand.length > 0 ? handValue(dealerHand.map(c => c.hidden ? { ...c, value: 0 } : c)) : 0;
  const canDouble = status === 'playing' && playerHand.length === 2 && parseFloat(stake) <= balance;

  const totalRounds = stats.wins + stats.losses + stats.pushes;

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
      <motion.div
        animate={{ boxShadow: ['0 0 0px rgba(0,255,135,0)', '0 0 16px rgba(0,255,135,0.08)', '0 0 0px rgba(0,255,135,0)'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-2xl"
      >
        <div className="bg-gradient-to-b from-[#0a0b12] to-[#06070d] border border-[#1b1e2e] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <div className="bg-gradient-to-r from-[#1a1c2e]/80 via-[#0f111f]/80 to-[#1a1c2e]/80 border border-[#2a2d42]/30 rounded-xl p-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-emerald-500/5" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Blackjack 21</span>
              </div>
              <span className="text-[8px] text-slate-500 font-mono">Dealer para em 17</span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#0a3d2a] to-[#062015] rounded-2xl p-4 md:p-6 border border-emerald-900/40 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,80,40,0.3)_0%,_transparent_70%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem]" />

            <div className="mb-6 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Dealer</span>
                {dealerHand.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-200/60">
                    {status === 'playing' ? '?' : handValue(dealerHand)}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {dealerHand.map((c, i) => <CardView key={i} card={c} index={i} />)}
              </div>
            </div>

            <div className="border-t border-emerald-800/30 my-4 relative z-10" />

            <div className={'mb-4 relative z-10 p-2 -m-2 rounded-xl transition-all duration-500 ' + (status === 'playing' ? 'shadow-[0_0_30px_rgba(0,255,135,0.15)]' : '')}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Você</span>
                {playerHand.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-200/60">{pv}</span>
                )}
              </div>
              <div className="flex gap-1.5">
                {playerHand.map((c, i) => <CardView key={i} card={c} index={i} />)}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key={result}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={'text-center py-3 px-4 rounded-xl text-sm font-bold relative z-10 ' + (
                    payout > 0
                      ? 'bg-brand/10 border border-brand/30 text-brand shadow-[0_0_20px_rgba(0,255,135,0.15)]'
                      : result.includes('Push') || result.includes('🤝')
                        ? 'bg-slate-500/10 border border-slate-500/30 text-slate-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                  )}
                >
                  {result}
                  {payout > 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="block text-xs font-mono mt-1"
                    >
                      +R$ {payout.toFixed(2)}
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {status === 'betting' ? (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1 mb-1.5">
                  <DollarSign className="w-3 h-3" /> Valor da Aposta (R$)
                </label>
                <input
                  type="number"
                  value={stake}
                  onChange={e => setStake(e.target.value)}
                  className="w-full bg-[#040508] border border-[#1b1e2e] focus:border-brand rounded-lg p-2.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 5, 10, 25].map(val => (
                  <button key={val} onClick={() => setStake(val.toString())}
                    className="flex-1 py-1.5 text-[9px] font-bold rounded-md bg-[#040508] border border-[#1c1f2e] text-slate-400 hover:text-white cursor-pointer transition-colors">
                    R${val}
                  </button>
                ))}
              </div>
              <motion.button
                onClick={deal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
              >
                <Play className="w-4 h-4" /> Distribuir Cartas
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3">
              {status === 'playing' && (
                <div className="flex gap-2">
                  <motion.button
                    onClick={hit}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)]"
                  >
                    Pedir (Hit)
                  </motion.button>
                  <motion.button
                    onClick={stand}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-400 hover:to-slate-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(148,163,184,0.2)] hover:shadow-[0_0_25px_rgba(148,163,184,0.35)]"
                  >
                    Parar (Stand)
                  </motion.button>
                  <motion.button
                    onClick={double}
                    disabled={!canDouble}
                    whileHover={canDouble ? { scale: 1.03 } : {}}
                    whileTap={canDouble ? { scale: 0.97 } : {}}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 disabled:from-[#1a1c29] disabled:to-[#1a1c29] disabled:text-[#383d5a] text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(147,51,234,0.2)] hover:shadow-[0_0_25px_rgba(147,51,234,0.35)]"
                  >
                    Dobrar ({parseFloat(stake || '0') * 2})
                  </motion.button>
                </div>
              )}
              {(status === 'settled') && (
                <motion.button
                  onClick={newGame}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.25)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                >
                  <Sparkles className="w-4 h-4" /> Nova Mão
                </motion.button>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
              <DollarSign className="w-3 h-3 text-slate-500 mx-auto mb-1" />
              <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Rodadas</p>
              <p className="text-sm font-bold text-white font-mono">{totalRounds}</p>
            </div>
            <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
              <Trophy className="w-3 h-3 text-brand mx-auto mb-1" />
              <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Vitórias</p>
              <p className="text-sm font-bold text-brand font-mono">{stats.wins}</p>
            </div>
            <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
              <Sparkles className="w-3 h-3 text-yellow-500 mx-auto mb-1" />
              <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Blackjacks</p>
              <p className="text-sm font-bold text-yellow-400 font-mono">{stats.blackjacks}</p>
            </div>
            <div className="bg-[#0d0e16]/60 border border-[#1a1c2a] rounded-lg p-2.5 text-center">
              <Swords className="w-3 h-3 text-rose-500 mx-auto mb-1" />
              <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Derrotas</p>
              <p className="text-sm font-bold text-rose-400 font-mono">{stats.losses}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
