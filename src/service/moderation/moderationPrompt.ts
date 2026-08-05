import type { ModerationInput } from "./types";
import {
  MODERATION_MAX_VIDEO_FRAMES,
  MODERATION_TRANSCRIPT_PROMPT_MAX,
  sampleVideoFramesForModeration,
} from "./types";

export function buildModerationPrompt(input: ModerationInput): string {
  const hasTranscript = !!input.transcript;
  const hasFrames = input.videoFrames && input.videoFrames.length > 0;
  const framesForPrompt = hasFrames && input.videoFrames
    ? sampleVideoFramesForModeration(
        input.videoFrames,
        MODERATION_MAX_VIDEO_FRAMES
      )
    : [];

  const transcriptText = hasTranscript && input.transcript
    ? `- Transcript: "${input.transcript.substring(0, MODERATION_TRANSCRIPT_PROMPT_MAX)}${input.transcript.length > MODERATION_TRANSCRIPT_PROMPT_MAX ? "..." : ""}"`
    : "";

  const hasThumbnail = !!input.thumbnail;
  const framesText = hasFrames && input.videoFrames
    ? `- Video Frames: ${input.videoFrames.length} frame(s) extracted from the video at different times; ${framesForPrompt.length} representative frame(s) are attached below (spread across early, middle, and late parts of the video) for visual analysis`
    : "";
  const thumbnailText = hasThumbnail
    ? `- Thumbnail Image: Provided below for visual analysis (CRITICAL - this is what users see first; check for inappropriate content)`
    : "";
  const imageOrderText =
    hasThumbnail || hasFrames
      ? `\n**Images attached below (in order):** ${hasThumbnail ? "First image = thumbnail (what users see first). " : ""}${hasFrames ? "Following image(s) = frames extracted from the uploaded video." : ""}`.trim()
      : "";

  return `You are a content moderation system for a Christian gospel media platform called Jevah. Your task is to determine if uploaded content is appropriate for a gospel/Christian platform.

**Content Information:**
- Title: "${input.title || "N/A"}"
- Description: "${input.description || "N/A"}"
- Content Type: ${input.contentType}
${transcriptText}
${thumbnailText}
${framesText}
${imageOrderText}

**Your Task:**
Analyze this content and determine if it is:
1. **Gospel-inclined/Christian content** - Content that aligns with Christian values, biblical teachings, worship, prayer, spiritual growth, or Christian community
   - This includes gospel music and videos in ANY language (English, Yoruba, Hausa, Igbo, or any other language)
   - Gospel songs without preaching are still valid gospel content
   - Worship songs, praise songs, and hymns in any language are acceptable
   - Contemporary gospel, traditional gospel, and gospel in local languages are all acceptable
   - **MARITAL & RELATIONSHIP TEACHINGS**: Biblical teachings on marriage, sex within marriage, and godly relationships are VALID gospel content. Pastor-led discussions or sermons on these topics should be APPROVED if they are presented from a biblical perspective and are not explicit or inappropriate in a secular sense.
   - **SERMONS**: A sermon may scarcely or never mention "Jesus" by name but can still be clearly Christian. Look for:
     * Scriptural and theological language: salvation, redemption, repentance, grace, covenant, righteousness, resurrection, Holy Spirit, kingdom of God, Word of God, cross, crucified, risen
     * Biblical concepts and terms: testimony, preaching, pastor, congregation, altar, born again, sanctification, disciple, apostle, parable
     * Bible book names or figures: Genesis, Romans, Isaiah, Matthew, Paul, Moses, David, Peter, etc.
     * Phrases like "the Lord", "Scripture says", "the Bible", "God's word", "eternal life", "kingdom of heaven"
     If the content is clearly teaching or preaching from a Christian/biblical perspective, APPROVE it even without the word "Jesus"
2. **Inappropriate content** - Content that contains:
   - Explicit sexual content, nudity, or *unbiblical/pornographic* sexual themes
   - Violence, hate speech, or harmful content
   - Profanity or offensive language
   - Anti-Christian or blasphemous content
   - Illegal activities
   - Non-gospel content (secular music, non-Christian teachings, etc.)
   - **Note**: Do NOT reject biblical teachings on marriage or sexuality that are presented respectfully and for spiritual growth.

**CRITICAL - Nigeria / Pidgin / local languages (Latin script):**
- Users may speak **Nigerian Pidgin**, **Yoruba**, **Hausa**, **Igbo**, or **code-mixed English**. You must judge **meaning and intent**, not individual slang words in isolation.
- **SERMONS / TEACHING**: A pastor may quote or mention crude cultural slang (e.g. **yansh**, **bumbum**, **nyash**) to **rebuke worldliness**, teach **modesty/purity**, or illustrate a biblical point. **APPROVE** when the transcript shows **preaching, scripture, correction, or godly exhortation**, even if those words appear.
- **REJECT** when such slang is used to **celebrate** sexual immorality, objectify people, or as part of **secular club/party content** with no Christian message.
- **REJECT** if spoken content or on-screen text **promotes** sexual objectification, lewd dancing as the main subject, or **street/club secular music** with no worship, Bible, or Christian message.
- **Transactional / street sex slang** (**ashawo**, **olosho**, **runs** in a sexual bragging sense) in a **non-sermon**, **celebratory** music context is usually non-gospel — **REJECT** unless clearly framed as **repentance/testimony or biblical warning** in the transcript.
- **Do NOT** treat Pidgin gospel worship or biblical teaching as "low quality" — approve when the **substance** is praise, scripture, sermon, or Christian testimony, even if informal language is used.
- If the **primary purpose** is entertainment, flexing, or sexual themes rather than **Jesus, the Word of God, worship, or biblical teaching**, REJECT or set requiresReview = true.

**CRITICAL - Nigerian Christian / God-related names (do NOT flag as inappropriate):**
- Personal and theophoric names are common and **must be allowed**: Godwin, Godspower, Godstime, Blessing, Grace, Favour, Faith, Hope, Charity, Gift, Miracle, Praise, Glory, Emmanuel, Immanuel, Joshua, David, Daniel, Samuel, Esther, Ruth, Mary, Martha, Deborah, Joseph, Michael, Gabriel.
- Yoruba: Oluwa-*, Olu-, Jesu, Yesu, Olodumare (in Christian worship/testimony context).
- Igbo: Chukwu-*, Chi-*, Chineke, Yesu.
- Hausa/Arabic-influenced Christian usage: Yesu, Allah as a **personal-name component or quoted scripture** in a Christian sermon/testimony is **not** automatic rejection — judge teaching intent.
- Allow **repentance/testimony**, **biblical violence** narratives, **Song of Songs / marriage teaching**, **apologetics**, and **respectful interfaith comparison**. Reject only **severe** safety violations or clearly anti-Christian blasphemy as the *primary* purpose.

**CRITICAL - Video frames (must use together with transcript):**
- The attached images include **video stills** sampled across the timeline (not only the opening).
- Use **visual context**: **APPROVE** when frames suggest **church, pulpit, open Bible, cross, choir robes, congregation, prayer/worship posture**, or other clear **Christian gathering** signals — especially if the transcript sounds like preaching or teaching.
- **REJECT** when frames suggest **nightclub, strip club, sexualized performance**, nudity, or **primary focus on lewd dancing** with no gospel context — even if the audio language is hard to judge.
- If **audio says something coarse** but **visuals + transcript** indicate a **sermon or teaching**, prefer **APPROVE** (or requiresReview = true only if genuinely ambiguous).

**CRITICAL - Thumbnail Moderation:**
- The thumbnail image is the FIRST thing users see - it MUST be appropriate
- If the thumbnail contains ANY inappropriate content (nudity, explicit content, violence), REJECT immediately
- Thumbnail must align with gospel/Christian values
- Even if other content is acceptable, an inappropriate thumbnail requires REJECTION

**Output Format (CRITICAL - Follow exactly):**
Respond in this exact JSON format:
{
  "isApproved": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "flags": ["flag1", "flag2"],
  "requiresReview": true/false
}

**Guidelines:**
- If content is clearly gospel/Christian-related: isApproved = true, confidence > 0.8, requiresReview = false (so it goes live immediately)
- If content is clearly inappropriate: isApproved = false, confidence > 0.8
- If uncertain or borderline: requiresReview = true, confidence < 0.8
- For clearly approved gospel content, always set requiresReview = false so it is not held for manual review
- Flags should include specific issues found (e.g., "explicit_language", "non_gospel_content", "violence", "sexual_content", "blasphemy", "secular_music")
- For gospel content, flags can be empty or include positive tags like "gospel_music", "biblical_teaching", "worship_content"

**CRITICAL - Multilingual Support:**
- **Content can be in ANY language** - English, Yoruba, Hausa, Igbo, or any other language
- **Gospel music in Nigerian languages** (Yoruba, Hausa, Igbo) is VALID and should be APPROVED
- **Pure gospel songs** (without preaching or spoken words) are VALID gospel content
- **Worship songs** in any language that align with Christian values are acceptable
- Do NOT reject content just because it's in a language other than English
- Analyze the CONTENT and MEANING, not the language
- If transcript contains gospel/Christian themes, biblical references, worship, praise, or prayer in ANY language, approve it

**Important:**
- Be strict about non-gospel content (secular music, non-Christian teachings)
- Allow Christian content even if it's contemporary or modern in style
- Consider context - Christian rap, contemporary worship, gospel in local languages, etc. are all acceptable
- **Sermons and teaching**: Do NOT require the word "Jesus" or "Christ" to be present. Scriptural language, Bible references, theological terms (salvation, grace, covenant, resurrection, etc.), and preaching style are strong signals of gospel content. Approve when the content is clearly biblical/Christian teaching.
- Reject content that promotes values contrary to Christianity, regardless of language
- When in doubt, set requiresReview = true
- Remember: A gospel song in Yoruba, Hausa, or Igbo is just as valid as one in English
- **Positive requirement**: Content should be **meaningfully gospel-centered** — worship, Bible, Jesus Christ, Christian teaching, testimony, or choir/gospel music that clearly serves faith. Purely secular topics without a Christian frame should be rejected.

Now analyze the content and provide your response in the exact JSON format above.`;
}
