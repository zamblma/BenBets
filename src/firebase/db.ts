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

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  balance: number;
  rawBalanceWasInvalid: boolean;
  createdAt?: string;
  lastSeen: number;
  placedBets: PlacedBet[];
  transactions: Transaction[];
  pokemonCollection: PokemonCard[];
  worldCupCollection: PokemonCard[];
  kpopCollection: PokemonCard[];
  cs2Collection: PokemonCard[];
  animeCollection: PokemonCard[];
  totalCards: number;
  uniqueCards: number;
  betsWon: number;
  biggestWin: number;
}

export function sanitizePlacedBets(rawBets: any): { bets: PlacedBet[]; repaired: boolean } {
  if (!Array.isArray(rawBets)) return { bets: [], repaired: false };
  let repaired = false;
  const bets: PlacedBet[] = [];

  for (const b of rawBets) {
    if (!b || typeof b !== 'object') {
      repaired = true;
      continue;
    }

    const stakeValid = typeof b.stake === 'number' && Number.isFinite(b.stake) && b.stake >= 0;
    const oddsValid = typeof b.odds === 'number' && Number.isFinite(b.odds) && b.odds >= 0;
    const payoutValid =
      typeof b.potentialPayout === 'number' && Number.isFinite(b.potentialPayout) && b.potentialPayout >= 0;

    if (!stakeValid || !oddsValid || !payoutValid) repaired = true;

    const stake = stakeValid ? b.stake : 0;
    const odds = oddsValid ? b.odds : 1.0;
    const potentialPayout = payoutValid ? b.potentialPayout : b.status === 'won' ? stake : 0;

    let selectionName = typeof b.selectionName === 'string' ? b.selectionName : '';
    if (/NaN/i.test(selectionName)) {
      selectionName = selectionName.replace(/NaNx?/gi, '1.00x');
      repaired = true;
    }

    const cleanBet: PlacedBet = {
      id: String(b.id || `bet-${bets.length}`),
      matchName: String(b.matchName || 'Aposta'),
      selectionName,
      odds,
      stake,
      potentialPayout,
      status: b.status === 'won' || b.status === 'lost' || b.status === 'pending' ? b.status : 'lost',
      placedAt: String(b.placedAt || ''),
      type: b.type === 'sports' || b.type === 'crash' || b.type === 'casino' ? b.type : 'casino',
    };

    if (typeof b.outcomeValue === 'string') {
      let cleanOutcome = b.outcomeValue;
      if (/NaN/i.test(cleanOutcome)) {
        cleanOutcome = /R\$/i.test(cleanOutcome) ? 'R$ 0.00' : '1.00x';
        repaired = true;
      }
      cleanBet.outcomeValue = cleanOutcome;
    }

    if (typeof b.matchId === 'string' && b.matchId) {
      cleanBet.matchId = b.matchId;
    }
    if (b.pickedOutcome === 'home' || b.pickedOutcome === 'draw' || b.pickedOutcome === 'away') {
      cleanBet.pickedOutcome = b.pickedOutcome;
    }
    if (Array.isArray(b.legs)) {
      const validLegs = b.legs
        .filter(
          (l: any) =>
            l &&
            typeof l === 'object' &&
            typeof l.matchId === 'string' &&
            (l.pickedOutcome === 'home' || l.pickedOutcome === 'draw' || l.pickedOutcome === 'away')
        )
        .map((l: any) => ({
          matchId: String(l.matchId),
          matchName: String(l.matchName || ''),
          pickedOutcome: l.pickedOutcome as 'home' | 'draw' | 'away',
          selectionName: String(l.selectionName || ''),
          odds: typeof l.odds === 'number' && Number.isFinite(l.odds) ? l.odds : 1,
        }));
      if (validLegs.length > 0) cleanBet.legs = validLegs;
    }

    bets.push(cleanBet);
  }

  return { bets, repaired };
}

export function recoverValidBalance(
  raw: any,
  sanitizedBets: PlacedBet[]
): { balance: number; repaired: boolean } {
  const rawBal = raw?.balance;
  if (typeof rawBal === 'number' && Number.isFinite(rawBal) && rawBal >= 0) {
    return { balance: rawBal, repaired: false };
  }

  // Saldo corrompido (ex.: NaN/null): recalcula a partir de bônus + transações + apostas válidas
  let est = 20.0;
  const txs: any[] = Array.isArray(raw?.transactions) ? raw.transactions : [];
  for (const tx of txs) {
    if (!tx || typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) continue;
    if (tx.type === 'deposito') est += tx.amount;
    else if (tx.type === 'saque') est -= tx.amount;
  }
  for (const b of sanitizedBets) {
    if (b.status === 'won') {
      est += b.potentialPayout - b.stake;
    } else if (b.status === 'lost' || b.status === 'pending') {
      est -= b.stake;
    }
  }
  const cleanBalance = Math.max(20.0, Number(est.toFixed(2)));
  return { balance: Number.isFinite(cleanBalance) ? cleanBalance : 20.0, repaired: true };
}

export const MUDAE_SEASON_VERSION = 2;

let lastUserDataLoadedAt = Date.now();
export function getLastUserDataLoadedAt(): number {
  return lastUserDataLoadedAt;
}

