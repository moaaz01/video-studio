"""Source-level guards for two engine bugs that shipped in delivered films.

1. The cut-light (CutFX) for the cut between beat i and i+1 was sequenced at
   beat i's start: every flash landed one cut early, the first one on frame 0
   (a washed-out first frame / thumbnail), and the last real cut had none.
2. The "still" camera still applied handheld shake and a 0.12 deg tilt, which
   uncovered a 1 px seam at the frame edge and softened text.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class EngineRegressions(unittest.TestCase):
    def test_cut_light_sits_on_the_next_beat(self):
        film = (ROOT / "src/film/Film.tsx").read_text(encoding="utf-8")
        seq = re.search(r"<Sequence key=\{`seam-[^>]*>", film)
        self.assertIsNotNone(seq, "cut-light Sequence not found")
        self.assertIn("from={beats[i + 1].start - 7}", seq.group(0))
        self.assertNotIn("from={beat.start - 7}", film)

    def test_still_camera_has_no_handheld(self):
        cam = (ROOT / "src/look/Camera.tsx").read_text(encoding="utf-8")
        self.assertIn('if (mode !== "still")', cam)
        guarded = cam.split('if (mode !== "still")', 1)[1].split("}", 1)[0]
        for noise in ('"cam-x"', '"cam-y"', '"cam-r"'):
            self.assertIn(noise, guarded, f"{noise} must only run when the camera is not still")
        self.assertIn("scale += 0.006 * s", guarded, "moving modes need overscan so the edge never shows")


if __name__ == "__main__":
    unittest.main()
