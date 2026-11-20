import { Match } from '../types';

const HOCKEY_CACHE_KEY = 'benbets_nhl_hockey_api_v2';
const HOCKEY_CACHE_TTL_MS = 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundOdd(value: number): number {
  return Number(clamp(value, 1.03, 28.0).toFixed(2));
}

/**
 * Converte o texto de tempo decorrido da partida em progresso normalizado [0, 1].
 */
export function parseMatchProgress(sport: Match['sport'], timeElapsed?: string): number {
  if (!timeElapsed) return 0;
  const normalized = timeElapsed.trim().toLowerCase();

  if (
    normalized.includes('fim') ||
    normalized === 'ft' ||
    normalized.includes('encerr') ||
    normalized.includes('final')
  ) {
    return 1;
  }

  if (sport === 'Futebol') {
    if (normalized === 'int' || normalized.includes('intervalo') || normalized === 'ht') {
      return 0.5;
    }
    const baseMatch = normalized.match(/(\d+)(?:\+(\d+))?/);
    if (!baseMatch) return 0.35;
    const baseMin = parseInt(baseMatch[1], 10);
    const added = baseMatch[2] ? parseInt(baseMatch[2], 10) : 0;
    return clamp((baseMin + added) / 90, 0.02, 0.99);
  }

  if (sport === 'Hóquei') {
    if (normalized.includes('ot') || normalized.includes('so') || normalized.includes('prorrog')) {
      return 0.97;
    }
    if (normalized.includes('intervalo')) {
      const perInt = normalized.match(/(\d+)/);
      const p = perInt ? parseInt(perInt[1], 10) : 1;
      return clamp(p / 3, 0.33, 0.67);
    }
    const perMatch = normalized.match(/(\d+)\s*(?:º|o|st|nd|rd|th)?\s*per/i) || normalized.match(/^(\d+)/);
    const period = perMatch ? clamp(parseInt(perMatch[1], 10), 1, 3) : 1;
    const clockMatch = normalized.match(/(\d{1,2}):(\d{2})/);
    if (clockMatch) {
      // Relógio de hóquei faz contagem regressiva de 20:00
      const minsLeft = parseInt(clockMatch[1], 10);
      const secsLeft = parseInt(clockMatch[2], 10);
      const elapsedInPeriod = clamp((20 * 60 - (minsLeft * 60 + secsLeft)) / (20 * 60), 0, 1);
      return clamp((period - 1 + elapsedInPeriod) / 3, 0.02, 0.99);
    }
    return clamp((period - 1 + 0.5) / 3, 0.1, 0.95);
  }

  if (sport === 'Basquete') {
    if (normalized.includes('ot') || normalized.includes('prorrog')) return 0.96;
    if (normalized.includes('intervalo') || normalized === 'ht') return 0.5;
    const qMatch = normalized.match(/q\s*(\d+)/i) || normalized.match(/(\d+)\s*(?:º|o)?\s*q/i);
    const quarter = qMatch ? clamp(parseInt(qMatch[1], 10), 1, 4) : 2;
    const clockMatch = normalized.match(/(\d{1,2}):(\d{2})/);
    if (clockMatch) {
      const minsLeft = parseInt(clockMatch[1], 10);
      const secsLeft = parseInt(clockMatch[2], 10);
      const elapsedInQ = clamp((12 * 60 - (minsLeft * 60 + secsLeft)) / (12 * 60), 0, 1);
      return clamp((quarter - 1 + elapsedInQ) / 4, 0.02, 0.99);
    }
    return clamp((quarter - 1 + 0.5) / 4, 0.1, 0.95);
  }

  if (sport === 'Vôlei' || sport === 'Tênis') {
    if (normalized.includes('tie')) return 0.9;
    const setMatch = normalized.match(/(\d+)/);
    const setNum = setMatch ? clamp(parseInt(setMatch[1], 10), 1, 5) : 1;
    const totalSets = sport === 'Vôlei' ? 4.5 : 3;
    return clamp((setNum - 1 + 0.5) / totalSets, 0.1, 0.95);
  }

  if (sport === 'E-Sports') {
    const mapMatch = normalized.match(/mapa?\s*(\d+)/i);
    if (mapMatch) {
      const mapNum = clamp(parseInt(mapMatch[1], 10), 1, 3);
      return clamp((mapNum - 1 + 0.5) / 3, 0.15, 0.92);
    }
    const minMatch = normalized.match(/(\d+)/);
    const mins = minMatch ? parseInt(minMatch[1], 10) : 18;
    return clamp(mins / 42, 0.05, 0.96);
  }

  if (sport === 'MMA') {
    const roundMatch = normalized.match(/(\d+)/);
    const r = roundMatch ? clamp(parseInt(roundMatch[1], 10), 1, 5) : 1;
    return clamp((r - 1 + 0.5) / 3.5, 0.12, 0.95);
  }

  return 0.45;
}

