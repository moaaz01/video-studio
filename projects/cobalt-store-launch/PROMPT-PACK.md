# Prompt pack v2 — Cobalt Ledger / feature film

A prompt pack for the **deeper 48-second cut**: sourcing, margin, automatic price
updates, payment coverage and quick setup. It is split into two layers:

1. **Code-rendered data film** (Remotion / HTML / SVG): the cards, the source graph,
   the price line, the setup checklist. This is the layer that carries Arabic and
   numbers, so it must be code — a video model will mangle both.
2. **Generative b-roll** (Veo / Kling / Runway / Midjourney): the cobalt room, chrome,
   glass, light and camera. No UI, no Arabic, no prices.

**Rule zero:** never let a video model render Arabic UI or a price. Composite the
real UI and the real type in code.

---

## 1 · Cobalt Ledger visual DNA

| token | value | use |
|---|---|---|
| Cobalt night | `#0B1730` | stage |
| Ink navy | `#040814` | deepest shadow |
| Ivory | `#F3F7FF` | headline, body |
| Ice blue | `#9CC8FF` | secondary emphasis, data |
| Champagne | `#F2A93B` | money, one CTA line |
| Brand teal | `#0F7C80` | inside the product UI only |
| Profit mint | `#7FE3C0` | profit numbers |
| Display | Tajawal 700/800 | headlines |
| Body | IBM Plex Sans Arabic | labels, captions |
| Product | Reem Kufi + IBM Plex | phone screens only |

**Material family:** smoked-glass data cards, one thin champagne ledger line, a
liquid-chrome ribbon in the background, a silver sphere at the edge. No green room,
no neon, no generic tech grid.

**Editing:** 120 BPM, 24 bars, one data event per bar. Maskline → flood → iris → blur.
One camera move per beat. A still at every beat before any render.

---

## 2 · Master prompt — 48s Cobalt Ledger film (for a code agent)

Copy this into Claude Code / OpenCode / any agent that can write and render code.

```text
You are a motion designer and creative director. Build a 48-second, 24-bar,
120 BPM product film in code (Remotion + React + SVG; no stock footage, no video
model, no external images).

<subject>
A complete digital-products store that lives inside Telegram. The audience is an
Arabic-speaking reseller who sells game top-ups, cards, numbers and subscriptions
by hand. The film must explain, in this order:
1) the shop is his, with his name and identity;
2) setup is a guided checklist from identity to launch (about 15 minutes when the
   payment/source keys are ready);
3) buyers pay from the wallet or a wide range of payment methods;
4) one product can be linked to several API sources, routed by cheapest or priority,
   with a margin and automatic repricing when a source cost rises;
5) the owner runs orders, profit, notifications and broadcast from the same phone;
6) the CTA is "for more details or your store, message us privately".
</subject>

<direction>
Cobalt Ledger: deep navy/cobalt stage, ivory Arabic display type (Tajawal 700/800),
IBM Plex Sans Arabic body, one champagne ledger line, smoked-glass data cards,
liquid-chrome ribbon and a silver sphere at the edge. Saffron is money only. Not
green. No neon, no glitch, no generic tech grid. Formal, expensive, editorial.
</direction>

<structure>
24 bars of 2.0 s:
0–6 open: Telegram bubble → phone on a real product page; headline "متجرك الرقمي…
       جاهز باسمك."
6–14 setup: a glass wizard board with the real steps: هوية المتجر، العملة وسعر
       الليرة، وسائل الدفع، المصادر، المنتجات، الإطلاق. Ring 6/6. "≈ 15 دقيقة"
       with the condition "إذا كانت المفاتيح جاهزة". Launch button.
14–24 store: buyer path home → product → checkout → paid; a payment-method ticker
       with محفظة المتجر، شام كاش، سيريتل كاش، MTN كاش، USDT، Binance Pay، تحويل بنكي.
24–34 sources: three source cards (مصدر ١/٢/٣) with costs $8.20/$8.45/$8.60; a product
       card "شدّات ببجي · 660 UC" with a 15% margin and sale $9.43; the cheapest badge
       switches when source 1 rises to $8.70; the sale price counts to $9.72; an
       amber alert "ارتفع سعر المصدر — انتقلنا للأرخص وحدّثنا سعر البيع". A line:
       "إن تعذّر: التالي تلقائياً". Wide only: "عند انخفاض التكلفة نُبلغك…".
34–42 owner: phone with orders, broadcast, stats; floating KPI cards.
42–48 finale: contact ticket with t.me/abumooaz1 and wa.me/905528552420; the line
       "للمزيد من التفاصيل أو لمتجرك — تواصل معنا على الخاص." No price anywhere.
</structure>

<type>
Tajawal 700/800 for headlines; line-height 1.28–1.35; no tracking; no per-letter
animation. IBM Plex Sans Arabic 400/500 for body. Reem Kufi only inside the product
phone. Every headline is whole words; the accent word is saffron only when it is
money, otherwise ice blue.
</type>

<build>
1. One Remotion project; every scene a pure function of frame.
2. Use real UI components for the phone and the product card; use SVG data cards for
   the source graph and setup board.
3. The ledger line is one SVG path that changes function per scene: setup path,
   source graph edges, ticket perforation. Animate stroke-dashoffset, never random.
4. Render one PNG still per beat at 1:1; inspect Arabic clipping, overlaps and price
   alignment before the full render.
5. Music: 120 BPM, dark sub intro, four-on-the-floor drop at 14 s, machine room at
   24 s, widest drop at 42 s. Duck under the voice.
6. Voice: warm Damascene male, fully vocalised; ASR-gate every line; no price claim.
</build>

<gotchas>
Never let the product card cover the headline or the source column. Never put a
number on screen without labelling it "مثال" if it is illustrative. Never use
"السعر على الخاص" — use "التفاصيل على الخاص" or "للحصول على متجرك…".
</gotchas>
```

