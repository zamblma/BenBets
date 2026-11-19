import { Match } from '../types';

const CACHE_KEY = 'benbets_br_football_api_v2';
const CACHE_TTL_MS = 60 * 1000;

interface LeagueDef {
  slug: string;
  label: string;
  flag: string;
}

const BRAZILIAN_LEAGUES: LeagueDef[] = [
  { slug: 'bra.1', label: 'Brasileirão Série A', flag: '🇧🇷' },
  { slug: 'bra.2', label: 'Brasileirão Série B', flag: '🇧🇷' },
  { slug: 'bra.copa_do_brazil', label: 'Copa do Brasil', flag: '🇧🇷' },
  { slug: 'conmebol.libertadores', label: 'CONMEBOL Libertadores', flag: '🌎' },
  { slug: 'conmebol.sudamericana', label: 'CONMEBOL Sul-Americana', flag: '🌎' },
];

let memoryCache: { ts: number; matches: Match[] } | null = null;
let inflightPromise: Promise<Match[]> | null = null;

function formatEspnDateYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}${m}${d}`;
}

function formatBrazilMatchTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Em breve';

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400_000);
  const targetYmd = formatEspnDateYmd(d);
  const todayYmd = formatEspnDateYmd(now);
  const tomorrowYmd = formatEspnDateYmd(tomorrow);

  const hhmm = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  if (targetYmd === todayYmd) return `Hoje - ${hhmm}`;
  if (targetYmd === tomorrowYmd) return `Amanhã - ${hhmm}`;

  const ddmm = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  return `${ddmm} - ${hhmm}`;
}

function americanToDecimal(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim().toUpperCase();
  if (!str) return null;
  if (str === 'EVEN' || str === 'EV') return 2.0;
  const num = Number(str);
  if (!Number.isFinite(num) || num === 0) return null;
  const dec = num > 0 ? 1 + num / 100 : 1 + 100 / Math.abs(num);
  return Number(Math.max(1.05, Math.min(25, dec)).toFixed(2));
}

function calcFormPoints(form?: string): number {
  if (!form || typeof form !== 'string') return 7;
  let pts = 0;
  for (const ch of form.slice(-5).toUpperCase()) {
    if (ch === 'W') pts += 3;
    else if (ch === 'D') pts += 1;
  }
  return pts;
}

function deriveOddsFromForm(homeForm?: string, awayForm?: string) {
  const hPts = calcFormPoints(homeForm);
  const aPts = calcFormPoints(awayForm);
  const diff = Math.max(-9, Math.min(9, hPts - aPts));

  const drawProb = 0.28 - Math.abs(diff) * 0.005;
  const homeShare = 0.56 + diff * 0.025; // slight home field edge
  const remaining = 1 - drawProb;
  const homeProb = Math.max(0.14, Math.min(0.75, remaining * homeShare));
  const awayProb = Math.max(0.14, 1 - drawProb - homeProb);

  const margin = 0.94;
  return {
    home: Number(Math.max(1.22, Math.min(12.0, margin / homeProb)).toFixed(2)),
    draw: Number(Math.max(2.6, Math.min(6.5, margin / drawProb)).toFixed(2)),
    away: Number(Math.max(1.22, Math.min(12.0, margin / awayProb)).toFixed(2)),
  };
}

function normalizeTeamColor(hex?: string, fallback = '#00ff87'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
  // Pure/near black isn't visible on dark #070910 background
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (r + g + b < 85) return '#cbd5e1';
  return `#${clean}`;
}

function findStatNumber(stats: any[], names: string[]): number | undefined {
  if (!Array.isArray(stats)) return undefined;
  for (const s of stats) {
    if (s && names.includes(String(s.name))) {
      const n = parseFloat(String(s.displayValue));
      if (Number.isFinite(n)) return Math.round(n);
    }
  }
  return undefined;
}