function poissonPmfs(lambda: number, maxGoals: number): number[] {
  const pmf: number[] = new Array(maxGoals + 1).fill(0);
  if (lambda <= 0.0001) {
    pmf[0] = 1;
    return pmf;
  }
  pmf[0] = Math.exp(-lambda);
  for (let k = 1; k <= maxGoals; k++) {
    pmf[k] = (pmf[k - 1] * lambda) / k;
  }
  return pmf;
}

/**
 * Recalcula odds decimais ao vivo com base no placar, tempo restante, odds pré-jogo
 * e estatísticas reais de campo (chutes, chutes no alvo, posse de bola e cartões vermelhos).
 */
export function computeLiveOddsFromScore({
  sport,
  scoreHome,
  scoreAway,
  progress,
  baseOdds,
  stats,
}: {
  sport: Match['sport'];
  scoreHome: number;
  scoreAway: number;
  progress: number;
  baseOdds: { home: number; draw?: number; away: number };
  stats?: Match['stats'];
}): { home: number; draw?: number; away: number } {
  const isThreeWay = sport === 'Futebol' || sport === 'Hóquei';
  const diff = scoreHome - scoreAway;

  const redH = Math.max(0, stats?.redCardsHome ?? 0);
  const redA = Math.max(0, stats?.redCardsAway ?? 0);

  if (progress <= 0 && diff === 0 && redH === 0 && redA === 0) {
    return {
      home: roundOdd(baseOdds.home),
      ...(baseOdds.draw !== undefined ? { draw: roundOdd(baseOdds.draw) } : {}),
      away: roundOdd(baseOdds.away),
    };
  }

  const t = clamp(progress, 0.02, 0.99);
  const rem = Math.max(0.025, 1 - t);
  const overround = 1.055;

  const invH = 1 / clamp(baseOdds.home || 2.1, 1.05, 25);
  const invA = 1 / clamp(baseOdds.away || 2.1, 1.05, 25);

  if (isThreeWay) {
    const invD = 1 / clamp(baseOdds.draw ?? (sport === 'Hóquei' ? 4.05 : 3.4), 1.4, 15);
    const totalInv = invH + invD + invA;
    const pH0 = invH / totalInv;
    const pA0 = invA / totalInv;

    // 1. Força relativa pré-jogo
    const ratio = Math.pow(clamp(pH0 / Math.max(0.01, pA0), 0.12, 8.5), 0.45);
    let shareH = clamp(ratio / (1 + ratio), 0.22, 0.78);
    let totalExpectedGoals = sport === 'Hóquei' ? 5.85 : 2.65;

    // 2. Ajuste por volume ofensivo real (chutes no alvo / chutes totais + ritmo do jogo)
    const sotH = stats?.shotsOnTargetHome;
    const sotA = stats?.shotsOnTargetAway;
    const shH = stats?.shotsHome;
    const shA = stats?.shotsAway;

    const attackH =
      sotH !== undefined && sotA !== undefined && sotH + sotA > 0
        ? sotH * 2.2 + (shH ?? sotH) * 0.45
        : shH !== undefined && shA !== undefined && shH + shA > 0
          ? shH
          : undefined;
    const attackA =
      sotH !== undefined && sotA !== undefined && sotH + sotA > 0
        ? sotA * 2.2 + (shA ?? sotA) * 0.45
        : shH !== undefined && shA !== undefined && shH + shA > 0
          ? shA
          : undefined;

    if (attackH !== undefined && attackA !== undefined && attackH + attackA >= 2) {
      // Suavização Bayesiana para evitar distorção nos primeiros minutos
      const priorStrength = sport === 'Hóquei' ? 8 : 5;
      const obsShotShare = (attackH + priorStrength * 0.5) / (attackH + attackA + priorStrength);
      const blendWeight = clamp(0.1 + t * 0.34, 0.1, 0.42);
      shareH = clamp(shareH * (1 - blendWeight) + obsShotShare * blendWeight, 0.16, 0.84);

      // Ritmo da partida (jogo aberto com muitos chutes vs jogo travado)
      const rawTotalShots = (shH ?? sotH ?? 0) + (shA ?? sotA ?? 0);
      if (rawTotalShots > 0 && t >= 0.15) {
        const expectedFullShots = sport === 'Hóquei' ? 60 : 23;
        const projectedShots = rawTotalShots / t;
        const tempoFactor = clamp(0.76 + 0.24 * (projectedShots / expectedFullShots), 0.78, 1.32);
        totalExpectedGoals *= tempoFactor;
      }
    }

    // 3. Ajuste por posse de bola (Futebol)
    if (sport === 'Futebol' && typeof stats?.possessionHome === 'number' && Number.isFinite(stats.possessionHome)) {
      const posEdge = clamp((stats.possessionHome - 50) / 100, -0.3, 0.3);
      shareH = clamp(shareH + posEdge * (0.1 + t * 0.08), 0.15, 0.85);
    }

    let lambdaH = totalExpectedGoals * shareH * rem;
    let lambdaA = totalExpectedGoals * (1 - shareH) * rem;

    // 4. Impacto real de cartão vermelho (expulsão reduz ataque próprio ~28% e aumenta o do rival ~24%)
    if (redH > 0) {
      lambdaH *= Math.pow(0.72, redH);
      lambdaA *= Math.pow(1.24, redH);
    }
    if (redA > 0) {
      lambdaA *= Math.pow(0.72, redA);
      lambdaH *= Math.pow(1.24, redA);
    }

    // 5. Urgência de reta final (quem perde por 1 gol pressiona e se expõe; na NHL puxa o goleiro)
    if (Math.abs(diff) === 1 && t >= 0.72) {
      const urgency = sport === 'Hóquei' ? 1.18 : 1.1;
      if (diff > 0) {
        lambdaA *= urgency;
        lambdaH *= 1.06;
      } else {
        lambdaH *= urgency;
        lambdaA *= 1.06;
      }
    }

    const maxK = sport === 'Hóquei' ? 14 : 10;
    const pmfH = poissonPmfs(lambdaH, maxK);
    const pmfA = poissonPmfs(lambdaA, maxK);

    let pH = 0;
    let pD = 0;
    let pA = 0;

    for (let k = 0; k <= maxK; k++) {
      for (let m = 0; m <= maxK; m++) {
        const prob = pmfH[k] * pmfA[m];
        const finalDiff = diff + k - m;
        if (finalDiff > 0) pH += prob;
        else if (finalDiff === 0) pD += prob;
        else pA += prob;
      }
    }

    const norm = Math.max(0.0001, pH + pD + pA);
    const fH = clamp(pH / norm, 0.025, 0.94);
    const fD = clamp(pD / norm, 0.025, 0.90);
    const fA = clamp(pA / norm, 0.025, 0.94);

    return {
      home: roundOdd(1 / (fH * overround)),
      draw: roundOdd(1 / (fD * overround)),
      away: roundOdd(1 / (fA * overround)),
    };
  }

  // Esportes 2-way (Basquete, Tênis, E-Sports, MMA, Vôlei) com ponderação de momentum/estatísticas
  const totalInv2 = invH + invA;
  const pH0 = clamp(invH / totalInv2, 0.08, 0.92);
  const pA0 = 1 - pH0;
  const priorLogit = Math.log(pH0 / pA0);

  let stdDev = 11;
  if (sport === 'Vôlei') stdDev = 1.25;
  else if (sport === 'Tênis') stdDev = 1.15;
  else if (sport === 'MMA') stdDev = 1.65;
  else if (sport === 'E-Sports') stdDev = Math.max(scoreHome, scoreAway) <= 4 ? 1.15 : 6.5;

  const minScale = stdDev > 4 ? 1.8 : 0.45;
  const remainingScale = Math.max(minScale, stdDev * Math.sqrt(rem));
  const priorPointsEdge = (priorLogit / 1.65) * stdDev * rem;

  let statsMomentum = 0;
  if (typeof stats?.possessionHome === 'number' && Number.isFinite(stats.possessionHome)) {
    statsMomentum += ((stats.possessionHome - 50) / 50) * 0.28;
  }
  if (
    typeof stats?.shotsHome === 'number' &&
    typeof stats?.shotsAway === 'number' &&
    stats.shotsHome + stats.shotsAway >= 4
  ) {
    const ratioEdge = (stats.shotsHome - stats.shotsAway) / (stats.shotsHome + stats.shotsAway);
    statsMomentum += ratioEdge * 0.35;
  }

  const z = (diff + priorPointsEdge) / remainingScale + statsMomentum * Math.sqrt(rem);
  const probH = clamp(1 / (1 + Math.exp(-1.7 * z)), 0.03, 0.97);
  const probA = 1 - probH;

  return {
    home: roundOdd(1 / (probH * overround)),
    away: roundOdd(1 / (probA * overround)),
  };
}

