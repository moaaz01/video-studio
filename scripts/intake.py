#!/usr/bin/env python3
"""Intake: the questions an agent must ask before a film exists.

A film built on invented product facts is thrown away. This tool makes the
missing information visible and blocking: it holds the question bank for each
format, writes `film/intake.json`, checks that every required answer and asset is
really present, and can turn the answers into the six-block brief.

    python scripts/intake.py init --format explainer --slug my-reel
    python scripts/intake.py questions --format explainer
    python scripts/intake.py check --intake film/intake.json
    python scripts/intake.py brief --intake film/intake.json --out film/brief.md

The agent asks the user; this script never guesses an answer and never fills a
field silently. `check` exits 1 while anything required is missing, so no beat
can be written against a half-empty brief.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FORMATS = ("explainer", "kinetic")

# ── question bank ───────────────────────────────────────────────────────────
# kind: text | long | list | int | choice | asset-list
# `min`/`max` apply to lists; `choices` to choice; `asset` names an asset slot.
Q = dict


def q(qid: str, prompt: str, why: str, kind: str = "text", required: bool = True,
      example: str = "", choices: list[str] | None = None,
      min_items: int = 0, max_items: int = 0,
      min_value: int = 0, max_value: int = 0) -> Q:
    return {
        "id": qid, "prompt": prompt, "why": why, "kind": kind,
        "required": required, "example": example,
        "choices": choices or [], "min": min_items, "max": max_items,
        "min_value": min_value, "max_value": max_value,
    }


COMMON: list[Q] = [
    q("product_name", "ما اسم المنتج أو الخدمة كما يظهر في العلامة؟",
      "الاسم هو أول ما يُطبع وآخر ما يُتذكّر.", example="متجر الشام للشحن"),
    q("one_liner", "بجملة واحدة: ماذا يفعل المنتج، ولمن؟",
      "الجملة الواحدة تمنع الفيلم من أن يصبح قائمة ميزات.", "long",
      example="متجر رقمي جاهز باسمك، يعمل من تلجرام بلا تطبيق."),
    q("audience", "من هو الشخص الواحد الذي نريد إقناعه؟",
      "كل قرار بصري يُقاس على هذا الشخص، لا على «الجميع».", "long",
      example="صاحب متجر صغير يبيع بطاقات الألعاب على تلجرام."),
    q("product_type", "ما نوع المنتج؟",
      "النوع يحدد الصيغة: تطبيق، لعبة، متجر، منتج مادي، دورة، أداة مطورين.", "choice",
      choices=["mobile-app", "saas-web", "game", "physical-product", "store-service", "course-education", "personal-brand", "api-devtool", "other"],
      example="store-service"),
    q("goal", "ما هدف الفيلم؟",
      "الهدف يحدد البنية: إطلاق، شرح، بيع، تعليم، توظيف، إعلان.", "choice",
      choices=["launch", "explain", "sell", "teach", "recruit", "announce"],
      example="explain"),
    q("emotion", "ما الإحساس الذي يجب أن يبقى بعد آخر إطار؟",
      "الإحساس يحدد الإيقاع واللون، لا الزخرفة.", "choice",
      choices=["premium", "hype", "calm", "smart", "warm"],
      example="smart"),
    q("promise", "ما الوعد الواحد الذي يتحقق فعلاً — لا شعار؟",
      "الادعاء الذي لا يستطيع المنتج إثباته سيُحذف.", "long",
      example="تفتح متجرك وتستقبل أول طلب في أقل من ١٥ دقيقة."),
    q("proof_points", "اذكر ٣ إلى ٧ حقائق/ميزات حقيقية يمكن طباعتها.",
      "كل نقطة يجب أن تكون موجودة في المنتج، لا في خيال الحملة.", "list",
      example="دفع بالمحفظة، كود تسليم فوري، ثلاثة مصادر سعر.", min_items=3, max_items=7),
    q("cta", "ما الإجراء الواحد المطلوب في النهاية؟",
      "فيلم بلا إجراء واحد ينتهي بلا أثر.", "long",
      example="اكتب «قالب» في التعليقات، أو افتح الرابط."),
    q("contact", "ما الحساب/الرابط الذي يظهر في نهاية الفيلم؟",
      "يُطبع كما هو؛ لا تخترع handle.", example="@shamshop_bot · github.com/moaaz01/video-studio"),
    q("language", "لغة الفيلم ولهجته؟",
      "الصوت والنص يجب أن يتكلما بلهجة واحدة.", "choice",
      choices=["ar-msa", "ar-shami", "ar-gulf", "ar-egyptian", "en", "bilingual"],
      example="ar-msa"),
    q("platforms", "أين سيُنشر الفيلم؟ (اختر كل المنصات)",
      "كل منصة تضيف نسبة وأبعاداً ومنطقة آمنة؛ نصدّرها كلها من نفس التايم لاين.", "list",
      choices=["x", "instagram", "tiktok", "youtube", "linkedin", "snapchat", "facebook", "other"],
      example="x, instagram, tiktok", min_items=1, max_items=7),
    q("aspect", "ما النسبة الأساسية؟",
      "نسبة واحدة أساسية؛ البقية مشتقة منها.", "choice",
      choices=["9x16", "16x9", "1x1", "4x5"], example="9x16"),
    q("duration_s", "كم ثانية تقريباً؟",
      "المدة تُحسب من الصوت المقاس، لا من الرغبة.", "int",
      example="45", min_value=6, max_value=120),
    q("brand_accent", "ما لون العلامة الأساسي (hex)؟",
      "لون واحد يملكه الفيلم؛ الباقي درجات.", example="#2F6BFF"),
    q("brand_font", "هل للعلامة خط خاص؟ (اختياري)",
      "إن لم يكن، نستخدم Tajawal/Reem Kufi من الاستوديو.", "text", required=False,
      example="Tajawal Bold"),
    q("voice_provider", "كيف نولّد الصوت؟",
      "Fish افتراضي؛ ElevenLabs اختياري ويحتاج مفتاحاً؛ none لفيلم بلا تعليق.",
      "choice", choices=["fish", "elevenlabs", "none"], example="fish"),
    q("voice_id", "معرّف الصوت أو اسمه إن اخترت ElevenLabs/Fish. (اختياري)",
      "لا نختار صوتاً عشوائياً؛ نسمع ٢–٣ ثم نختار.", "text", required=False,
      example="voice id from the provider dashboard"),
    q("music_mode", "الموسيقى: أصلية من الاستوديو أم ملف خارجي؟",
      "الاستوديو يؤلف bed على نفس الـ BPM؛ الخارجي يحتاج ملفاً وترخيصاً.",
      "choice", choices=["original", "external", "none"], example="original"),
    q("music_mood", "مزاج الموسيقى في ثلاث كلمات. (اختياري)",
      "يحدد الآلات والإيقاع، لا النوع فقط.", "text", required=False,
      example="دافئ، واثق، سريع"),
    q("website", "رابط الموقع أو المستودع أو مسار التطبيق المحلي. (اختياري)",
      "للتحقق من النصوص والواجهات؛ لا نعيد رسمها من الذاكرة.", "text", required=False,
      example="https://example.com أو /path/to/app"),
    q("notes", "أي شيء آخر يجب ألا ننساه؟ (اختياري)",
      "قيود، كلمات ممنوعة، حسابات لا تظهر، تفاصيل عقد.", "long", required=False,
      example="لا نذكر السعر؛ لا نستخدم كلمة «الأفضل»."),
]

EXPLAINER: list[Q] = [
    q("hook_number", "ما الرقم الذي يفتح الفيديو؟ (٧ أدوات، ٣ أسباب، ٥ أخطاء...)",
      "الهوك الرقمي يحدد توقع المشاهد ويمنع المقدمة الضبابية.", example="٧"),
    q("points", "اكتب ٣ إلى ٧ نقاط، كل نقطة سطر واحد قصير (اسم + فكرة).",
      "كل نقطة = جملة منطوقة = beat واحد = بطاقة واحدة.", "list",
      example="ملف واحد: النص والإيقاع والصوت. | ثلاثة أبعاد من نفس التايم لاين. | قياس لا ذوق.",
      min_items=3, max_items=7),
    q("twist", "أين المفاجأة/التحول بعد الهوك؟ (اختياري)",
      "التحول يمنع الفيديو من أن يكون قائمة مسطحة.", "long", required=False,
      example="النقطة السابعة صنعت هذا الفيديو نفسه."),
    q("cta_keyword", "ما الكلمة التي يكتبها المشاهد في التعليق؟",
      "CTA بكلمة واحدة قابل للقياس؛ «تابعنا» ليس CTA.", example="قالب"),
    q("freebie", "ماذا يحصل عليه المشاهد مقابل التعليق؟",
      "وعد ملموس، لا «المزيد من المحتوى».", "long",
      example="ملف JSON جاهز للقالب + دليل التركيب."),
    q("visual_mode", "ما نوع البطاقات؟",
      "البطاقة تشرح الجملة؛ لا تكررها.", "choice",
      choices=["cards", "type-only", "mixed", "product-shots"], example="cards"),
    q("card_types", "أي أنواع بطاقات تريد؟ (اختياري)",
      "كل نوع له بياناته؛ نختار ما يخدم النقطة.", "list", required=False,
      example="checklist, counter, window, steps, compare, quote, image, statement",
      min_items=0, max_items=8),
    q("voice_tone", "نبرة الصوت؟",
      "تحدد السرعة والوقفات، لا «صوت جميل» فقط.", "choice",
      choices=["warm", "authoritative", "energetic", "calm"], example="warm"),
    q("caption_style", "هل نحرق الترجمة على الفيديو؟",
      "X يشغّل صامتاً؛ النص على الشاشة ليس اختيارياً.", "choice",
      choices=["burned", "none"], example="burned"),
]

KINETIC: list[Q] = [
    q("launch_claim", "ما الجملة/الادعاء الذي يفتح الفيلم؟",
      "كلمتان إلى خمس، تُقال بصوت عالٍ وتُرسم بحجم الشاشة.", "long",
      example="فيديو عربي. بلا مونتاج."),
    q("tempo_bpm", "ما الإيقاع (BPM)؟ ١٥٠–١٧٥ للترايلر، ١٢٠–١٢٨ للهادئ.",
      "كل shot يقاس بالـ beat؛ الإيقاع يحدد طول الفيلم.", "int", example="160",
      min_value=120, max_value=175),
    q("genre", "نوع الموسيقى/المزاج. (اختياري)",
      "drum & bass، phonk، breakbeat، أو bed هادئ.", "text", required=False,
      example="drum and bass، مقطعية، بلا صوت بشري"),
    q("visual_mode", "ما مصدر الصور؟",
      "نوعي فقط، أم key art/product shots حقيقية؟", "choice",
      choices=["type-only", "type+art", "product-shots"], example="type-only"),
    q("end_card", "نص بطاقة النهاية: الاسم، السطر، والرابط/الحساب.",
      "آخر إطار هو ما يُلتقط ويُشارك.", "long",
      example="VIDEO STUDIO · استوديو الفيديو العربي · github.com/moaaz01/video-studio"),
    q("sfx_kit", "مجموعة المؤثرات؟",
      "الاستوديو عنده kit جاهز؛ Scenario اختياري لتوليد kit خاص.", "choice",
      choices=["studio", "scenario", "none"], example="studio"),
]

ASSETS: dict[str, dict] = {
    "logo": {
        "prompt": "ارفع شعار العلامة (SVG أفضل، أو PNG بخلفية شفافة).",
        "why": "الشعار في النهاية والافتتاحية يجب أن يكون الأصل، لا إعادة رسم.",
        "required_for": {"kinetic"}, "extensions": [".svg", ".png"],
        "multiple": False, "example": "public/assets/<slug>/logo.svg",
    },
    "product_shot": {
        "prompt": "ارفع ١–٣ صور حقيقية للمنتج/الخدمة (أو لقطات شاشة).",
        "why": "الصورة الحقيقية هي دليل الثقة؛ لا نولّد واجهة المنتج.",
        "required_for": set(), "extensions": [".jpg", ".jpeg", ".png", ".webp"],
        "multiple": True, "example": "public/assets/<slug>/product-01.png",
    },
    "screenshot": {
        "prompt": "ارفع ١–٣ لقطات شاشة حقيقية للتطبيق/الموقع.",
        "why": "النصوص والألوان تُسحب من الواجهة نفسها، لا من الذاكرة.",
        "required_for": set(), "extensions": [".jpg", ".jpeg", ".png", ".webp"],
        "multiple": True, "example": "public/assets/<slug>/screen-01.png",
    },
    "key_art": {
        "prompt": "ارفع ١–٢ صور key art أو صور منتج عالية الدقة (≥ 2048px عرض).",
        "why": "Picture shots تحتاج عرضاً كافياً للـ punch-in دون softness.",
        "required_for": set(), "extensions": [".jpg", ".jpeg", ".png", ".webp"],
        "multiple": True, "example": "public/assets/<slug>/key-art-01.png",
    },
    "font": {
        "prompt": "ارفع خط العلامة إن وُجد (TTF/OTF/WOFF2).",
        "why": "الخط جزء من الهوية؛ البديل الافتراضي Tajawal.",
        "required_for": set(), "extensions": [".ttf", ".otf", ".woff2"],
        "multiple": False, "example": "public/assets/<slug>/brand.ttf",
    },
}


def bank(fmt: str) -> list[Q]:
    if fmt == "explainer":
        return COMMON + EXPLAINER
    if fmt == "kinetic":
        return COMMON + KINETIC
    raise SystemExit(f"unknown format {fmt!r}; choose from {', '.join(FORMATS)}")


def defaults(fmt: str) -> dict:
    answers = {
        "language": "ar-msa",
        "platforms": ["x"],
        "aspect": "9x16" if fmt == "explainer" else "16x9",
        "duration_s": 45 if fmt == "explainer" else 30,
        "voice_provider": "fish" if fmt == "explainer" else "none",
        "music_mode": "original",
        "visual_mode": "cards" if fmt == "explainer" else "type-only",
        "caption_style": "burned" if fmt == "explainer" else "none",
        "sfx_kit": "studio" if fmt == "kinetic" else "studio",
        "voice_tone": "warm" if fmt == "explainer" else "energetic",
    }
    return answers


def state(fmt: str, slug: str) -> dict:
    return {
        "version": 1,
        "format": fmt,
        "slug": slug,
        "created": _dt.date.today().isoformat(),
        "answers": defaults(fmt),
        "assets": {name: ([] if spec["multiple"] else "") for name, spec in ASSETS.items()},
    }


def load(path: pathlib.Path) -> dict:
    if not path.exists():
        raise SystemExit(f"{path} not found — run: python scripts/intake.py init --format explainer --slug <slug>")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("format") not in FORMATS:
        raise SystemExit(f"{path}: format must be one of {FORMATS}")
    return data


def filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(str(v).strip() for v in value)
    return bool(value)


def asset_values(data: dict, name: str) -> list[str]:
    raw = (data.get("assets") or {}).get(name)
    if isinstance(raw, str):
        return [raw] if raw.strip() else []
    if isinstance(raw, list):
        return [str(v).strip() for v in raw if str(v).strip()]
    return []


def resolve_asset(path: str) -> pathlib.Path:
    p = pathlib.Path(path)
    return p if p.is_absolute() else (ROOT / p)


def check_asset(path: str, spec: dict, fmt: str) -> tuple[bool, str]:
    p = resolve_asset(path)
    if p.is_absolute() and ROOT not in p.parents and p != ROOT:
        return False, "use a repo-relative path under public/assets/<slug>/ (no local absolute paths in a public repo)"
    if ".." in pathlib.PurePath(path).parts:
        return False, "path must not climb out of the repo"
    if not p.exists() or not p.is_file():
        return False, f"file not found: {path}"
    if p.stat().st_size == 0:
        return False, f"file is empty: {path}"
    if p.suffix.lower() not in spec["extensions"]:
        return False, f"{p.suffix or '(no extension)'} is not one of {', '.join(spec['extensions'])}"
    if not path.startswith("public/"):
        return False, "put delivered assets under public/assets/<slug>/ so a clone can render them"
    return True, "ok"


def check(data: dict, strict: bool = False) -> tuple[list[dict], list[dict]]:
    """Return (checks, problems). Checks are the full table; problems are failures."""
    fmt = data["format"]
    answers = data.get("answers") or {}
    checks: list[dict] = []
    problems: list[dict] = []

    def add(qid: str, label: str, ok: bool, detail: str, required: bool) -> None:
        row = {"id": qid, "label": label, "pass": ok, "required": required, "detail": detail}
        checks.append(row)
        if required and not ok:
            problems.append(row)

    for item in bank(fmt):
        value = answers.get(item["id"])
        ok = filled(value)
        detail = "" if ok else "missing"
        if item["kind"] == "choice" and ok and value not in item["choices"]:
            ok, detail = False, f"choose one of {', '.join(item['choices'])}"
        if item["kind"] == "int" and ok:
            try:
                number = int(value)
                lo = item.get("min_value") or 6
                hi = item.get("max_value") or 120
                ok = lo <= number <= hi
                detail = "" if ok else f"must be {lo}..{hi}"
            except (TypeError, ValueError):
                ok, detail = False, "must be an integer"
        if item["kind"] == "list" and ok:
            values = [str(v).strip() for v in value if str(v).strip()]
            if item.get("min") and len(values) < item["min"]:
                ok, detail = False, f"needs at least {item['min']} items (has {len(values)})"
            if item.get("max") and len(values) > item["max"]:
                ok, detail = False, f"needs at most {item['max']} items (has {len(values)})"
            if item.get("choices"):
                bad = [v for v in values if v not in item["choices"]]
                if bad:
                    ok, detail = False, "unknown value(s): " + ", ".join(bad)
        add(item["id"], item["prompt"], ok, detail, item["required"])

    # Format-specific checks that are not just presence.
    if fmt == "explainer":
        hook = str(answers.get("hook_number") or "")
        hook_ok = bool(re.search(r"[0-9٠-٩]", hook))
        add("hook_number.digit", "الهوك يحتوي رقماً", hook_ok,
            "" if hook_ok else "اكتب عدداً صريحاً مثل ٧ أو 7", True)
        points = [str(v).strip() for v in (answers.get("points") or []) if str(v).strip()]
        add("points.count", "عدد النقاط ٣–٧", 3 <= len(points) <= 7,
            f"has {len(points)}", True)
        cta_ok = bool(str(answers.get("cta_keyword") or "").strip())
        add("cta_keyword.present", "كلمة CTA موجودة", cta_ok,
            "" if cta_ok else "اكتب كلمة واحدة", True)
    else:
        tempo = answers.get("tempo_bpm")
        try:
            bpm = int(tempo)
            ok = 120 <= bpm <= 175
        except (TypeError, ValueError):
            bpm, ok = 0, False
        add("tempo_bpm.range", "الإيقاع ١٢٠–١٧٥ BPM", ok, f"{bpm or '?'} BPM", True)
        points = [str(v).strip() for v in (answers.get("proof_points") or []) if str(v).strip()]
        add("proof_points.count", "عدد الحقائق ٣–٥", 3 <= len(points) <= 5, f"has {len(points)}", True)

    # Assets: required by format and by the chosen visual mode.
    required_assets: set[str] = set()
    for name, spec in ASSETS.items():
        if fmt in spec["required_for"]:
            required_assets.add(name)
    if fmt == "kinetic":
        mode = answers.get("visual_mode")
        if mode == "type+art":
            required_assets.add("key_art")
        elif mode == "product-shots":
            required_assets.add("product_shot")
    if fmt == "explainer" and answers.get("visual_mode") in ("product-shots",):
        required_assets.add("screenshot")

    for name, spec in ASSETS.items():
        values = asset_values(data, name)
        required = name in required_assets
        if not values:
            add(f"asset.{name}", spec["prompt"], False,
                "missing" if required else "optional / not supplied", required)
            continue
        if not spec["multiple"] and len(values) > 1:
            add(f"asset.{name}", spec["prompt"], False, "only one file is allowed", required)
            continue
        for i, value in enumerate(values, 1):
            ok, detail = check_asset(value, spec, fmt)
            add(f"asset.{name}.{i}", f"{spec['prompt']} [{i}]", ok, detail, required)

    # Strict is about the promise of the format, not about optional fields.
    if strict:
        if fmt == "explainer":
            add("asset.real_ui", "صورة/لقطة حقيقية واحدة على الأقل",
                bool(asset_values(data, "screenshot") or asset_values(data, "product_shot")),
                "strict explainer needs one real product image or screenshot", True)
        if fmt == "kinetic":
            add("asset.logo", "شعار أصلي للنهاية", bool(asset_values(data, "logo")),
                "strict kinetic needs the real logo", True)

    return checks, problems


def cmd_init(args: argparse.Namespace) -> int:
    out = pathlib.Path(args.out)
    if out.exists() and not args.force:
        print(f"{out} exists — pass --force to overwrite")
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(state(args.format, args.slug), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}  ({args.format}, slug {args.slug})")
    print("\nnext: ask the user the questions, fill the answers, then:")
    print(f"  python scripts/intake.py check --intake {out}")
    return 0


def cmd_questions(args: argparse.Namespace) -> int:
    rows = [*bank(args.format)]
    if args.json:
        print(json.dumps({"format": args.format, "questions": rows,
                          "assets": ASSETS}, ensure_ascii=False, indent=2))
        return 0
    print(f"Intake · {args.format} · {len(rows)} questions + {len(ASSETS)} asset slots\n")
    for i, item in enumerate(rows, 1):
        flag = "required" if item["required"] else "optional"
        print(f"{i:2d}. [{flag}] {item['id']} — {item['prompt']}")
        if item["why"]:
            print(f"    why: {item['why']}")
        if item["choices"]:
            print(f"    choices: {', '.join(item['choices'])}")
        if item["example"]:
            print(f"    example: {item['example']}")
    print("\nAssets:")
    for name, spec in ASSETS.items():
        req = "required" if args.format in spec["required_for"] else "optional"
        print(f"  - {name} [{req}] — {spec['prompt']}  ({spec['example']})")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    data = load(pathlib.Path(args.intake))
    checks, problems = check(data, args.strict)
    if args.json:
        print(json.dumps({"format": data["format"], "slug": data.get("slug"),
                          "pass": not problems, "checks": checks,
                          "missing": [p["id"] for p in problems]}, ensure_ascii=False, indent=2))
        return 0 if not problems else 1
    print(f"Intake check · {data['format']} · {data.get('slug')}\n")
    for row in checks:
        mark = "PASS" if row["pass"] else ("FAIL" if row["required"] else "skip")
        print(f"  {mark:4s} {row['id']:24s} {row['detail']}")
    if problems:
        print(f"\n{len(problems)} required item(s) missing. Ask the user, then fill the intake:")
        for p in problems:
            print(f"  - {p['id']}: {p['label']} ({p['detail']})")
        return 1
    print("\nOK  every required answer and asset is present")
    return 0


def _bullets(values, empty: str = "—") -> str:
    items = [str(v).strip() for v in (values or []) if str(v).strip()]
    return "\n".join(f"  - {item}" for item in items) if items else f"  - {empty}"


def cmd_brief(args: argparse.Namespace) -> int:
    path = pathlib.Path(args.intake)
    data = load(path)
    checks, problems = check(data, False)
    if problems and not args.allow_missing:
        print(f"{len(problems)} required item(s) are still missing; finish the intake first")
        for p in problems:
            print(f"  - {p['id']}: {p['label']}")
        return 1
    out = pathlib.Path(args.out)
    if out.exists() and not args.force:
        print(f"{out} exists — pass --force to overwrite")
        return 1
    a = data.get("answers") or {}
    fmt = data["format"]
    points = a.get("points") if fmt == "explainer" else a.get("proof_points")
    points_block = _bullets(points)
    assets = []
    for name in ASSETS:
        for value in asset_values(data, name):
            assets.append(f"  - {name}: `{value}`")
    assets_block = "\n".join(assets) if assets else "  - لا توجد أصول بعد — اطلبها من المستخدم"
    direction = "#kinetic" if fmt == "kinetic" else "#editorial أو #ui-film"
    gotchas = (
        "1. كلمة تظهر قبل أن تُقال — كل كلمة تُكشف عند نطقها.\n"
        "2. موسيقى أعلى من الصوت — duck تحت كل جملة.\n"
        "3. نص قريب من حواف Reels — ابقَ داخل 80% الوسط."
        if fmt == "explainer" else
        "1. shot يpark — كل إطار فيه حركة أو قطع.\n"
        "2. حروف عربية تُفكك — كلمات فقط، لا letters.\n"
        "3. ادعاء بلا دليل — كل رقم من الفيلم أو من المستخدم."
    )
    structure = (
        "| bars | time | kind | what happens | value |\n|---|---|---|---|---|\n"
        + "\n".join(f"| — | — | explainer | {str(p).strip()} | |" for p in (points or []))
        if fmt == "explainer" else
        "| beat | shot | ground | text | cue |\n|---|---|---|---|---|\n"
        "| 0 | charge | bg | — | riser |\n| 1 | slam | accent | — | impact |"
    )
    brief = f"""# {a.get('product_name') or data.get('slug')} — brief

