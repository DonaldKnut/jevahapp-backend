"""Vision scoring: NudeNet NSFW + OpenCLIP multi-label scene/safety.

Efficient Contabo path — one CLIP forward pass for:
  Christian worship, secular party, violence, gore, weapons, drugs, sexual imagery.
No extra models beyond NudeNet + OpenCLIP already loaded.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Optional

from . import config

logger = logging.getLogger("content-guardian.vision")

_nudenet = None
_nudenet_failed = False
_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None
_clip_failed = False
_clip_text_features = None  # cached normalized text embeddings

# Ordered label groups — softmax mass within each image is split across groups.
LABEL_GROUPS: list[tuple[str, list[str]]] = [
    (
        "christian",
        [
            "a Christian church service with pastor and congregation",
            "people worshipping God in a church with a cross and Bible",
            "a gospel choir singing praise music",
            "a preacher at a pulpit with an open Bible",
            "a person praying with hands folded or open Bible at home",
            "a Christian testimony or Bible study in a living room",
            "outdoor Christian worship or street preaching with a Bible",
            "a pastor teaching Scripture on camera in a studio",
        ],
    ),
    (
        "secular",
        [
            "a nightclub party with dancing and flashing lights",
            "people twerking or dancing provocatively in a club",
            "a secular music concert with crowd partying",
            "strip club or sexualized dance performance",
        ],
    ),
    (
        "violence",
        [
            "a person being violently beaten or assaulted",
            "a fist fight with someone punched and injured",
            "physical domestic violence attack on a person",
            "a mob violently attacking a person on the street",
            "graphic scene of someone being hit with a weapon",
        ],
    ),
    (
        "gore",
        [
            "graphic bloody gore and severe injuries",
            "bloody corpse or mutilated body",
            "extreme blood splatter from a violent wound",
        ],
    ),
    (
        "weapons",
        [
            "a person aiming a gun at another person",
            "brandishing a knife or machete in a threatening way",
            "armed robbery or shootout with firearms",
        ],
    ),
    (
        "drugs",
        [
            "people using illegal drugs or injecting narcotics",
            "piles of cocaine heroin or drug paraphernalia",
            "smoking crack or methamphetamine",
        ],
    ),
    (
        "sexual",
        [
            "pornographic sexual intercourse scene",
            "explicit nude sexual content",
            "people engaged in sexual activity on camera",
        ],
    ),
    (
        "neutral",
        [
            "an ordinary safe everyday photo of people talking",
            "a normal indoor interview or talking head video frame",
            "a calm outdoor street scene with pedestrians",
        ],
    ),
]

# NudeNet classes that indicate explicit sexual content
NUDENET_HOT = {
    "FEMALE_GENITALIA_EXPOSED",
    "MALE_GENITALIA_EXPOSED",
    "FEMALE_BREAST_EXPOSED",
    "BUTTOCKS_EXPOSED",
    "ANUS_EXPOSED",
    "FACE_SEXUAL",
}


def _decode_image(data: str):
    from PIL import Image

    raw = data
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    buf = base64.b64decode(raw)
    img = Image.open(io.BytesIO(buf)).convert("RGB")
    return img


def _load_nudenet():
    global _nudenet, _nudenet_failed
    if _nudenet_failed or not config.ENABLE_NUDENET:
        return None
    if _nudenet is not None:
        return _nudenet
    try:
        from nudenet import NudeDetector

        _nudenet = NudeDetector()
        logger.info("NudeNet loaded")
        return _nudenet
    except Exception as e:
        logger.warning("NudeNet unavailable: %s", e)
        _nudenet_failed = True
        return None


def _load_clip():
    global _clip_model, _clip_preprocess, _clip_tokenizer, _clip_failed, _clip_text_features
    if _clip_failed or not config.ENABLE_CLIP:
        return None
    if _clip_model is not None:
        return _clip_model
    try:
        import open_clip
        import torch
        import torch.nn.functional as F

        model, _, preprocess = open_clip.create_model_and_transforms(
            config.CLIP_MODEL, pretrained=config.CLIP_PRETRAINED
        )
        tokenizer = open_clip.get_tokenizer(config.CLIP_MODEL)
        model.eval()
        _clip_model = model
        _clip_preprocess = preprocess
        _clip_tokenizer = tokenizer

        # Cache text features once (all label prompts)
        all_prompts: list[str] = []
        for _, prompts in LABEL_GROUPS:
            all_prompts.extend(prompts)
        with torch.no_grad():
            tokens = tokenizer(all_prompts)
            text_features = model.encode_text(tokens)
            _clip_text_features = F.normalize(text_features, dim=-1)

        logger.info(
            "OpenCLIP loaded %s/%s (%d safety labels)",
            config.CLIP_MODEL,
            config.CLIP_PRETRAINED,
            len(all_prompts),
        )
        return _clip_model
    except Exception as e:
        logger.warning("OpenCLIP unavailable: %s", e)
        _clip_failed = True
        _clip_text_features = None
        return None


def score_nsfw(images: list) -> float:
    """Max NSFW / explicit probability across images (0-1) via NudeNet."""
    detector = _load_nudenet()
    if detector is None or not images:
        return 0.0

    max_score = 0.0
    for img in images:
        try:
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                img.save(tmp.name, format="JPEG", quality=85)
                path = tmp.name
            try:
                dets = detector.detect(path)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
            for d in dets or []:
                label = str(d.get("class") or d.get("label") or "")
                score = float(d.get("score") or d.get("confidence") or 0)
                upper = label.upper()
                if upper in NUDENET_HOT or label in NUDENET_HOT:
                    max_score = max(max_score, score)
                elif "EXPOSED" in upper or "SEXUAL" in upper:
                    max_score = max(max_score, score * 0.9)
        except Exception as e:
            logger.debug("NudeNet frame failed: %s", e)
    return round(min(1.0, max_score), 4)


def score_multilabel_clip(images: list) -> dict[str, float]:
    """
    Softmax over all prompt groups per image; average max group mass across frames.
    Returns scores for: christian, secular, violence, gore, weapons, drugs, sexual, neutral.
    """
    zeros = {name: 0.0 for name, _ in LABEL_GROUPS}
    model = _load_clip()
    if model is None or not images or _clip_text_features is None:
        return zeros

    import torch
    import torch.nn.functional as F

    assert _clip_preprocess is not None
    group_sizes = [len(prompts) for _, prompts in LABEL_GROUPS]
    accum = {name: [] for name, _ in LABEL_GROUPS}

    with torch.no_grad():
        for img in images:
            image_input = _clip_preprocess(img).unsqueeze(0)
            image_features = model.encode_image(image_input)
            image_features = F.normalize(image_features, dim=-1)
            logits = (100.0 * image_features @ _clip_text_features.T).softmax(dim=-1)[0]

            offset = 0
            for (name, _), size in zip(LABEL_GROUPS, group_sizes):
                mass = float(logits[offset : offset + size].sum().item())
                accum[name].append(mass)
                offset += size

    out: dict[str, float] = {}
    for name, vals in accum.items():
        out[name] = round(sum(vals) / max(1, len(vals)), 4)
    return out


def score_scenes(images: list) -> tuple[float, float]:
    """Backward-compatible (christian, secular) from multilabel CLIP. """
    scores = score_multilabel_clip(images)
    return scores.get("christian", 0.0), scores.get("secular", 0.0)


def score_vision(
    thumbnail: Optional[str] = None,
    frames: Optional[list[str]] = None,
    max_frames: Optional[int] = None,
) -> dict:
    """Decode images and return NSFW + multi-label safety scores."""
    cap = max_frames or config.MAX_FRAMES
    raw_list: list[str] = []
    if thumbnail:
        raw_list.append(thumbnail)
    if frames:
        if len(frames) <= cap:
            raw_list.extend(frames)
        else:
            for i in range(cap):
                idx = round(i * (len(frames) - 1) / max(1, cap - 1))
                raw_list.append(frames[idx])

    images = []
    for raw in raw_list[: cap + 1]:
        try:
            images.append(_decode_image(raw))
        except Exception as e:
            logger.debug("Bad image skipped: %s", e)

    signals: list[str] = []
    empty_safety = {
        "violence_score": 0.0,
        "gore_score": 0.0,
        "weapons_score": 0.0,
        "drugs_score": 0.0,
        "sexual_scene_score": 0.0,
    }
    if not images:
        return {
            "nsfw_score": 0.0,
            "christian_scene_score": 0.0,
            "secular_scene_score": 0.0,
            **empty_safety,
            "frame_count_scored": 0,
            "signals": ["no_vision_input"],
            "vision_available": bool(_load_nudenet() or _load_clip()),
        }

    nsfw = score_nsfw(images)
    labels = score_multilabel_clip(images)
    # Combine NudeNet + CLIP sexual for defense in depth
    sexual_clip = labels.get("sexual", 0.0)
    nsfw_combined = round(min(1.0, max(nsfw, sexual_clip * 0.95)), 4)

    nudenet_ok = _load_nudenet() is not None
    clip_ok = _load_clip() is not None
    vision_ok = nudenet_ok or clip_ok
    if not vision_ok:
        signals.append("vision_unavailable")
    if nsfw_combined > 0.3:
        signals.append("nsfw_signal")
    if labels.get("christian", 0) > 0.4:
        signals.append("christian_scene")
    if labels.get("secular", 0) > 0.4:
        signals.append("secular_scene")
    if labels.get("violence", 0) > 0.35:
        signals.append("violence_signal")
    if labels.get("gore", 0) > 0.3:
        signals.append("gore_signal")
    if labels.get("weapons", 0) > 0.35:
        signals.append("weapons_signal")
    if labels.get("drugs", 0) > 0.35:
        signals.append("drugs_signal")
    if sexual_clip > 0.35:
        signals.append("sexual_scene_signal")

    return {
        "nsfw_score": nsfw_combined,
        "christian_scene_score": labels.get("christian", 0.0),
        "secular_scene_score": labels.get("secular", 0.0),
        "violence_score": labels.get("violence", 0.0),
        "gore_score": labels.get("gore", 0.0),
        "weapons_score": labels.get("weapons", 0.0),
        "drugs_score": labels.get("drugs", 0.0),
        "sexual_scene_score": sexual_clip,
        "frame_count_scored": len(images),
        "signals": signals,
        "vision_available": vision_ok,
    }


def vision_status() -> dict:
    return {
        "nudenet": config.ENABLE_NUDENET and not _nudenet_failed,
        "clip": config.ENABLE_CLIP and not _clip_failed,
        "nudenet_loaded": _nudenet is not None,
        "clip_loaded": _clip_model is not None,
        "safety_labels": [name for name, _ in LABEL_GROUPS],
    }
