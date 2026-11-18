import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { PlacedBet, Transaction, PokemonCard } from '../types';

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const ACTIVE_24H_MS = 24 * 60 * 60 * 1000;

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  balance: number;
  totalCards: number;
  uniqueCards: number;
  betsWon: number;
  totalBets: number;
  biggestWin: number;
  lastSeen: number;
  createdAt?: string;
}

export async function getUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as {
    balance: number;
    displayName?: string;
    placedBets: PlacedBet[];
    transactions: Transaction[];
    pokemonCollection: PokemonCard[];
    worldCupCollection: PokemonCard[];
    kpopCollection: PokemonCard[];
    cs2Collection: PokemonCard[];
    animeCollection: PokemonCard[];
  };
}

export async function createUserData(uid: string, email: string, displayName?: string) {
  const ref = doc(db, 'users', uid);
  const data = {
    email,
    displayName: displayName || email.split('@')[0],
    balance: 20.00,
    placedBets: [],
    transactions: [],
    pokemonCollection: [],
    worldCupCollection: [],
    kpopCollection: [],
    cs2Collection: [],
    animeCollection: [],
    lastSeen: Date.now(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return data;
}

export async function updateBalance(uid: string, newBalance: number) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { balance: newBalance, lastSeen: Date.now() });
}

export async function updateUserPresence(uid: string) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { lastSeen: Date.now() });
}

export async function markUserOffline(uid: string) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { lastSeen: 0 });
}

function sumCollectionStats(raw: any): { uniqueCards: number; totalCards: number } {
  const keys = [
    'pokemonCollection',
    'worldCupCollection',
    'kpopCollection',
    'cs2Collection',
    'animeCollection',
  ];
  let uniqueCards = 0;
  let totalCards = 0;
  for (const k of keys) {
    const arr = raw?.[k];
    if (!Array.isArray(arr)) continue;
    uniqueCards += arr.length;
    for (const c of arr) {
      totalCards += typeof c?.quantity === 'number' && c.quantity > 0 ? c.quantity : 1;
    }
  }
  return { uniqueCards, totalCards };
}

export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map((d) => {
        const raw = d.data() || {};
        const fallbackName = raw.email ? String(raw.email).split('@')[0] : 'Agente';
        const displayName = String(raw.displayName || fallbackName || 'Agente').trim() || 'Agente';
        const balance =
          typeof raw.balance === 'number' && Number.isFinite(raw.balance) ? raw.balance : 0;
        const { uniqueCards, totalCards } = sumCollectionStats(raw);

        const bets: PlacedBet[] = Array.isArray(raw.placedBets) ? raw.placedBets : [];
        let betsWon = 0;
        let biggestWin = 0;
        for (const b of bets) {
          if (b?.status === 'won') {
            betsWon += 1;
            const payout = typeof b.potentialPayout === 'number' && Number.isFinite(b.potentialPayout) ? b.potentialPayout : 0;
            if (payout > biggestWin) biggestWin = payout;
          }
        }

        return {
          uid: d.id,
          displayName,
          balance,
          totalCards,
          uniqueCards,
          betsWon,
          totalBets: bets.length,
          biggestWin,
          lastSeen: typeof raw.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
        };
      });
      onUpdate(entries);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function addBet(uid: string, bet: PlacedBet) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { placedBets: arrayUnion(bet) });
}

export async function updateBet(uid: string, betId: string, updates: Partial<PlacedBet>) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const bets: PlacedBet[] = data.placedBets || [];
  const updated = bets.map(b => b.id === betId ? { ...b, ...updates } : b);
  await updateDoc(ref, { placedBets: updated });
}

export async function addTransaction(uid: string, tx: Transaction) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { transactions: arrayUnion(tx) });
}

export async function addPokemonCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.pokemonCollection || [];
  const merged: PokemonCard[] = [...existing];

  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) {
      merged[idx].quantity += 1;
    } else {
      merged.push(newCard);
    }
  }

  await updateDoc(ref, { pokemonCollection: merged });
}

export async function removePokemonCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.pokemonCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { pokemonCollection: updated });
}

export async function addWorldCupStickers(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.worldCupCollection || [];
  const merged: PokemonCard[] = [...existing];

  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) {
      merged[idx].quantity += 1;
    } else {
      merged.push(newCard);
    }
  }

  await updateDoc(ref, { worldCupCollection: merged });
}

export async function removeWorldCupSticker(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.worldCupCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { worldCupCollection: updated });
}

export async function setWorldCupCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { worldCupCollection: cards });
}

export async function addKpopCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.kpopCollection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { kpopCollection: merged });
}

export async function removeKpopCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.kpopCollection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { kpopCollection: updated });
}

