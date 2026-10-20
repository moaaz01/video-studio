#!/usr/bin/env python3
"""Compile a short Arabic brief into a `film/film.json` plan plus a shot list.

    python scripts/shotlist.py examples/shotlist/brief-device.md --out film/eval-shotlist.json --json
    python scripts/shotlist.py examples/shotlist/brief-device.md --shots-out out/shotlist/shots.md

The brief supplies the facts; this file owns the structure. Only two facts move
the plan: the one number it states (no number -> no stat beat) and the
distribution line, whose handle has to close the film.

The rules are code: the 120 BPM grid, the 15-22 bar window, the 4.5 s hook
ceiling, the cta handle, the kind alternation, and the reading budget
(advise.py's constants, imported not copied). `advise.py` reviews the plan
before it is written; a MUST or a score under the floor refuses it.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import tempfile
from typing import Any, NamedTuple

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import advise  # noqa: E402  measured review: imported, never re-implemented
import make_timeline  # noqa: E402  the compiler's word budget, same constants

FPS, BPM, WIDTH, HEIGHT = 30, 120, 1920, 1080
BAR = 240 / BPM  # seconds per bar on the 120 BPM grid
BARS_RANGE, HOOK_MAX_SECONDS = (15, 22), 4.5
DEFAULT_LOOK, DEFAULT_MIN_SCORE = "paper-clean", 90  # explainers: cinematic-look.md
KINDS, TONES = {"hook", "device", "stat", "cta"}, {"ink", "paper", "emerald"}
STAT_KEYS = {"from", "to", "suffix", "label"}
STAGE = {
    "hook": ("push-in", "إطار كامل؛ نص مركزي في ثلاث كتل، وقاعدة رفيعة، والشعار أسفل الوسط"),
    "device": ("settle", "إطار كامل؛ الهاتف على يسار الإطار، والعمود النصي بمحاذاة اليمين"),
    "stat": ("drift", "إطار كامل؛ الرقم داخل حلقة في المركز، والتسمية تحته"),
    "cta": ("push-in", "إطار كامل؛ بطاقة النهاية: الأيقونة، الاسم، سطر الوعد، زر التحميل، جهات الاتصال"),
}
ACTIONS = {
    "hook": "تدخل الكلمات كلمةً كلمة، وتُرسم القاعدة، ثم يظهر شعار التطبيق أسفل الوسط.",
    "stat": "يعدّ الرقم من صفر، وتُملأ الحلقة، ثم تثبت التسمية.",
    "cta": "يثبت الشعار والاسم، ثم زر التحميل، ثم جهات الاتصال، وأخيرًا سطر التوزيع.",
}
DEVICE_ACTIONS = (
    "يهبط الهاتف ويثبت على المحور، ثم تُرفع ملزمة PDF ويظهر سؤالها على الصفحة الأولى.",
    "تنتقل الشاشة إلى التلخيص العربي، ثم إلى بطاقة الاختبار على الصفحات المحددة.",
)
HANDLE_RE = re.compile(r"t\.me/\S+|wa\.me/\S+|\+\d[\d\s]{7,}")
NUMBER_RE = re.compile(r"([0-9٠-٩]+)(?:\s+([^\n]+))?")
ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
COLUMNS = ("#", "beat", "seconds", "framing", "camera", "action", "text", "vo")


class ShotlistError(ValueError):
    """The brief cannot support a plan, or the plan cannot pass its checks."""


class Proof(NamedTuple):
    to: int
    suffix: str
    label: str


class Brief(NamedTuple):
    path: pathlib.Path
    title: str
    features: tuple[str, ...]
    proof: Proof | None
    handle: str
    distribution: str


def plain(line: str) -> str:
    """List markers and emphasis off, so a label can be matched."""
    return re.sub(r"^[-*+]\s+", "", line.strip()).replace("**", "").replace("`", "").strip()


def labelled(text: str, *labels: str) -> str | None:
    """The value after the first `label:` line, in brief order."""
    for line in text.splitlines():
        clean = plain(line)
        for label in labels:
            if clean.startswith(label):
                value = clean[len(label) :].lstrip(":： ").strip()
                if value:
                    return value.rstrip(" .،؛")
    return None


def parse_title(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            head = plain(line[2:])
            return re.split(r"\s+[—–-]\s+", head)[0].strip() or head
    return "المنصة"


def parse_features(text: str) -> tuple[str, ...]:
    raw = labelled(text, "الميزات الحقيقية", "الميزات", "ميزات") or ""
    parts = (part.strip(" .،؛") for part in re.split(r"[·؛;،]", raw))
    return tuple(part for part in parts if part)


def parse_contact(text: str) -> tuple[str, str]:
    """The distribution handle and the line that carries it; no handle, no film."""
    match = HANDLE_RE.search(text)
    if not match:
        raise ShotlistError("the brief has no distribution handle: add a t.me/…, wa.me/… or phone line")
    handle = match.group(0).rstrip(".,;:،؛)")
    for line in text.splitlines():
        if handle in line:
            clean = plain(line).split(":", 1)[-1].strip().rstrip(" .")
            return handle, clean or f"التحميل عبر {handle}"
    return handle, f"التحميل عبر {handle}"


def parse_proof(text: str) -> Proof | None:
    """The number the brief states, plus the unit and label that follow it."""
    if not re.search(r"\d", text):
        return None  # no number -> no stat beat, see build_beats
    match = NUMBER_RE.search(labelled(text, "رقم صادق", "الرقم الصادق", "رقم") or text)
    if not match:
        return None
    words = match.group(2).strip(" .،؛").split() if match.group(2) else []
    return Proof(
        to=int(match.group(1).translate(ARABIC_DIGITS)),
        suffix=words[0] if len(words) >= 2 else "",
        label=" ".join(words[1:] if len(words) >= 2 else words),
    )


def load_brief(path: pathlib.Path) -> Brief:
    if not path.is_file():
        raise ShotlistError(f"no such brief: {path}")
    text = path.read_text(encoding="utf-8")
    features = parse_features(text)
    if len(features) < 2:
        raise ShotlistError("the brief must list at least two real features under «الميزات»")
    handle, distribution = parse_contact(text)
    return Brief(path, parse_title(text), features, parse_proof(text), handle, distribution)


def beat(kind: str, bars: int, tone: str, *, stat: dict[str, Any] | None = None, **copy: Any) -> dict[str, Any]:
    """One plan beat; `stat` stays out of the non-stat beats entirely."""
    data: dict[str, Any] = {"kind": kind, "bars": bars, "tone": tone, "kicker": "", "line1": "", "line2": "", "vo": (), **copy}
    if stat is not None:
        data["stat"] = stat
    return data


def build_beats(facts: Brief) -> list[dict[str, Any]]:
    """The deck: a hook, the feature screens, the number, the end card."""
    features = facts.features
    if facts.proof is None:
        tail = [beat("device", 10, "paper", kicker="الميزات", line1=features[0], line2="، ".join(features[1:]),
                     vo=("ارفع الملزمة، ولخِّص بالعربية، ثم اختبر نفسك.",))]
    else:
        proof = facts.proof
        tail = [
            beat("stat", 3, "ink", kicker="العيّنة", vo=(f"{proof.to} صفحةً في الملزمة التجريبية.",),
                 stat={"from": 0, "to": proof.to, "suffix": proof.suffix, "label": proof.label}),
            beat("device", 4, "paper", kicker="التلخيص والاختبار", line1=features[1],
                 line2=f"ثم {features[2]}" if len(features) > 2 else "",
                 vo=("لخِّص بالعربية، ثم اختبر نفسك على صفحاتٍ محددة.",)),
        ]
    deck = [
        beat("hook", 2, "ink", kicker=facts.title, line1="ارفع ملزمتك واسألها",
             line2="لطلاب الجامعات", vo=("من الملزمةِ إلى السؤال، بلا طباعة.",)),
        beat("device", 4, "paper", kicker="الملزمة", line1=features[0],
             line2="من هاتفك، بلا طباعة", vo=("ارفع ملزمةَ PDF، واسأل عن أيِّ صفحةٍ فيها.",)),
        *tail,
        beat("cta", 3, "emerald", line1="جرّبها على ملزمتك",
             line2=facts.distribution, vo=("حمِّل التطبيق، وابدأ بملزمتك الأولى.",)),
    ]
    return [{"id": f"b{index:02d}-{item['kind']}", **item} for index, item in enumerate(deck, 1)]


def build_plan(facts: Brief) -> dict[str, Any]:
    beats = build_beats(facts)
    bars = sum(int(item["bars"]) for item in beats)
    return {"look": DEFAULT_LOOK, "slug": facts.path.stem, "fps": FPS, "width": WIDTH, "height": HEIGHT,
            "bpm": BPM, "frames": round(bars * BAR * FPS), "beats": beats}


def beat_seconds(plan: dict[str, Any], item: dict[str, Any]) -> float:
    return advise.frames_of(item, plan) / plan["fps"]


def validate(plan: dict[str, Any], facts: Brief) -> list[str]:
    """The rule sheet, checked against the plan we are about to emit."""
    beats, problems = plan["beats"], []
    total = sum(int(item["bars"]) for item in beats)
    if not BARS_RANGE[0] <= total <= BARS_RANGE[1]:
        problems.append(f"{total} bars outside the {BARS_RANGE[0]}-{BARS_RANGE[1]} window")
    if plan["frames"] != round(total * BAR * plan["fps"]):
        problems.append(f"frames {plan['frames']} != bar grid")
    if beats[0]["kind"] != "hook" or beats[-1]["kind"] != "cta":
        problems.append("the film must open on a hook and close on a cta")
    hook_seconds = beat_seconds(plan, beats[0])
    if hook_seconds > HOOK_MAX_SECONDS:
        problems.append(f"hook runs {hook_seconds:.1f}s > {HOOK_MAX_SECONDS}s")
    if facts.handle not in (beats[-1].get("line2") or ""):
        problems.append(f"the cta's line2 must carry the handle «{facts.handle}»")
    problems += [f"{a['id']} and {b['id']} are both {b['kind']}"
                 for a, b in zip(beats, beats[1:]) if a["kind"] == b["kind"]]
    stats = [item for item in beats if item["kind"] == "stat"]
    if (facts.proof is None and stats) or (facts.proof is not None and len(stats) != 1):
        problems.append("the stat beat must exist exactly when the brief states a number")
    for item in beats:
        where, stat = item["id"], item.get("stat")
        if item["kind"] not in KINDS or item["tone"] not in TONES:
            problems.append(f"{where}: kind/tone outside {sorted(KINDS)}/{sorted(TONES)}")
        if not isinstance(item["bars"], int) or item["bars"] <= 0:
            problems.append(f"{where}: bars must be a positive int")
        if not item.get("vo"):
            problems.append(f"{where}: no vo line")
        if item["kind"] == "stat" and set(stat or {}) != STAT_KEYS:
            problems.append(f"{where}: stat needs exactly {sorted(STAT_KEYS)}")
        if item["kind"] != "stat" and stat is not None:
            problems.append(f"{where}: stat only belongs to the stat beat")
        seconds = beat_seconds(plan, item)
        chars = len(advise.text_of(item).replace(" ", ""))
        if chars > advise.READ_BUDGET * advise.CHARS_PER_SEC * seconds:
            problems.append(f"{where}: {chars} non-space chars do not fit {seconds:.1f}s")
        words = make_timeline.words(" ".join(
            part for part in (item.get("kicker"), item.get("line1"), item.get("line2"), (stat or {}).get("label")) if part))
        if words * make_timeline.SEC_PER_WORD > seconds:
            problems.append(f"{where}: {words} words do not fit {seconds:.1f}s")
    return problems


def compile_brief(path: pathlib.Path) -> tuple[dict[str, Any], Brief, dict[str, Any]]:
    """Brief in, checked plan and review out; refuses instead of guessing."""
    facts = load_brief(path)
    plan = build_plan(facts)
    problems = validate(plan, facts)
    if not problems:
        with tempfile.TemporaryDirectory(prefix="shotlist-") as tmp:
            review_path = pathlib.Path(tmp) / "plan.json"
            review_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            report = advise.advise(review_path)
        if not report["counts"]["MUST"] and report["score"] >= DEFAULT_MIN_SCORE:
            return plan, facts, report
        problems = [f"advise.py: score {report['score']}/100, "
                    f"{report['counts']['MUST']} MUST finding(s), floor {DEFAULT_MIN_SCORE}"]
    raise ShotlistError("\n".join(problems))


def build_shots(plan: dict[str, Any]) -> list[dict[str, Any]]:
    shots: list[dict[str, Any]] = []
    devices = 0
    for no, item in enumerate(plan["beats"], start=1):
        kind, stat = item["kind"], item.get("stat") or {}
        action = DEVICE_ACTIONS[min(devices, len(DEVICE_ACTIONS) - 1)] if kind == "device" else ACTIONS[kind]
        devices += kind == "device"
        parts = [item.get("kicker"), item.get("line1"), item.get("line2")]
        if stat:
            parts.append(f"{stat.get('to')} {stat.get('suffix', '')}".strip())
        camera, framing = STAGE[kind]
        shots.append({"no": no, "beat": item["id"], "seconds": round(beat_seconds(plan, item), 2),
                      "framing": framing, "camera": camera, "action": action,
                      "text": " · ".join(str(part) for part in [*parts, stat.get("label")] if part),
                      "vo": " ".join(item.get("vo") or [])})
    return shots


def shots_markdown(shots: list[dict[str, Any]]) -> str:
    """The shot list as a markdown table, one row per beat."""
    header = "| " + " | ".join(COLUMNS) + " |"
    rows = ["|---:|---|---:|---|---|---|---|---|"]
    for shot in shots:
        cells = [str(shot["no"]), shot["beat"], f"{shot['seconds']:.1f}"]
        rows.append("| " + " | ".join(cells + [shot[column] for column in COLUMNS[3:]]) + " |")
    return "\n".join([header, *rows]) + "\n"


def summary(plan: dict[str, Any], facts: Brief, shots: list[dict[str, Any]], report: dict[str, Any],
            brief: str, out: str | None, shots_out: str | None) -> str:
    beats = plan["beats"]
    bars = sum(int(item["bars"]) for item in beats)
    seconds = sum(beat_seconds(plan, item) for item in beats)
    lines = [
        f"brief      {brief}",
        f"plan       {out or '(not written — pass --out)'}",
        f"look       {plan['look']} · {plan['width']}x{plan['height']} · {plan['fps']} fps · {plan['bpm']} BPM",
        f"grid       {bars} bars = {seconds:.1f} s = {plan['frames']} frames · {len(beats)} beats · {len(shots)} shots",
        f"review     advise score {report['score']}/100 · MUST {report['counts']['MUST']} · "
        f"SHOULD {report['counts']['SHOULD']} · COULD {report['counts']['COULD']}",
        f"facts      {len(facts.features)} features · number {facts.proof.to if facts.proof else 'none'} · handle {facts.handle}",
    ]
    if shots_out:
        lines.append(f"shots      {shots_out} (written)")
    lines += ["", f"{'beat':14s} {'kind':8s} {'bars':>4s} {'seconds':>7s}  framing"]
    lines += [f"{item['id']:14s} {item['kind']:8s} {item['bars']:4d} {shot['seconds']:7.1f}  {shot['framing']}"
              for item, shot in zip(beats, shots)]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="turn a short Arabic brief into a film plan and a shot list")
    parser.add_argument("brief", help="markdown brief, e.g. examples/shotlist/brief-device.md")
    parser.add_argument("--out", metavar="FILE", help="write the plan here (film/film.json shape)")
    parser.add_argument("--shots-out", metavar="FILE", help="write the shot list here as a markdown table")
    parser.add_argument("--json", action="store_true", help="print {plan, shots} instead of the summary")
    args = parser.parse_args()
    out_path = ROOT / args.out if args.out else None
    shots_path = ROOT / args.shots_out if args.shots_out else None
    try:
        plan, facts, report = compile_brief(ROOT / args.brief)
        shots = build_shots(plan)
        for path, text in ((out_path, json.dumps(plan, ensure_ascii=False, indent=2) + "\n"),
                           (shots_path, shots_markdown(shots))):
            if path is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
    except ShotlistError as error:
        print("shotlist: refused", file=sys.stderr)
        for line in str(error).splitlines():
            print(f"  - {line}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"shotlist: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"plan": plan, "shots": shots}, ensure_ascii=False, indent=2))
    else:
        print(summary(plan, facts, shots, report, args.brief, args.out, args.shots_out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
