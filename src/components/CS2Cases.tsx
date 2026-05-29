import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowLeft, TrendingUp, Crosshair } from 'lucide-react';
import type { PokemonCard } from '../types';

interface CSSkin {
  id: string;
  name: string;
  rarity: string;
  weapon: string;
  rarityLevel: number;
  minPrice: number;
  maxPrice: number;
  lastWinner?: string;
  lastWonAt?: string;
}

interface CS2CaseData {
  id: string;
  name: string;
  image: string;
  price: number;
  tier: 'daily' | 'budget' | 'standard' | 'premium' | 'high';
  weights: number[];
  items: CSSkin[];
}

function rarityColor(level: number) {
  switch (level) {
    case 0: return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', glow: 'rgba(59,130,246,0.3)' };
    case 1: return { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'rgba(168,85,247,0.3)' };
    case 2: return { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-400', glow: 'rgba(236,72,153,0.3)' };
    case 3: return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', glow: 'rgba(239,68,68,0.3)' };
    case 4: return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', glow: 'rgba(234,179,8,0.5)' };
    default: return { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-400', glow: 'rgba(100,116,139,0.3)' };
  }
}

function rarityLabel(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec (Azul)';
    case 1: return 'Restricted (Roxa)';
    case 2: return 'Classified (Rosa)';
    case 3: return 'Covert (Vermelha)';
    case 4: return 'Rare Special (Ouro)';
    default: return 'Desconhecida';
  }
}

function rarityLabelShort(level: number): string {
  switch (level) {
    case 0: return 'Mil-Spec';
    case 1: return 'Restricted';
    case 2: return 'Classified';
    case 3: return 'Covert';
    case 4: return '★ Rare Special';
    default: return '';
  }
}

function tierLabel(tier: string) {
  switch (tier) {
    case 'daily': return { label: 'Diária Grátis', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
    case 'budget': return { label: 'Econômica', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    case 'standard': return { label: 'Padrão', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    case 'premium': return { label: 'Premium', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    case 'high': return { label: 'Alto Risco', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    default: return { label: tier, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
  }
}

const ALL_CASES: CS2CaseData[] = [
  // ─── DAILY (FREE) ───
  {
    id: 'daily', name: 'Caixa Diária CSGOSKINS', image: '🎁', price: 0, tier: 'daily',
    weights: [70.469, 1.254, 1.186, 0.014, 0.011],
    items: [
      { id: 'daily_1', name: 'Sand Dune', rarity: 'Mil-Spec', weapon: 'Nova', rarityLevel: 0, minPrice: 0.01, maxPrice: 0.05, lastWinner: '» Darek2510_ «', lastWonAt: '29/05/2026, 00:47:58' },
      { id: 'daily_2', name: 'Sand Mesh', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.01, maxPrice: 0.05, lastWinner: 'NB', lastWonAt: '29/05/2026, 00:47:47' },
      { id: 'daily_3', name: 'Desert Storm', rarity: 'Mil-Spec', weapon: 'G3SG1', rarityLevel: 0, minPrice: 0.01, maxPrice: 0.05, lastWinner: '—', lastWonAt: '—' },
      { id: 'daily_4', name: 'Cold Fusion', rarity: 'Mil-Spec', weapon: 'Galil AR', rarityLevel: 0, minPrice: 0.02, maxPrice: 0.10, lastWinner: 'Tubi', lastWonAt: '29/05/2026, 00:47:57' },
      { id: 'daily_5', name: 'Freight', rarity: 'Mil-Spec', weapon: 'P90', rarityLevel: 0, minPrice: 0.05, maxPrice: 0.30, lastWinner: 'k1nox SKINS', lastWonAt: '29/05/2026, 00:44:55' },
      { id: 'daily_6', name: 'Aloha', rarity: 'Mil-Spec', weapon: 'SG 553', rarityLevel: 0, minPrice: 0.05, maxPrice: 0.30, lastWinner: 'Pablo IX SKINS', lastWonAt: '29/05/2026, 00:40:20' },
      { id: 'daily_7', name: 'Necro Jr.', rarity: 'Mil-Spec', weapon: 'MP5-SD', rarityLevel: 0, minPrice: 0.05, maxPrice: 0.30, lastWinner: 'XpLay__', lastWonAt: '29/05/2026, 00:46:57' },
      { id: 'daily_8', name: 'Poultrygeist', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.05, maxPrice: 0.30, lastWinner: 'C SKINS', lastWonAt: '29/05/2026, 00:47:18' },
      { id: 'daily_9', name: 'Runic', rarity: 'Restricted', weapon: 'PP-Bizon', rarityLevel: 1, minPrice: 0.50, maxPrice: 3, lastWinner: 'Neckklace SKINS', lastWonAt: '29/05/2026, 00:44:56' },
      { id: 'daily_10', name: 'Violent Daimyo', rarity: 'Classified', weapon: 'Five-SeveN', rarityLevel: 2, minPrice: 5, maxPrice: 20, lastWinner: 'Anonymous', lastWonAt: '28/05/2026, 21:02:19' },
      { id: 'daily_11', name: 'Weasel', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 5, maxPrice: 20, lastWinner: 'diegoslvr', lastWonAt: '28/05/2026, 22:23:37' },
      { id: 'daily_12', name: 'Cyrex', rarity: 'Covert', weapon: 'M4A1-S', rarityLevel: 3, minPrice: 20, maxPrice: 80, lastWinner: '🤌pizzatime🤌', lastWonAt: '28/05/2026, 14:08:34' },
      { id: 'daily_13', name: 'Water Elemental', rarity: 'Covert', weapon: 'Glock-18', rarityLevel: 3, minPrice: 15, maxPrice: 50, lastWinner: 'player', lastWonAt: '28/05/2026, 18:28:58' },
      { id: 'daily_14', name: 'Hyper Beast', rarity: 'Rare Special', weapon: 'M4A1-S', rarityLevel: 4, minPrice: 50, maxPrice: 200, lastWinner: 'Ban da Ganância 乡', lastWonAt: '29/05/2026, 00:11:29' },
      { id: 'daily_15', name: 'Aquamarine Revenge', rarity: 'Rare Special', weapon: 'AK-47', rarityLevel: 4, minPrice: 40, maxPrice: 150, lastWinner: 'cpluki', lastWonAt: '28/05/2026, 17:41:16' },
      { id: 'daily_16', name: 'Hyper Beast', rarity: 'Rare Special', weapon: 'AWP', rarityLevel: 4, minPrice: 60, maxPrice: 250, lastWinner: '𝔉𝔞𝔟𝔦𝔬_skins', lastWonAt: '28/05/2026, 20:33:28' },
      { id: 'daily_17', name: 'Point Disarray', rarity: 'Rare Special', weapon: 'AK-47', rarityLevel: 4, minPrice: 40, maxPrice: 150, lastWinner: 'elprime', lastWonAt: '28/05/2026, 22:34:20' },
      { id: 'daily_18', name: 'Leaded Glass', rarity: 'Rare Special', weapon: 'M4A1-S', rarityLevel: 4, minPrice: 30, maxPrice: 120, lastWinner: 'beat CS2SKINS.GIFT', lastWonAt: '28/05/2026, 18:28:16' },
    ],
  },
  // ─── BUDGET ───
  {
    id: 'chroma2', name: 'Chroma 2 Case', image: '🎨', price: 5.90, tier: 'budget',
    weights: [85, 12, 2.5, 0.5, 0],
    items: [
      { id: 'ch2_1', name: 'Tigris', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.3, maxPrice: 1.5 },
      { id: 'ch2_2', name: 'Facets', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.3, maxPrice: 1.5 },
      { id: 'ch2_3', name: 'Jungle', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.3, maxPrice: 1.5 },
      { id: 'ch2_4', name: 'Catenary', rarity: 'Mil-Spec', weapon: 'G3SG1', rarityLevel: 0, minPrice: 0.3, maxPrice: 1.5 },
      { id: 'ch2_5', name: 'Osiris', rarity: 'Mil-Spec', weapon: 'UMP-45', rarityLevel: 0, minPrice: 0.3, maxPrice: 1.5 },
      { id: 'ch2_6', name: 'Night', rarity: 'Restricted', weapon: 'AK-47', rarityLevel: 1, minPrice: 2, maxPrice: 8 },
      { id: 'ch2_7', name: 'Big Iron', rarity: 'Restricted', weapon: 'R8 Revolver', rarityLevel: 1, minPrice: 2, maxPrice: 8 },
      { id: 'ch2_8', name: 'Flame', rarity: 'Classified', weapon: 'FAMAS', rarityLevel: 2, minPrice: 8, maxPrice: 25 },
      { id: 'ch2_9', name: 'Crimson Tsunami', rarity: 'Classified', weapon: 'MAG-7', rarityLevel: 2, minPrice: 8, maxPrice: 25 },
      { id: 'ch2_10', name: 'Kill Confirmed', rarity: 'Covert', weapon: 'Glock-18', rarityLevel: 3, minPrice: 25, maxPrice: 80 },
    ],
  },
  {
    id: 'falchion', name: 'Falchion Case', image: '⚔️', price: 7.90, tier: 'budget',
    weights: [82, 13.5, 3, 1.5, 0],
    items: [
      { id: 'fal_1', name: 'Copper Galaxy', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.3, maxPrice: 2 },
      { id: 'fal_2', name: 'Colony', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 0.3, maxPrice: 2 },
      { id: 'fal_3', name: 'Valence', rarity: 'Mil-Spec', weapon: 'SG 553', rarityLevel: 0, minPrice: 0.3, maxPrice: 2 },
      { id: 'fal_4', name: 'Midnight Storm', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.3, maxPrice: 2 },
      { id: 'fal_5', name: 'Rapid Eye', rarity: 'Mil-Spec', weapon: 'MP7', rarityLevel: 0, minPrice: 0.3, maxPrice: 2 },
      { id: 'fal_6', name: 'Fire Starter', rarity: 'Restricted', weapon: 'P250', rarityLevel: 1, minPrice: 2, maxPrice: 10 },
      { id: 'fal_7', name: 'Tiger Tooth', rarity: 'Restricted', weapon: 'SSG 08', rarityLevel: 1, minPrice: 2, maxPrice: 10 },
      { id: 'fal_8', name: 'Bone Forged', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 10, maxPrice: 35 },
      { id: 'fal_9', name: 'Cyrex', rarity: 'Classified', weapon: 'M4A1-S', rarityLevel: 2, minPrice: 10, maxPrice: 35 },
      { id: 'fal_10', name: 'Wasteland Princess', rarity: 'Covert', weapon: 'PP-Bizon', rarityLevel: 3, minPrice: 30, maxPrice: 100 },
    ],
  },
  // ─── STANDARD ───
  {
    id: 'cs20', name: 'CS20 Case', image: '🎯', price: 12.90, tier: 'standard',
    weights: [79.92, 15.98, 3.20, 0.64, 0.26],
    items: [
      { id: 'cs20_1', name: 'Stalker', rarity: 'Mil-Spec', weapon: 'AUG', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'cs20_2', name: 'Verdigris', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'cs20_3', name: 'Lead Conduit', rarity: 'Mil-Spec', weapon: 'USP-S', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'cs20_4', name: 'Spectre', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'cs20_5', name: 'Buddy', rarity: 'Mil-Spec', weapon: 'Five-SeveN', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'cs20_6', name: 'Whitefish', rarity: 'Restricted', weapon: 'MAC-10', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_7', name: 'Runic', rarity: 'Restricted', weapon: 'PP-Bizon', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_8', name: 'Incinegator', rarity: 'Restricted', weapon: 'XM1014', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'cs20_9', name: 'Tooth Fairy', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_10', name: 'Bloodsport', rarity: 'Classified', weapon: 'MP7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_11', name: 'Atheris', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'cs20_12', name: 'Legion of Anubis', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'cs20_13', name: 'Printstream', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'fracture', name: 'Fracture Case', image: '💥', price: 12.90, tier: 'standard',
    weights: [79.92, 15.98, 3.20, 0.64, 0.26],
    items: [
      { id: 'frc_1', name: 'Fragments', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'frc_2', name: 'Mount Fuji', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'frc_3', name: 'Toy Soldier', rarity: 'Mil-Spec', weapon: 'Nova', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'frc_4', name: 'Ivory', rarity: 'Mil-Spec', weapon: 'P2000', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'frc_5', name: 'Hazard', rarity: 'Restricted', weapon: 'SG 553', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_6', name: 'Ensnared', rarity: 'Restricted', weapon: 'MAC-10', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_7', name: 'Cassette', rarity: 'Restricted', weapon: 'P250', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'frc_8', name: 'Neo-Noir', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_9', name: 'Emphorosaur-S', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_10', name: 'Justice', rarity: 'Classified', weapon: 'MAG-7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'frc_11', name: 'Wildfire', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'frc_12', name: 'Printstream', rarity: 'Covert', weapon: 'M4A1-S', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'snakebite', name: 'Snakebite Case', image: '🐍', price: 12.90, tier: 'standard',
    weights: [79.92, 15.98, 3.20, 0.64, 0.26],
    items: [
      { id: 'snk_1', name: 'Distressed', rarity: 'Mil-Spec', weapon: 'CZ75-Auto', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'snk_2', name: 'Epicenter', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'snk_3', name: 'Food Chain', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'snk_4', name: 'Ziggy', rarity: 'Mil-Spec', weapon: 'XM1014', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'snk_5', name: 'Boost Protocol', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_6', name: 'Roadblock', rarity: 'Restricted', weapon: 'UMP-45', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_7', name: 'Tom Cat', rarity: 'Restricted', weapon: 'AUG', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'snk_8', name: 'Cyber Security', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'snk_9', name: 'Eye of the Emperor', rarity: 'Classified', weapon: 'FAMAS', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'snk_10', name: 'Rat Rod', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'snk_11', name: 'Trigger Discipline', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'dreams', name: 'Dreams & Nightmares', image: '🌙', price: 12.90, tier: 'standard',
    weights: [79.92, 15.98, 3.20, 0.64, 0.26],
    items: [
      { id: 'dr_1', name: 'Dream', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'dr_2', name: 'Sakkaku', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'dr_3', name: 'Dream', rarity: 'Mil-Spec', weapon: 'MP9', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'dr_4', name: 'Night', rarity: 'Mil-Spec', weapon: 'P2000', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'dr_5', name: 'Red', rarity: 'Mil-Spec', weapon: 'XM1014', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'dr_6', name: 'Dream', rarity: 'Restricted', weapon: 'AWP', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_7', name: 'Night', rarity: 'Restricted', weapon: 'FAMAS', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_8', name: 'Night', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'dr_9', name: 'Night', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_10', name: 'Night', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_11', name: 'Night', rarity: 'Classified', weapon: 'M4A1-S', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'dr_12', name: 'Night', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'dr_13', name: 'Night', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'dr_14', name: 'Dream', rarity: 'Covert', weapon: 'M4A4', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  {
    id: 'kilowatt', name: 'Kilowatt Case', image: '⚡', price: 12.90, tier: 'standard',
    weights: [79.92, 15.98, 3.20, 0.64, 0.26],
    items: [
      { id: 'kw_1', name: 'X-Ray', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'kw_2', name: 'Power Load', rarity: 'Mil-Spec', weapon: 'M249', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'kw_3', name: 'Heirloom', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 0.5, maxPrice: 3 },
      { id: 'kw_4', name: 'Kush Kit', rarity: 'Restricted', weapon: 'PP-Bizon', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_5', name: 'Concrete Jungle', rarity: 'Restricted', weapon: 'MP9', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_6', name: 'Copper Coated', rarity: 'Restricted', weapon: 'G3SG1', rarityLevel: 1, minPrice: 3, maxPrice: 12 },
      { id: 'kw_7', name: 'Vektor', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_8', name: 'Fade', rarity: 'Classified', weapon: 'SSG 08', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_9', name: 'Crescendo', rarity: 'Classified', weapon: 'MAG-7', rarityLevel: 2, minPrice: 12, maxPrice: 50 },
      { id: 'kw_10', name: 'Koi', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
      { id: 'kw_11', name: 'Hot Rod', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 50, maxPrice: 300 },
    ],
  },
  // ─── PREMIUM ───
  {
    id: 'prisma', name: 'Prisma Case', image: '🌈', price: 24.90, tier: 'premium',
    weights: [65, 22, 8, 3.5, 1.5],
    items: [
      { id: 'prs_1', name: 'Flashback', rarity: 'Mil-Spec', weapon: 'SG 553', rarityLevel: 0, minPrice: 1, maxPrice: 5 },
      { id: 'prs_2', name: 'Drift Wood', rarity: 'Mil-Spec', weapon: 'AUG', rarityLevel: 0, minPrice: 1, maxPrice: 5 },
      { id: 'prs_3', name: 'Hazard', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 1, maxPrice: 5 },
      { id: 'prs_4', name: 'Grip', rarity: 'Mil-Spec', weapon: 'Tec-9', rarityLevel: 0, minPrice: 1, maxPrice: 5 },
      { id: 'prs_5', name: 'Run', rarity: 'Restricted', weapon: 'MP7', rarityLevel: 1, minPrice: 5, maxPrice: 20 },
      { id: 'prs_6', name: 'Momentum', rarity: 'Restricted', weapon: 'M4A4', rarityLevel: 1, minPrice: 5, maxPrice: 20 },
      { id: 'prs_7', name: 'Risky', rarity: 'Restricted', weapon: 'P250', rarityLevel: 1, minPrice: 5, maxPrice: 20 },
      { id: 'prs_8', name: 'Moonrise', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 20, maxPrice: 80 },
      { id: 'prs_9', name: 'Grim', rarity: 'Classified', weapon: 'AK-47', rarityLevel: 2, minPrice: 20, maxPrice: 80 },
      { id: 'prs_10', name: 'Tiger Moth', rarity: 'Classified', weapon: 'USP-S', rarityLevel: 2, minPrice: 20, maxPrice: 80 },
      { id: 'prs_11', name: 'Wild Lotus', rarity: 'Covert', weapon: 'M4A1-S', rarityLevel: 3, minPrice: 100, maxPrice: 500 },
      { id: 'prs_12', name: 'Bloodsport', rarity: 'Covert', weapon: 'Desert Eagle', rarityLevel: 3, minPrice: 100, maxPrice: 500 },
      { id: 'prs_13', name: '★ Karambit', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 800, maxPrice: 3000 },
      { id: 'prs_14', name: '★ M9 Bayonet', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 600, maxPrice: 2500 },
    ],
  },
  {
    id: 'spectrum', name: 'Spectrum 2 Case', image: '💎', price: 39.90, tier: 'premium',
    weights: [55, 25, 12, 5, 3],
    items: [
      { id: 'sp2_1', name: 'Jungle Slipstream', rarity: 'Mil-Spec', weapon: 'SSG 08', rarityLevel: 0, minPrice: 1, maxPrice: 6 },
      { id: 'sp2_2', name: 'Tread', rarity: 'Mil-Spec', weapon: 'PP-Bizon', rarityLevel: 0, minPrice: 1, maxPrice: 6 },
      { id: 'sp2_3', name: 'Ventilator', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 1, maxPrice: 6 },
      { id: 'sp2_4', name: 'System Lock', rarity: 'Restricted', weapon: 'MP9', rarityLevel: 1, minPrice: 6, maxPrice: 25 },
      { id: 'sp2_5', name: 'Patch Up', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 6, maxPrice: 25 },
      { id: 'sp2_6', name: 'Kami', rarity: 'Restricted', weapon: 'FAMAS', rarityLevel: 1, minPrice: 6, maxPrice: 25 },
      { id: 'sp2_7', name: 'Swept', rarity: 'Classified', weapon: 'MP7', rarityLevel: 2, minPrice: 25, maxPrice: 100 },
      { id: 'sp2_8', name: 'Tiger Tooth', rarity: 'Classified', weapon: 'Glock-18', rarityLevel: 2, minPrice: 25, maxPrice: 100 },
      { id: 'sp2_9', name: 'Harpy', rarity: 'Classified', weapon: 'P250', rarityLevel: 2, minPrice: 25, maxPrice: 100 },
      { id: 'sp2_10', name: 'Fade', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 150, maxPrice: 700 },
      { id: 'sp2_11', name: 'Asiimov', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 150, maxPrice: 700 },
      { id: 'sp2_12', name: '★ Butterfly Knife', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 1200, maxPrice: 5000 },
      { id: 'sp2_13', name: '★ Talon Knife', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 800, maxPrice: 3500 },
      { id: 'sp2_14', name: '★ Driver Gloves', rarity: 'Rare Special', weapon: 'Gloves', rarityLevel: 4, minPrice: 600, maxPrice: 2500 },
    ],
  },
  // ─── HIGH RISK ───
  {
    id: 'riptide', name: 'Operation Riptide', image: '🌊', price: 59.90, tier: 'high',
    weights: [45, 28, 15, 8, 4],
    items: [
      { id: 'rip_1', name: 'M.A.C.', rarity: 'Mil-Spec', weapon: 'SCAR-20', rarityLevel: 0, minPrice: 2, maxPrice: 8 },
      { id: 'rip_2', name: 'Spray', rarity: 'Mil-Spec', weapon: 'MAG-7', rarityLevel: 0, minPrice: 2, maxPrice: 8 },
      { id: 'rip_3', name: 'Drift', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 2, maxPrice: 8 },
      { id: 'rip_4', name: 'Tailored', rarity: 'Restricted', weapon: 'UMP-45', rarityLevel: 1, minPrice: 8, maxPrice: 30 },
      { id: 'rip_5', name: 'Leaping', rarity: 'Restricted', weapon: 'CZ75-Auto', rarityLevel: 1, minPrice: 8, maxPrice: 30 },
      { id: 'rip_6', name: 'Flow', rarity: 'Restricted', weapon: 'P2000', rarityLevel: 1, minPrice: 8, maxPrice: 30 },
      { id: 'rip_7', name: 'Dual', rarity: 'Restricted', weapon: 'Dual Berettas', rarityLevel: 1, minPrice: 8, maxPrice: 30 },
      { id: 'rip_8', name: 'Blueprint', rarity: 'Classified', weapon: 'M4A1-S', rarityLevel: 2, minPrice: 30, maxPrice: 150 },
      { id: 'rip_9', name: 'Vaporwave', rarity: 'Classified', weapon: 'AWP', rarityLevel: 2, minPrice: 30, maxPrice: 150 },
      { id: 'rip_10', name: 'Nightmare', rarity: 'Classified', weapon: 'AK-47', rarityLevel: 2, minPrice: 30, maxPrice: 150 },
      { id: 'rip_11', name: 'Gold Arabesque', rarity: 'Covert', weapon: 'AK-47', rarityLevel: 3, minPrice: 200, maxPrice: 1000 },
      { id: 'rip_12', name: 'The Empress', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 200, maxPrice: 1000 },
      { id: 'rip_13', name: '★ Skeleton Knife', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 1500, maxPrice: 6000 },
      { id: 'rip_14', name: '★ Moto Gloves', rarity: 'Rare Special', weapon: 'Gloves', rarityLevel: 4, minPrice: 1000, maxPrice: 4000 },
      { id: 'rip_15', name: '★ Specialist Gloves', rarity: 'Rare Special', weapon: 'Gloves', rarityLevel: 4, minPrice: 1200, maxPrice: 5000 },
    ],
  },
  {
    id: 'bravo', name: 'Operation Bravo Case', image: '🏆', price: 99.90, tier: 'high',
    weights: [35, 28, 20, 12, 5],
    items: [
      { id: 'bra_1', name: 'Sandstorm', rarity: 'Mil-Spec', weapon: 'P250', rarityLevel: 0, minPrice: 3, maxPrice: 10 },
      { id: 'bra_2', name: 'Death Head', rarity: 'Mil-Spec', weapon: 'SSG 08', rarityLevel: 0, minPrice: 3, maxPrice: 10 },
      { id: 'bra_3', name: 'Agency', rarity: 'Mil-Spec', weapon: 'MAC-10', rarityLevel: 0, minPrice: 3, maxPrice: 10 },
      { id: 'bra_4', name: 'Tuxedo', rarity: 'Restricted', weapon: 'Glock-18', rarityLevel: 1, minPrice: 10, maxPrice: 40 },
      { id: 'bra_5', name: 'Stainless', rarity: 'Restricted', weapon: 'Five-SeveN', rarityLevel: 1, minPrice: 10, maxPrice: 40 },
      { id: 'bra_6', name: 'Cold Blooded', rarity: 'Restricted', weapon: 'P2000', rarityLevel: 1, minPrice: 10, maxPrice: 40 },
      { id: 'bra_7', name: 'Crimson Web', rarity: 'Classified', weapon: 'USP-S', rarityLevel: 2, minPrice: 40, maxPrice: 200 },
      { id: 'bra_8', name: 'Case Hardened', rarity: 'Classified', weapon: 'AK-47', rarityLevel: 2, minPrice: 40, maxPrice: 200 },
      { id: 'bra_9', name: 'Fade', rarity: 'Classified', weapon: 'M4A4', rarityLevel: 2, minPrice: 40, maxPrice: 200 },
      { id: 'bra_10', name: 'Dragon Lore', rarity: 'Covert', weapon: 'AWP', rarityLevel: 3, minPrice: 500, maxPrice: 5000 },
      { id: 'bra_11', name: 'Howl', rarity: 'Covert', weapon: 'M4A4', rarityLevel: 3, minPrice: 400, maxPrice: 3000 },
      { id: 'bra_12', name: '★ Karambit Doppler', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 2000, maxPrice: 10000 },
      { id: 'bra_13', name: '★ M9 Bayonet Marble', rarity: 'Rare Special', weapon: 'Knife', rarityLevel: 4, minPrice: 1500, maxPrice: 8000 },
      { id: 'bra_14', name: '★ Hand Wraps', rarity: 'Rare Special', weapon: 'Gloves', rarityLevel: 4, minPrice: 1200, maxPrice: 6000 },
    ],
  },
];

const ITEM_WIDTH = 88;
const CONTAINER_WIDTH = 600;

function pickWeightedItem(caseData: CS2CaseData): CSSkin {
  const roll = Math.random() * 100;
  let cumulative = 0;
  let chosenLevel = 0;
  for (let i = 0; i < caseData.weights.length; i++) {
    cumulative += caseData.weights[i];
    if (roll < cumulative) { chosenLevel = i; break; }
  }
  const pool = caseData.items.filter(s => s.rarityLevel === chosenLevel);
  if (pool.length === 0) {
    const fallback = caseData.items.filter(s => s.rarityLevel === 0);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateStripItems(caseData: CS2CaseData, winner: CSSkin, winnerIndex: number): CSSkin[] {
  const items: CSSkin[] = [];
  for (let i = 0; i < 50; i++) {
    if (i === winnerIndex) { items.push(winner); }
    else { items.push(pickWeightedItem(caseData)); }
  }
  return items;
}

interface CS2CasesProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
  userId: string;
  collection: PokemonCard[];
  onCollectionUpdate: (cards: PokemonCard[]) => void;
  onSellCard: (cardId: string, price: number) => void;
  onSellAllDuplicates: (prices: Record<string, number>) => void;
}

export default function CS2Cases({
  balance, onUpdateBalance, userId, collection,
  onCollectionUpdate, onSellCard, onSellAllDuplicates,
}: CS2CasesProps) {
  const [tab, setTab] = useState<'cases' | 'collection' | 'market'>('cases');
  const [selectedCase, setSelectedCase] = useState<CS2CaseData | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<CSSkin | null>(null);
  const [resultPrice, setResultPrice] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [stripItems, setStripItems] = useState<CSSkin[]>([]);
  const [stripX, setStripX] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const newPrices: Record<string, number> = {};
    ALL_CASES.forEach(c => c.items.forEach(s => {
      newPrices[s.id] = Math.round((s.minPrice + Math.random() * (s.maxPrice - s.minPrice)) * 100) / 100;
    }));
    setPrices(newPrices);
    const interval = setInterval(() => {
      setPrices(prev => {
        const updated = { ...prev };
        ALL_CASES.forEach(c => c.items.forEach(s => {
          const current = updated[s.id] ?? (s.minPrice + s.maxPrice) / 2;
          const change = (Math.random() - 0.5) * 1.5;
          const newPrice = Math.max(s.minPrice * 0.5, Math.min(s.maxPrice * 1.5, current + change));
          updated[s.id] = Math.round(newPrice * 100) / 100;
        }));
        return updated;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const winners = JSON.parse(localStorage.getItem('cs2DailyWinners') || '{}');
      const dailyCase = ALL_CASES.find(c => c.id === 'daily');
      if (dailyCase) {
        dailyCase.items.forEach(item => {
          if (winners[item.id]) {
            item.lastWinner = winners[item.id].winner;
            item.lastWonAt = winners[item.id].timestamp;
          }
        });
      }
    } catch {}
  }, []);

  const openCase = useCallback(() => {
    if (!selectedCase || rolling) return;
    if (balance < selectedCase.price) return;
    setRolling(true);
    setShowResult(false);
    setResult(null);
    if (selectedCase.price > 0) onUpdateBalance(-selectedCase.price);

    const winner = pickWeightedItem(selectedCase);
    const winnerIndex = 35 + Math.floor(Math.random() * 8);
    const items = generateStripItems(selectedCase, winner, winnerIndex);
    setStripItems(items);
    setStripX(CONTAINER_WIDTH);

    const targetX = -(winnerIndex * ITEM_WIDTH - CONTAINER_WIDTH / 2 + ITEM_WIDTH / 2);
    const startX = CONTAINER_WIDTH;
    const endX = targetX;
    const duration = 3500;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setStripX(startX + (endX - startX) * eased);
      if (p < 1) { requestAnimationFrame(animate); }
      else {
        setStripX(endX);
        setResult(winner);
        setResultPrice(Math.round((winner.minPrice + Math.random() * (winner.maxPrice - winner.minPrice)) * 100) / 100);
        setShowResult(true);
        setRolling(false);
      }
    }
    requestAnimationFrame(animate);
  }, [selectedCase, rolling, balance, onUpdateBalance]);

  const handleKeep = useCallback(() => {
    if (!result || !selectedCase) return;
    const card: PokemonCard = {
      id: result.id,
      name: `${result.weapon} | ${result.name}`,
      imageUrl: '',
      rarity: rarityLabel(result.rarityLevel),
      setName: selectedCase.name,
      setSeries: 'CS2',
      quantity: 1,
    };
    onCollectionUpdate([card]);
    if (selectedCase.tier === 'daily') {
      const now = new Date();
      const ts = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      try {
        const winners = JSON.parse(localStorage.getItem('cs2DailyWinners') || '{}');
        winners[result.id] = { winner: 'Você', timestamp: ts };
        localStorage.setItem('cs2DailyWinners', JSON.stringify(winners));
      } catch {}
    }
    setShowResult(false);
    setResult(null);
  }, [result, selectedCase, onCollectionUpdate]);

  const handleSellNow = useCallback(() => {
    if (!result) return;
    onUpdateBalance(resultPrice);
    setShowResult(false);
    setResult(null);
  }, [result, resultPrice, onUpdateBalance]);

  const sellPrice = useCallback((card: PokemonCard): number => prices[card.id] ?? 0, [prices]);

  const handleSellSingle = useCallback((card: PokemonCard) => {
    onSellCard(card.id, sellPrice(card));
  }, [onSellCard, sellPrice]);

  const handleSellAllDups = useCallback(() => {
    const dupePrices: Record<string, number> = {};
    collection.forEach(c => {
      if (c.quantity > 1) dupePrices[c.id] = sellPrice(c);
    });
    onSellAllDuplicates(dupePrices);
  }, [collection, onSellAllDuplicates, sellPrice]);

  const filteredCollection = collection
    .filter(c => c.setSeries === 'CS2')
    .filter(c => {
      if (rarityFilter === null) return true;
      const rarMap: Record<string, number> = {
        'Mil-Spec (Azul)': 0, 'Restricted (Roxa)': 1,
        'Classified (Rosa)': 2, 'Covert (Vermelha)': 3, 'Rare Special (Ouro)': 4,
      };
      return rarMap[c.rarity] === rarityFilter;
    })
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const casesToShow = ALL_CASES.filter(c => tierFilter ? c.tier === tierFilter : true);

  const rarityCounts: Record<number, { total: number; collected: number }> = {};
  [0, 1, 2, 3, 4].forEach(i => { rarityCounts[i] = { total: 0, collected: 0 }; });
  ALL_CASES.forEach(c => c.items.forEach(s => {
    rarityCounts[s.rarityLevel].total++;
    if (collection.some(cc => cc.id === s.id)) rarityCounts[s.rarityLevel].collected++;
  }));

  const totalItems = ALL_CASES.reduce((sum, c) => sum + c.items.length, 0);
  const collectedItems = collection.filter(c => c.setSeries === 'CS2').length;

  const TIER_INFO: Record<string, { label: string; icon: string; color: string }> = {
    daily: { label: 'Diária Grátis', icon: '🎁', color: 'text-green-400 border-green-500/30 bg-green-500/5' },
    budget: { label: 'Econômicas', icon: '🪙', color: 'text-slate-400 border-slate-500/30 bg-slate-500/5' },
    standard: { label: 'Padrão', icon: '📦', color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
    premium: { label: 'Premium', icon: '💎', color: 'text-purple-400 border-purple-500/30 bg-purple-500/5' },
    high: { label: 'Alto Risco', icon: '🔥', color: 'text-red-400 border-red-500/30 bg-red-500/5' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#161a2b]/40 via-[#0e1017] to-[#161a2b]/20 p-5 rounded-2xl border border-orange-950/45 flex items-center gap-4">
        <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20 text-orange-400">
          <Crosshair className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-extrabold text-white text-base">CS2 Case Opening</h3>
          <p className="text-slate-400 text-xs">Abra caixas e ganhe skins raras do Counter-Strike 2</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Progresso</div>
          <div className="text-sm font-bold text-white">{collectedItems}/{totalItems}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#1a1c2a] pb-2">
        {[
          { id: 'cases' as const, label: 'Caixas', icon: '📦' },
          { id: 'collection' as const, label: 'Coleção', icon: '📚' },
          { id: 'market' as const, label: 'Mercado', icon: '💰' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              tab === t.id
                ? 'bg-brand text-slate-950 border-brand shadow-[0_0_10px_rgba(0,255,135,0.2)]'
                : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d] hover:bg-[#141624]'
            }`}
          ><span>{t.icon}</span>{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'cases' && !selectedCase && (
          <motion.div key="case-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Tier filters */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setTierFilter(null)}
                className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  tierFilter === null ? 'bg-brand text-slate-950 border-brand' : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d]'
                }`}>Todas</button>
              {Object.entries(TIER_INFO).map(([key, info]) => (
                <button key={key} onClick={() => setTierFilter(key)}
                  className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${info.color} ${
                    tierFilter === key ? 'ring-1 ring-brand/50' : ''
                  }`}
                >{info.icon} {info.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {casesToShow.map(c => {
                const tInfo = TIER_INFO[c.tier] || { label: '', icon: '', color: 'text-slate-400' };
                return (
                  <button key={c.id} onClick={() => setSelectedCase(c)}
                    className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-4 text-center hover:border-orange-500/30 transition-all cursor-pointer group"
                  >
                    <div className="text-4xl mb-2">{c.image}</div>
                    <div className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-1">R$ {c.price.toFixed(2)}</div>
                    <div className={`text-[9px] mt-1 px-1.5 py-0.5 rounded inline-block border ${tInfo.color}`}>{tInfo.icon} {tInfo.label}</div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {tab === 'cases' && selectedCase && (
          <motion.div key="case-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <button onClick={() => setSelectedCase(null)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> Voltar
            </button>

            <div className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">{selectedCase.image}</div>
                <div>
                  <h4 className="text-lg font-bold text-white">{selectedCase.name}</h4>
                  <p className="text-sm text-slate-400">R$ {selectedCase.price.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{selectedCase.items.length} skins possíveis</p>
                  <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded inline-block border ${(TIER_INFO[selectedCase.tier] || {}).color || ''}`}>
                    {(TIER_INFO[selectedCase.tier] || {}).icon} {(TIER_INFO[selectedCase.tier] || {}).label}
                  </div>
                </div>
              </div>

              {/* Odds table */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                  { level: 0, label: 'Azul', chance: `${selectedCase.weights[0]}%`, color: 'text-blue-400' },
                  { level: 1, label: 'Roxa', chance: `${selectedCase.weights[1]}%`, color: 'text-purple-400' },
                  { level: 2, label: 'Rosa', chance: `${selectedCase.weights[2]}%`, color: 'text-pink-400' },
                  { level: 3, label: 'Verm.', chance: `${selectedCase.weights[3]}%`, color: 'text-red-400' },
                  { level: 4, label: 'Ouro', chance: `${selectedCase.weights[4]}%`, color: 'text-yellow-300' },
                ].map(o => (
                  <div key={o.level} className={`bg-[#0a0b12] border border-[#1a1d2d] rounded-lg p-2 text-center ${o.color}`}>
                    <div className="text-xs font-bold">{o.label}</div>
                    <div className="text-lg font-black">{o.chance}</div>
                    <div className="text-[10px] opacity-60">{rarityCounts[o.level].collected}/{rarityCounts[o.level].total}</div>
                  </div>
                ))}
              </div>

              {/* Open / rolling area */}
              <div className="relative" style={{ minHeight: rolling || showResult ? '320px' : 'auto' }}>
                {!rolling && !showResult && (
                  <button onClick={openCase} disabled={balance < selectedCase.price}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                      balance < selectedCase.price
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : selectedCase.price === 0
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                    }`}
                  >{selectedCase.price === 0 ? '🎁 Abrir Caixa Grátis' : `Abrir Caixa — R$ ${selectedCase.price.toFixed(2)}`}</button>
                )}

                {(rolling || showResult) && (
                  <div className="relative">
                    <div className="relative overflow-hidden rounded-xl border border-[#1a1d2d] bg-[#0a0b12] mb-4" style={{ height: '160px' }}>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                      </div>
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-24 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent rounded-full" />
                      <div
                        className="flex gap-1.5 items-center py-8 absolute"
                        style={{ transform: `translateX(${stripX}px)`, transition: 'none', willChange: 'transform' }}
                      >
                        {(rolling ? stripItems : [result!]).map((item, i) => {
                          const rColor = rarityColor(item.rarityLevel);
                          return (
                            <div key={rolling ? `s-${i}` : 'r'}
                              className={`shrink-0 w-[80px] rounded-lg border ${rColor.border} ${rColor.bg} p-1.5 text-center`}
                              style={{ boxShadow: `0 0 6px ${rColor.glow}` }}
                            >
                              <div className="text-[9px] font-mono text-slate-400 truncate">{item.weapon}</div>
                              <div className={`text-[10px] font-bold ${rColor.text} truncate leading-tight`}>{item.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {showResult && result && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-6 text-center"
                      >
                        <div className="text-sm text-slate-400 mb-3">🎉 Você ganhou!</div>
                        <div className="flex justify-center mb-3">
                          <div
                            className={`w-36 h-36 rounded-2xl border-2 flex items-center justify-center ${rarityColor(result.rarityLevel).border} ${rarityColor(result.rarityLevel).bg} overflow-hidden`}
                            style={{ boxShadow: `0 0 40px ${rarityColor(result.rarityLevel).glow}` }}
                          >
                            <img
                              src={`https://csimg.glitch.me/${encodeURIComponent(result.weapon + ' | ' + result.name)}`}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              alt={result.name}
                              className="w-full h-full object-contain p-1"
                            />
                            <span className="text-4xl absolute opacity-30">{result.rarityLevel === 4 ? '⭐' : '🔫'}</span>
                          </div>
                        </div>
                        <div className={`text-sm font-mono ${rarityColor(result.rarityLevel).text} opacity-80 mb-0.5`}>
                          {result.weapon}
                        </div>
                        <div className={`text-lg md:text-xl font-bold ${rarityColor(result.rarityLevel).text} px-4 max-w-xs mx-auto leading-tight`}>
                          {result.name}
                        </div>
                        <div className={`text-xs ${rarityColor(result.rarityLevel).text} opacity-70 mt-0.5`}>
                          {rarityLabelShort(result.rarityLevel)}
                        </div>
                        <div className="text-xl font-black text-brand mt-2">R$ {resultPrice.toFixed(2)}</div>
                        <div className="flex gap-2 mt-4">
                          <button onClick={handleSellNow}
                            className="flex-1 py-2.5 bg-brand text-slate-950 rounded-xl text-xs font-bold hover:shadow-[0_0_12px_rgba(0,255,135,0.3)] transition-all cursor-pointer"
                          >Vender por R$ {resultPrice.toFixed(2)}</button>
                          <button onClick={handleKeep}
                            className="flex-1 py-2.5 bg-[#1a1d2d] text-slate-200 rounded-xl text-xs font-bold hover:bg-[#242738] transition-all cursor-pointer border border-[#2a2d3d]"
                          >Guardar na Coleção</button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Case contents */}
              <div className="mt-4">
                <h5 className="text-sm font-bold text-slate-300 mb-2">Conteúdo da Caixa</h5>
                {[0, 1, 2, 3, 4].map(level => {
                  const items = selectedCase.items.filter(s => s.rarityLevel === level);
                  if (items.length === 0) return null;
                  const rColor = rarityColor(level);
                  return (
                    <div key={level} className="mb-2">
                      <div className={`text-xs font-bold ${rColor.text} mb-1`}>{rarityLabel(level)}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(s => {
                          const owned = collection.some(c => c.id === s.id && c.setSeries === 'CS2');
                          const winner = s.lastWinner;
                          const lastWon = s.lastWonAt;
                          return (
                            <div key={s.id}
                              className={`text-[10px] px-2 py-1 rounded-lg border ${rColor.border} ${rColor.bg} ${owned ? 'opacity-60' : ''} relative group`}
                            >
                              {s.weapon} | {s.name}{owned && <span className="text-brand ml-1">✓</span>}
                              {selectedCase.tier === 'daily' && winner && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20">
                                  <div className="bg-[#1a1d2d] border border-[#2a2d3d] rounded-lg px-2 py-1 text-[9px] text-slate-300 whitespace-nowrap shadow-lg">
                                    Último: {winner} {lastWon !== '—' ? `(${lastWon})` : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" placeholder="Buscar skin..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0e16] border border-[#1a1d2d] rounded-xl py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/30" />
              </div>
              <button onClick={() => setRarityFilter(null)}
                className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${rarityFilter === null ? 'bg-brand text-slate-950 border-brand' : 'bg-[#0d0e16] text-slate-300 border-[#1a1d2d]'}`}>Todas</button>
              {[
                { level: 0, label: 'Azul', color: 'text-blue-400' },
                { level: 1, label: 'Roxa', color: 'text-purple-400' },
                { level: 2, label: 'Rosa', color: 'text-pink-400' },
                { level: 3, label: 'Vermelha', color: 'text-red-400' },
                { level: 4, label: 'Ouro', color: 'text-yellow-300' },
              ].map(r => (
                <button key={r.level} onClick={() => setRarityFilter(rarityFilter === r.level ? null : r.level)}
                  className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${r.color} ${rarityFilter === r.level ? 'bg-white/5' : 'bg-[#0d0e16] border-[#1a1d2d]'}`}>{r.label}</button>
              ))}
            </div>

            {filteredCollection.length === 0
              ? <div className="text-center py-12 text-slate-500 text-sm">Nenhuma skin na coleção</div>
              : <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {filteredCollection.map(card => {
                    const rarMap: Record<string, number> = {
                      'Mil-Spec (Azul)': 0, 'Restricted (Roxa)': 1,
                      'Classified (Rosa)': 2, 'Covert (Vermelha)': 3, 'Rare Special (Ouro)': 4,
                    };
                    const level = rarMap[card.rarity] ?? 0;
                    const rColor = rarityColor(level);
                    const price = prices[card.id] ?? 0;
                    return (
                      <div key={card.id} className={`bg-[#0d0e16] border ${rColor.border} rounded-xl p-3 text-center`}
                        style={{ boxShadow: `0 0 8px ${rColor.glow}` }}>
                        <div className="text-3xl mb-1">{level === 4 ? '⭐' : '🔫'}</div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{card.name.split(' | ')[0]}</div>
                        <div className="text-xs font-bold text-white truncate">{card.name.split(' | ')[1] || card.name}</div>
                        <div className={`text-[10px] ${rColor.text}`}>{card.rarity}</div>
                        <div className="text-xs font-bold text-brand mt-1">R$ {price.toFixed(2)}</div>
                        {card.quantity > 1 && <div className="text-[10px] text-slate-500 mt-0.5">{card.quantity}x</div>}
                        {card.quantity > 1 && (
                          <button onClick={() => handleSellSingle(card)}
                            className="mt-1.5 w-full py-1 bg-[#1a1d2d] text-slate-300 rounded-lg text-[10px] font-bold hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer border border-[#2a2d3d]"
                          >Vender 1x R$ {price.toFixed(2)}</button>
                        )}
                      </div>
                    );
                  })}
                </div>}
          </motion.div>
        )}

        {tab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-white">Mercado de Skins CS2</div>
                <TrendingUp className="w-4 h-4 text-brand" />
              </div>
              <p className="text-[10px] text-slate-500">Preços flutuam a cada 20s</p>
              {collection.filter(c => c.setSeries === 'CS2' && c.quantity > 1).length > 0 && (
                <button onClick={handleSellAllDups}
                  className="mt-3 w-full py-2.5 bg-brand/10 border border-brand/30 text-brand rounded-xl text-xs font-bold hover:bg-brand/20 transition-all cursor-pointer"
                >Vender Todas Repetidas</button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ALL_CASES.flatMap(c => c.items).map(skin => {
                const owned = collection.filter(c => c.id === skin.id && c.setSeries === 'CS2');
                const quantity = owned.reduce((s, c) => s + c.quantity, 0);
                const rColor = rarityColor(skin.rarityLevel);
                const price = prices[skin.id] ?? 0;
                if (quantity <= 1) return null;
                return (
                  <div key={skin.id} className={`bg-[#0d0e16] border ${rColor.border} rounded-xl p-3 text-center`}>
                    <div className={`text-[10px] font-mono ${rColor.text}`}>{skin.weapon}</div>
                    <div className="text-xs font-bold text-white truncate">{skin.name}</div>
                    <div className="text-[10px] text-slate-400">{rarityLabelShort(skin.rarityLevel)}</div>
                    <div className="text-xs font-bold text-brand mt-1">R$ {price.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{quantity - 1} repetidas</div>
                    <button onClick={() => { const c = owned[0]; if (c) handleSellSingle(c); }}
                      className="mt-1.5 w-full py-1 bg-[#1a1d2d] text-slate-300 rounded-lg text-[10px] font-bold hover:bg-brand/20 hover:text-brand transition-all cursor-pointer border border-[#2a2d3d]"
                    >Vender 1x R$ {price.toFixed(2)}</button>
                  </div>
                );
              })}
              {collection.filter(c => c.setSeries === 'CS2' && c.quantity > 1).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">Nenhuma skin repetida para vender</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress summary */}
      {tab === 'collection' && (
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map(level => {
            const rColor = rarityColor(level);
            const pct = rarityCounts[level].total > 0 ? Math.round((rarityCounts[level].collected / rarityCounts[level].total) * 100) : 0;
            return (
              <div key={level} className="bg-[#0d0e16] border border-[#1a1d2d] rounded-xl p-3">
                <div className={`text-[10px] font-bold ${rColor.text}`}>{rarityLabelShort(level)}</div>
                <div className="text-lg font-black text-white mt-0.5">{rarityCounts[level].collected}/{rarityCounts[level].total}</div>
                <div className="w-full h-1.5 bg-[#1a1d2d] rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${level === 0 ? 'bg-blue-500' : level === 1 ? 'bg-purple-500' : level === 2 ? 'bg-pink-500' : level === 3 ? 'bg-red-500' : 'bg-yellow-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