export async function getUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  lastUserDataLoadedAt = Date.now();
  if (!snap.exists()) return null;
  const raw = snap.data() || {};
  const { bets: cleanBets, repaired: betsRepaired } = sanitizePlacedBets(raw.placedBets);
  const { balance: cleanBalance, repaired: balRepaired } = recoverValidBalance(raw, cleanBets);
  const needsSeasonReset = raw.mudaeSeasonVersion !== MUDAE_SEASON_VERSION;

  const updates: Record<string, any> = {};
  if (betsRepaired || balRepaired) {
    updates.balance = cleanBalance;
    updates.placedBets = cleanBets;
  }
  if (needsSeasonReset) {
    updates.animeCollection = [];
    updates.mudaeSeasonVersion = MUDAE_SEASON_VERSION;
    if (raw.mudaeData && typeof raw.mudaeData === 'object') {
      updates.mudaeData = {
        ...raw.mudaeData,
        marketListings: [],
      };
    }
  }

  if (Object.keys(updates).length > 0) {
    updateDoc(ref, updates).catch(() => {});
  }

  return {
    ...raw,
    balance: cleanBalance,
    balanceRepaired: balRepaired,
    mudaeSeasonVersion: MUDAE_SEASON_VERSION,
    placedBets: cleanBets,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    pokemonCollection: Array.isArray(raw.pokemonCollection) ? raw.pokemonCollection : [],
    worldCupCollection: Array.isArray(raw.worldCupCollection) ? raw.worldCupCollection : [],
    kpopCollection: Array.isArray(raw.kpopCollection) ? raw.kpopCollection : [],
    cs2Collection: Array.isArray(raw.cs2Collection) ? raw.cs2Collection : [],
    animeCollection: needsSeasonReset
      ? []
      : Array.isArray(raw.animeCollection)
        ? raw.animeCollection
        : [],
  } as {
    balance: number;
    balanceRepaired?: boolean;
    mudaeSeasonVersion?: number;
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
  lastUserDataLoadedAt = Date.now();
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
    mudaeSeasonVersion: MUDAE_SEASON_VERSION,
    lastSeen: Date.now(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return data;
}

export async function updateBalance(uid: string, newBalance: number) {
  if (typeof newBalance !== 'number' || !Number.isFinite(newBalance) || newBalance < 0) return;
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { balance: Number(newBalance.toFixed(2)), lastSeen: Date.now() });
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
  const isAnimeCurrent = raw?.mudaeSeasonVersion === MUDAE_SEASON_VERSION;
  const keys = [
    'pokemonCollection',
    'worldCupCollection',
    'kpopCollection',
    'cs2Collection',
    ...(isAnimeCurrent ? ['animeCollection'] : []),
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

function mapDocToAdminRecord(uid: string, raw: any): { record: AdminUserRecord; needsRepair: boolean } {
  const email = typeof raw?.email === 'string' ? raw.email : '';
  const fallbackName = email ? email.split('@')[0] : 'Agente';
  const displayName = String(raw?.displayName || fallbackName || 'Agente').trim() || 'Agente';
  const { bets, repaired: betsRepaired } = sanitizePlacedBets(raw?.placedBets);
  const { balance, repaired: balRepaired } = recoverValidBalance(raw, bets);
  const { uniqueCards, totalCards } = sumCollectionStats(raw);
  const isAnimeCurrent = raw?.mudaeSeasonVersion === MUDAE_SEASON_VERSION;

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
    needsRepair: betsRepaired || balRepaired,
    record: {
      uid,
      email,
      displayName,
      balance,
      rawBalanceWasInvalid: balRepaired,
      createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : undefined,
      lastSeen: typeof raw?.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0,
      placedBets: bets,
      transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
      pokemonCollection: Array.isArray(raw?.pokemonCollection) ? raw.pokemonCollection : [],
      worldCupCollection: Array.isArray(raw?.worldCupCollection) ? raw.worldCupCollection : [],
      kpopCollection: Array.isArray(raw?.kpopCollection) ? raw.kpopCollection : [],
      cs2Collection: Array.isArray(raw?.cs2Collection) ? raw.cs2Collection : [],
      animeCollection: isAnimeCurrent && Array.isArray(raw?.animeCollection) ? raw.animeCollection : [],
      totalCards,
      uniqueCards,
      betsWon,
      biggestWin,
    },
  };
}

export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map((d) => {
        const { record } = mapDocToAdminRecord(d.id, d.data() || {});
        return {
          uid: record.uid,
          displayName: record.displayName,
          balance: record.balance,
          totalCards: record.totalCards,
          uniqueCards: record.uniqueCards,
          betsWon: record.betsWon,
          totalBets: record.placedBets.length,
          biggestWin: record.biggestWin,
          lastSeen: record.lastSeen,
          createdAt: record.createdAt,
        };
      });
      onUpdate(entries);
    },
    (err) => {
      console.warn('[BenBets] Erro no snapshot da coleção users:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function addBet(uid: string, bet: PlacedBet) {
  const { bets } = sanitizePlacedBets([bet]);
  const cleanBet = bets[0];
  if (!cleanBet) return;
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { placedBets: arrayUnion(cleanBet) });
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

export async function removeAnimeCard(uid: string, cardId: string, removeAll = false) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const existing: PokemonCard[] = data.animeCollection || [];
  const updated = existing
    .map(c => c.id === cardId ? { ...c, quantity: removeAll ? 0 : c.quantity - 1 } : c)
    .filter(c => c.quantity > 0);
  await updateDoc(ref, { animeCollection: updated });
}