function mapEspnEventToMatch(ev: any, leagueDef: LeagueDef): Match | null {
  const comp = ev?.competitions?.[0];
  if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) return null;

  const state = comp?.status?.type?.state;
  const completed = Boolean(comp?.status?.type?.completed);
  if (completed || state === 'post') return null;

  const homeComp = comp.competitors.find((c: any) => c.homeAway === 'home') || comp.competitors[0];
  const awayComp = comp.competitors.find((c: any) => c.homeAway === 'away') || comp.competitors[1];

  const homeTeam = homeComp?.team || {};
  const awayTeam = awayComp?.team || {};
  const teamHome = String(homeTeam.shortDisplayName || homeTeam.displayName || 'Casa');
  const teamAway = String(awayTeam.shortDisplayName || awayTeam.displayName || 'Fora');

  const badgeHome = String(homeTeam.abbreviation || teamHome.slice(0, 3)).toUpperCase().slice(0, 3);
  const badgeAway = String(awayTeam.abbreviation || teamAway.slice(0, 3)).toUpperCase().slice(0, 3);

  const isLive = state === 'in';
  const rawH = parseInt(String(homeComp?.score ?? '0'), 10);
  const rawA = parseInt(String(awayComp?.score ?? '0'), 10);
  const scoreHome = isLive && Number.isFinite(rawH) ? rawH : isLive ? 0 : undefined;
  const scoreAway = isLive && Number.isFinite(rawA) ? rawA : isLive ? 0 : undefined;

  const displayClock = comp?.status?.displayClock;
  const statusShort = comp?.status?.type?.shortDetail;
  const timeElapsed = isLive
    ? displayClock && displayClock !== "0'"
      ? String(displayClock)
      : statusShort && !/scheduled/i.test(statusShort)
      ? String(statusShort)
      : 'Em andamento'
    : undefined;

  // Real Moneyline Odds -> Decimal
  const oddsObj = Array.isArray(comp.odds) ? comp.odds[0] : undefined;
  const ml = oddsObj?.moneyline;
  const decHome = americanToDecimal(ml?.home?.close?.odds ?? ml?.home?.open?.odds);
  const decDraw = americanToDecimal(ml?.draw?.close?.odds ?? ml?.draw?.open?.odds ?? oddsObj?.drawOdds?.moneyLine);
  const decAway = americanToDecimal(ml?.away?.close?.odds ?? ml?.away?.open?.odds);

  const fallbackOdds = deriveOddsFromForm(homeComp?.form, awayComp?.form);
  const odds = {
    home: decHome ?? fallbackOdds.home,
    draw: decDraw ?? fallbackOdds.draw,
    away: decAway ?? fallbackOdds.away,
  };

  // Real statistics & play details
  const posHome = findStatNumber(homeComp?.statistics, ['possessionPct']);
  const shotsHome = findStatNumber(homeComp?.statistics, ['totalShots', 'shotsOnTarget']);
  const shotsAway = findStatNumber(awayComp?.statistics, ['totalShots', 'shotsOnTarget']);

  let liveEvent: string | undefined;
  if (isLive) {
    const details = Array.isArray(comp.details) ? comp.details : [];
    const latest = details[details.length - 1];
    if (latest) {
      const clockText = latest?.clock?.displayValue ? `${latest.clock.displayValue} ` : '';
      const player = latest?.athletesInvolved?.[0]?.shortName || '';
      const typeText = latest?.type?.text || 'Lance';
      const icon = latest?.scoringPlay ? '⚽' : latest?.redCard ? '🟥' : latest?.yellowCard ? '🟨' : '🔥';
      liveEvent = `${icon} ${clockText}${typeText}${player ? ` (${player})` : ''}`.trim();
    } else if (homeComp?.form || awayComp?.form) {
      liveEvent = `📊 Forma recente: ${badgeHome} ${homeComp?.form || '-'} × ${badgeAway} ${awayComp?.form || '-'}`;
    } else {
      liveEvent = `⚽ Partida em andamento — ${comp?.venue?.fullName || leagueDef.label}`;
    }
  } else if (homeComp?.form && awayComp?.form) {
    liveEvent = `📊 Últimos 5 jogos: ${badgeHome} (${homeComp.form}) × ${badgeAway} (${awayComp.form})`;
  }

  const venueName = comp?.venue?.fullName
    ? comp?.venue?.address?.city
      ? `${comp.venue.fullName} • ${comp.venue.address.city}`
      : String(comp.venue.fullName)
    : undefined;

  const roundNum = ev?.week?.number ? `Rodada ${ev.week.number}` : comp?.notes?.[0]?.headline;
  const phase = typeof roundNum === 'string' && roundNum.trim() ? roundNum.trim() : 'Temporada Oficial';

  return {
    id: `espn-${ev.id}`,
    sport: 'Futebol',
    league: leagueDef.label,
    countryFlag: leagueDef.flag,
    phase,
    venue: venueName,
    teamHome,
    teamAway,
    badgeHome,
    badgeAway,
    colorHome: normalizeTeamColor(homeTeam.color, '#00ff87'),
    colorAway: normalizeTeamColor(awayTeam.color, '#38bdf8'),
    logoHome: typeof homeTeam.logo === 'string' ? homeTeam.logo : undefined,
    logoAway: typeof awayTeam.logo === 'string' ? awayTeam.logo : undefined,
    time: isLive ? 'Ao Vivo' : formatBrazilMatchTime(comp.date || ev.date),
    isLive,
    scoreHome,
    scoreAway,
    timeElapsed,
    liveEvent,
    stats:
      posHome !== undefined || shotsHome !== undefined
        ? {
            possessionHome: posHome ?? 50,
            shotsHome: shotsHome ?? 0,
            shotsAway: shotsAway ?? 0,
            detailLabel: 'Posse % • Finalizações',
          }
        : undefined,
    odds,
  };
}

