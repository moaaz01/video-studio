# Fidelity pipeline

A film about an app is judged in the first two seconds: does the screen on the wall
match the screen in their hand? Everything here exists to win that comparison.

Two kinds of truth, and you need both:

| Truth | Question it answers | Tool |
|---|---|---|
| **source scan** | What does the product actually *say* and *call* things? | `scripts/ui_source.py --dir <project>` |
| **device capture** | What does it actually *look like* at real density? | `scripts/ui_source.py --rea` (REA + adb) |

Neither is optional, and neither replaces reading the app like a user.

---

## 1. Source scan — no device, no excuses

```powershell
python scripts/ui_source.py --dir C:/path/to/app/android
```

Writes `film/ui-source.json` (gitignored) and prints:

```
package     com.studyai.app
kotlin      378 files
screens     100
routes      6
strings     ar:40, default:40
colors      50
fonts       tajawal_regular, tajawal_medium, tajawal_bold, tajawal_extrabold
```

Why each field matters:

- **screens** — the real inventory (`@Composable fun XScreen`). A beat that shows a
  screen nobody can name in this list is invented. Cut it.
- **strings** — every label the film prints must exist in the app's own table, in the
  same locale. If the film says "المساعد الذكي" and the app says "المساعد", the film
  is wrong.
- **colors** — the palette the film paints with. `Paper`, `PaperRaised`, `dayInk` are
  not decoration; they are the app's design tokens.
- **fonts** — the type families the app ships. If the app ships Tajawal, the film sets
  Tajawal. Match the weights too.
- **routes** — how screens connect, which is the story of a demo: `home → challenge/{id}
  → summary` is a narrative, and the film should walk the same path.

Wire the tokens, not your taste: copy the values from the scan into `src/brand.ts` /
`src/theme.ts`, then delete the words "roughly" and "close enough" from your head.

## 2. Device capture — the pixels

```powershell
# what is attached, and at what density
adb devices -l
npx -y rea-agents@latest inspect-adb-display <serial> --format json

# one real frame, digested
npx -y rea-agents@latest capture-adb-screen <serial> --output-directory references/corpus/evidence/<slug>
```

Or, when a device is attached and you only need the picture:

```powershell
python scripts/ui_source.py --capture <serial>
```

That prints the PNG path plus:

```
Physical size: 1080x2400
Physical density: 440
```

**dp = px × 160 / density.** At density 440 that is `dp = px / 2.75`, so a 1080-wide
screen is **392.7 dp** — not 412. Wire that number into `src/theme.ts`
(`APP_W_DP`, `PHONE`, `SCREEN_DP`) before you lay out a single row, or every margin
in the film will be uniformly wrong and you will chase it for an hour.

For the APK's own tables (works with no device attached):

```powershell
npx -y rea-agents@latest decode-android-resources app-release.apk --locale ar --format json
```

For a web product, capture the viewport with
`npx -y rea-agents@latest capture-web-screenshot <cdp-endpoint> <targetId>` — the
point is the same: real viewport, real type rendering, real density.

## 3. Capture → rebuild → compare

1. Capture the screen. Put it in `references/corpus/evidence/<slug>/`.
2. Rebuild it in `src/components/` against the scanned tokens — never screenshot it
   into the video if the point of the film is a live product; a static image dies the
   moment the camera moves.
3. Render the same beat, crop both to 1:1, and compare side by side.
   `python scripts/qa.py --stills 8` gives you the frames; a 400 px crop tells you the
   truth about spacing, weight and colour that a full-frame glance hides.
4. Fix the *token*, not the frame. If the padding is wrong, `theme.ts` is wrong.

Repeat for the three or four screens that carry the film. A 40-second promo does not
need ten reconstructed screens; it needs three that are indistinguishable from the
product.

## 4. Evidence discipline

- A captured screen is **evidence**, not an asset: cite it in a corpus card
  (`src/corpus.py add --source rea ...`) and keep the date — the app changes.
- Never ship a screenshot as the hero of a moving shot. Held still it is fine (that
  *is* the product), scaled and moving it reads as a stolen image.
- Never invent a screen to fill a beat. Change the beat.
- When the app and the film disagree, the app wins. Always. Then update the film.

## 5. When there is no app yet

Design system, Figma, or nothing at all: then the film is a *concept* film and must
be honest about it — no fake status bars with fake battery, no fake numbers, no
"downloaded 12k times". Direction `atmosphere` or `kinetic` carries that brief without
lying; `device` does not.
