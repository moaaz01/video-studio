# Reference sources

Evidence beats taste. When a brief arrives, the first hour is spent looking, not
drawing: two or three films in the same genre, read structurally, out-perform any
amount of "make it modern".

This page lists the sources that are worth reading, what each one is actually good
for, and the card format that turns a reference into a decision.

## The three sources

### [prompt-motion.com](https://prompt-motion.com/)
A gallery of motion pieces made with Claude, published **with the prompt or skill
behind each video**. Filterable by genre — Product UI, Phone, Charts, Diagrams,
Kinetic type, Shapes, Particles, Characters, Photos, Music, Code — and it has a
[templates](https://prompt-motion.com/templates) page whose entries are prompts
with the swappable parts isolated as fields (the 3D template, the showreel prompt).

**Use it for:** the *language* of a brief. If a client says "make it like that
one", this is where you find the exact vocabulary for the moves (and the prompt
shape that produces them). **Take:** genre taxonomy, prompt-as-brief structure,
the habit of isolating every swappable field. **Do not take:** specific videos or
scores as assets — they belong to their creators.

### [whatships.com](https://whatships.com/)
A curated edit of **startup and product launch videos from X** — launch films,
demos, walkthroughs. This is the closest thing to a ground truth for the genre the
audience already watches daily.

**Use it for:** genre benchmarks — how long a launch film holds, when the product
first appears, how the end card is built, what the first 1.5 s does. **Take:**
structure, pacing, the end-card grammar, the "one action" discipline. **Do not
take:** claims, metrics or logo walls from other products.

### [github.com/morluto/rea](https://github.com/morluto/rea)
An agent toolkit, not a design source. Its value here is the packaging pattern:
a repository an agent can enter cold — and the studio repo mirrors that idea with
`SKILL.md`, `AGENTS.md`, `llms.txt`, scripts that self-describe, and a QA command
that proves the state instead of asserting it.

## Reading a reference like a designer

Watch once with sound off, then once with sound on, and only then fill a card:

```markdown
## reference card — <title / link>
genre:            launch | ui-demo | explainer | reel | editorial
runtime:          __s, __ beats, median beat __s
first 1.5 s:      what exactly is on screen (shot, type, action)
product appears:  at __s, occupying __ % of frame
structure:        hook → proof → proof → claim → action  (name the real one)
palette:          __ field, __ ink, __ accent (hex if you can sample)
type:             __ families, __ weights, scale ratio __
transitions:      cut | wipe | morph | match-cut (only the ones actually used)
sound:            __ BPM feel, VO density, __ SFX per cut
end card:         what it asks for, in how many words
what to steal:    1–3 moves, named
what to avoid:    anything that only works because of their brand
```

Three cards on the desk is enough. If all three share a move, that move is the
genre's requirement — keep it. If only one has it, it is a stylistic choice —
choose deliberately.

## Mini-library (add to it as you work)

Fill this in with what you actually watch; the studio is more useful the more it
knows. Keep only structure, never assets.

| genre | reference | the move worth reusing |
|---|---|---|
| device film | _add_ | _add_ |
| launch trailer | _add_ | _add_ |
| ui demo | _add_ | _add_ |
| kinetic type | _add_ | _add_ |
| explainer | _add_ | _add_ |
| editorial / paper | _add_ | _add_ |

## Rules

- **Structure is free, assets are not.** Copying pacing is craft; downloading
  someone's music, footage or logo is a license problem.
- **Never reference a film the user has not cleared** for the final delivery —
  point at it, do not embed it.
- **The studio's own palette does not come from a reference.** References inform
  the direction; the product's real tokens inform the colours. When the two
  disagree, the product wins.
- **Muted first.** A reference that only works with its score is teaching you
  about audio, not about picture.