export async function setAnimeCollection(uid: string, cards: PokemonCard[]) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { animeCollection: cards });
}

// Mudae Server-Wide Sync, P2P Marketplace & User Progression
export interface MudaeTowerLevels {
  floor1Rolls: number;
  floor2Reaction: number;
  floor3WishSpawn: number;
  floor4Slots: number;
  floor5Claims: number;
  floor6Rainbow: number;
}

export interface MudaeMarketListing {
  id: string;
  cardId: string;
  sellerUid: string;
  sellerName: string;
  price: number;
  listedAt: number;
  card: PokemonCard;
  rank: number;
  series: string;
  baseValue: number;
}

export interface MudaeSaleReceipt {
  id: string;
  cardId: string;
  cardName: string;
  buyerUid: string;
  buyerName: string;
  price: number;
  soldAt: number;
  seenBySeller: boolean;
}

export interface MudaeLiveOrb {
  id: string;
  label: string;
  emoji: string;
  baseValue: number;
  colorClass: string;
  glowStyle: string;
  collectedByUid?: string;
  collectedByName?: string;
}

export interface MudaeLiveRoll {
  instanceId: string;
  rollerUid: string;
  rollerName: string;
  mode: 'wa' | 'ha' | 'ma';
  rolledAt: number;
  expiresAt: number;
  char: {
    id: string;
    name: string;
    series: string;
    image: string;
    gender: 'Female' | 'Male' | 'Other';
    favourites: number;
    claimRank: number;
    baseValue: number;
    tierIndex: number;
    tierLabel: string;
  };
  claimedByUid?: string;
  claimedByName?: string;
  grantedKeyToRoller?: number;
  orb: MudaeLiveOrb | null;
}

export interface MudaeUserData {
  wishlist: string[];
  disablelist: string[];
  tower: MudaeTowerLevels;
  totalInvestedTower: number;
  rollsUsed: number;
  extraRollsUsed: number;
  rollsWindowStart: number;
  claimsUsed: number;
  claimsWindowStart: number;
  lastRtUsed: number;
  totalReactionsCollected: number;
  totalKakeraEarned: number;
  marketListings: MudaeMarketListing[];
  salesReceipts: MudaeSaleReceipt[];
}

export interface ServerAnimeClaim {
  cardId: string;
  ownerUid: string;
  ownerName: string;
  keys: number;
  name: string;
  image: string;
  series: string;
  rarity: PokemonCard['rarity'];
}

const MUDAE_LOCAL_PREFIX = 'benbets_mudae_v1_';

export function getDefaultMudaeUserData(): MudaeUserData {
  return {
    wishlist: [],
    disablelist: [],
    tower: {
      floor1Rolls: 0,
      floor2Reaction: 0,
      floor3WishSpawn: 0,
      floor4Slots: 0,
      floor5Claims: 0,
      floor6Rainbow: 0,
    },
    totalInvestedTower: 0,
    rollsUsed: 0,
    extraRollsUsed: 0,
    rollsWindowStart: 0,
    claimsUsed: 0,
    claimsWindowStart: 0,
    lastRtUsed: 0,
    totalReactionsCollected: 0,
    totalKakeraEarned: 0,
    marketListings: [],
    salesReceipts: [],
  };
}

function clampMudaeLevel(v: any): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(5, n));
}

function safeMudaeNum(v: any): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

function sanitizeMarketListings(raw: any): MudaeMarketListing[] {
  if (!Array.isArray(raw)) return [];
  const out: MudaeMarketListing[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !item.cardId || !item.card) continue;
    const price = safeMudaeNum(item.price);
    if (price <= 0) continue;
    out.push({
      id: String(item.id || `mkt-${item.cardId}`),
      cardId: String(item.cardId),
      sellerUid: String(item.sellerUid || ''),
      sellerName: String(item.sellerName || 'Jogador'),
      price: Number(price.toFixed(2)),
      listedAt: safeMudaeNum(item.listedAt),
      card: item.card,
      rank: typeof item.rank === 'number' && Number.isFinite(item.rank) ? item.rank : 180,
      series: String(item.series || item.card?.setName || 'Anime'),
      baseValue: safeMudaeNum(item.baseValue),
    });
  }
  return out;
}

function sanitizeSalesReceipts(raw: any): MudaeSaleReceipt[] {
  if (!Array.isArray(raw)) return [];
  const out: MudaeSaleReceipt[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object' || !r.id || !r.cardId) continue;
    out.push({
      id: String(r.id),
      cardId: String(r.cardId),
      cardName: String(r.cardName || 'Personagem'),
      buyerUid: String(r.buyerUid || ''),
      buyerName: String(r.buyerName || 'Jogador'),
      price: Number(safeMudaeNum(r.price).toFixed(2)),
      soldAt: safeMudaeNum(r.soldAt),
      seenBySeller: Boolean(r.seenBySeller),
    });
  }
  return out.slice(-30);
}

