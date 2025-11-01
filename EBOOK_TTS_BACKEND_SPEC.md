Ebook TTS Backend Spec (to pair with current FE)
This doc describes exactly what the frontend already does and the minimal backend we need. Use this to implement backend endpoints with Gemini AI support.
Required Backend API

1. GET /api/ebooks/text
   Return per-page text for a PDF.
   Query params:
   url (string) – direct PDF URL; or
   contentId (string) – backend resolves to PDF URL
   Optional: normalize=true – normalize with Gemini (expand abbreviations, add pauses, fix pronunciation; preserve order)
   200 Response:

"title": "Book Title",
"totalPages": 200,
"pages": [
{ "page": 1, "text": "Page 1 text ..." },
{ "page": 2, "text": "Page 2 text ..." }
]
}
Errors: 400/401/404/500
Notes:
Use pdf-parse or pdfjs-dist on server to extract text in reading order; strip headers/footers where possible.
Add Cache-Control: private, max-age=300.
If normalize=true, pass each page's text through Gemini with a prompt like:
"Preserve sentence order and meaning. Expand abbreviations for TTS. Add natural pauses. Do not summarize." 2) (Optional) POST /api/tts/render
Use a neural TTS provider to render audio for better voice quality.
Body:
{
"contentId": "ebook_123",
"pages": [{"page": 1, "text": "..."}],
"voiceId": "en-US-female-1",
"language": "en-US",
"speed": 1.2,
"pitch": 0,
"format": "mp3",
"cache": true
}
200 (short) or 202 (long) with job status endpoint.
Security + Anti-download
Prefer returning text only; do not proxy full PDF unless using short-lived signed URLs.
If proxying PDFs, set Content-Disposition: inline and Cache-Control: no-store.
Rate-limit and auth as needed.
FE integration flow
FE opens PdfViewer with { url, title }.
FE calls GET /api/ebooks/text?url=...&normalize=true.
FE receives { pages } and streams each page into the TTS chunker.
Controls allow play/stop/speed/pitch.
That's all the FE needs.













