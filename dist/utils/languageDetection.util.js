"use strict";
/**
 * Language Detection Utility
 * Helps identify and detect Nigerian languages (Yoruba, Hausa, Igbo) and other languages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOSPEL_KEYWORDS = exports.LanguageDetectionUtil = exports.NIGERIAN_LANGUAGE_CODES = void 0;
exports.containsGospelKeywords = containsGospelKeywords;
/**
 * Nigerian language codes for Google Cloud Speech-to-Text
 */
exports.NIGERIAN_LANGUAGE_CODES = {
    YORUBA: "yo-NG",
    HAUSA: "ha-NG",
    IGBO: "ig-NG",
    ENGLISH_NG: "en-NG",
    ENGLISH_US: "en-US",
};
/**
 * Language detection patterns (simple heuristic-based detection)
 * Note: This is a fallback. Primary detection should use AI/ML services
 */
class LanguageDetectionUtil {
    /**
     * Detect language from text using pattern matching
     * This is a basic fallback - AI services should be primary
     */
    static detectLanguageFromText(text) {
        const lowerText = text.toLowerCase();
        // Yoruba patterns (common characters and words)
        const yorubaPatterns = [
            /\b(ọ|Ọ|ọwọ|Ọwọ|àgbà|Àgbà|àwọn|Àwọn|bí|Bí|dúpẹ́|Dúpẹ́|jésù|Jésù|olúwa|Olúwa|ọlọrun|Ọlọrun)/g,
            /\b(àdúrà|Àdúrà|ìwòrìpò|Ìwòrìpò|ìgbàgbọ|Ìgbàgbọ|èdè|Èdè)/g,
        ];
        // Hausa patterns
        const hausaPatterns = [
            /\b(yesu|Yesu|ubangiji|Ubangiji|allah|Allah|addu'a|Addu'a|ibada|Ibada)/g,
            /\b(na|Na|da|Da|wata|Wata|mutum|Mutum)/g,
        ];
        // Igbo patterns
        const igboPatterns = [
            /\b(jisos|Jisos|chiukwu|Chiukwu|ekpere|Ekpere|abụ|Abụ|chineke|Chineke)/g,
            /\b(nke|Nke|na|Na|ma|Ma|ọ|Ọ)/g,
        ];
        let yorubaMatches = 0;
        let hausaMatches = 0;
        let igboMatches = 0;
        yorubaPatterns.forEach(pattern => {
            const matches = lowerText.match(pattern);
            if (matches)
                yorubaMatches += matches.length;
        });
        hausaPatterns.forEach(pattern => {
            const matches = lowerText.match(pattern);
            if (matches)
                hausaMatches += matches.length;
        });
        igboPatterns.forEach(pattern => {
            const matches = lowerText.match(pattern);
            if (matches)
                igboMatches += matches.length;
        });
        // Calculate confidence based on matches
        const totalMatches = yorubaMatches + hausaMatches + igboMatches;
        if (totalMatches === 0) {
            // Default to English if no patterns found
            return {
                code: exports.NIGERIAN_LANGUAGE_CODES.ENGLISH_US,
                name: "English",
                confidence: 0.5,
            };
        }
        // Determine most likely language
        if (yorubaMatches >= hausaMatches && yorubaMatches >= igboMatches) {
            const confidence = Math.min(0.95, 0.5 + (yorubaMatches / Math.max(text.length / 10, 1)) * 0.45);
            return {
                code: exports.NIGERIAN_LANGUAGE_CODES.YORUBA,
                name: "Yoruba",
                confidence,
            };
        }
        else if (hausaMatches >= igboMatches) {
            const confidence = Math.min(0.95, 0.5 + (hausaMatches / Math.max(text.length / 10, 1)) * 0.45);
            return {
                code: exports.NIGERIAN_LANGUAGE_CODES.HAUSA,
                name: "Hausa",
                confidence,
            };
        }
        else {
            const confidence = Math.min(0.95, 0.5 + (igboMatches / Math.max(text.length / 10, 1)) * 0.45);
            return {
                code: exports.NIGERIAN_LANGUAGE_CODES.IGBO,
                name: "Igbo",
                confidence,
            };
        }
    }
    /**
     * Get all Nigerian language codes for alternative language detection
     */
    static getNigerianLanguageCodes() {
        return [
            exports.NIGERIAN_LANGUAGE_CODES.YORUBA,
            exports.NIGERIAN_LANGUAGE_CODES.HAUSA,
            exports.NIGERIAN_LANGUAGE_CODES.IGBO,
            exports.NIGERIAN_LANGUAGE_CODES.ENGLISH_NG,
            exports.NIGERIAN_LANGUAGE_CODES.ENGLISH_US,
        ];
    }
    /**
     * Check if a language code is a Nigerian language
     */
    static isNigerianLanguage(languageCode) {
        return Object.values(exports.NIGERIAN_LANGUAGE_CODES).includes(languageCode);
    }
    /**
     * Get language name from code
     */
    static getLanguageName(code) {
        const names = {
            [exports.NIGERIAN_LANGUAGE_CODES.YORUBA]: "Yoruba",
            [exports.NIGERIAN_LANGUAGE_CODES.HAUSA]: "Hausa",
            [exports.NIGERIAN_LANGUAGE_CODES.IGBO]: "Igbo",
            [exports.NIGERIAN_LANGUAGE_CODES.ENGLISH_NG]: "English (Nigeria)",
            [exports.NIGERIAN_LANGUAGE_CODES.ENGLISH_US]: "English (US)",
        };
        return names[code] || code;
    }
}
exports.LanguageDetectionUtil = LanguageDetectionUtil;
/**
 * Gospel keywords in multiple Nigerian languages
 */
exports.GOSPEL_KEYWORDS = {
    english: [
        "jesus", "christ", "god", "lord", "prayer", "worship", "praise",
        "gospel", "bible", "scripture", "faith", "church", "sermon",
        "hymn", "devotional", "blessing", "amen", "hallelujah", "hosanna",
    ],
    yoruba: [
        "jésù", "jésu", "olúwa", "oluwa", "ọlọrun", "olorun",
        "àdúrà", "adura", "ìgbàgbọ", "igbagbo", "ìwòrìpò", "iworipo",
        "dúpẹ́", "dupe", "àgbà", "agba", "àwọn", "awon",
    ],
    hausa: [
        "yesu", "ubangiji", "allah", "addu'a", "ibada", "na gode",
        "du'a", "addini", "masihi", "rukuni",
    ],
    igbo: [
        "jisos", "chiukwu", "chineke", "ekpere", "abụ", "ofufe",
        "ebube", "nna", "mgbe", "biko",
    ],
};
/**
 * Check if text contains gospel keywords in any supported language
 */
function containsGospelKeywords(text) {
    const lowerText = text.toLowerCase();
    const allKeywords = [
        ...exports.GOSPEL_KEYWORDS.english,
        ...exports.GOSPEL_KEYWORDS.yoruba,
        ...exports.GOSPEL_KEYWORDS.hausa,
        ...exports.GOSPEL_KEYWORDS.igbo,
    ];
    return allKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}