export function sanitizeMudaeUserData(raw: any): MudaeUserData {
  const def = getDefaultMudaeUserData();
  if (!raw || typeof raw !== 'object') return def;
  const rawTower = raw.tower && typeof raw.tower === 'object' ? raw.tower : {};
  return {
    wishlist: Array.isArray(raw.wishlist) ? raw.wishlist.map(String).filter(Boolean) : [],
    disablelist: Array.isArray(raw.disablelist) ? raw.disablelist.map(String).filter(Boolean) : [],
    tower: {
      floor1Rolls: clampMudaeLevel(rawTower.floor1Rolls),
      floor2Reaction: clampMudaeLevel(rawTower.floor2Reaction),
      floor3WishSpawn: clampMudaeLevel(rawTower.floor3WishSpawn),
      floor4Slots: clampMudaeLevel(rawTower.floor4Slots),
      floor5Claims: clampMudaeLevel(rawTower.floor5Claims),
      floor6Rainbow: clampMudaeLevel(rawTower.floor6Rainbow),
    },
    totalInvestedTower: Number(safeMudaeNum(raw.totalInvestedTower).toFixed(2)),
    rollsUsed: Math.floor(safeMudaeNum(raw.rollsUsed)),
    extraRollsUsed: Math.floor(safeMudaeNum(raw.extraRollsUsed)),
    rollsWindowStart: safeMudaeNum(raw.rollsWindowStart),
    claimsUsed: Math.floor(safeMudaeNum(raw.claimsUsed)),
    claimsWindowStart: safeMudaeNum(raw.claimsWindowStart),
    lastRtUsed: safeMudaeNum(raw.lastRtUsed),
    totalReactionsCollected: Math.floor(safeMudaeNum(raw.totalReactionsCollected)),
    totalKakeraEarned: Number(safeMudaeNum(raw.totalKakeraEarned).toFixed(2)),
    marketListings: sanitizeMarketListings(raw.marketListings),
    salesReceipts: sanitizeSalesReceipts(raw.salesReceipts),
  };
}

export async function getMudaeUserData(uid: string): Promise<MudaeUserData> {
  if (!uid) return getDefaultMudaeUserData();
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.mudaeData) {
        const clean = sanitizeMudaeUserData(data.mudaeData);
        if (data.mudaeSeasonVersion !== MUDAE_SEASON_VERSION) {
          clean.marketListings = [];
        }
        return clean;
      }
    }
  } catch {
    // Fallback to localStorage below
  }
  try {
    const localRaw = localStorage.getItem(`${MUDAE_LOCAL_PREFIX}${uid}`);
    if (localRaw) return sanitizeMudaeUserData(JSON.parse(localRaw));
  } catch { /* ignore */ }
  return getDefaultMudaeUserData();
}

export async function saveMudaeUserData(uid: string, mudaeData: MudaeUserData): Promise<void> {
  const clean = sanitizeMudaeUserData(mudaeData);
  if (!uid) return;
  try {
    localStorage.setItem(`${MUDAE_LOCAL_PREFIX}${uid}`, JSON.stringify(clean));
  } catch { /* quota */ }
  try {
    await setDoc(
      doc(db, 'users', uid),
      { mudaeData: clean, mudaeSeasonVersion: MUDAE_SEASON_VERSION },
      { merge: true }
    );
  } catch { /* ignore */ }
}

const migratedDocIds = new Set<string>();
const LIVE_ROLL_TTL_MS = 10 * 60 * 1000;

function cleanLiveRollForFirestore(roll: MudaeLiveRoll): MudaeLiveRoll {
  const cleanOrb: MudaeLiveOrb | null = roll.orb
    ? {
        id: String(roll.orb.id),
        label: String(roll.orb.label),
        emoji: String(roll.orb.emoji),
        baseValue: safeMudaeNum(roll.orb.baseValue),
        colorClass: String(roll.orb.colorClass),
        glowStyle: String(roll.orb.glowStyle),
        ...(roll.orb.collectedByUid ? { collectedByUid: String(roll.orb.collectedByUid) } : {}),
        ...(roll.orb.collectedByName ? { collectedByName: String(roll.orb.collectedByName) } : {}),
      }
    : null;

  return {
    instanceId: String(roll.instanceId),
    rollerUid: String(roll.rollerUid),
    rollerName: String(roll.rollerName),
    mode: roll.mode === 'ha' || roll.mode === 'ma' ? roll.mode : 'wa',
    rolledAt: safeMudaeNum(roll.rolledAt),
    expiresAt: safeMudaeNum(roll.expiresAt),
    char: {
      id: String(roll.char.id),
      name: String(roll.char.name),
      series: String(roll.char.series),
      image: String(roll.char.image || ''),
      gender: roll.char.gender === 'Female' || roll.char.gender === 'Male' ? roll.char.gender : 'Other',
      favourites: safeMudaeNum(roll.char.favourites),
      claimRank: Math.max(1, Math.floor(safeMudaeNum(roll.char.claimRank) || 1)),
      baseValue: safeMudaeNum(roll.char.baseValue),
      tierIndex: Math.max(0, Math.min(4, Math.floor(safeMudaeNum(roll.char.tierIndex)))),
      tierLabel: String(roll.char.tierLabel || 'Rank C'),
    },
    ...(roll.claimedByUid ? { claimedByUid: String(roll.claimedByUid) } : {}),
    ...(roll.claimedByName ? { claimedByName: String(roll.claimedByName) } : {}),
    ...(typeof roll.grantedKeyToRoller === 'number' && roll.grantedKeyToRoller > 0
      ? { grantedKeyToRoller: Math.floor(roll.grantedKeyToRoller) }
      : {}),
    orb: cleanOrb,
  };
}