function formatEspnDateYmd(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date).replace(/-/g, '');
}

function formatBrazilMatchTime(isoDate: string): string {
  try {
    const matchDate = new Date(isoDate);
    const now = new Date();

    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const todayStr = dateFmt.format(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dateFmt.format(tomorrow);
    const targetStr = dateFmt.format(matchDate);

    const timeStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(matchDate);

    if (targetStr === todayStr) return `Hoje - ${timeStr}`;
    if (targetStr === tomorrowStr) return `Amanhã - ${timeStr}`;

    const dayMonth = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    }).format(matchDate);

    return `${dayMonth} - ${timeStr}`;
  } catch {
    return 'Em breve';
  }
}

function americanToDecimal(american?: string | number): number | null {
  if (american === undefined || american === null) return null;
  const val = typeof american === 'number' ? american : parseFloat(String(american));
  if (Number.isNaN(val) || val === 0) return null;
  if (val > 0) return Number((1 + val / 100).toFixed(2));
  return Number((1 + 100 / Math.abs(val)).toFixed(2));
}

function deriveHockeyBaseOdds(homeRecord?: string, awayRecord?: string): { home: number; draw: number; away: number } {
  const parseWinPct = (rec?: string) => {
    if (!rec) return 0.5;
    const parts = rec.split('-').map((n) => parseInt(n, 10));
    if (parts.length < 2 || parts.some(Number.isNaN)) return 0.5;
    const total = parts.reduce((a, b) => a + b, 0);
    return total > 0 ? parts[0] / total : 0.5;
  };

  const pctH = parseWinPct(homeRecord);
  const pctA = parseWinPct(awayRecord);
  const diff = (pctH - pctA) * 0.45 + 0.05; // leve fator casa
  const pH = clamp(0.41 + diff, 0.2, 0.65);
  const pA = clamp(0.36 - diff, 0.16, 0.58);
  const pD = clamp(1 - pH - pA, 0.18, 0.27);
  const sum = pH + pD + pA;

  return {
    home: roundOdd(1 / ((pH / sum) * 1.06)),
    draw: roundOdd(1 / ((pD / sum) * 1.06)),
    away: roundOdd(1 / ((pA / sum) * 1.06)),
  };
}