> Generated from `{path}` by `scripts/intake.py brief`. The intake is the source
> of truth; do not add a fact here that is not in it.

## `<inputs>` — what must be known before anything is drawn

- **Product / what it is:** {a.get('product_name') or '—'} — {a.get('one_liner') or '—'}
- **Type / goal / emotion:** {a.get('product_type') or '—'} · {a.get('goal') or '—'} · {a.get('emotion') or '—'}
- **Audience — the one person:** {a.get('audience') or '—'}
- **The one promise (a claim the product actually keeps):** {a.get('promise') or '—'}
- **The one action (exactly one):** {a.get('cta') or '—'}
- **Contact / end card:** {a.get('contact') or '—'}
- **Aspect + length:** {a.get('aspect') or '—'}, about {a.get('duration_s') or '—'} s
- **Language / voice:** {a.get('language') or '—'} · provider {a.get('voice_provider') or '—'}
- **Assets given:**
{assets_block}
- **Facts I may print:**
{points_block}
- **Facts I must not print:** anything not listed above; no invented ratings, users, awards, prices or screenshots.

## `<direction>` — the feel, and what is banned

- **Direction:** {direction} (choose one from `references/visual-direction.md`)
- **Two references, cited:** pin with `scripts/corpus.py`; `refs check --min 2` must pass.
- **Three moves that define it:** (motion / type / colour — one line each)
- **Banned in this film:** (at least three specific things)
- **What the audience should feel at 0 s / middle / last frame:**

