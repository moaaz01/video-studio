"""Craft gate, storylines gate and style cards."""
from __future__ import annotations

import json
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import craft  # noqa: E402
import kinds  # noqa: E402


def tl(layers: list[dict], dur_s: float = 8.0, **beat) -> dict:
    return {"fps": 30, "style": {"transitions": ["whip", "blur"]},
            "beats": [{"id": "b01", "kind": "gfx", "dur": int(dur_s * 30), "data": {"palette": "midnight-amber", "backdrop": "mesh", "layers": layers}, **beat}]}


def levels(findings: list[dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for f in findings:
        out.setdefault(f["level"], []).append(f["problem"])
    return out


class CraftCheckTests(unittest.TestCase):
    def test_clean_beat_has_no_p0(self):
        f = craft.check(tl([
            {"type": "text", "text": "الرقم", "size": 0.6, "at": 0.2, "glow": True},
            {"type": "text", "text": "كل شيء يبدأ بسؤال", "size": 0.2, "at": 0.6, "v": {"size": 0.22}},
        ]))
        self.assertNotIn("P0", levels(f))

    def test_small_text_on_vertical_is_p0(self):
        f = craft.check(tl([{"type": "text", "text": "مصدر", "size": 0.15, "at": 0}]))
        self.assertIn("text too small on 9:16", levels(f).get("P0", []))

    def test_two_glows_is_p0(self):
        f = craft.check(tl([{"type": "text", "text": "أ", "size": 0.5, "glow": True, "at": 0},
                            {"type": "counter", "to": 5, "size": 0.5, "glow": True, "at": 0.3}]))
        self.assertIn("two accents glow", levels(f)["P0"])

    def test_short_hold_is_flagged(self):
        line = "هذا سطر طويل جدا يحتاج وقتا كافيا للقراءة على الشاشة"
        f = craft.check(tl([{"type": "text", "text": line, "size": 0.3, "at": 0, "out": 1.0}]))
        self.assertIn("line too short to read", levels(f)["P0"])

    def test_indic_digits_is_p0(self):
        f = craft.check(tl([{"type": "text", "text": "١٢٣", "size": 0.5, "at": 0}]))
        self.assertIn("Arabic-Indic digits", levels(f)["P0"])

    def test_stagger_pulse_and_dead_stretch(self):
        layers = [{"type": "text", "text": "أ", "size": 0.5, "at": 0, "anim": "pulse"},
                  {"type": "shape", "at": 0}, {"type": "shape", "at": 0}]
        p1 = levels(craft.check(tl(layers, dur_s=10)))["P1"]
        for problem in ("everything enters at once", "breathing title", "dead stretch"):
            self.assertIn(problem, p1)

    def test_hold_rule_counts_words_not_tashkeel(self):
        self.assertEqual(craft.words("فِنْجَانُ قَهْوَةٍ"), 2)
        self.assertAlmostEqual(craft.need_hold("فنجان قهوة"), 1.4)


class StorylinesTests(unittest.TestCase):
    GOOD = "\n".join(
        f"## {n}\nDevice: {d}\nForm: {fm}\nFirst 2 seconds: x\nBeats: a\nLook: data-noir\nSound: pulse\n"
        for n, d, fm in (("A", "a number lands", "match cuts"), ("B", "before and after", "split screen"), ("C", "a question", "one frame"))
    ) + "\nPicked: A — reason\n"

    def test_good_passes(self):
        self.assertEqual(craft.storylines(self.GOOD), [])

    def test_shared_device_and_missing_pick_fail(self):
        bad = self.GOOD.replace("before and after", "a number lands").replace("Picked: A — reason", "")
        errs = craft.storylines(bad)
        self.assertTrue(any("share a device" in e for e in errs))
        self.assertTrue(any("Picked" in e for e in errs))


class StyleCardTests(unittest.TestCase):
    def test_every_card_maps_to_the_engine(self):
        looks = set(re.findall(r'\|\s*"([a-z-]+)"', (ROOT / "src/look/looks.ts").read_text(encoding="utf-8")))
        cuts = set(re.findall(r"'([a-z]+)'", re.search(r"TransitionName = ([^;]+);", (ROOT / "src/film/types.ts").read_text(encoding="utf-8")).group(1)))
        styles = craft.load_styles()
        self.assertGreaterEqual(len(styles), 12)
        self.assertEqual(len({s["id"] for s in styles}), len(styles))
        for s in styles:
            self.assertIn(s["look"], looks, s["id"])
            self.assertIn(s["palette"], kinds.PALETTES, s["id"])
            self.assertIn(s["backdrop"], kinds.BACKDROPS, s["id"])
            self.assertTrue(set(s["transitions"]) <= cuts, s["id"])
            self.assertTrue(2 <= len(s["transitions"]) <= 4, s["id"])
            self.assertEqual(len(s["moves"]), 3, s["id"])
            self.assertEqual(len(s["pitfalls"]), 3, s["id"])

    def test_pipelines_gate_craft_after_timeline(self):
        d = json.loads((ROOT / "references/pipelines.json").read_text(encoding="utf-8"))
        self.assertIn("craft", d["stages"])
        for name, p in d["pipelines"].items():
            st = p["stages"]
            if "timeline" in st:
                self.assertEqual(st[st.index("timeline") + 1], "craft", name)

    def test_burst_layer_is_known(self):
        self.assertIn("burst", kinds.LAYERS)
        self.assertIn("'burst'", (ROOT / "src/scenes/Gfx.tsx").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()


class RenderGateTests(unittest.TestCase):
    def _run(self, layers):
        import tempfile
        from unittest import mock
        with tempfile.TemporaryDirectory() as tmp:
            t = pathlib.Path(tmp)
            (t / "tl.json").write_text(json.dumps(tl(layers)), encoding="utf-8")
            with mock.patch.object(craft, "GATE_RECORD", t / "gate.json"):
                rc = craft.render_gate(t / "tl.json")
            return rc, json.loads((t / "gate.json").read_text(encoding="utf-8"))

    def test_p0_refuses_and_is_recorded(self):
        rc, rec = self._run([{"type": "text", "text": "مصدر", "size": 0.1, "at": 0}])
        self.assertEqual(rc, 1)
        self.assertFalse(rec["pass"])
        self.assertTrue(rec["p0"])

    def test_clean_passes(self):
        rc, rec = self._run([{"type": "text", "text": "الرقم", "size": 0.6, "at": 0.2, "glow": True},
                             {"type": "text", "text": "كل شيء يبدأ بسؤال", "size": 0.2, "at": 0.6, "v": {"size": 0.22}}])
        self.assertEqual(rc, 0)
        self.assertTrue(rec["pass"])
        self.assertEqual(len(rec["sha256"]), 64)

    def test_render_and_export_call_the_gate(self):
        for f in ("scripts/studio.py", "scripts/platforms.py"):
            src = (ROOT / f).read_text(encoding="utf-8")
            self.assertIn("craft.render_gate(", src, f)
            self.assertLess(src.index("craft.render_gate("), src.index('"remotion", "render"'), f)

    def test_delivery_requires_a_passed_gate_and_a_review(self):
        src = (ROOT / "scripts/private.py").read_text(encoding="utf-8")
        self.assertIn('"craft-gate.json"', src)
        self.assertIn("REVIEW.md", src)
