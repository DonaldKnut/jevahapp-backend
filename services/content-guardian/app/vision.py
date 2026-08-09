"""Vision scoring: NudeNet NSFW + OpenCLIP church vs club scenes."""
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

CHRISTIAN_PROMPTS = [
    "a Christian church service with pastor and congregation",
    "people worshipping God in a church with a cross and Bible",
    "a gospel choir singing praise music",
    "a preacher at a pulpit with an open Bible",
]

SECULAR_PROMPTS = [
    "a nightclub party with dancing and flashing lights",
    "people twerking or dancing provocatively in a club",
    "a secular music concert with crowd partying",
    "strip club or sexualized dance performance",
]


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
    global _clip_model, _clip_preprocess, _clip_tokenizer, _clip_failed
    if _clip_failed or not config.ENABLE_CLIP:
        return None
    if _clip_model is not None:
        return _clip_model
    try:
        import open_clip
        import torch

        model, _, preprocess = open_clip.create_model_and_transforms(
            config.CLIP_MODEL, pretrained=config.CLIP_PRETRAINED
        )
        tokenizer = open_clip.get_tokenizer(config.CLIP_MODEL)
        model.eval()
        _clip_model = model
        _clip_preprocess = preprocess
        _clip_tokenizer = tokenizer
        logger.info("OpenCLIP loaded %s/%s", config.CLIP_MODEL, config.CLIP_PRETRAINED)
        return _clip_model
    except Exception as e:
        logger.warning("OpenCLIP unavailable: %s", e)
        _clip_failed = True
        return None


def score_nsfw(images: list) -> float:
    """Max NSFW-ish probability across images (0-1)."""
    detector = _load_nudenet()
    if detector is None or not images:
        return 0.0

    # Labels that indicate explicit content
    hot = {
        "FEMALE_GENITALIA_EXPOSED",
        "MALE_GENITALIA_EXPOSED",
        "FEMALE_BREAST_EXPOSED",
        "BUTTOCKS_EXPOSED",
        "ANUS_EXPOSED",
        "BELLY_EXPOSED",
    }
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
                label = d.get("class") or d.get("label") or ""
                score = float(d.get("score") or d.get("confidence") or 0)
                if label in hot:
                    max_score = max(max_score, score)
                elif "EXPOSED" in str(label).upper():
                    max_score = max(max_score, score * 0.85)
        except Exception as e:
            logger.debug("NudeNet frame failed: %s", e)
    return round(min(1.0, max_score), 4)


def score_scenes(images: list) -> tuple[float, float]:
    """
    Returns (christian_scene_score, secular_scene_score) averaged over images.
    Softmax over Christian vs secular prompt groups.
    """
    model = _load_clip()
    if model is None or not images:
        return 0.0, 0.0

    import torch
    import torch.nn.functional as F

    assert _clip_preprocess is not None and _clip_tokenizer is not None
    texts = CHRISTIAN_PROMPTS + SECULAR_PROMPTS
    tokens = _clip_tokenizer(texts)

    with torch.no_grad():
        text_features = model.encode_text(tokens)
        text_features = F.normalize(text_features, dim=-1)

        chris_scores: list[float] = []
        sec_scores: list[float] = []
        for img in images:
            image_input = _clip_preprocess(img).unsqueeze(0)
            image_features = model.encode_image(image_input)
            image_features = F.normalize(image_features, dim=-1)
            logits = (100.0 * image_features @ text_features.T).softmax(dim=-1)[0]
            n_c = len(CHRISTIAN_PROMPTS)
            c = float(logits[:n_c].sum().item())
            s = float(logits[n_c:].sum().item())
            total = c + s + 1e-8
            chris_scores.append(c / total)
            sec_scores.append(s / total)

    christian = sum(chris_scores) / len(chris_scores)
    secular = sum(sec_scores) / len(sec_scores)
    return round(christian, 4), round(secular, 4)


def score_vision(
    thumbnail: Optional[str] = None,
    frames: Optional[list[str]] = None,
    max_frames: Optional[int] = None,
) -> dict:
    """Decode images and return NSFW + scene scores."""
    cap = max_frames or config.MAX_FRAMES
    raw_list: list[str] = []
    if thumbnail:
        raw_list.append(thumbnail)
    if frames:
        # Even subsample
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
    if not images:
        return {
            "nsfw_score": 0.0,
            "christian_scene_score": 0.0,
            "secular_scene_score": 0.0,
            "frame_count_scored": 0,
            "signals": ["no_vision_input"],
            "vision_available": bool(_load_nudenet() or _load_clip()),
        }

    nsfw = score_nsfw(images)
    christian, secular = score_scenes(images)
    nudenet_ok = _load_nudenet() is not None
    clip_ok = _load_clip() is not None
    vision_ok = nudenet_ok or clip_ok
    if not vision_ok:
        signals.append("vision_unavailable")
    if nsfw > 0.3:
        signals.append("nsfw_signal")
    if christian > secular and christian > 0.4:
        signals.append("christian_scene")
    if secular > christian and secular > 0.4:
        signals.append("secular_scene")

    return {
        "nsfw_score": nsfw,
        "christian_scene_score": christian,
        "secular_scene_score": secular,
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
    }