## `<structure>` — the clock

{structure}

## `<build>` — how it stays reproducible

- **Format:** `{fmt}` — see `references/formats/{'explainer-reel' if fmt == 'explainer' else 'kinetic-film'}.md`
- **Tokens:** {a.get('brand_accent') or '—'} accent; font {a.get('brand_font') or 'Tajawal'}
- **Voice:** {a.get('voice_provider') or '—'} · {a.get('voice_tone') or '—'}
- **Music:** {a.get('music_mode') or '—'} · {a.get('music_mood') or '—'}
- **Platforms / safe area:** {', '.join(a.get('platforms') or []) or '—'} · check with `studio.py safe`
- **Every style is a pure function of `frame`** — no state, no timers, no randomness
- **Stills at every beat before the full render:** yes

## `<gotchas>` — the three things that will look cheap

{gotchas}

## `<start>` — the first action

> Read this brief back as five sentences, name the direction, and show the beat
> table on the clock. Only then write the film JSON.
"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(brief, encoding="utf-8")
    print(f"wrote {out}  ({fmt}, {len(points or [])} points)")
    return 0


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="intake questions and completeness gate")
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("init", help="write film/intake.json with empty answers")
    i.add_argument("--format", choices=FORMATS, required=True)
    i.add_argument("--slug", required=True)
    i.add_argument("--out", default="film/intake.json")
    i.add_argument("--force", action="store_true")
    i.set_defaults(func=cmd_init)

    q = sub.add_parser("questions", help="print the questions to ask the user")
    q.add_argument("--format", choices=FORMATS, default="explainer")
    q.add_argument("--json", action="store_true")
    q.set_defaults(func=cmd_questions)

    c = sub.add_parser("check", help="fail until every required answer and asset exists")
    c.add_argument("--intake", default="film/intake.json")
    c.add_argument("--strict", action="store_true")
    c.add_argument("--json", action="store_true")
    c.set_defaults(func=cmd_check)

    b = sub.add_parser("brief", help="turn a complete intake into film/brief.md")
    b.add_argument("--intake", default="film/intake.json")
    b.add_argument("--out", default="film/brief.md")
    b.add_argument("--force", action="store_true")
    b.add_argument("--allow-missing", action="store_true")
    b.set_defaults(func=cmd_brief)

    args = p.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()
