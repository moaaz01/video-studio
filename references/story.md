# Story: three storylines, then one

Most weak films are good motion around no story. Before a single beat, write three
storylines, pick one, and save them as `film/STORYLINES.md`. The gate:

```bash
python scripts/studio.py craft storylines film/STORYLINES.md
```

It fails unless there are three `##` storylines, each with `Device:`, `Form:`,
`First 2 seconds:`, `Beats:`, `Look:` and `Sound:`, no two sharing a device or a form,
and one `Picked: <name>` line. Skip it only for a single-idea piece under 15 s
(one kinetic line, one stat), where the request is the story.

## The one thing

- **What it is**, in one line: the one idea the viewer must leave with, in their
  words, not the slogan.
- **One viewer, one real task, one real piece of data** that travels from the hook
  to the payoff (a number, a screen, a question).
- Facts come from the intake or a cited source; creative choices are yours. What the
  source does not say stays unsaid ("40 min → 2 min" is not "20× faster").

## Devices (what the story is)

| Device | What the viewer sees |
|---|---|
| A moment in someone's day | a person, a time, the message that creates the need |
| A character does the work | the presenter (`character`) or a cursor carries, points, reacts |
| The result first | the finished output plays, then pull back to where it came from |
| Life before and after | the old way churns, the new way moves calmly (never mock a named competitor) |
| Type carries the argument | giant kinetic Arabic words, colour fields, cuts on the beat |
| A number lands | one real number earned by a scene, then made physical (`counter` + glow) |
| A question with the input | «ماذا لو…؟» filled by a real input |
| The object is the explanation | a flow of cards or a machine whose working is the idea |

## Forms (how the camera tells it)

| Form | What the viewer sees |
|---|---|
| One continuous take | the camera never cuts; it pushes and travels into the next world |
| Object-to-object chain | each shot ends on the thing that opens the next (a card becomes a screen) |
| Endless zoom | dive into a detail that becomes the next world |
| Cut on the beat | hard cuts on the music, colour fields every half bar |
| Match cuts | one shape holds while the world around it changes (a ring → a coin → a logo) |
| One frame that rebuilds | a single composition keeps rearranging itself |
| Split screen to one | panes play together, then collapse into the one that matters |

Three storylines that are all plain cuts between scenes have not tried the forms.

## The hook, the turn, the end

- **Hook in the first 2 seconds.** No logo first. A number, a question, a result.
- **One turn.** Something changes between the middle and the end (the twist beat).
- **An ending that echoes** the opening: the same number, the same object, now understood.
- **One native move** at the peak: a moment only motion can do (a card that becomes
  the next world, a ring that grows into the frame).
- **Not the starter again.** If you began from a starter or playbook, change its opening
  and its ending at least, and say in `REVIEW.md` what else you changed.

## Template

```markdown
# Storylines — <film>

## A · <name>
Device: a number lands
Form: match cuts
First 2 seconds: «15 ريال» fills the frame, a coffee cup ring around it.
Beats: hook → question → day → year → ten years → twist → end card
Look: data-noir (references/styles.json)
Sound: 120 BPM minimal pulse; silence for one bar before the 10-year number.

## B · <name>
Device: life before and after
Form: split screen to one
...

## C · <name>
Device: a question with the input
Form: one frame that rebuilds
...

Picked: A — a stranger would follow it and remember the number.
```

Ideas restated from HyperFrames `story.md` (Apache-2.0) and Lemo-Opuscar `DIRECTOR.md`
(directing method only); see `THIRD_PARTY_NOTICES.md`.
