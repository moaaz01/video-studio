"""Foley cue sheets: legacy parity, levels, sync with the renderer, external VO."""
from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import craft  # noqa: E402
import foley  # noqa: E402
import kinds  # noqa: E402


def beat(bid: str, kind: str, start: int, dur: int = 60, **kw) -> dict:
    return {"id": bid, "kind": kind, "start": start, "dur": dur, "tone": kw.pop("tone", "ink"), "data": kw.pop("data", {}), "sfx": kw.pop("sfx", []), **kw}


TUT = beat("t01", "tutorial", 0, 120, data={"steps": [
    {"at": 1.0, "x": 0.5, "y": 0.5},
    {"at": 2.0, "x": 0.5, "y": 0.5, "action": "hover"},
    {"at": 3.0, "x": 0.5, "y": 0.5, "keys": ["Ctrl", "K"]},
]})


class SyncTests(unittest.TestCase):
    def test_render_constants_match(self):
        gfx = (ROOT / "src/scenes/Gfx.tsx").read_text(encoding="utf-8")
        film = (ROOT / "src/film/Film.tsx").read_text(encoding="utf-8")
        cursor = (ROOT / "src/components/Cursor.tsx").read_text(encoding="utf-8")
        self.assertIn(f"const STAGGER = {foley.GFX_STAGGER};", gfx)
        self.assertIn(f"l.dur ?? {foley.COUNTER_DUR}", gfx)
        self.assertIn(f"const PREROLL = {foley.PREROLL};", film)
        self.assertIn(f"const OVER = {foley.OVER};", film)
        self.assertIn("i * 0.1", cursor)
        zooms = dict(re.findall(r"(\w+): ([\d.]+)", re.search(r"ACTION_ZOOM[^{]+\{([^}]+)\}", cursor).group(1)))
        self.assertEqual(set(zooms), kinds.ACTIONS)

    def test_catalog_covers_every_stem_and_profile(self):
        cat = foley.catalog()
        stems = {p.stem for p in (ROOT / "public/audio/sfx").glob("*.wav")}
        self.assertEqual(set(cat), stems)
        for name, lv in foley.profiles()["levels"].items():
            if lv.get("legacy"):
                continue
            used = [e["stem"] for e in (lv.get("events") or {}).values()] + ((lv.get("cut") or {}).get("stems") or [])
            for s in used:
                self.assertIn(s, stems, f"{name}: {s}")
            self.assertTrue(all(0.2 <= e["gain"] <= 0.65 for e in (lv.get("events") or {}).values()), name)

    def test_style_cards_carry_a_known_level(self):
        levels = set(foley.profiles()["levels"])
        for s in craft.load_styles():
            self.assertIn(s["interaction"], levels, s["id"])