function sanitizeLiveRolls(raw: any): MudaeLiveRoll[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = Date.now() - LIVE_ROLL_TTL_MS;
  const out: MudaeLiveRoll[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !item.instanceId || !item.char?.id) continue;
    if (safeMudaeNum(item.rolledAt) < cutoff) continue;
    out.push(cleanLiveRollForFirestore(item as MudaeLiveRoll));
  }
  return out;
}

function buildClaimsFromDocs(
  docs: Array<{ id: string; data: Record<string, any> }>,
  currentUid?: string
): {
  claims: Record<string, ServerAnimeClaim>;
  wishCounts: Record<string, number>;
  listings: MudaeMarketListing[];
  unseenReceipts: MudaeSaleReceipt[];
  serverLiveRolls: MudaeLiveRoll[];
} {
  const claims: Record<string, ServerAnimeClaim> = {};
  const wishCounts: Record<string, number> = {};
  const listings: MudaeMarketListing[] = [];
  const serverLiveRolls: MudaeLiveRoll[] = [];
  let unseenReceipts: MudaeSaleReceipt[] = [];

  for (const d of docs) {
    const raw = d.data || {};
    const ownerUid = d.id;
    const ownerName =
      typeof raw.displayName === 'string' && raw.displayName.trim()
        ? raw.displayName.trim()
        : typeof raw.email === 'string' && raw.email.includes('@')
          ? raw.email.split('@')[0]
          : `Jogador ${ownerUid.slice(0, 6)}`;

    const isSeasonCurrent = raw.mudaeSeasonVersion === MUDAE_SEASON_VERSION;
    if (!isSeasonCurrent && !migratedDocIds.has(ownerUid)) {
      migratedDocIds.add(ownerUid);
      const resetPayload: Record<string, any> = {
        animeCollection: [],
        mudaeSeasonVersion: MUDAE_SEASON_VERSION,
      };
      if (raw.mudaeData && typeof raw.mudaeData === 'object') {
        resetPayload.mudaeData = { ...raw.mudaeData, marketListings: [] };
      }
      updateDoc(doc(db, 'users', ownerUid), resetPayload).catch(() => {});
    }

    const col: PokemonCard[] = isSeasonCurrent && Array.isArray(raw.animeCollection) ? raw.animeCollection : [];
    const ownedIds = new Set<string>();
    for (const c of col) {
      if (!c || !c.id) continue;
      ownedIds.add(String(c.id));
      const keys = typeof c.quantity === 'number' && c.quantity > 0 ? Math.floor(c.quantity) : 1;
      const prev = claims[c.id];
      if (!prev || keys > prev.keys || (keys === prev.keys && ownerUid < prev.ownerUid)) {
        claims[c.id] = {
          cardId: String(c.id),
          ownerUid,
          ownerName,
          keys,
          name: String(c.name || 'Personagem'),
          image: String(c.imageUrl || ''),
          series: String(c.setName || 'Anime'),
          rarity: String(c.rarity || 'Rank C'),
        };
      }
    }

    const mudaeRaw = raw.mudaeData;
    const wishlist: string[] = Array.isArray(mudaeRaw?.wishlist) ? mudaeRaw.wishlist : [];
    const seenWish = new Set<string>();
    for (const charId of wishlist) {
      if (typeof charId === 'string' && charId && !seenWish.has(charId)) {
        seenWish.add(charId);
        wishCounts[charId] = (wishCounts[charId] || 0) + 1;
      }
    }

    if (isSeasonCurrent) {
      const userListings = sanitizeMarketListings(mudaeRaw?.marketListings);
      for (const l of userListings) {
        if (!ownedIds.has(l.cardId)) continue;
        listings.push({
          ...l,
          sellerUid: ownerUid,
          sellerName: ownerName,
        });
      }
    }

    if (currentUid && ownerUid === currentUid) {
      const receipts = sanitizeSalesReceipts(mudaeRaw?.salesReceipts);
      unseenReceipts = receipts.filter((r) => !r.seenBySeller);
    }

    const userLiveRolls = sanitizeLiveRolls(raw.mudaeLiveRolls);
    for (const lr of userLiveRolls) {
      serverLiveRolls.push({
        ...lr,
        rollerUid: ownerUid,
        rollerName: ownerName,
      });
    }
  }

  listings.sort((a, b) => b.listedAt - a.listedAt);
  serverLiveRolls.sort((a, b) => b.rolledAt - a.rolledAt);
  return {
    claims,
    wishCounts,
    listings,
    unseenReceipts,
    serverLiveRolls: serverLiveRolls.slice(0, 16),
  };
}