function mapHockeyPeriodLabel(period: number, displayClock?: string, detail?: string): string {
  const upperDetail = (detail || '').toUpperCase();
  if (upperDetail.includes('SO')) return 'Shootout';
  if (upperDetail.includes('OT') || period >= 4) {
    return displayClock && displayClock !== '0:00' ? `OT ${displayClock}` : 'Prorrogação (OT)';
  }
  if (upperDetail.includes('END') || upperDetail.includes('INT')) {
    return `Intervalo ${period}º Per`;
  }
  const clockPart = displayClock && displayClock !== '0:00' ? ` ${displayClock}` : '';
  return `${Math.max(1, period)}º Per${clockPart}`;
}

function extractShots(competitor: any): number | undefined {
  const stats = competitor?.statistics || [];
  const shotsStat = stats.find(
    (s: any) =>
      s?.name === 'shots' ||
      s?.name === 'shotsOnGoal' ||
      s?.abbreviation === 'SOG' ||
      s?.abbreviation === 'S'
  );
  if (!shotsStat) return undefined;
  const val = parseInt(shotsStat.displayValue, 10);
  return Number.isNaN(val) ? undefined : val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEspnHockeyEvent(ev: any): Match | null {
  try {
    const comp = ev.competitions?.[0];
    if (!comp) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home') || comp.competitors?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away') || comp.competitors?.[1];
    if (!homeComp?.team || !awayComp?.team) return null;

    const statusType = comp.status?.type || ev.status?.type || {};
    const state = statusType.state; // 'pre' | 'in' | 'post'
    const completed = statusType.completed === true;
    const isLive = state === 'in' && !completed;
    const isFinished = state === 'post' || completed;

    const nowDateStr = formatEspnDateYmd(new Date());
    const evDateStr = ev.date ? formatEspnDateYmd(new Date(ev.date)) : '';
    if (isFinished && evDateStr !== nowDateStr) {
      return null;
    }

    const oddsObj = comp.odds?.[0];
    const homeMl = americanToDecimal(oddsObj?.homeTeamOdds?.moneyLine ?? oddsObj?.moneyline?.home?.close?.odds);
    const awayMl = americanToDecimal(oddsObj?.awayTeamOdds?.moneyLine ?? oddsObj?.moneyline?.away?.close?.odds);
    const drawMl = americanToDecimal(oddsObj?.drawOdds?.moneyLine ?? oddsObj?.moneyline?.draw?.close?.odds);

    const fallbackBase = deriveHockeyBaseOdds(
      homeComp.records?.[0]?.summary,
      awayComp.records?.[0]?.summary
    );

    const decHome = homeMl && homeMl >= 1.05 ? homeMl : fallbackBase.home;
    const decAway = awayMl && awayMl >= 1.05 ? awayMl : fallbackBase.away;
    // NHL 3-way regulation empate tipicamente entre 3.70 e 4.45
    const balancedFactor = Math.max(0, 1 - Math.abs(decHome - decAway) * 0.25);
    const derivedDraw = roundOdd(4.35 - balancedFactor * 0.55);
    const baseOdds = {
      home: decHome,
      draw: drawMl && drawMl >= 1.5 ? drawMl : derivedDraw,
      away: decAway,
    };

    const scoreHome = isLive || isFinished ? parseInt(homeComp.score || '0', 10) : undefined;
    const scoreAway = isLive || isFinished ? parseInt(awayComp.score || '0', 10) : undefined;
    const period = comp.status?.period || ev.status?.period || 1;
    const displayClock = comp.status?.displayClock || ev.status?.displayClock;
    const shortDetail = statusType.shortDetail || '';
    const timeElapsed = isLive
      ? mapHockeyPeriodLabel(period, displayClock, shortDetail)
      : isFinished
      ? shortDetail.toUpperCase().includes('OT')
        ? 'Fim (OT)'
        : shortDetail.toUpperCase().includes('SO')
        ? 'Fim (SO)'
        : 'Fim de Jogo'
      : undefined;

    const venueName = comp.venue?.fullName;
    const venueCity = comp.venue?.address?.city;
    const venueText = venueName ? (venueCity ? `${venueName} • ${venueCity}` : venueName) : 'Arena NHL';

    const shotsH = extractShots(homeComp);
    const shotsA = extractShots(awayComp);
    const liveStats: Match['stats'] | undefined = isLive
      ? {
          shotsHome: shotsH ?? 12 + (scoreHome ?? 0) * 5,
          shotsAway: shotsA ?? 11 + (scoreAway ?? 0) * 5,
          ...(shotsH !== undefined ? { shotsOnTargetHome: shotsH } : {}),
          ...(shotsA !== undefined ? { shotsOnTargetAway: shotsA } : {}),
          detailLabel: 'Chutes ao Gol (SOG)',
        }
      : undefined;

    const odds =
      isLive && scoreHome !== undefined && scoreAway !== undefined
        ? computeLiveOddsFromScore({
            sport: 'Hóquei',
            scoreHome,
            scoreAway,
            progress: parseMatchProgress('Hóquei', timeElapsed),
            baseOdds,
            stats: liveStats,
          })
        : baseOdds;

    const homeName = homeComp.team.shortDisplayName || homeComp.team.displayName || homeComp.team.name;
    const awayName = awayComp.team.shortDisplayName || awayComp.team.displayName || awayComp.team.name;
    const homeAbbrev = (homeComp.team.abbreviation || homeName.slice(0, 3)).toUpperCase().slice(0, 4);
    const awayAbbrev = (awayComp.team.abbreviation || awayName.slice(0, 3)).toUpperCase().slice(0, 4);

    return {
      id: `espn-nhl-${ev.id}`,
      sport: 'Hóquei',
      league: 'NHL (EUA/Canadá)',
      countryFlag: '🏒',
      phase: 'Temporada Regular',
      venue: venueText,
      teamHome: homeName,
      teamAway: awayName,
      badgeHome: homeAbbrev,
      badgeAway: awayAbbrev,
      colorHome: homeComp.team.color ? `#${homeComp.team.color}` : '#0ea5e9',
      colorAway: awayComp.team.color ? `#${awayComp.team.color}` : '#f97316',
      logoHome: homeComp.team.logo,
      logoAway: awayComp.team.logo,
      isLive,
      isFinished,
      time: isLive ? 'AO VIVO' : isFinished ? timeElapsed || 'Fim de Jogo' : formatBrazilMatchTime(ev.date),
      timeElapsed,
      scoreHome,
      scoreAway,
      liveEvent: isLive
        ? `No gelo • ${homeName} ${scoreHome ?? 0} x ${scoreAway ?? 0} ${awayName}`
        : isFinished
        ? `Placar Final: ${homeName} ${scoreHome ?? 0} x ${scoreAway ?? 0} ${awayName}`
        : undefined,
      stats: liveStats,
      baseOdds,
      odds,
    };
  } catch {
    return null;
  }
}

