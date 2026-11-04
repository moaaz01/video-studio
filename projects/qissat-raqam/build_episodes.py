#!/usr/bin/env python3
"""Build «قصّة رقم» episode films from compact specs.

One spec = one episode: a number hook, a question, three steps (each with one
visual idea), a twist and an end card. The builder lays every layer out for both
16:9 and 9:16 (`v` overrides), so one film.json serves both masters.

    python projects/qissat-raqam/build_episodes.py            # writes episodes/dNN.json
    python projects/qissat-raqam/build_episodes.py 1 3        # only these days

Facts live in each spec's `src` line and are shown on the end card. Every number
is either arithmetic shown on screen or taken from the cited source; nothing here
is invented. VO lines carry full tashkeel; display copy is derived by stripping it.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "episodes"
BRAND = "قصّة رقم"  # change here if the channel name changes
TAGLINE = "رقم جديد كل يوم"
TASHKEEL = re.compile("[ؗ-ًؚ-ٰٟۖ-ۭ]")
BARS = {"hook": 4, "q": 3, "s1": 5, "s2": 5, "s3": 5, "twist": 4, "end": 3}
TONES = {"hook": "ink", "q": "paper", "s1": "paper", "s2": "ink", "s3": "paper", "twist": "ink", "end": "emerald"}
HAIR = {"hairStyle": "hijab", "accent": "#0E8A6E", "shirt": "#1A2A36"}
CURVE = "M8 12 C20 70 40 82 92 90"  # illustrative decay, always labelled as such
LOOP = "M50 8 C78 8 92 28 92 50 C92 78 72 92 50 92 C22 92 8 72 8 50 C8 22 28 8 50 8"


def plain(s: str) -> str:
    return TASHKEEL.sub("", s)


def text(t: str, y: float, size: float, at: float = 0, **kw) -> dict:
    return {"type": "text", "text": t, "x": 0.5, "y": y, "size": size, "at": at, "anim": "rise", "w": 0.84, **kw}


def title_layer(t: str) -> dict:
    return text(t, 0.17, 0.3, 0.0, v={"w": 0.9})


def flow(nodes: list[str]) -> list[dict]:
    """Glass cards in reading order (right → left on 16:9, top → bottom on 9:16), joined by drawn connectors."""
    n = len(nodes)
    cards, layers, pos = [], [], []
    for i, label in enumerate(nodes):
        k = i - (n - 1) / 2
        pos.append(((0.5 - k * 0.3, 0.55), (0.5, 0.52 + k * 0.17)))
        (lx, ly), (vx, vy) = pos[-1]
        cards.append({"type": "card", "title": label, "x": lx, "y": ly, "w": 0.26, "at": 0.4 + i * 0.5, "z": 0.4 * i,
                      "v": {"x": vx, "y": vy, "w": 0.84}})
    for i in range(n - 1):
        (ax, ay), (avx, avy) = pos[i]
        (bx, by), (bvx, bvy) = pos[i + 1]
        layers.append({"type": "connector", "x": ax - 0.13, "y": ay, "to": [bx + 0.13, by],
                       "at": 0.7 + i * 0.5, "v": {"x": avx, "y": avy + 0.05, "to": [bvx, bvy - 0.05]}})
    return layers + cards


def viz(v: dict) -> list[dict]:
    kind = v["type"]
    if kind == "count":
        out = [{"type": "counter", "to": v["to"], "suffix": v.get("suffix", ""), "x": 0.5, "y": 0.5, "size": 0.55,
                "at": 0.2, "dur": 1.8, "glow": True, "v": {"size": 0.5}}]
        if v.get("label"):
            out.append(text(v["label"], 0.8, 0.2, 1.0, v={"w": 0.9}))
        return out
    if kind == "bars":
        return [{"type": "bars", "values": v["values"], "labels": v["labels"], "suffix": v.get("suffix", ""), "ltr": v.get("ltr", False),
                 "x": 0.5, "y": 0.58, "w": 0.7, "h": 0.5, "at": 0.3, "v": {"w": 0.8, "h": 0.42, "y": 0.56}}]
    if kind == "flow":
        return flow(v["nodes"])
    if kind == "curve":
        earth = [{"type": "shape", "shape": "circle", "x": 0.5, "y": 0.55, "size": 0.22, "color": "#2B86A8", "at": 0.1,
                  "v": {"y": 0.5, "size": 0.3}}] if v.get("earth") else []
        return [*earth, {"type": "path", "d": v.get("d", CURVE), "x": 0.5, "y": 0.55, "size": 0.6, "glow": True, "width": 5,
                 "at": 0.3, "dur": 2.0, "v": {"size": 0.8, "y": 0.5}},
                text(v.get("note", "رسم توضيحي"), 0.9, 0.12, 1.5, v={"w": 0.9})]
    raise SystemExit(f"unknown viz {kind!r}")


# one palette per pillar; backdrops rotate by role so no two adjacent beats share a ground
PALETTE_BY_PILLAR = {"مالك بالأرقام": "emerald-gold", "تقنية": "electric-indigo", "جسمك وعقلك": "sunset-plum",
                     "كيف تربح الشركات": "midnight-amber", "الكون والأرض": "ocean-cyan", "عقول عربية": "emerald-gold"}
BACKDROP_BY_ROLE = {"hook": "beams", "q": "mesh", "s1": "grid", "s2": "topo", "s3": "flow", "twist": "dots", "end": "mesh"}
PALETTE = {"name": "midnight-amber"}  # set per episode by build()


def beat(bid: str, role: str, layers: list[dict], vo: str) -> dict:
    return {"id": bid, "kind": "gfx", "tone": TONES[role], "bars": BARS[role], "vo": [vo],
            "data": {"palette": PALETTE["name"], "backdrop": BACKDROP_BY_ROLE[role], "layers": layers}}


def build(spec: dict) -> dict:
    PALETTE["name"] = spec.get("palette") or PALETTE_BY_PILLAR.get(spec["pillar"], "midnight-amber")
    hook = spec["hook"]
    hook_layers = [text(hook["text"], 0.42, 0.95, 0.1, anim="pop", fx="gradient", v={"size": 0.85, "w": 0.92})]
    if hook.get("label"):
        hook_layers.append(text(hook["label"], 0.72, 0.22, 0.9, v={"w": 0.9}))
    beats = [beat("b01", "hook", hook_layers, hook["vo"])]

    q = spec["q"]
    if q.get("character"):
        beats.append({"id": "b02", "kind": "character", "tone": "paper", "bars": BARS["q"], "kicker": spec["pillar"],
                      "line1": q["text"], "vo": [q["vo"]],
                      "data": {"character": {**HAIR, "hairStyle": spec.get("hair", "hijab")},
                               "gestures": [{"at": 0, "pose": "present"}, {"at": 1.8, "pose": "point"}],
                               "expression": "confident"}})
    else:
        beats.append(beat("b02", "q", [text(q["text"], 0.45, 0.4, 0.1)], q["vo"]))

    for i, step in enumerate(spec["steps"], 1):
        role = f"s{i}"
        beats.append(beat(f"b{i + 2:02d}", role, [title_layer(step["title"]), *viz(step["viz"])], step["vo"]))

    tw = spec["twist"]
    beats.append(beat("b06", "twist", [
        {"type": "shape", "shape": "ring", "x": 0.5, "y": 0.5, "size": 0.9, "at": 0, "anim": "spin", "glow": True, "z": 1},
        text(tw["text"], 0.5, 0.3, 0.3, w=0.5, v={"w": 0.62})], tw["vo"]))
    beats.append(beat("b07", "end", [
        text(BRAND, 0.34, 0.5, 0.1, anim="pop", fx="gradient"),
        text(TAGLINE, 0.5, 0.26, 0.6),
        text(spec["src"], 0.72, 0.15, 1.0, v={"w": 0.9})], spec["end_vo"]))

    return {
        "slug": f"qr-d{spec['day']:02d}", "format": "launch", "fps": 30, "width": 1920, "height": 1080, "bpm": 120,
        "look": "premium-warm",
        "style": {"template": "stats-impact", "look": "premium-warm", "motion": 1.0, "background": "paper-glow",
                  "transitions": ["blur", "slide"]},
        "voice": {"provider": "fish", "model": "s2.1-pro-free", "language": "ar", "speed": 1.0},
        "beats": beats,
    }


END_VO = "رَقْمٌ جَدِيدٌ كُلَّ يَوْمٍ. تَابِعْ قِصَّةَ رَقَم."

SPECS = [
    {"day": 1, "pillar": "مالك بالأرقام",
     "hook": {"text": "54750 ريال", "label": "فنجان بـ15 ريالاً يومياً لعشر سنوات",
              "vo": "فِنْجَانُ قَهْوَةٍ كُلَّ يَوْمٍ... كَمْ يُكَلِّفُكَ حَقًّا؟"},
     "q": {"text": "كم يكلّفك فنجانك اليومي؟", "vo": "لِنَحْسُبْهَا مَعًا، خُطْوَةً خُطْوَةً."},
     "steps": [
         {"title": "في اليوم", "viz": {"type": "count", "to": 15, "suffix": " ريال"},
          "vo": "خَمْسَةَ عَشَرَ رِيَالًا فِي اليَوْمِ تَبْدُو مَبْلَغًا صَغِيرًا لَا يَسْتَحِقُّ التَّفْكِير."},
         {"title": "في السنة", "viz": {"type": "count", "to": 5475, "suffix": " ريال"},
          "vo": "فِي السَّنَةِ: خَمْسَةُ آلَافٍ وَأَرْبَعُمِئَةٍ وَخَمْسَةٌ وَسَبْعُونَ رِيَالًا."},
         {"title": "في عشر سنوات", "viz": {"type": "bars", "values": [5475, 16425, 27375, 54750],
                                          "labels": ["سنة", "3 سنوات", "5 سنوات", "10 سنوات"], "ltr": True},
          "vo": "وَفِي عَشْرِ سَنَوَاتٍ: أَرْبَعَةٌ وَخَمْسُونَ أَلْفًا وَسَبْعُمِئَةٍ وَخَمْسُونَ رِيَالًا."}],
     "twist": {"text": "ثمن العادة الصغيرة يكبر مع الوقت",
               "vo": "لَيْسَ المَقْصُودُ أَنْ تَتْرُكَ قَهْوَتَكَ، بَلْ أَنْ تَعْرِفَ ثَمَنَ عَادَاتِكَ الصَّغِيرَةِ."},
     "src": "الحساب: 15×365×10 (السعر مثال)", "end_vo": END_VO},

    {"day": 2, "pillar": "تقنية",
     "hook": {"text": "واحد في المليون", "label": "فرصة أن يفتح غريب هاتفك بوجهه، حسب آبل",
              "vo": "وَاحِدٌ فِي المِلْيُون. هَذِهِ فُرْصَةُ أَنْ يَفْتَحَ غَرِيبٌ هَاتِفَكَ بِوَجْهِهِ، حَسَبَ آبِل."},
     "q": {"text": "كيف يعرف هاتفك أنك أنت؟", "character": True, "vo": "فَكَيْفَ يَعْرِفُ هَاتِفُكَ أَنَّكَ أَنْتَ؟"},
     "steps": [
         {"title": "يرسم وجهك", "viz": {"type": "flow", "nodes": ["أشعة غير مرئية", "خريطة عمق", "وجهك"]},
          "vo": "يُسْقِطُ الهَاتِفُ أَشِعَّةً تَحْتَ حَمْرَاءَ لِيَبْنِيَ خَرِيطَةَ عُمْقٍ لِوَجْهِكَ، لَا صُورَةً عَادِيَّةً."},
         {"title": "يقارن", "viz": {"type": "flow", "nodes": ["تمثيل رياضي", "مقارنة", "فتح أو رفض"]},
          "vo": "ثُمَّ تُحَوِّلُهَا شَبَكَةٌ عَصَبِيَّةٌ إِلَى تَمْثِيلٍ رِيَاضِيٍّ، وَتُقَارِنُهُ بِمَا حَفِظَهُ الهَاتِفُ عَنْك."},
         {"title": "حدّ الأمان", "viz": {"type": "count", "to": 5, "suffix": " محاولات", "label": "ثم يطلب الرمز السري"},
          "vo": "وَبَعْدَ خَمْسِ مُحَاوَلَاتٍ فَاشِلَةٍ يَطْلُبُ الهَاتِفُ الرَّمْزَ السِّرِّيّ."}],
     "twist": {"text": "التوائم والإخوة والأطفال دون 13: النسبة تختلف",
               "vo": "وَالرَّقْمُ يَضْعُفُ مَعَ التَّوْأَمِ وَالإِخْوَةِ وَمَنْ هُمْ دُونَ الثَّالِثَةَ عَشْرَةَ، فَالأَمَانُ لَيْسَ مُطْلَقًا."},
     "src": "المصدر: Apple Platform Security — الرقم ادّعاء الشركة", "end_vo": END_VO},

    {"day": 3, "pillar": "جسمك وعقلك",
     "hook": {"text": "70 ساعة", "label": "قضاها شخص واحد ليقيس كم ننسى",
              "vo": "سَبْعُونَ سَاعَةً قَضَاهَا شَخْصٌ وَاحِدٌ لِيَقِيسَ كَمْ نَنْسَى."},
     "q": {"text": "لماذا ننسى بهذه السرعة؟", "character": True, "hair": "short",
           "vo": "لِمَاذَا يَضِيعُ مَا تَحْفَظُهُ بِهَذِهِ السُّرْعَة؟"},
     "steps": [
         {"title": "البداية", "viz": {"type": "count", "to": 1885, "label": "اختبر إبنغهاوس ذاكرته بمقاطع بلا معنى"},
          "vo": "فِي عَامِ أَلْفٍ وَثَمَانِمِئَةٍ وَخَمْسَةٍ وَثَمَانِينَ اخْتَبَرَ إِبِّنْغَهَاوْس ذَاكِرَتَهُ بِمَقَاطِعَ لَا مَعْنَى لَهَا."},
         {"title": "منحنى النسيان", "viz": {"type": "curve", "note": "رسم توضيحي لما تتذكره عبر الوقت"},
          "vo": "وَفِي أَلْفَيْنِ وَخَمْسَةَ عَشَرَ أَعَادَ بَاحِثَانِ التَّجْرِبَةَ، وَقَاسَا مَا بَقِيَ بَعْدَ عِشْرِينَ دَقِيقَةً وَحَتَّى وَاحِدٍ وَثَلَاثِينَ يَوْمًا."},
         {"title": "كيف تبطئه؟", "viz": {"type": "flow", "nodes": ["تعلّم", "مراجعة مبكرة", "ذاكرة أطول"]},
          "vo": "وَالمُرَاجَعَةُ المُبَكِّرَةُ تُبْطِئُ النِّسْيَانَ، وَلِهَذَا تَنْجَحُ تَقْنِيَةُ التَّكْرَارِ المُتَبَاعِد."}],
     "twist": {"text": "المنحنى لم يكن سلساً تماماً: ارتفاع بعد يوم",
               "vo": "وَالطَّرِيفُ أَنَّ المُنْحَنَى فِي التَّجْرِبَةِ الحَدِيثَةِ لَمْ يَكُنْ سَلِسًا تَمَامًا، بَلْ ظَهَرَ فِيهِ ارْتِفَاعٌ بَعْدَ مُرُورِ يَوْمٍ."},
     "src": "المصدر: Murre & Dros 2015 (الرسم توضيحي)", "end_vo": END_VO},

    {"day": 4, "pillar": "كيف تربح الشركات",
     "hook": {"text": "1956", "label": "سنة تقول الرواية إن طاولة فقدت أرجلها",
              "vo": "عَامُ أَلْفٍ وَتِسْعِمِئَةٍ وَسِتَّةٍ وَخَمْسِينَ. طَاوِلَةٌ لَا تَدْخُلُ السَّيَّارَة."},
     "q": {"text": "لماذا تبيع إيكيا أثاثها قطعاً؟", "vo": "فَلِمَاذَا تَبِيعُ إِيكِيَا أَثَاثَهَا مُفَكَّكًا؟"},
     "steps": [
         {"title": "الرواية", "viz": {"type": "flow", "nodes": ["طاولة كاملة", "لا تدخل السيارة", "تُفكّ الأرجل"]},
          "vo": "تَقُولُ الرِّوَايَةُ الشَّائِعَةُ إِنَّ مُوَظَّفًا نَزَعَ أَرْجُلَ طَاوِلَةٍ لِيُدْخِلَهَا سَيَّارَتَهُ."},
         {"title": "المنطق", "viz": {"type": "flow", "nodes": ["حجم أقل", "نقل أرخص", "سعر أقل"]},
          "vo": "القِطَعُ المُسَطَّحَةُ تَشْغَلُ حَيِّزًا أَقَلَّ، فَيَرْخُصُ نَقْلُهَا وَتَخْزِينُهَا."},
         {"title": "الشراكة", "viz": {"type": "flow", "nodes": ["أنت تحمل", "أنت تركّب", "التوفير لك"]},
          "vo": "وَيَنْقُلُ التَّرْكِيبُ جُزْءًا مِنَ العَمَلِ إِلَى الزَّبُون، فَيَنْخَفِضُ السِّعْر."}],
     "twist": {"text": "المؤرخون يختلفون: الأثاث المسطّح أقدم",
               "vo": "وَالمُؤَرِّخُونَ يَخْتَلِفُونَ: الأَثَاثُ المُسَطَّحُ وُجِدَ قَبْلَ ذَلِكَ، لَكِنَّ إِيكِيَا جَعَلَتْهُ عَادَةً عَالَمِيَّة."},
     "src": "المصدر: تقارير منشورة — الرواية متنازع عليها", "end_vo": END_VO},

    {"day": 5, "pillar": "الكون والأرض",
     "hook": {"text": "28000 كم/ساعة", "label": "سرعة محطة الفضاء الدولية تقريباً",
              "vo": "نَحْوُ ثَمَانِيَةٍ وَعِشْرِينَ أَلْفَ كِيلُومِتْرٍ فِي السَّاعَة. سُرْعَةُ مَحَطَّةِ الفَضَاءِ الدَّوْلِيَّة."},
     "q": {"text": "لماذا لا تسقط على الأرض؟", "vo": "فَلِمَاذَا لَا تَسْقُطُ عَلَى الأَرْض؟"},
     "steps": [
         {"title": "هي تسقط", "viz": {"type": "flow", "nodes": ["الجاذبية تسحب", "سقوط دائم", "لكن..."]},
          "vo": "فِي الحَقِيقَةِ هِيَ تَسْقُطُ دَائِمًا، فَالجَاذِبِيَّةُ تَسْحَبُهَا نَحْوَ الأَرْضِ."},
         {"title": "تخطئها", "viz": {"type": "curve", "d": LOOP, "earth": True, "note": "رسم توضيحي"},
          "vo": "لَكِنَّهَا تَتَحَرَّكُ جَانِبِيًّا بِسُرْعَةٍ كَبِيرَةٍ، فَيَنْحَنِي سُقُوطُهَا حَوْلَ كُرَةِ الأَرْضِ وَلَا يَصِلُ إِلَيْهَا."},
         {"title": "دورة كاملة", "viz": {"type": "count", "to": 90, "suffix": " دقيقة", "label": "تقريباً لدورة واحدة"},
          "vo": "وَهَكَذَا تُتِمُّ المَحَطَّةُ دَوْرَةً كَامِلَةً حَوْلَ الأَرْضِ كُلَّ تِسْعِينَ دَقِيقَةً تَقْرِيبًا."}],
     "twist": {"text": "السقوط الحر المستمر يجعل روّادها يطفون",
               "vo": "وَهَذَا السُّقُوطُ الحُرُّ المُسْتَمِرُّ هُوَ مَا يَجْعَلُ رُوَّادَهَا يَطْفُونَ دَاخِلَهَا."},
     "src": "المصدر: ناسا — أرقام تقريبية", "end_vo": END_VO},

    {"day": 6, "pillar": "مالك بالأرقام",
     "hook": {"text": "72", "label": "الرقم الذي يخبرك متى يتضاعف مالك",
              "vo": "اثْنَانِ وَسَبْعُونَ. رَقْمٌ يُخْبِرُكَ مَتَى يَتَضَاعَفُ مَالُكَ."},
     "q": {"text": "كيف تستخدمه؟", "vo": "كَيْفَ تَسْتَخْدِمُهُ؟ اقْسِمْهُ عَلَى نِسْبَةِ العَائِد."},
     "steps": [
         {"title": "المعادلة", "viz": {"type": "flow", "nodes": ["72", "÷ العائد %", "= سنوات المضاعفة"]},
          "vo": "اثْنَانِ وَسَبْعُونَ مَقْسُومًا عَلَى العَائِدِ يُعْطِيكَ عَدَدَ السَّنَوَاتِ تَقْرِيبًا."},
         {"title": "أمثلة", "viz": {"type": "bars", "values": [12, 8, 6], "labels": ["6%", "9%", "12%"], "suffix": " سنة"},
          "vo": "بِعَائِدِ سِتَّةٍ بِالمِئَةِ يَتَضَاعَفُ المَالُ فِي اثْنَتَيْ عَشْرَةَ سَنَةً. وَبِتِسْعَةٍ فِي ثَمَانٍ. وَبِاثْنَيْ عَشَرَ فِي سِتّ."},
         {"title": "احذر", "viz": {"type": "flow", "nodes": ["عائد أعلى", "وقت أقل", "مخاطرة أكبر"]},
          "vo": "وَهَذَا تَقْرِيبٌ رِيَاضِيٌّ لِلعَوَائِدِ المُتَوَسِّطَةِ، وَالعَائِدُ الأَعْلَى يَحْمِلُ مُخَاطَرَةً أَكْبَر."}],
     "twist": {"text": "التضخم يعمل بالقاعدة نفسها ضد مالك",
               "vo": "وَالتَّضَخُّمُ يَعْمَلُ بِالقَاعِدَةِ نَفْسِهَا لِيُنْقِصَ قِيمَةَ مَالِكَ، فَاحْسِبِ العَائِدَ بَعْدَ التَّضَخُّمِ دَائِمًا."},
     "src": "قاعدة تقريبية — ليست نصيحة استثمارية", "end_vo": END_VO},

    {"day": 7, "pillar": "عقول عربية",
     "hook": {"text": "1200 سنة", "label": "تقريباً: عمر كلمة «خوارزمية»",
              "vo": "قَبْلَ نَحْوِ أَلْفٍ وَمِئَتَيْ سَنَةٍ وُلِدَ اسْمٌ يَسْتَخْدِمُهُ هَاتِفُكَ كُلَّ يَوْم."},
     "q": {"text": "من هو الخوارزمي؟", "character": True, "hair": "short",
           "vo": "إِنَّهُ مُحَمَّدُ بْنُ مُوسَى الخَوَارِزْمِيّ."},
     "steps": [
         {"title": "بغداد", "viz": {"type": "flow", "nodes": ["بغداد", "بيت الحكمة", "كتاب الجبر"]},
          "vo": "عَاشَ فِي بَغْدَادَ فِي القَرْنِ التَّاسِعِ المِيلَادِيّ، وَأَلَّفَ كِتَابًا فِي الحِسَابِ بِالجَبْرِ وَالمُقَابَلَة."},
         {"title": "الجبر", "viz": {"type": "flow", "nodes": ["كلمة الجبر", "algebra", "علم الجبر"]},
          "vo": "وَمِنْ كَلِمَةِ الجَبْرِ فِي عُنْوَانِ كِتَابِهِ جَاءَتْ كَلِمَةُ algebra فِي اللُّغَاتِ الأُورُبِّيَّة."},
         {"title": "الخوارزمية", "viz": {"type": "flow", "nodes": ["الخوارزمي", "Algoritmi", "algorithm"]},
          "vo": "وَمِنْ تَرْجَمَةِ اسْمِهِ إِلَى اللَّاتِينِيَّةِ جَاءَتْ كَلِمَةُ algorithm، أَيِ الخَوَارِزْمِيَّة."}],
     "twist": {"text": "الخوارزمية: خطوات يُنفّذها هاتفك كل لحظة",
               "vo": "وَالخَوَارِزْمِيَّةُ سِلْسِلَةُ خُطُوَاتٍ تُنَفِّذُهَا هَوَاتِفُنَا وَتَطْبِيقَاتُنَا فِي كُلِّ لَحْظَة."},
     "src": "المصدر: مراجع تاريخ الرياضيات (القرن 9 م)", "end_vo": END_VO},
]


def main(argv: list[str]) -> int:
    days = {int(a) for a in argv} or {s["day"] for s in SPECS}
    OUT.mkdir(exist_ok=True)
    for spec in SPECS:
        if spec["day"] not in days:
            continue
        film = build(spec)
        film["beats"][0]["kicker"] = plain(spec["pillar"])
        path = OUT / f"d{spec['day']:02d}.json"
        path.write_text(json.dumps(film, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total = sum(BARS.values()) * 2
        print(f"wrote {path.relative_to(HERE.parents[1])} ({total}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