export function subscribeToServerAnimeClaims(
  onUpdate: (
    claims: Record<string, ServerAnimeClaim>,
    wishCounts: Record<string, number>,
    listings: MudaeMarketListing[],
    unseenReceipts: MudaeSaleReceipt[],
    serverLiveRolls: MudaeLiveRoll[]
  ) => void,
  currentUid?: string,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
      const { claims, wishCounts, listings, unseenReceipts, serverLiveRolls } = buildClaimsFromDocs(docs, currentUid);
      onUpdate(claims, wishCounts, listings, unseenReceipts, serverLiveRolls);
    },
    (err) => {
      console.warn('[BenBets Mudae] Erro ao sincronizar claims do servidor:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function publishLiveMudaeRoll(
  uid: string,
  roll: MudaeLiveRoll,
  mudaeUpdates?: Partial<MudaeUserData>
): Promise<void> {
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const raw = snap.exists() ? snap.data() || {} : {};
  const existingRolls = sanitizeLiveRolls(raw.mudaeLiveRolls);
  const nextRolls = [cleanLiveRollForFirestore(roll), ...existingRolls.filter((r) => r.instanceId !== roll.instanceId)].slice(0, 5);
  const payload: Record<string, any> = {
    mudaeLiveRolls: nextRolls,
    mudaeSeasonVersion: MUDAE_SEASON_VERSION,
  };
  if (mudaeUpdates) {
    const currentMudae = sanitizeMudaeUserData(raw.mudaeData);
    payload.mudaeData = sanitizeMudaeUserData({ ...currentMudae, ...mudaeUpdates });
  }
  await setDoc(ref, payload, { merge: true });
}

export async function collectLiveMudaeOrb(
  collectorUid: string,
  collectorName: string,
  roll: MudaeLiveRoll
): Promise<{ ok: boolean; alreadyTakenBy?: string }> {
  if (!collectorUid || !roll.rollerUid || !roll.orb) return { ok: false };
  const ref = doc(db, 'users', roll.rollerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false };
  const raw = snap.data() || {};
  const rolls = sanitizeLiveRolls(raw.mudaeLiveRolls);
  const idx = rolls.findIndex((r) => r.instanceId === roll.instanceId);
  if (idx < 0 || !rolls[idx].orb) return { ok: false };
  if (rolls[idx].orb?.collectedByUid) {
    return { ok: false, alreadyTakenBy: rolls[idx].orb?.collectedByName || 'Outro jogador' };
  }
  const updatedRoll: MudaeLiveRoll = {
    ...rolls[idx],
    orb: {
      ...rolls[idx].orb!,
      collectedByUid: collectorUid,
      collectedByName: collectorName || 'Jogador',
    },
  };
  rolls[idx] = cleanLiveRollForFirestore(updatedRoll);
  await updateDoc(ref, { mudaeLiveRolls: rolls });
  return { ok: true };
}

export async function markLiveMudaeRollClaimed(
  claimerUid: string,
  claimerName: string,
  roll: MudaeLiveRoll
): Promise<{ ok: boolean; alreadyTakenBy?: string }> {
  if (!claimerUid) return { ok: false };
  const existingClaim = await checkServerAnimeClaim(roll.char.id);
  if (existingClaim) {
    return { ok: false, alreadyTakenBy: existingClaim.ownerName };
  }
  if (!roll.rollerUid) return { ok: true };
  const ref = doc(db, 'users', roll.rollerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: true };
  const raw = snap.data() || {};
  const rolls = sanitizeLiveRolls(raw.mudaeLiveRolls);
  const idx = rolls.findIndex((r) => r.instanceId === roll.instanceId);
  if (idx >= 0) {
    if (rolls[idx].claimedByUid) {
      return { ok: false, alreadyTakenBy: rolls[idx].claimedByName || 'Outro jogador' };
    }
    rolls[idx] = cleanLiveRollForFirestore({
      ...rolls[idx],
      claimedByUid: claimerUid,
      claimedByName: claimerName || 'Jogador',
    });
    await updateDoc(ref, { mudaeLiveRolls: rolls });
  }
  return { ok: true };
}

export async function checkServerAnimeClaim(cardId: string): Promise<ServerAnimeClaim | null> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
    const { claims } = buildClaimsFromDocs(docs);
    return claims[cardId] || null;
  } catch {
    return null;
  }
}

export async function resetAllUsersMudaeCollections(): Promise<number> {
  const snap = await getDocs(collection(db, 'users'));
  let count = 0;
  for (const d of snap.docs) {
    const raw = d.data() || {};
    const payload: Record<string, any> = {
      animeCollection: [],
      mudaeLiveRolls: [],
      mudaeSeasonVersion: MUDAE_SEASON_VERSION,
    };
    if (raw.mudaeData && typeof raw.mudaeData === 'object') {
      payload.mudaeData = {
        ...raw.mudaeData,
        marketListings: [],
      };
    }
    await updateDoc(doc(db, 'users', d.id), payload);
    count += 1;
  }
  return count;
}

