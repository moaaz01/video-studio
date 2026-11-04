# Channel kit — hand this to the production agent

> Replace `[اسم القناة]` and `[@المعرّف]` with the name and handle you chose.
> In the builder, the name is one constant: `BRAND` in `build_episodes.py`.

## What the agent reads, in order

| File | What it is |
|---|---|
| `projects/qissat-raqam/PLAN-60.md` | Strategy, money reality, policy rules, the episode template, weekly pillars, **the 60 episode titles**, phases and metrics |
| `projects/qissat-raqam/build_episodes.py` | Episode specs → film files. Days 1–7 are already written and researched; add days 8–60 as new `SPECS` entries |
| `projects/qissat-raqam/episodes/d01…d07.json` | Week 1 films, each compiles `--strict` |
| `references/formats/visual-forms.md#gfx-pro` | Palettes, backdrops, cards, charts, text effects: the visual vocabulary |
| `references/design-inspiration.md` | Where to borrow taste, and how a reference becomes data; the ten checks against "cheap AI" |
| `AGENTS.md` → `SKILL.md` | Studio rules: sourced facts only, Western digits (123), 1:1 still before any render |

Per episode: `python projects/qissat-raqam/build_episodes.py <day>` → voice (your own
pipeline) → `python scripts/make_timeline.py --film projects/qissat-raqam/episodes/dNN.json --strict`
→ `python scripts/studio.py score` → `python scripts/studio.py render 9x16 16x9` → `python scripts/studio.py qa --stills 8 --require-audio`.
A 10 s beat holds about 21 spoken words; numbers spoken as words cost more.

---

## Channel description (YouTube "About", ~900 characters)

```
[اسم القناة] — رقم واحد… وقصة كاملة خلفه.

كل يوم نختار رقماً صادماً من عالم المال أو التقنية أو جسمك وعقلك أو الكون، ونحكي لك في أقل من دقيقة لماذا هو مهم، بالرسوم المتحركة والبيانات الواضحة، وبالعربية الفصحى البسيطة.

ماذا ستجد هنا؟
• مالك بالأرقام: كيف تعمل الفائدة والتضخم والادخار؟
• تقنية وذكاء اصطناعي: ماذا يحدث داخل هاتفك؟
• جسمك وعقلك: لماذا ننسى؟ لماذا نتعب؟
• كيف تربح الشركات: الأسرار وراء أسعار ما نشتريه.
• الكون والأرض: أسئلة بسيطة بإجابات مدهشة.
• عقول عربية: علماء غيّروا العالم.

كل رقم له مصدر في وصف الحلقة. لا سياسة، ولا نصائح استثمارية، فقط فهمٌ أوضح للعالم.

🔔 رقم جديد كل يوم، وملخّص «أرقام الأسبوع» كل جمعة.
اشترك وفعّل الجرس لتبدأ يومك بمعلومة تستحق المشاركة.

للتعاون والرعايات: [البريد]
```

**Short version** (TikTok / Instagram bio, under 80 characters):

```
رقم واحد كل يوم… وقصة تغيّر نظرتك 🔢 مال · تقنية · عقل · كون
```

**SEO tags for the channel:** معلومات، حقائق، معلومة اليوم، اقتصاد، مال، ادخار، تقنية،
ذكاء اصطناعي، علوم، فضاء، علم النفس، أرقام، شرح مبسط، ثقافة عامة، تعلم

---

## Logo prompt (for a logo-design site or an image model)

Paste this as written. Image models misspell Arabic, so the prompt asks for **the
symbol only**. Set the Arabic wordmark yourself in a real font afterwards
(Tajawal ExtraBold or Cairo Black), or let a human designer do it.

```
Minimal modern logo mark for an Arabic educational YouTube channel about surprising numbers and the stories behind them.
Concept: a bold geometric numeral-like shape that doubles as a speech bubble or an open book — "a number that tells a story".
Style: flat vector, clean geometry, thick confident strokes, rounded corners, no gradients except one subtle accent glow, works at 32×32 px.
Colours: deep night blue (#0B0F1A) background, warm amber-gold (#F2C14E) primary mark, a small teal (#3DD6C4) accent dot.
Mood: smart, curious, trustworthy, youthful but not childish, suitable for both men and women aged 18–50.
Composition: centred symbol inside a circle-safe square (YouTube avatar crop), generous padding, high contrast.
Absolutely no text, no letters, no Arabic or Latin characters, no numbers written as text, no mascots, no 3D, no clip-art, no stock icons.
Deliver: icon on dark background, icon on white background, monochrome version.
```

**Variants for the same prompt** (change only the Concept line):
- *Counter:* "a rounded rectangle split like a flip-clock digit, with a tiny spark on top".
- *Bubble number:* "a speech bubble whose tail forms the stroke of the digit 1".
- *Spark chart:* "three rising bars that end in a star-shaped spark".

**Banner (2560×1440, safe area 1546×423 in the centre):**
```
Wide YouTube channel banner, deep night-blue background with a slow mesh gradient, faint dot-matrix pattern and floating amber particles, a few glowing amber line-chart strokes and small geometric shapes (hexagon, ring, star) at the edges, empty centre safe area for text, premium motion-graphics look, no text, no letters, no numbers.
```
Add the name and «رقم جديد كل يوم» in the centre yourself, in Arabic type.