---

## 3 · Scene prompts (image / b-roll only)

### 3.1 Cobalt room

```text
A deep cobalt-navy studio at night, almost black at the edges, a broad liquid-chrome
ribbon entering from the lower left and exiting upper right, one silver sphere
two-thirds out of frame at the upper right, smoked-glass monoliths at the edges.
One cool silver key from upper left, a faint champagne bounce from below. Fine film
grain, clean highlights, no text, no logo, 35mm, slow push-in.
```

### 3.2 Glass data card

```text
A single smoked-glass data card floating in a cobalt room, thin ice-blue edge light,
a brushed silver chamfer, a faint reflection of a chrome ribbon on its surface. Blank:
no text, no UI. 85mm, f/2.8, shallow depth of field. The card turns 4 degrees.
```

### 3.3 Ledger line

```text
A single thin champagne line draws itself across a dark cobalt surface, left to right,
then branches into three delicate paths. Macro, 100mm, f/4. The line has a soft glow,
not a neon tube. No text.
```

### 3.4 Chrome sphere

```text
A polished chrome sphere at the upper right of a cobalt room, two-thirds out of frame.
Its reflection holds a blurred ivory light and one thin ribbon. The sphere drifts less
than a millimetre. 50mm, f/2. No text.
```

### 3.5 Cobalt ticket

```text
A thick graphite-green ticket floating in a cobalt room, a saffron perforation line,
a mint edge light, otherwise blank. Slow 4-degree rotation, macro 85mm, f/2.8.
```

---

## 4 · Data-scene recipes (code, not a video model)

### 4.1 Setup checklist

- Board: glass card, 6 rows, two columns wide / one column portrait.
- Rows: number, icon, title, hint, a blue check dot that pops on the bar.
- Header: 6/6 ring, `≈ 15 دقيقة` + the condition.
- Footer: launch button; a single champagne path behind the rows.
- Animation: row i enters at `0.4 + i*0.28 s`; ring draws 0→6 over 2 s; launch
  pulses on the last bar. No bounce.

### 4.2 Source graph

- Left: three source cards (glass). Center: white product card. Right: price panel.
- Edges: SVG lines from each source to the product; the cheapest edge is ice blue,
  the others 8% opacity.
- On the source-cost change: the cheapest badge and edge **switch** to source 2; the
  sale price counts from 9.43 to 9.72 over 0.8 s; an amber alert enters.
- Numbers always two decimals; dollar sign isolated LTR; label the example.

### 4.3 Payment constellation

- A wallet card in the center; six method chips orbit at two radii.
- Methods: محفظة المتجر، شام كاش، سيريتل كاش، MTN كاش، USDT، Binance Pay، تحويل بنكي.
- Each chip lands on a 16th; a thin line connects it to the wallet; no logos, no
  invented brands beyond the app's own templates.

---

## 5 · Motion prompts for a video model (image-to-video, no UI)

### 5.1 Preserve a real screenshot

```text
Animate this exact screenshot with a camera move only: 4-degree perspective tilt
from -6° to -2°, 2% push-in over 4 seconds. Preserve every pixel of the interface:
no re-rendering, no new text, no morphing. Add one soft travelling reflection on the
glass. The screen content must stay identical.
```

### 5.2 Chrome ribbon loop

```text
The chrome ribbon drifts two centimetres right, the specular line travels along its
top edge, then it settles. Locked camera. 4 seconds, seamless loop, no text.
```

### 5.3 Cobalt light sweep

```text
A single soft silver band sweeps diagonally across a cobalt room, revealing the glass
monoliths and the chrome sphere, then leaves. No flare, no particles, no text.
```

---

## 6 · References and what to steal

| reference | what it gives this cut |
|---|---|
| [Awesome Opus 5.5 Videos](https://github.com/yihui-dev/awesome-opus5-5-videos) | 700+ code-rendered prompts; the production grammar: one system, exact type, an event per beat, stills before render. |
| [zero — Opus 5.5 UI motion showreel](https://omo.space/workflows/opus-5-5-ui-motion-design-showreel) | one element never cuts; it morphs while content swaps; closed-form springs; loop closes. |
| [remotion-director](https://github.com/Zane-0x5a/remotion-director) | brief → directions → builds → critic loop; the edit is judged from the rendered film. |
| [Dia — a brand painted by hand](https://whatships.com/videos/dia-refreshed-brand/) | identity as material, not a settings list. |
| [ElevenLabs Brand Kit](https://whatships.com/videos/elevenlabs-brand-kit/) | one identity across type, colour and cards. |
| [HadiType](https://www.behance.net/gallery/221542845/haditype_foundry-showreel-2025) | whole-word Arabic kinetic type. |

---

## 7 · Negative prompt

```text
green background, emerald stage, neon, cyberpunk, purple/pink gradient, RGB split,
glitch, shockwave rings, lens flare, fake Arabic, garbled text, invented logos,
unlabelled live prices, generic tech grid, floating holograms, oversaturated,
plastic, low-poly, watermark, fast random cuts, camera shake, dead holds
```

---

## 8 · The one rule that makes it believable

The **room** may be generated. The **product**, the **Arabic**, the **prices** and the
**contacts** may not. They are real components, real strings and real numbers from the
app — or they are labelled as an example. That division is the film.