export async function listMudaeCharacterForSale(
  uid: string,
  sellerName: string,
  input: { card: PokemonCard; price: number; rank: number; series: string; baseValue: number }
): Promise<MudaeMarketListing> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const raw = snap.exists() ? snap.data() || {} : {};
  const resolvedSellerName =
    typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : sellerName || 'Jogador';
  const mudae = sanitizeMudaeUserData(raw.mudaeData);
  const entry: MudaeMarketListing = {
    id: `mkt-${uid.slice(0, 6)}-${input.card.id}`,
    cardId: input.card.id,
    sellerUid: uid,
    sellerName: resolvedSellerName,
    price: Number(Math.max(1, input.price).toFixed(2)),
    listedAt: Date.now(),
    card: input.card,
    rank: input.rank,
    series: input.series,
    baseValue: input.baseValue,
  };
  const nextListings = [
    entry,
    ...mudae.marketListings.filter((l) => l.cardId !== input.card.id),
  ];
  const nextMudae: MudaeUserData = { ...mudae, marketListings: nextListings };
  await setDoc(ref, { mudaeData: nextMudae, mudaeSeasonVersion: MUDAE_SEASON_VERSION }, { merge: true });
  return entry;
}

export async function cancelMudaeMarketListing(uid: string, cardId: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const raw = snap.data() || {};
  const mudae = sanitizeMudaeUserData(raw.mudaeData);
  const nextMudae: MudaeUserData = {
    ...mudae,
    marketListings: mudae.marketListings.filter((l) => l.cardId !== cardId),
  };
  await setDoc(ref, { mudaeData: nextMudae }, { merge: true });
}

export async function buyMudaeMarketListing(
  buyerUid: string,
  buyerName: string,
  listing: MudaeMarketListing
): Promise<{ ok: boolean; error?: string; card?: PokemonCard }> {
  if (!buyerUid || !listing.sellerUid) return { ok: false, error: 'Dados inválidos para compra.' };
  if (listing.sellerUid === buyerUid) return { ok: false, error: 'Você não pode comprar seu próprio anúncio.' };

  const sellerRef = doc(db, 'users', listing.sellerUid);
  const sellerSnap = await getDoc(sellerRef);
  if (!sellerSnap.exists()) return { ok: false, error: 'Vendedor não encontrado.' };

  const sellerRaw = sellerSnap.data() || {};
  const sellerCol: PokemonCard[] = Array.isArray(sellerRaw.animeCollection) ? sellerRaw.animeCollection : [];
  const ownedCard = sellerCol.find((c) => c.id === listing.cardId);
  if (!ownedCard) return { ok: false, error: 'Este personagem não pertence mais ao vendedor.' };

  const sellerMudae = sanitizeMudaeUserData(sellerRaw.mudaeData);
  const liveListing = sellerMudae.marketListings.find((l) => l.cardId === listing.cardId);
  if (!liveListing) return { ok: false, error: 'Este anúncio foi cancelado ou acabou de ser vendido.' };

  const finalPrice = liveListing.price;
  const { bets } = sanitizePlacedBets(sellerRaw.placedBets);
  const { balance: sellerBaseBal } = recoverValidBalance(sellerRaw, bets);
  const nextSellerBal = Number((sellerBaseBal + finalPrice).toFixed(2));
  const nextSellerCol = sellerCol.filter((c) => c.id !== listing.cardId);
  const nextSellerListings = sellerMudae.marketListings.filter((l) => l.cardId !== listing.cardId);

  const receipt: MudaeSaleReceipt = {
    id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cardId: listing.cardId,
    cardName: ownedCard.name,
    buyerUid,
    buyerName: buyerName || 'Jogador',
    price: finalPrice,
    soldAt: Date.now(),
    seenBySeller: false,
  };

  await updateDoc(sellerRef, {
    animeCollection: nextSellerCol,
    balance: nextSellerBal,
    mudaeSeasonVersion: MUDAE_SEASON_VERSION,
    mudaeData: {
      ...sellerMudae,
      marketListings: nextSellerListings,
      salesReceipts: [...sellerMudae.salesReceipts, receipt].slice(-30),
    },
  });

  return { ok: true, card: ownedCard };
}

export async function acknowledgeMudaeSalesReceipts(uid: string, receiptIds: string[]): Promise<void> {
  if (!uid || receiptIds.length === 0) return;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const raw = snap.data() || {};
  const mudae = sanitizeMudaeUserData(raw.mudaeData);
  const ackSet = new Set(receiptIds);
  const updated = mudae.salesReceipts.map((r) => (ackSet.has(r.id) ? { ...r, seenBySeller: true } : r));
  await setDoc(ref, { mudaeData: { ...mudae, salesReceipts: updated } }, { merge: true });
}

// Live Global Chat
export interface LiveChatMessage {
  id: string;
  uid: string;
  userName: string;
  text: string;
  createdAt: number;
  kind?: 'text' | 'win';
  badgeText?: string;
}

function sanitizeChatMessage(raw: any, fallbackUid: string, fallbackName: string): LiveChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 220) : '';
  if (!text) return null;
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  if (createdAt <= 0) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `chat-${fallbackUid.slice(0, 6)}-${createdAt}`;
  return {
    id,
    uid: fallbackUid,
    userName:
      typeof raw.userName === 'string' && raw.userName.trim()
        ? raw.userName.trim().slice(0, 40)
        : fallbackName,
    text,
    createdAt,
    kind: raw.kind === 'win' ? 'win' : 'text',
    ...(typeof raw.badgeText === 'string' && raw.badgeText.trim()
      ? { badgeText: raw.badgeText.trim().slice(0, 48) }
      : {}),
  };
}

