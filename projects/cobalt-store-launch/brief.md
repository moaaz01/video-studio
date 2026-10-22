# متجرك باسمك — Cobalt Ledger brief

> Direction: **Cobalt Ledger** — a deep cobalt data-film with silver chrome, ivory
> Arabic and one champagne thread. Not green: the stage is navy/cobalt, the product's
> teal stays inside its own screens, and saffron is reserved for money. 48.00 s,
> 24 bars at 120 BPM, one continuous move. The cut explains *how the store makes
> money*, not just that it exists.

## `<inputs>` — what is known

- **Product:** a complete digital-products store inside Telegram (Mini App). Buyer
  browses, pays from the wallet or an external method, receives a code. Owner runs
  products, sources, pricing, orders, broadcast and stats from the same phone.
- **Audience:** an Arabic-speaking reseller who already sells game top-ups, cards,
  numbers and subscriptions by hand. He cares about **margin**, **sourcing**,
  **payment coverage** and **setup speed**.
- **The one promise:** one shop, many sources, many payment methods, automatic
  pricing, and the owner in control — without an app or a website.
- **The one action:** message `t.me/abumooaz1` or WhatsApp `+90 552 855 2420` for the
  store or more details. No price is stated in the film.
- **Aspects/length:** 16:9 1920×1080, 9:16 1080×1920, 1:1 1080×1080; 48.00 s,
  1440 frames, 30 fps.
- **Voice:** Damascene male, Fish **drama-3**, fully vocalised, temperature 0.6,
  per-line speed lifts; ASR-gated. The same voice as the approved emerald cut.
- **Facts I may print:** the real setup steps (`store.setup.ts`), the 15-minute guide
  (`guides.ts`, conditioned on keys), the real payment templates (`ARCHITECTURE`
  §payment_methods), source linking / cheapest / priority / silent fallback / margin
  / automatic price rise / decrease notification (R67, R24, R23, D6, D7), the
  multi-currency model (D17), and the owner's orders/broadcast/stats.
- **Facts I must not print:** supplier names, live prices as if real, invented
  ratings/users/awards, "free", "0% commission", end-to-end encryption, AI claims.

## `<direction>` — the feel

- **Cobalt Ledger** — a private trading desk at night. A thin champagne ledger line
  runs through every scene: it becomes the setup path, the price line, the source
  graph and the ticket perforation. Glass data cards, not floating screenshots.
- **Type:** Tajawal 700/800 for headlines, IBM Plex Sans Arabic for body, Reem Kufi
  only inside the product UI. Whole words, no tracking, no letter animation.
- **Colour:** cobalt `#0B1730`, ink `#040814`, ivory `#F3F7FF`, ice `#9CC8FF`,
  champagne `#F2A93B` (money only), brand teal `#0F7C80` (inside the phone only).
- **Motion:** 120 BPM; a data event per bar. A tight maskline, a flood, an iris and a
  blur hand-off; one camera move per beat. No glitch, no neon, no random particles.
- **Banned:** green stage, generic tech grid, fake supplier logos, unlabelled live
  prices, letter-by-letter Arabic, dead holds, feature bullets without a visual.

## `<structure>` — the clock (24 bars = 48.00 s)

| bars | time | kind | what happens | the value |
|---|---|---|---|---|
| 0–3 | 0–6 | open | Cobalt stage, a Telegram bubble becomes the shop, real product page | متجرك الرقمي… جاهز باسمك |
| 3–7 | 6–14 | setup | Wizard checklist: identity, currency, payments, sources, products, launch; ring 6/6; ≈15 min | من أول خطوة… إلى الإطلاق |
| 7–12 | 14–24 | store | Buyer path home→product→checkout→paid; payment-method ticker/row around the phone | يشتري… يدفع… ويستلم |
| 12–17 | 24–34 | sources | 3 source cards → product; cheapest switches; 15% margin; source cost rises; price auto-updates; fallback line | من عدة مصادر… أفضل سعر وأعلى ربح |
| 17–21 | 34–42 | admin | Owner phone: orders, broadcast, stats; floating KPIs | كل شيء… تحت سيطرتك |
| 21–24 | 42–48 | finale | Contact ticket, no price; “more details or your store” | للمزيد… تواصل معنا على الخاص |

## `<build>`

- Tokens from `src/store/tokens.ts`; real wizard labels from `store.setup.ts`;
  real payments from `ARCHITECTURE.md`; real source rules from `docs/PLAN.md` D6/D7
  and `docs/REQUIREMENTS.md` R23/R24/R67.
- Numbers in the source scene are a **worked example**, labelled «مثال»:
  $8.20 / $8.45 / $8.60 cost, 15% margin → $9.43; a rise to $8.45 cheapest →
  $9.72. The card never presents them as live quotes.
- Voice: `drama-3` + damascus-m; six lines, 41.2 s of speech; ASR 0.985 worst;
  light EQ/de-esser/compressor after synthesis.
- Score: `make_bed.py --style souk-drop`, 48 s, mapped to open/setup→hook,
  store→drop, sources→machine room, admin→drop, finale→widest drop.
- Stills at every beat before render; `advise --strict`; `qa.py`; `safe_area`.

## `<gotchas>`

1. **The data scene must stay legible.** The source graph is the hero; do not let the
   product card cover the headline or the price panel. Check every aspect at 1:1.
2. **The CTA has no price.** Say “للحصول على متجرك أو لمزيد من التفاصيل — تواصل معنا
   على الخاص.” Never “السعر على الخاص”.
3. **The voice is the product.** The ر in «متجرك», the ة at the end of a pause, the
   clusters in «بث إشعارات» and «الأمان والتشفير» are tested; never ship a take that
   has not passed ASR and a 1:1 listen.