class LevelTests(unittest.TestCase):
    def test_legacy_reproduces_the_fixed_mix(self):
        beats = [beat("b01", "hook", 0), beat("b02", "stat", 60), beat("b03", "cta", 120, sfx=[{"at": 6, "name": "ding", "gain": 0.3}])]
        level, cues = foley.cue_sheet(beats, {"sfx": {"intro": "riser_short"}}, 30, 180)
        self.assertEqual(level, "legacy")
        got = [(c["frame"], c["name"]) for c in cues]
        self.assertEqual(got, [(0, "riser_short"), (58, "whoosh_rtl"), (60, "stamp_thud"), (100, "correct_chime"),
                               (118, "whoosh_rtl"), (120, "ui_pop"), (152, "ding"), (126, "ding")])

    def test_none_level_has_only_named_cues(self):
        beats = [beat("f01", "footage", 0), beat("f02", "footage", 60, sfx=[{"at": 0, "name": "ding"}])]
        _, cues = foley.cue_sheet(beats, {"interaction": "none"}, 30, 120)
        self.assertEqual([c["role"] for c in cues], ["named"])
        self.assertEqual(foley.suggest(beats)[0], "none")

    def test_rich_tutorial_click_and_keys_land_on_the_press(self):
        _, cues = foley.cue_sheet([TUT], {"interaction": "rich"}, 30, 120)
        clicks = [c for c in cues if c["role"] == "click"]
        keys = [c for c in cues if c["role"] == "keys"]
        peak = foley.catalog()["button_click"]["peak_ms"]
        self.assertEqual([c["frame"] for c in clicks], [30 - foley.jsround(peak * 30 / 1000)])
        self.assertEqual(len(keys), 2)  # the hover step is silent; the keys step is its keys
        self.assertEqual(foley.suggest([TUT])[0], "rich")

    def test_peak_alignment_and_rotation_on_cuts(self):
        beats = [beat(f"b{i}", "gfx", i * 60) for i in range(5)]
        _, cues = foley.cue_sheet(beats, {"interaction": "standard"}, 30, 300)
        cuts = [c for c in cues if c["role"] == "cut"]
        self.assertEqual(len(cuts), 4)
        self.assertGreater(len({(c["name"], c["rate"]) for c in cuts}), 1)
        first = cuts[0]
        peak = foley.catalog()[first["name"]]["peak_ms"]
        self.assertEqual(first["frame"], 60 + foley.OVER // 2 - foley.jsround(peak * 30 / 1000))

    def test_subtle_cuts_only_on_chapters_and_cap_holds(self):
        beats = [beat("b0", "gfx", 0), beat("b1", "gfx", 60), beat("b2", "gfx", 120, data={"chapter": True}), beat("b3", "hook", 180)]
        _, cues = foley.cue_sheet(beats, {"interaction": "subtle"}, 30, 240)
        self.assertEqual([c["beat"] for c in cues if c["role"] == "cut"], ["b2", "b3"])
        many = [beat(f"c{i}", "gfx", i * 30, 30, data={"layers": [{"type": "counter", "to": 5, "at": 0}]}) for i in range(12)]
        _, dense = foley.cue_sheet(many, {"interaction": "subtle"}, 30, 360)
        self.assertLessEqual(foley._max_window([c["frame"] for c in dense], 300), 4)

    def test_footage_cuts_are_silent_and_named_cues_stay_exact(self):
        beats = [beat("f1", "footage", 0), beat("f2", "footage", 60), beat("h", "hook", 120, sfx=[{"at": 5, "name": "ding", "gain": 0.3}])]
        _, cues = foley.cue_sheet(beats, {"interaction": "standard"}, 30, 180)
        self.assertNotIn("f2", [c["beat"] for c in cues if c["role"] == "cut"])
        self.assertIn({"frame": 125, "name": "ding"}, [{"frame": c["frame"], "name": c["name"]} for c in cues])
        self.assertEqual(foley.suggest([beat("a", "footage", 0), beat("b", "footage", 60), beat("c", "hook", 120)])[0], "none")

    def test_declared_style_roles_choose_the_stem(self):
        _, cues = foley.cue_sheet([TUT], {"interaction": "rich", "sfx": {"intro": "riser_short", "accent": "send_click"}}, 30, 120)
        self.assertEqual([c["name"] for c in cues if c["role"] == "click"], ["send_click"])
        self.assertEqual([c["name"] for c in cues if c["role"] == "intro"], ["riser_short"])

    def test_no_flams(self):
        b = beat("g", "gfx", 0, 60, data={"layers": [{"type": "badge", "text": "x", "at": 0.5}, {"type": "card", "title": "y", "at": 0.5}]})
        _, cues = foley.cue_sheet([b], {"interaction": "standard"}, 30, 60)
        frames = sorted(c["frame"] for c in cues)
        self.assertTrue(all(b - a >= foley.MIN_GAP_FRAMES for a, b in zip(frames, frames[1:])))

    def test_craft_flags_missing_level_and_monotony(self):
        tl = {"fps": 30, "beats": [beat(f"b{i}", "gfx", i * 60) for i in range(6)], "style": {},
              "cues": [{"frame": i * 60, "name": "whoosh_rtl", "gain": 0.6, "role": "cut"} for i in range(1, 6)]}
        problems = [f["problem"] for f in craft.check(tl)]
        self.assertIn("no interaction level", problems)
        self.assertIn("the same whoosh on every cut", problems)


class CompileTests(unittest.TestCase):
    def test_timeline_carries_cues_and_level(self):
        with tempfile.TemporaryDirectory() as tmp:
            film = json.loads((ROOT / "projects/qissat-raqam/episodes/d01.json").read_text(encoding="utf-8"))
            src = pathlib.Path(tmp) / "f.json"
            src.write_text(json.dumps(film, ensure_ascii=False), encoding="utf-8")
            empty = pathlib.Path(tmp) / "vo.json"
            empty.write_text("[]", encoding="utf-8")
            out = pathlib.Path(tmp) / "tl.json"
            subprocess.run([sys.executable, str(ROOT / "scripts/make_timeline.py"), "--film", str(src), "--vo", str(empty),
                            "--out", str(out), "--style-out", str(pathlib.Path(tmp) / "st.json")],
                           cwd=ROOT, capture_output=True, check=False)
            tl = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(tl["interaction"], "subtle")
            self.assertTrue(tl["cues"])
            self.assertTrue(all(c["name"] for c in tl["cues"]))

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_legacy_matches_the_typescript_mix(self):
        """Golden: the fallback in Soundtrack.tsx and foley.legacy_cues agree frame for frame."""
        esbuild = ROOT.parent / "node_modules/.bin/esbuild"
        candidates = [ROOT / "node_modules/.bin/esbuild.cmd", ROOT / "node_modules/.bin/esbuild",
                      *[p / "node_modules/.bin/esbuild.cmd" for p in ROOT.parents], *[p / "node_modules/.bin/esbuild" for p in ROOT.parents]]
        esbuild = next((c for c in candidates if c.exists()), None)
        if esbuild is None:
            self.skipTest("esbuild not found")
        src = (ROOT / "src/audio/Soundtrack.tsx").read_text(encoding="utf-8")
        body = src[src.index("const legacyAccents = (): Accent[] =>"):src.index("const accents: Accent[] = T.cues")]
        harness = ("import fs from 'fs';\ntype Accent = {at: number; name: string; gain: number; rate?: number};\n"
                   "const T = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));\nconst FPS = T.fps; const STYLE = T.style ?? {};\n"
                   "const cutStem = STYLE.sfx?.cut ?? 'whoosh_rtl';\nconst introStem = STYLE.sfx?.intro;\n"
                   "const defaultAccent = STYLE.sfx?.accent ?? 'ui_pop';\n" + body +
                   "\nconsole.log(JSON.stringify(legacyAccents().map(a=>[Math.max(0,Math.round(a.at*FPS)),a.name,a.gain])));\n")
        beats = [beat("b01", "hook", 0, 75), beat("b02", "device", 75), beat("b03", "stat", 135, sfx=[{"at": 7, "name": "ding", "gain": 0.3}]),
                 beat("b04", "cta", 195)]
        tl = {"fps": 30, "beats": beats, "style": {"sfx": {"intro": "riser_short", "cut": "pan_whoosh"}}}
        with tempfile.TemporaryDirectory() as tmp:
            t = pathlib.Path(tmp)
            (t / "h.ts").write_text(harness, encoding="utf-8")
            (t / "tl.json").write_text(json.dumps(tl), encoding="utf-8")
            subprocess.run([str(esbuild), str(t / "h.ts"), "--platform=node", "--format=cjs", f"--outfile={t / 'h.cjs'}",
                            "--log-level=error"], check=True, shell=sys.platform == "win32")
            js = json.loads(subprocess.run(["node", str(t / "h.cjs"), str(t / "tl.json")], capture_output=True, text=True, check=True).stdout)
        py = [[c["frame"], c["name"], c["gain"]] for c in foley.legacy_cues(beats, tl["style"], 30)]
        self.assertEqual(py, js)


if __name__ == "__main__":
    unittest.main()