function readLocalCache(): Match[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.ts === 'number' &&
      Date.now() - parsed.ts < CACHE_TTL_MS &&
      Array.isArray(parsed.matches)
    ) {
      return parsed.matches;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchBrazilianFootballMatches(forceRefresh = false): Promise<Match[]> {
  if (!forceRefresh) {
    if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL_MS) {
      return memoryCache.matches;
    }
    const local = readLocalCache();
    if (local && local.length > 0) {
      memoryCache = { ts: Date.now(), matches: local };
      return local;
    }
  }

  if (inflightPromise && !forceRefresh) return inflightPromise;

  inflightPromise = (async () => {
    const today = new Date();
    const requestSpecs: { league: LeagueDef; url: string }[] = [];

    for (const lg of BRAZILIAN_LEAGUES) {
      requestSpecs.push({
        league: lg,
        url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard`,
      });
    }

    // Fetch next 3 single days for Brasileirão Série A & B (ESPN supports single YYYYMMDD dates cleanly)
    for (const offset of [1, 2, 3]) {
      const ymd = formatEspnDateYmd(new Date(today.getTime() + offset * 86400_000));
      for (const lg of BRAZILIAN_LEAGUES.slice(0, 2)) {
        requestSpecs.push({
          league: lg,
          url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${ymd}`,
        });
      }
    }

    const results = await Promise.allSettled(
      requestSpecs.map(async ({ league, url }) => {
        const res = await fetch(url);
        if (!res.ok) return [] as Match[];
        const data = await res.json();
        const events = Array.isArray(data?.events) ? data.events : [];
        return events
          .map((ev: any) => mapEspnEventToMatch(ev, league))
          .filter((m: Match | null): m is Match => m !== null);
      })
    );

    const seen = new Set<string>();
    const combined: Match[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const m of r.value) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            combined.push(m);
          }
        }
      }
    }

    // Put live matches first, then preserve chronological order
    combined.sort((a, b) => Number(b.isLive) - Number(a.isLive));

    if (combined.length > 0) {
      memoryCache = { ts: Date.now(), matches: combined };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
      } catch {
        /* ignore quota */
      }
    }

    inflightPromise = null;
    return combined;
  })().catch(() => {
    inflightPromise = null;
    return memoryCache?.matches || [];
  });

  return inflightPromise;
}
