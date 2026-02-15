/**
 * Comprehensive Test Suite for Nigerian Language Content Moderation
 * Tests Yoruba, Hausa, Igbo, and multilingual gospel content
 */

import {
  LanguageDetectionUtil,
  NIGERIAN_LANGUAGE_CODES,
  GOSPEL_KEYWORDS,
  containsGospelKeywords,
} from "../src/utils/languageDetection.util";
import { ContentModerationService } from "../src/service/contentModeration.service";
import { TranscriptionService } from "../src/service/transcription.service";

describe("Nigerian Language Content Moderation", () => {
  let moderationService: ContentModerationService;
  let transcriptionService: TranscriptionService;

  beforeAll(() => {
    moderationService = new ContentModerationService();
    transcriptionService = new TranscriptionService();
  });

  describe("Language Detection Utility", () => {
    describe("Yoruba Language Detection", () => {
      it("should detect Yoruba language from text", () => {
        const yorubaText = "Jésù olúwa mi, dúpẹ́ lọwọ ọlọrun";
        const result = LanguageDetectionUtil.detectLanguageFromText(yorubaText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.YORUBA);
        expect(result.name).toBe("Yoruba");
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it("should detect Yoruba gospel keywords", () => {
        const yorubaGospelText = "Àdúrà fún ìgbàgbọ ni àwọn ọmọ";
        const result = LanguageDetectionUtil.detectLanguageFromText(yorubaGospelText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.YORUBA);
      });

      it("should handle mixed Yoruba-English content", () => {
        const mixedText = "Jésù olúwa mi, thank you God for everything";
        const result = LanguageDetectionUtil.detectLanguageFromText(mixedText);
        
        // Should detect Yoruba due to Yoruba keywords present
        expect([
          NIGERIAN_LANGUAGE_CODES.YORUBA,
          NIGERIAN_LANGUAGE_CODES.ENGLISH_US,
        ]).toContain(result.code);
      });
    });

    describe("Hausa Language Detection", () => {
      it("should detect Hausa language from text", () => {
        const hausaText = "Yesu Ubangiji, Allah ya gode";
        const result = LanguageDetectionUtil.detectLanguageFromText(hausaText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.HAUSA);
        expect(result.name).toBe("Hausa");
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it("should detect Hausa gospel keywords", () => {
        const hausaGospelText = "Addu'a da ibada ga Allah";
        const result = LanguageDetectionUtil.detectLanguageFromText(hausaGospelText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.HAUSA);
      });
    });

    describe("Igbo Language Detection", () => {
      it("should detect Igbo language from text", () => {
        const igboText = "Jisos Chineke, ekpere anyi biko";
        const result = LanguageDetectionUtil.detectLanguageFromText(igboText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.IGBO);
        expect(result.name).toBe("Igbo");
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it("should detect Igbo gospel keywords", () => {
        const igboGospelText = "Ofufe na abụ maka Chiukwu";
        const result = LanguageDetectionUtil.detectLanguageFromText(igboGospelText);
        
        expect(result.code).toBe(NIGERIAN_LANGUAGE_CODES.IGBO);
      });
    });

    describe("Language Utility Functions", () => {
      it("should get all Nigerian language codes", () => {
        const codes = LanguageDetectionUtil.getNigerianLanguageCodes();
        
        expect(codes).toContain(NIGERIAN_LANGUAGE_CODES.YORUBA);
        expect(codes).toContain(NIGERIAN_LANGUAGE_CODES.HAUSA);
        expect(codes).toContain(NIGERIAN_LANGUAGE_CODES.IGBO);
        expect(codes).toContain(NIGERIAN_LANGUAGE_CODES.ENGLISH_NG);
        expect(codes).toContain(NIGERIAN_LANGUAGE_CODES.ENGLISH_US);
      });

      it("should check if language is Nigerian", () => {
        expect(
          LanguageDetectionUtil.isNigerianLanguage(
            NIGERIAN_LANGUAGE_CODES.YORUBA
          )
        ).toBe(true);
        expect(
          LanguageDetectionUtil.isNigerianLanguage(
            NIGERIAN_LANGUAGE_CODES.HAUSA
          )
        ).toBe(true);
        expect(
          LanguageDetectionUtil.isNigerianLanguage("fr-FR")
        ).toBe(false);
      });

      it("should get language name from code", () => {
        expect(
          LanguageDetectionUtil.getLanguageName(
            NIGERIAN_LANGUAGE_CODES.YORUBA
          )
        ).toBe("Yoruba");
        expect(
          LanguageDetectionUtil.getLanguageName(
            NIGERIAN_LANGUAGE_CODES.HAUSA
          )
        ).toBe("Hausa");
        expect(
          LanguageDetectionUtil.getLanguageName(
            NIGERIAN_LANGUAGE_CODES.IGBO
          )
        ).toBe("Igbo");
      });
    });
  });

  describe("Gospel Keywords Detection", () => {
    it("should detect English gospel keywords", () => {
      const englishGospelText = "Jesus Christ is Lord, praise God";
      expect(containsGospelKeywords(englishGospelText)).toBe(true);
    });

    it("should detect Yoruba gospel keywords", () => {
      const yorubaGospelText = "Jésù olúwa mi, dúpẹ́ lọwọ ọlọrun";
      expect(containsGospelKeywords(yorubaGospelText)).toBe(true);
    });

    it("should detect Hausa gospel keywords", () => {
      const hausaGospelText = "Yesu Ubangiji, Allah ya gode";
      expect(containsGospelKeywords(hausaGospelText)).toBe(true);
    });

    it("should detect Igbo gospel keywords", () => {
      const igboGospelText = "Jisos Chineke, ekpere anyi biko";
      expect(containsGospelKeywords(igboGospelText)).toBe(true);
    });

    it("should return false for non-gospel content", () => {
      const nonGospelText = "This is just a regular song about love";
      expect(containsGospelKeywords(nonGospelText)).toBe(false);
    });

    it("should detect mixed language gospel content", () => {
      const mixedGospelText = "Jésù Christ is my Lord, ọlọrun mi";
      expect(containsGospelKeywords(mixedGospelText)).toBe(true);
    });
  });

  describe("Content Moderation - Nigerian Languages", () => {
    describe("Yoruba Gospel Content", () => {
      it("should approve Yoruba gospel song transcript", async () => {
        const yorubaTranscript =
          "Jésù olúwa mi, dúpẹ́ lọwọ ọlọrun. Àdúrà fún ìgbàgbọ ni àwọn ọmọ";
        
        const result = await moderationService.moderateContent({
          transcript: yorubaTranscript,
          title: "Yoruba Gospel Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.7);
      });

      it("should approve Yoruba gospel song without preaching", async () => {
        const yorubaSongOnly =
          "Ọlọrun mi, ọlọrun mi, dúpẹ́ fún gbogbo ohun tí o ṣe";
        
        const result = await moderationService.moderateContent({
          transcript: yorubaSongOnly,
          title: "Pure Yoruba Gospel Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });

      it("should approve Yoruba worship song", async () => {
        const yorubaWorship =
          "Ìwòrìpò fún olúwa, àdúrà fún olúwa, dúpẹ́ fún olúwa";
        
        const result = await moderationService.moderateContent({
          transcript: yorubaWorship,
          title: "Yoruba Worship",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });
    });

    describe("Hausa Gospel Content", () => {
      it("should approve Hausa gospel song transcript", async () => {
        const hausaTranscript =
          "Yesu Ubangiji, Allah ya gode. Addu'a da ibada ga Allah";
        
        const result = await moderationService.moderateContent({
          transcript: hausaTranscript,
          title: "Hausa Gospel Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.7);
      });

      it("should approve Hausa praise song", async () => {
        const hausaPraise = "Masihi na gode, Allah na gode";
        
        const result = await moderationService.moderateContent({
          transcript: hausaPraise,
          title: "Hausa Praise Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });
    });

    describe("Igbo Gospel Content", () => {
      it("should approve Igbo gospel song transcript", async () => {
        const igboTranscript =
          "Jisos Chineke, ekpere anyi biko. Ofufe na abụ maka Chiukwu";
        
        const result = await moderationService.moderateContent({
          transcript: igboTranscript,
          title: "Igbo Gospel Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.7);
      });

      it("should approve Igbo worship song", async () => {
        const igboWorship = "Chineke, ebube di n'aha gi";
        
        const result = await moderationService.moderateContent({
          transcript: igboWorship,
          title: "Igbo Worship",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });
    });

    describe("Multilingual Gospel Content", () => {
      it("should approve mixed English-Yoruba gospel content", async () => {
        const mixedTranscript =
          "Jesus Christ, Jésù olúwa mi. Praise God, dúpẹ́ ọlọrun";
        
        const result = await moderationService.moderateContent({
          transcript: mixedTranscript,
          title: "Mixed Gospel Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });

      it("should approve multilingual gospel video", async () => {
        const multilingualContent =
          "Yesu Ubangiji, Jisos Chineke, Jesus Christ is Lord";
        
        const result = await moderationService.moderateContent({
          transcript: multilingualContent,
          title: "Multilingual Gospel Video",
          contentType: "videos",
        });

        expect(result.isApproved).toBe(true);
      });
    });

    describe("Pure Gospel Songs (No Preaching)", () => {
      it("should approve Yoruba gospel song without spoken words", async () => {
        const songOnly = "Ọlọrun mi ọlọrun mi, dúpẹ́ dúpẹ́";
        
        const result = await moderationService.moderateContent({
          transcript: songOnly,
          title: "Yoruba Gospel Song Only",
          description: "Pure gospel song, no preaching",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });

      it("should approve Hausa gospel song without preaching", async () => {
        const hausaSongOnly = "Allah na gode, Allah na gode";
        
        const result = await moderationService.moderateContent({
          transcript: hausaSongOnly,
          title: "Hausa Gospel Song Only",
          contentType: "music",
        });

        expect(result.isApproved).toBe(true);
      });
    });

    describe("Non-Gospel Content Rejection", () => {
      it("should reject secular Yoruba content", async () => {
        const secularYoruba = "Fuji music, party time, let's dance";
        
        const result = await moderationService.moderateContent({
          transcript: secularYoruba,
          title: "Secular Song",
          contentType: "music",
        });

        expect(result.isApproved).toBe(false);
        expect(result.flags).toContain("non_gospel_content");
      });

      it("should reject inappropriate content in any language", async () => {
        const inappropriateContent = "Explicit content with bad words";
        
        const result = await moderationService.moderateContent({
          transcript: inappropriateContent,
          title: "Inappropriate Content",
          contentType: "music",
        });

        expect(result.isApproved).toBe(false);
      });
    });
  });

  describe("Integration Tests - Full Flow", () => {
    it("should handle Yoruba gospel video upload flow", async () => {
      // Simulate transcript from transcription service
      const yorubaTranscript =
        "Jésù olúwa mi, dúpẹ́ lọwọ ọlọrun. Àdúrà fún ìgbàgbọ";
      
      // Language detection
      const detectedLang = LanguageDetectionUtil.detectLanguageFromText(
        yorubaTranscript
      );
      expect(detectedLang.code).toBe(NIGERIAN_LANGUAGE_CODES.YORUBA);

      // Gospel keyword check
      expect(containsGospelKeywords(yorubaTranscript)).toBe(true);

      // Content moderation
      const moderationResult = await moderationService.moderateContent({
        transcript: yorubaTranscript,
        title: "Yoruba Gospel Video",
        contentType: "videos",
      });

      expect(moderationResult.isApproved).toBe(true);
    });

    it("should handle Hausa gospel audio upload flow", async () => {
      const hausaTranscript = "Yesu Ubangiji, Allah ya gode";
      
      const detectedLang = LanguageDetectionUtil.detectLanguageFromText(
        hausaTranscript
      );
      expect(detectedLang.code).toBe(NIGERIAN_LANGUAGE_CODES.HAUSA);

      expect(containsGospelKeywords(hausaTranscript)).toBe(true);

      const moderationResult = await moderationService.moderateContent({
        transcript: hausaTranscript,
        title: "Hausa Gospel Audio",
        contentType: "music",
      });

      expect(moderationResult.isApproved).toBe(true);
    });

    it("should handle Igbo gospel song upload flow", async () => {
      const igboTranscript = "Jisos Chineke, ekpere anyi biko";
      
      const detectedLang = LanguageDetectionUtil.detectLanguageFromText(
        igboTranscript
      );
      expect(detectedLang.code).toBe(NIGERIAN_LANGUAGE_CODES.IGBO);

      expect(containsGospelKeywords(igboTranscript)).toBe(true);

      const moderationResult = await moderationService.moderateContent({
        transcript: igboTranscript,
        title: "Igbo Gospel Song",
        contentType: "music",
      });

      expect(moderationResult.isApproved).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty transcript gracefully", async () => {
      const result = await moderationService.moderateContent({
        transcript: "",
        title: "Gospel Song",
        contentType: "music",
      });

      // Should rely on title/description for moderation
      expect(result).toBeDefined();
    });

    it("should handle very short transcripts", async () => {
      const shortTranscript = "Jésù";
      
      const result = await moderationService.moderateContent({
        transcript: shortTranscript,
        title: "Short Yoruba Song",
        contentType: "music",
      });

      expect(result).toBeDefined();
    });

    it("should handle transcripts with special characters", async () => {
      const specialCharTranscript = "Jésù ọlọrun, àdúrà ìgbàgbọ";
      
      const result = await moderationService.moderateContent({
        transcript: specialCharTranscript,
        title: "Yoruba with Special Characters",
        contentType: "music",
      });

      expect(result.isApproved).toBe(true);
    });

    it("should handle mixed case transcripts", async () => {
      const mixedCase = "JÉSÙ OLÚWA MI, jésù ọlọrun";
      
      const result = await moderationService.moderateContent({
        transcript: mixedCase,
        title: "Mixed Case Yoruba",
        contentType: "music",
      });

      expect(result.isApproved).toBe(true);
    });
  });
});


