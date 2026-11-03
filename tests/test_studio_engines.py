"""Unit tests for the provider, footage, pipeline and beat-kind engines.

    python -m unittest discover -s tests -v
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import footage  # noqa: E402
import kinds  # noqa: E402
import pipelines  # noqa: E402
import providers  # noqa: E402


class ProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = providers.load_catalog()

    def test_every_provider_names_a_known_capability(self) -> None:
        caps = set(self.catalog["capabilities"])
        for p in self.catalog["providers"]:
            self.assertIn(p["capability"], caps, p["id"])

    def test_unavailable_provider_never_wins(self) -> None:
        rows = providers.rank(self.catalog, "tts", keys=set())
        self.assertTrue(rows[0]["available"] or not any(r["available"] for r in rows))
        self.assertFalse(next(r for r in rows if r["id"] == "elevenlabs")["available"])

    def test_key_makes_cloud_provider_available(self) -> None:
        rows = providers.rank(self.catalog, "tts", profile="hero", keys={"ELEVENLABS_API_KEY", "FISH_API_KEY"})
        self.assertIn(rows[0]["id"], {"elevenlabs", "fish-s2"})

    def test_needs_filter_before_scoring(self) -> None:
        rows = providers.rank(self.catalog, "image", need={"offline"}, keys=set())
        self.assertTrue(all(r["id"] == "sd-local" for r in rows))
        rows = providers.rank(self.catalog, "tts", need={"arabic"}, keys=set())
        self.assertNotIn("piper", [r["id"] for r in rows])

    def test_free_is_top_cost_score(self) -> None:
        pool = [p for p in self.catalog["providers"] if p["capability"] == "video"]
        scores = providers.cost_scores(pool)
        self.assertEqual(scores["ltx-local"], 5.0)
        self.assertGreater(scores["kling"], scores["veo"])

    def test_spend_gate(self) -> None:
        budget = {"mode": "cap", "cap_usd": 10.0, "approve_over_usd": 0.5}
        self.assertFalse(providers.check_spend(0.8, budget, 0.0, approved=False)[0])
        self.assertTrue(providers.check_spend(0.8, budget, 0.0, approved=True)[0])
        self.assertFalse(providers.check_spend(0.4, budget, 9.8, approved=False)[0])
        ok, msg = providers.check_spend(0.4, {**budget, "mode": "warn"}, 9.8, approved=False)
        self.assertTrue(ok)
        self.assertTrue(msg.startswith("WARN"))
        self.assertTrue(providers.check_spend(0.4, {**budget, "mode": "observe"}, 9.8, approved=False)[0])


class FootageTests(unittest.TestCase):
    def test_keep_ranges_cut_long_pauses_and_keep_short_ones(self) -> None:
        hop = footage.HOP_S
        loud, quiet = -20.0, -60.0
        # 1 s speech, 0.2 s breath, 1 s speech, 1.5 s silence, 1 s speech
        db = [loud] * 50 + [quiet] * 10 + [loud] * 50 + [quiet] * 75 + [loud] * 50
        ranges = footage.keep_ranges(db, hop_s=hop, threshold_db=-38, min_silence=0.45, pad=0.08)
        self.assertEqual(len(ranges), 2)
        self.assertAlmostEqual(ranges[0][0], 0.0)
        self.assertAlmostEqual(ranges[0][1], 2.28, places=2)
        self.assertAlmostEqual(ranges[1][0], 3.62, places=2)

    def test_slivers_are_dropped(self) -> None:
        db = [-60.0] * 50 + [-20.0] * 5 + [-60.0] * 50
        self.assertEqual(footage.keep_ranges(db), [])

    def test_clips_prefer_a_hook_and_never_overlap(self) -> None:
        segs = []
        t = 0.0
        texts = ["كان يوماً عادياً في المكتب.", "ثم حدث شيء.", "لماذا يفشل معظم المتاجر في أول شهر؟",
                 "السبب الأول هو التسعير.", "والسبب الثاني هو الثقة.", "وهذا كل شيء."] * 3
        for text in texts:
            segs.append({"start": t, "end": t + 8.0, "text": text})
            t += 8.0
        picked = footage.score_clips(segs, min_s=20, max_s=40, top=3)
        self.assertTrue(picked)
        self.assertTrue(picked[0]["hook"].startswith("لماذا"))
        for a in picked:
            for b in picked:
                if a is not b:
                    self.assertTrue(a["end"] <= b["start"] or a["start"] >= b["end"])

    def test_edl_to_film_shifts_words_into_the_beat(self) -> None:
        edl = {"src": "assets/x/talk.mp4", "ranges": [{"in": 2.0, "out": 4.0}]}
        tr = {"segments": [{"words": [{"word": " مرحبا", "start": 2.5, "end": 2.9}, {"word": "خارج", "start": 5, "end": 5.4}]}]}
        film = footage.edl_to_film(edl, tr)
        beat = film["beats"][0]
        self.assertEqual(film["format"], "footage")
        self.assertEqual(beat["seconds"], 2.0)
        self.assertEqual(beat["data"]["words"], [{"w": "مرحبا", "start": 0.5, "end": 0.9}])


class PipelineTests(unittest.TestCase):
    def test_every_pipeline_stage_is_defined(self) -> None:
        defs = pipelines.load_defs()
        for name, p in defs["pipelines"].items():
            for stage in p["stages"]:
                self.assertIn(stage, defs["stages"], f"{name}: {stage}")

    def test_gates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "film").mkdir()
            (root / "film" / "a.json").write_text("{}", encoding="utf-8")
            state = {"film": "film/a.json", "approvals": {}}
            self.assertTrue(pipelines.check_gate({"file": "{film}"}, state, root)[0])
            self.assertFalse(pipelines.check_gate({"file": "film/missing"}, state, root)[0])
            self.assertFalse(pipelines.check_gate({"approval": "script"}, state, root)[0])
            state["approvals"]["script"] = {"quote": "تمام"}
            self.assertTrue(pipelines.check_gate({"approval": "script"}, state, root)[0])


class KindTests(unittest.TestCase):
    def test_tutorial_rejects_steps_off_screen_or_out_of_time(self) -> None:
        data = {"src": "missing.png", "steps": [{"at": 9, "x": 1.4, "y": 0.5}]}
        problems, _ = kinds.validate("tutorial", "t1", data, 6.0, ROOT)
        joined = " ".join(problems)
        self.assertIn("does not exist", joined)
        self.assertIn("x/y must be 0–1", joined)
        self.assertIn("outside the beat", joined)

    def test_gfx_layers(self) -> None:
        problems, _ = kinds.validate("gfx", "g1", {"layers": [{"type": "sparkle"}, {"type": "text"}]}, 4.0, ROOT)
        self.assertEqual(len(problems), 2)
        problems, _ = kinds.validate("gfx", "g1", {"layers": [{"type": "counter", "to": 9, "at": 1}]}, 4.0, ROOT)
        self.assertEqual(problems, [])

    def test_character_vocabulary(self) -> None:
        problems, _ = kinds.validate("character", "c1", {"pose": "dab", "expression": "smug"}, 4.0, ROOT)
        self.assertEqual(len(problems), 2)


class StarterCompileTests(unittest.TestCase):
    """The asset-free starters must compile --strict as shipped."""

    def compile(self, name: str) -> subprocess.CompletedProcess:
        with tempfile.TemporaryDirectory() as tmp:
            return subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "make_timeline.py"), "--film", f"references/starters/{name}.json",
                 "--out", str(pathlib.Path(tmp) / "t.json"), "--style-out", str(pathlib.Path(tmp) / "s.json"),
                 "--vo", str(pathlib.Path(tmp) / "none.json"), "--strict"],
                cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
            )

    def test_character_and_motion_graphics_compile(self) -> None:
        for name in ("character", "motion-graphics"):
            proc = self.compile(name)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_media_starters_refuse_until_real_assets_exist(self) -> None:
        for name in ("tutorial", "talking-head"):
            proc = self.compile(name)
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("does not exist", proc.stdout + proc.stderr)

    def test_character_gets_word_timings_for_the_mouth(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "t.json"
            subprocess.run([sys.executable, str(ROOT / "scripts" / "make_timeline.py"), "--film",
                            "references/starters/character.json", "--out", str(out), "--style-out",
                            str(pathlib.Path(tmp) / "s.json"), "--vo", str(pathlib.Path(tmp) / "none.json")],
                           cwd=ROOT, capture_output=True)
            tl = json.loads(out.read_text(encoding="utf-8"))
            self.assertTrue(all(b["data"].get("words") for b in tl["beats"]))


if __name__ == "__main__":
    unittest.main()