export function subscribeToLiveChat(
  onUpdate: (messages: LiveChatMessage[], onlineCount: number, onlineUids: string[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const now = Date.now();
      const collected: LiveChatMessage[] = [];
      const onlineUids: string[] = [];

      for (const d of snap.docs) {
        const raw = d.data() || {};
        const uid = d.id;
        const resolvedName =
          typeof raw.displayName === 'string' && raw.displayName.trim()
            ? raw.displayName.trim()
            : typeof raw.email === 'string' && raw.email.includes('@')
              ? raw.email.split('@')[0]
              : `Agente ${uid.slice(0, 5)}`;

        const lastSeen = typeof raw.lastSeen === 'number' && Number.isFinite(raw.lastSeen) ? raw.lastSeen : 0;
        if (lastSeen > 0 && now - lastSeen < ONLINE_WINDOW_MS) {
          onlineUids.push(uid);
        }

        const list = Array.isArray(raw.liveChatMessages) ? raw.liveChatMessages : [];
        for (const item of list) {
          const clean = sanitizeChatMessage(item, uid, resolvedName);
          if (clean) collected.push(clean);
        }
      }

      collected.sort((a, b) => a.createdAt - b.createdAt);
      onUpdate(collected.slice(-80), onlineUids.length, onlineUids);
    },
    (err) => {
      console.warn('[BenBets Chat] Erro ao sincronizar chat ao vivo:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function sendLiveChatMessage(
  uid: string,
  userName: string,
  text: string,
  extra?: { kind?: 'text' | 'win'; badgeText?: string }
): Promise<LiveChatMessage | null> {
  if (!uid) return null;
  const trimmed = text.trim().slice(0, 220);
  if (!trimmed) return null;

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const raw = snap.exists() ? snap.data() || {} : {};
  const resolvedName =
    typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : userName.trim() || 'Jogador';

  const existing: LiveChatMessage[] = Array.isArray(raw.liveChatMessages)
    ? raw.liveChatMessages
        .map((m: any) => sanitizeChatMessage(m, uid, resolvedName))
        .filter((m: LiveChatMessage | null): m is LiveChatMessage => Boolean(m))
    : [];

  const msg: LiveChatMessage = {
    id: `msg-${uid.slice(0, 5)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    uid,
    userName: resolvedName,
    text: trimmed,
    createdAt: Date.now(),
    kind: extra?.kind === 'win' ? 'win' : 'text',
    ...(extra?.badgeText ? { badgeText: extra.badgeText.trim().slice(0, 48) } : {}),
  };

  const next = [...existing, msg].slice(-25);
  await setDoc(
    ref,
    {
      liveChatMessages: next,
      lastSeen: Date.now(),
    },
    { merge: true }
  );
  return msg;
}

export async function deleteLiveChatMessage(uid: string, messageId: string): Promise<void> {
  if (!uid || !messageId) return;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const raw = snap.data() || {};
  const existing = Array.isArray(raw.liveChatMessages) ? raw.liveChatMessages : [];
  const filtered = existing.filter((m: any) => m?.id !== messageId);
  await updateDoc(ref, { liveChatMessages: filtered });
}

// Admin
export async function getAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => mapDocToAdminRecord(d.id, d.data() || {}).record);
}

export function subscribeToAllUsers(
  onUpdate: (users: AdminUserRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const records: AdminUserRecord[] = snap.docs.map((d) => {
        const { record, needsRepair } = mapDocToAdminRecord(d.id, d.data() || {});
        if (needsRepair) {
          updateDoc(doc(db, 'users', d.id), {
            balance: record.balance,
            placedBets: record.placedBets,
          }).catch(() => {});
        }
        return record;
      });
      onUpdate(records);
    },
    (err) => {
      console.warn('[BenBets Admin] Erro ao escutar usuários no Firestore:', err?.code || err);
      if (onError) onError(err);
    }
  );
}

export async function adminSetBalance(uid: string, balance: number) {
  if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) return;
  await setDoc(doc(db, 'users', uid), { balance: Number(balance.toFixed(2)) }, { merge: true });
}

export async function adminUpdateUserProfile(
  uid: string,
  updates: { displayName?: string; email?: string; balance?: number }
) {
  const payload: Record<string, any> = {};
  if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
    payload.displayName = updates.displayName.trim();
  }
  if (typeof updates.email === 'string' && updates.email.trim()) {
    payload.email = updates.email.trim();
  }
  if (typeof updates.balance === 'number' && Number.isFinite(updates.balance) && updates.balance >= 0) {
    payload.balance = Number(updates.balance.toFixed(2));
  }
  if (Object.keys(payload).length === 0) return;
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
}

export async function adminResetUser(uid: string, clearCollections = false) {
  const payload: Record<string, any> = {
    balance: 20.0,
    placedBets: [],
    transactions: [],
  };
  if (clearCollections) {
    payload.pokemonCollection = [];
    payload.worldCupCollection = [];
    payload.kpopCollection = [];
    payload.cs2Collection = [];
    payload.animeCollection = [];
  }
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
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
  const { bets } = sanitizePlacedBets(data.placedBets);
  const { balance: baseBal } = recoverValidBalance(data, bets);
  await updateDoc(ref, { missions, balance: Number((baseBal + missionDef.reward).toFixed(2)), lastSeen: Date.now() });
}
