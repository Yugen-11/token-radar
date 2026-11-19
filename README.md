[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Yugen-11/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Yugen-11/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — which pre-token protocol is worth farming next

Token Radar reads a sealed DefiLlama snapshot of 758 protocols and answers one question:
which protocol that records no token yet is worth farming, and what do I do about it? It
ranks 198 launch candidates by an implied token value, gives each one a concrete farm plan,
and presents it all in an offline dashboard.

## The model (radar-2)

Every row is scored by one function of the snapshot's own figures — no protocol name is ever
special-cased:

```
implied = round( tvl_usd x peer_ratio(category)
               x (1 + 0.4 x clamp(change_7d, -50, 150) / 100)
               x launch(age, growth)
               x (1 + 0.04 x min(chains - 1, 4)) )
```

- **Peer ratio.** What tokenized peers in the same category trade at, as market cap per dollar
  of TVL. Each peer's ratio is winsorized to [0.01, 1.00] first — a $6M-TVL protocol with a
  $2.6B token is noise, not a comparable — and the category median is used only when at least
  3 peers qualify (each with $10M+ of TVL). Thinner categories fall back to the market-wide
  median (0.169 on this snapshot). Clamped to [0.02, 0.50].
- **Growth.** Seven-day TVL growth, capped so one wild week (the snapshot's fastest grower is
  +4,448%) cannot decide the board.
- **Launch.** The chance the token comes soon, from how long the protocol has run with no
  token: `0.85 / (1 + age_years / 1.5)`, boosted by positive 7-day growth, clamped to
  [0.08, 0.85]. A six-month-old protocol scores ~0.68, a five-year-old one ~0.20.
- **Chains.** More chains reach more farmers, up to 1.16x.

On this snapshot the model prices the top candidate near $259M and the median row near
$2.0M — in line with what large launch tokens have actually been worth, not a made-up scale.
Implied value is an estimate of what a token would be worth if it traded like its peers:
not a price, not a promise a token comes, and never a figure make.fun states.

## Who is on the board

A launch candidate is a protocol that records no token (no market cap, no CoinGecko id, no
symbol) and is not an exchange, not a wrapped, staked or bridged product of a token that
already trades, and not a versioned pool of another protocol — the watchlist's own rule,
minus its TVL floor. All 40 watchlist slugs are on the board; the other 158 rows are the
early ones below the floor. Protocols whose token already trades are set aside in the
dashboard's Live token view, with their market caps and market-cap-per-TVL shown — that is
also where the peer ratios come from.

## Farm plans

Each row carries six steps, derived from the protocol's own record (category, chains, TVL,
age): the main action (supply for a lender, liquidity for a DEX, a curator vault for a risk
curator, a mint for an RWA protocol), a second leg, a weekly habit, a hold window of 30–60
days, and a claim-safety step. Every step states what it costs and how long it takes, with
gas priced by chain (Ethereum ~$8 a transaction, most L2s under $1, Solana ~$0.02). The
dashboard regenerates the same plan from the same derivation, so the board and the page
agree on every step.

## How to run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot-input/snapshot.json
```

The program reads the snapshot, writes `board.json` (196 rows) and `data.js` beside the
dashboard, copies `dashboard/` and `screenshots/` to the output directory, and writes
`dossier.json` with the vendored make.fun library. Serve the output directory and open
`dashboard/index.html` — the page works offline, with no network requests. Node 22,
standard library only.

## The dashboard

- **Farm next** — the five strongest rows as cards.
- **The board** — sortable by rank, implied value, TVL, 7-day change and age; filterable by
  category and chain, searchable, with a watchlist-only toggle.
- **Detail view** — the implied-value breakdown (TVL × peer ratio, growth, launch and chain
  factors, with the page recomputing the row and checking the board's number), plus the
  six-step farm plan.
- **Live token** — the tokenized comparables, set aside from the ranking.

## Files

- `main.ts` — the entry program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-2 model, the farm-plan derivation, and the board checks.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the offline dashboard.
- `snapshot-input/` — the sealed snapshot this entry was built and graded on.
- `vendor/makefun-board.ts` — make.fun's dossier library, untouched.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=4ab68p3v&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
