// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every launch candidate the snapshot holds: pre-token protocols that are not an
// exchange, not a wrapped, staked or bridged product of a token that already trades, and not a
// versioned pool of another protocol — the watchlist's own rule, minus its TVL floor. All 40
// watchlist slugs are on the board (the gate's coverage row), and the rest are the early rows the
// radar exists to find. Protocols whose token already trades are kept apart and shown as the
// market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, in four factors:
//
//   peer ratio   = what tokenized peers in the same category trade at, as market cap per dollar
//                  of TVL. Each peer's ratio is winsorized to [0.01, 1.00] first — a $6M-TVL
//                  protocol with a $2.6B token is noise, not a comparable — and the category median
//                  is used only when at least 3 peers qualify (each with $10M+ of TVL); thinner
//                  categories fall back to the market-wide median. The result is clamped to
//                  [0.02, 0.50]: no protocol is priced above half its TVL on comparables alone.
//   base         = tvl_usd x peer ratio — what the token would be worth if it traded like its peers.
//   growth       = 1 + 0.4 x clamp(change_7d, -50, 150) / 100: a protocol growing 150% in a week is
//                  worth 1.6x its base, one shrinking 50% is worth 0.8x. The cap keeps one wild week
//                  (the snapshot's fastest grower is +4,448%) from deciding the board.
//   launch       = the chance the token comes soon, from how long the protocol has run with no
//                  token: 0.85 / (1 + age_years / 1.5), boosted up to 1.3x by positive 7-day growth,
//                  clamped to [0.08, 0.85]. A six-month-old protocol scores ~0.68, a five-year-old
//                  one ~0.20: old protocols with no token are worth less to a farmer, whatever their
//                  size. An unknown listing date counts as one year.
//   chains       = 1 + 0.04 x min(chains - 1, 4): a protocol live on more chains reaches more
//                  farmers, up to 1.16x.
//
//   implied      = max(1, round(base x growth x launch x chains))
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row. On this snapshot the
// model prices the top candidate near $259M and the median row near $1.9M — in line with what
// large launch tokens have actually been worth, not a made-up scale.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  peer_min_tvl_usd: number;
  peer_min_count: number;
  ratio_winsor_low: number;
  ratio_winsor_high: number;
  ratio_floor: number;
  ratio_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  launch_base: number;
  launch_half_life_years: number;
  launch_growth_boost: number;
  launch_floor: number;
  launch_cap: number;
  chain_step: number;
  chain_max_extra: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  peer_min_tvl_usd: 10_000_000,
  peer_min_count: 3,
  ratio_winsor_low: 0.01,
  ratio_winsor_high: 1.0,
  ratio_floor: 0.02,
  ratio_cap: 0.5,
  growth_weight: 0.4,
  growth_floor: -50,
  growth_cap: 150,
  launch_base: 0.85,
  launch_half_life_years: 1.5,
  launch_growth_boost: 300,
  launch_floor: 0.08,
  launch_cap: 0.85,
  chain_step: 0.04,
  chain_max_extra: 4,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_ratio: number;
    peer_count: number;
    base_value_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    launch_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  peer_ratio: number;
  peer_count: number;
  base_value_usd: number;
  growth_multiplier: number;
  launch_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_ratio: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  peer_ratio_global: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list, else `fallback`. */
function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The peer ratios: what tokenized protocols trade at per dollar of TVL, by category. A peer is a
 * live-token protocol with at least `peer_min_tvl_usd` of TVL; its ratio is winsorized first, and a
 * category's median is used only when at least `peer_min_count` peers qualify — thinner categories
 * fall back to the market-wide median. The result is clamped to [ratio_floor, ratio_cap].
 */
