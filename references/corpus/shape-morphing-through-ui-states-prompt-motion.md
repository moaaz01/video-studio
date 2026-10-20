# Shape morphing through UI states - prompt-motion

- source: prompt-motion
- url: https://prompt-motion.com/twoclipping-5cba86
- direction: `ui-film`
- pinned: 2026-10-20

## The move

One element, never cut: size, radius and colour morph while the content swaps with a short blur, every value a closed-form spring summed per event, all of it a pure function of seek(t); drags are direct manipulation and the loop closes on frame 0.

## What it buys this film

This is exactly how a UI beat should behave in our engine: no transitions, no state, one spring per change, so --concurrency=75% cannot change the picture.

## What I am NOT taking

the 1440x1440 canvas, the Geist/black-and-white palette and the cursor choreography - our frame is 1920x1080, RTL, and the emerald/paper tokens come from the app.
