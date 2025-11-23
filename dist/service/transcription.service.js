"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcriptionService = exports.TranscriptionService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const logger_1 = __importDefault(require("../utils/logger"));
const mediaProcessing_service_1 = require("./mediaProcessing.service");
class TranscriptionService {
    constructor() {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            logger_1.default.warn("GOOGLE_AI_API_KEY not found. Transcription will not be available.");
            this.genAI = null;
            this.model = null;
        }
        else {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            // Note: Gemini can handle audio transcription, but for better results,
            // you might want to use Google Cloud Speech-to-Text API
            // For now, we'll use Gemini's audio capabilities
            this.model = this.genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
            });
        }
    }
    /**
     * Transcribe audio using Gemini (or fallback to Google Cloud Speech-to-Text)
     *
     * Note: Gemini 1.5 can process audio, but for production, consider using
     * Google Cloud Speech-to-Text API for better accuracy
     */
    transcribeAudio(audioBuffer_1, audioMimeType_1) {
        return __awaiter(this, arguments, void 0, function* (audioBuffer, audioMimeType, languageCode = "en-US") {
            try {
                // Prepare audio for transcription
                const preparedAudio = yield mediaProcessing_service_1.mediaProcessingService.prepareAudioForTranscription(audioBuffer, audioMimeType);
                // If using Google Cloud Speech-to-Text (recommended for production)
                if (process.env.GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED === "true") {
                    return yield this.transcribeWithGoogleCloud(preparedAudio, languageCode);
                }
                // Fallback: Use Gemini for transcription (if supported)
                if (this.model) {
                    try {
                        const base64Audio = preparedAudio.toString("base64");
                        // Gemini 1.5 can process audio files
                        const result = yield this.model.generateContent({
                            contents: [{
                                    role: "user",
                                    parts: [
                                        {
                                            text: "Transcribe the following audio. Return only the transcript text, no additional commentary."
                                        },
                                        {
                                            inlineData: {
                                                mimeType: "audio/wav",
                                                data: base64Audio,
                                            },
                                        },
                                    ],
                                }],
                        });
                        const response = yield result.response;
                        const transcript = response.text().trim();
                        return {
                            transcript,
                            confidence: 0.7, // Gemini doesn't provide confidence scores
                            language: languageCode,
                        };
                    }
                    catch (error) {
                        logger_1.default.warn("Gemini transcription failed, trying fallback:", error);
                        // Fall back to basic method
                    }
                }
                // Final fallback: return empty transcript
                logger_1.default.warn("No transcription service available");
                return {
                    transcript: "",
                    confidence: 0,
                    language: languageCode,
                };
            }
            catch (error) {
                logger_1.default.error("Error transcribing audio:", error);
                return {
                    transcript: "",
                    confidence: 0,
                    language: languageCode,
                };
            }
        });
    }
    /**
     * Transcribe using Google Cloud Speech-to-Text API (recommended)
     *
     * To use this, you need to:
     * 1. Enable Google Cloud Speech-to-Text API
     * 2. Set GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED=true
     * 3. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path
     * 4. Install @google-cloud/speech: npm install @google-cloud/speech
     */
    transcribeWithGoogleCloud(audioBuffer, languageCode) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // Dynamic import to avoid requiring the package if not used
                const speech = yield Promise.resolve(`${"@google-cloud/speech"}`).then(s => __importStar(require(s))).catch(() => null);
                if (!speech) {
                    throw new Error("Google Cloud Speech-to-Text not available");
                }
                const client = new speech.SpeechClient();
                const audioBytes = audioBuffer.toString("base64");
                const request = {
                    audio: {
                        content: audioBytes,
                    },
                    config: {
                        encoding: "LINEAR16",
                        sampleRateHertz: 16000,
                        languageCode: languageCode,
                        enableAutomaticPunctuation: true,
                        model: "default",
                    },
                };
                const [response] = yield client.recognize(request);
                if (!response.results || response.results.length === 0) {
                    return {
                        transcript: "",
                        confidence: 0,
                        language: languageCode,
                    };
                }
                const transcript = response.results
                    .map((result) => { var _a, _b; return ((_b = (_a = result.alternatives) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.transcript) || ""; })
                    .join(" ");
                const confidence = ((_c = (_b = (_a = response.results[0]) === null || _a === void 0 ? void 0 : _a.alternatives) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.confidence) || 0;
                return {
                    transcript,
                    confidence,
                    language: languageCode,
                };
            }
            catch (error) {
                logger_1.default.error("Google Cloud Speech-to-Text error:", error);
                throw error;
            }
        });
    }
    /**
     * Check if transcription service is available
     */
    isAvailable() {
        return this.genAI !== null && this.model !== null;
    }
}
exports.TranscriptionService = TranscriptionService;
// Export singleton instance
exports.transcriptionService = new TranscriptionService();