/**
 * Busca jogos reais e ao vivo da NHL via API pública oficial da ESPN.
 */
export async function fetchRealHockeyMatches(forceRefresh = false): Promise<Match[]> {
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(HOCKEY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; data: Match[] };
        if (Date.now() - parsed.ts < HOCKEY_CACHE_TTL_MS && Array.isArray(parsed.data)) {
          return parsed.data;
        }
      }
    } catch {
      /* ignore cache errors */
    }
  }

  const dates: string[] = [];
  const base = new Date();
  for (let i = 0; i <= 3; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    dates.push(formatEspnDateYmd(d));
  }

  const seenIds = new Set<string>();
  const allMatches: Match[] = [];

  await Promise.all(
    dates.map(async (ymd) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${ymd}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const json = await res.json();
        const events = json.events || [];
        for (const ev of events) {
          const mapped = mapEspnHockeyEvent(ev);
          if (mapped && !seenIds.has(mapped.id)) {
            seenIds.add(mapped.id);
            allMatches.push(mapped);
          }
        }
      } catch {
        /* fallback silently if offline or CORS issue */
      }
    })
  );

  allMatches.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (Boolean(a.isFinished) !== Boolean(b.isFinished)) return a.isFinished ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  if (allMatches.length > 0) {
    try {
      localStorage.setItem(HOCKEY_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: allMatches }));
    } catch {
      /* ignore quota errors */
    }
  }

  return allMatches;
}