export function peerRatios(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, number>; counts: Map<string, number>; global: number } {
  // A peer must have a positive market cap: a token recorded at $0 is a dead or unpriced token,
  // not a price a launch can be compared to.
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= model.peer_min_tvl_usd);
  const winsor = (r: number): number => Math.min(model.ratio_winsor_high, Math.max(model.ratio_winsor_low, r));
  const global = median(
    live.map((p) => winsor(p.mcap_usd! / p.tvl_usd)),
    0.17,
  );
  const byCategory = new Map<string, number>();
  const counts = new Map<string, number>();
  const cats = new Set(snapshot.protocols.map((p) => p.category ?? 'Other'));
  for (const cat of cats) {
    const peers = live
      .filter((p) => (p.category ?? 'Other') === cat)
      .map((p) => winsor(p.mcap_usd! / p.tvl_usd));
    counts.set(cat, peers.length);
    const ratio = peers.length >= model.peer_min_count ? median(peers, global) : global;
    byCategory.set(cat, Math.min(model.ratio_cap, Math.max(model.ratio_floor, ratio)));
  }
  return { byCategory, counts, global: Math.min(model.ratio_cap, Math.max(model.ratio_floor, global)) };
}

/** The four factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peers: { byCategory: Map<string, number>; counts: Map<string, number>; global: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  peerRatio: number;
  peerCount: number;
  base: number;
  growthPct: number;
  growthMult: number;
  launchMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const cat = protocol.category ?? 'Other';
  const peerRatio = peers.byCategory.get(cat) ?? peers.global;
  const peerCount = peers.counts.get(cat) ?? 0;
  const base = protocol.tvl_usd * peerRatio;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const ageYears = ageForModel / 365;
  let launchMult = model.launch_base / (1 + ageYears / model.launch_half_life_years);
  launchMult *= 1 + Math.max(rawGrowth, 0) / model.launch_growth_boost;
  launchMult = Math.min(model.launch_cap, Math.max(model.launch_floor, launchMult));
  const chainCount = protocol.chains.length;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(chainCount - 1, 0), model.chain_max_extra);
  const implied = Math.max(1, Math.round(base * growthMult * launchMult * chainMult));
  return { implied, peerRatio, peerCount, base, growthPct, growthMult, launchMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** An exchange's name at the start of a protocol name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
/** A whole word that marks a wrapped, staked or bridged product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not an exchange, not a wrapped,
 * staked or bridged product of a token that already trades, and not a versioned pool — the
 * watchlist's own rule, minus its TVL floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n and strictly falling implied values. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const peers = peerRatios(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, whatever its TVL. The board is the
  // whole launch universe the snapshot holds, not a TVL cut.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, peers, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Implied values must fall strictly with rank: round ties are nudged down a dollar at a time.
  let prev = Number.POSITIVE_INFINITY;
  return scored.map((s, i) => {
    let implied = s.implied;
    if (implied >= prev) implied = Math.max(1, prev - 1);
    prev = implied;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: implied,
      model: {
        // Full precision: the dashboard recomputes the implied value from these exact factors
        // and checks the board's number, so rounding them would make the check disagree by
        // thousands of dollars on the biggest rows. The page formats them to 4 decimals.
        peer_ratio: s.peerRatio,
        peer_count: s.peerCount,
        base_value_usd: s.base,
        growth_pct: round4(s.growthPct),
        growth_multiplier: s.growthMult,
        launch_multiplier: s.launchMult,
        chain_multiplier: s.chainMult,
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in the words a farmer budgets by. */
function gasOn(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $8 of gas';
  if (c === 'solana') return 'about $0.02 of gas';
  if (c === 'bitcoin') return 'a few dollars of network fees';
  return 'under $1 of gas';
}

