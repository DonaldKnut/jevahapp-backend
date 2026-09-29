"""OCR helper unit tests (no tesseract required for merge/status paths)."""
from app import ocr as frame_ocr
from app.text_score import score_text


def test_ocr_status_shape():
    status = frame_ocr.ocr_status()
    assert "available" in status
    assert "enabled" in status
    assert "max_frames" in status


def test_ocr_disabled_returns_empty(monkeypatch):
    monkeypatch.setattr(frame_ocr.config, "ENABLE_OCR", False)
    r = frame_ocr.extract_text_from_frames(["data:image/jpeg;base64,aaa"])
    assert r["text"] == ""
    assert "ocr_disabled" in r["signals"]


def test_scripture_in_ocr_merged_body_scores_high():
    # Simulate Guardian merging OCR into spoken body
    ocr = "John 3:16 For God so loved the world that he gave his only begotten Son"
    r = score_text(title="Silent slide", description="", transcript=ocr)
    assert r["gospel_score"] >= 0.7
    assert "gospel_anchor" in r["signals"] or "gospel_lexicon" in r["signals"]
