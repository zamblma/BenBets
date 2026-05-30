import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';
import type { PlacedBet, Transaction, PokemonCard } from '../types';

export async function getUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as {
    balance: number;
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
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return data;
}

export async function updateBalance(uid: string, newBalance: number) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { balance: newBalance });
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