export async function addCS2Cards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.cs2Collection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { cs2Collection: merged });
}

export async function removeCS2Card(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.cs2Collection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { cs2Collection: updated });
}

export async function getAnimeGachaPackData(uid: string): Promise<{ count: number; firstPackTime: number }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { count: 0, firstPackTime: 0 };
  const data = snap.data();
  return {
    count: data.animeGachaPacksOpened || 0,
    firstPackTime: data.animeGachaFirstPackTime || 0,
  };
}

export async function recordAnimeGachaPack(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const now = Date.now();
  const firstPackTime = data.animeGachaFirstPackTime || 0;
  const count = data.animeGachaPacksOpened || 0;
  const HOUR_MS = 3600000;

  if (now - firstPackTime >= HOUR_MS) {
    await updateDoc(ref, { animeGachaFirstPackTime: now, animeGachaPacksOpened: 1 });
  } else {
    await updateDoc(ref, { animeGachaPacksOpened: count + 1 });
  }
}

export async function addAnimeCards(uid: string, newCards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const merged: PokemonCard[] = [...existing];
  for (const newCard of newCards) {
    const idx = merged.findIndex(c => c.id === newCard.id);
    if (idx >= 0) { merged[idx].quantity += 1; }
    else { merged.push(newCard); }
  }
  await updateDoc(ref, { animeCollection: merged });
}

export async function removeAnimeCard(uid: string, cardId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const updated = existing.map(c => c.id === cardId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0);
  await updateDoc(ref, { animeCollection: updated });
}

export async function setAnimeCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { animeCollection: cards });
}

// Admin
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
}

export async function adminSetBalance(uid: string, balance: number) {
  await updateDoc(doc(db, 'users', uid), { balance });
}

// Daily Missions
export interface Mission {
  id: string;
  title: string;
  desc: string;
  icon: string;
  target: number;
  reward: number;
}

export interface MissionProgress {
  current: number;
  completed: boolean;
  claimed: boolean;
  date: string;
}

export const DAILY_MISSIONS: Mission[] = [
  { id: 'blackjack_wins', title: 'Mestre do Blackjack', desc: 'Ganhe 3 mãos de blackjack', icon: '🃏', target: 3, reward: 10 },
  { id: 'crash_cashout', title: 'Aviador', desc: 'Faça cashout 2 vezes', icon: '✈️', target: 2, reward: 8 },
  { id: 'roulette_spins', title: 'Roleta', desc: 'Gire a roleta 5 vezes', icon: '🎡', target: 5, reward: 6 },
  { id: 'dice_rolls', title: 'Dados', desc: 'Jogue os dados 3 vezes', icon: '🎲', target: 3, reward: 5 },
  { id: 'fortune_spins', title: 'Tigre da Sorte', desc: 'Gire o Fortune Tiger 3 vezes', icon: '🐯', target: 3, reward: 7 },
  { id: 'pokemon_packs', title: 'Pokémon Trainer', desc: 'Abra 2 pacotes Pokémon', icon: '⚡', target: 2, reward: 12 },
];

export async function getMissions(uid: string): Promise<Record<string, MissionProgress>> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  const saved = data.missions || {};
  const today = new Date().toDateString();
  // Reset if outdated
  for (const key of Object.keys(saved)) {
    if (saved[key].date !== today) delete saved[key];
  }
  return saved;
}

export async function updateMissionProgress(uid: string, missionId: string, increment: number) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const missions: Record<string, MissionProgress> = data.missions || {};
  const today = new Date().toDateString();
  let m = missions[missionId];
  // Reset diário: se a missão pertence a outro dia, zera o progresso
  if (!m || m.date !== today) {
    m = { current: 0, completed: false, claimed: false, date: today };
  }
  if (m.completed && !m.claimed) return; // waiting claim
  if (m.claimed) return; // already done
  m.current += increment;
  m.date = today;
  const missionDef = DAILY_MISSIONS.find(x => x.id === missionId);
  if (missionDef && m.current >= missionDef.target) m.completed = true;
  missions[missionId] = m;
  await updateDoc(ref, { missions });
}

export async function claimMissionReward(uid: string, missionId: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const missions: Record<string, MissionProgress> = data.missions || {};
  const today = new Date().toDateString();
  const m = missions[missionId];
  // Só permite resgate do dia atual (reset a cada 24h acontece em getMissions/updateMissionProgress)
  if (!m || m.date !== today || !m.completed || m.claimed) return;
  const missionDef = DAILY_MISSIONS.find(x => x.id === missionId);
  if (!missionDef) return;
  m.claimed = true;
  await updateDoc(ref, { missions, balance: (data.balance || 0) + missionDef.reward, lastSeen: Date.now() });
}