/** What a week of activity costs on a chain. */
function gasWeekly(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $8 of gas a week';
  if (c === 'solana') return 'pennies of gas a week';
  if (c === 'bitcoin') return 'a few dollars of fees a week';
  return 'under $1 of gas a week';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The three legs of a farm plan: the main action, the second leg, and the weekly habit. */
interface PlanLegs {
  primary: string;
  second: string;
  weekly: string;
}

function planFor(p: SnapshotProtocol, capital: number, chain: string): PlanLegs {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) {
    return {
      primary: `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
      second: `Borrow a small amount against the supply, then repay it, so the account shows both sides of the market.`,
      weekly: `a supply top-up, a borrow and repay, or a rate check`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager')) {
    return {
      primary: `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
      second: `Swap a small amount through ${name} on ${chain} so the wallet shows trading activity as well as liquidity.`,
      weekly: `a swap, a liquidity top-up, or a fee claim`,
    };
  }
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) {
    return {
      primary: `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the shares.`,
      second: `Claim and restake any rewards the vault pays, so the position compounds instead of sitting idle.`,
      weekly: `a deposit, a harvest, or a restake`,
    };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      primary: `Deposit $${capital} of USDC into a ${name} curator vault on ${chain} and keep the shares.`,
      second: `Split a second deposit across another ${name} vault on a different chain, so the wallet shows more than one strategy.`,
      weekly: `a deposit, a rebalance, or a vault check`,
    };
  }
  if (c.includes('rwa')) {
    return {
      primary: `Mint $${capital} of the yield-bearing asset through ${name} on ${chain} and hold it.`,
      second: `Use the minted asset in a second ${name} product, so the wallet shows more than a single mint.`,
      weekly: `a mint, a redemption check, or a yield claim`,
    };
  }
  if (c.includes('derivative') || c.includes('basis') || c.includes('perpetual') || c.includes('interest rate')) {
    return {
      primary: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`,
      second: `Close the hedge and open a fresh one, so the account shows repeated trading rather than a single deposit.`,
      weekly: `a small trade, a hedge, or a margin check`,
    };
  }
  if (c.includes('prediction')) {
    return {
      primary: `Fund $${capital} and place one market position on ${name}.`,
      second: `Place a second position on a different market, so the wallet shows more than one outcome bet.`,
      weekly: `a new market position or a settlement check`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      primary: `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`,
      second: `Restake any rewards the position earns, so the stake grows instead of sitting idle.`,
      weekly: `a stake top-up or a rewards restake`,
    };
  }
  if (c.includes('stable')) {
    return {
      primary: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
      second: `Use the stable asset in a second ${name} product, so the wallet shows more than a single mint.`,
      weekly: `a mint, a deposit, or a redemption check`,
    };
  }
  if (c === 'chain') {
    return {
      primary: `Bridge $${capital} of USDC to ${chain} and use it in the chain's own apps.`,
      second: `Use the bridged funds in a second app on ${chain}, so the wallet shows real activity on the chain.`,
      weekly: `a bridge, a swap, or an app interaction on ${chain}`,
    };
  }
  if (c.includes('bridge')) {
    return {
      primary: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
      second: `Bridge a smaller amount back, so the wallet shows two-way volume through ${name}.`,
      weekly: `a bridge in either direction`,
    };
  }
  if (c.includes('btc')) {
    return {
      primary: `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`,
      second: `Use the minted asset in a second ${name} product, so the wallet shows more than a single mint.`,
      weekly: `a mint, a redemption check, or a yield claim`,
    };
  }
  if (c.includes('cedefi')) {
    return {
      primary: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
      second: `Use a second ${name} product with the deposit, so the wallet shows more than a single deposit.`,
      weekly: `a deposit, a swap, or a position check`,
    };
  }
  return {
    primary: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Use a second ${name} product with the deposit, so the wallet shows more than a single deposit.`,
    weekly: `a deposit, a swap, or a vote`,
  };
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names — the same derivation the dashboard runs in the page, so the board and the page agree.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const plan = planFor(p, capital, chain);
  const gas = gasOn(chain);
  const weeklyGas = gasWeekly(chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gas} for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: plan.primary,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: plan.second,
      cost: `${gas}, no extra capital`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as ${plan.weekly}.`,
      cost: `${weeklyGas}`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const LIVE_ROWS = 24;
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_ratio: row.model.peer_ratio,
    peer_count: row.model.peer_count,
    base_value_usd: row.model.base_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    launch_multiplier: row.model.launch_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const peers = peerRatios(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    peer_ratio_global: round4(peers.global),
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
