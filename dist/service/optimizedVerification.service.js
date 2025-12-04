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
exports.optimizedVerificationService = exports.OptimizedVerificationService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const transcription_service_1 = require("./transcription.service");
const contentModeration_service_1 = require("./contentModeration.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Optimized verification service with:
 * - Parallel processing where possible
 * - Audio sampling (only first 30-60 seconds for transcription)
 * - Faster frame extraction
 * - Progress reporting
 */
class OptimizedVerificationService {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), "jevah-media-processing");
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Verify content with progress updates
     */
    verifyContentWithProgress(file, fileMimeType, contentType, title, description, uploadId, onProgress, thumbnailBuffer, thumbnailMimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            const reportProgress = (progress, stage, message) => {
                if (onProgress) {
                    onProgress({
                        uploadId,
                        progress,
                        stage,
                        message,
                        timestamp: new Date().toISOString(),
                    });
                }
            };
            reportProgress(10, "file_received", "File received, starting verification...");
            let transcript = "";
            let videoFrames = [];
            try {
                if (contentType === "videos" && fileMimeType.startsWith("video")) {
                    yield this.processVideoContent(file, fileMimeType, uploadId, reportProgress, (t, f) => {
                        transcript = t;
                        videoFrames = f;
                    });
                }
                else if ((contentType === "music" || contentType === "audio") &&
                    fileMimeType.startsWith("audio")) {
                    yield this.processAudioContent(file, fileMimeType, uploadId, reportProgress, (t) => {
                        transcript = t;
                    });
                }
                else if (contentType === "books") {
                    yield this.processBookContent(file, fileMimeType, uploadId, reportProgress, (t) => {
                        transcript = t;
                    });
                }
                // Moderate thumbnail if provided (CRITICAL - first thing users see)
                let thumbnailBase64;
                if (thumbnailBuffer) {
                    reportProgress(72, "moderating", "Checking thumbnail image...");
                    thumbnailBase64 = `data:${thumbnailMimeType || "image/jpeg"};base64,${thumbnailBuffer.toString("base64")}`;
                }
                // Run moderation (includes thumbnail check)
                reportProgress(75, "moderating", "Checking content guidelines...");
                const moderationResult = yield contentModeration_service_1.contentModerationService.moderateContent({
                    transcript: transcript || undefined,
                    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
                    thumbnail: thumbnailBase64,
                    title,
                    description,
                    contentType,
                });
                reportProgress(95, "finalizing", "Verification complete!");
                return {
                    isApproved: moderationResult.isApproved,
                    moderationResult,
                    transcript: transcript || undefined,
                    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
                };
            }
            catch (error) {
                logger_1.default.error("Optimized verification error:", error);
                reportProgress(0, "error", `Verification failed: ${error.message}`);
                throw error;
            }
        });
    }
    /**
     * Process video content with optimized extraction
     */
    processVideoContent(videoBuffer, videoMimeType, uploadId, reportProgress, onComplete) {
        return __awaiter(this, void 0, void 0, function* () {
            reportProgress(20, "validating", "Validating video format...");
            // Get video duration first (quick operation)
            const duration = yield this.getVideoDuration(videoBuffer, videoMimeType);
            logger_1.default.info("Video duration detected", { duration, uploadId });
            reportProgress(30, "analyzing", "Extracting audio and frames...");
            // Determine optimal sampling strategy based on video length
            // For safety: Always check beginning, and check middle/end for longer videos
            const shouldSampleMultiple = duration > 120; // If longer than 2 minutes, sample multiple segments
            // Run audio extraction and frame extraction in parallel for speed
            const [audioResult, framesResult] = yield Promise.all([
                // Extract audio sample(s) - multiple segments for longer videos to catch inappropriate content anywhere
                shouldSampleMultiple
                    ? this.extractMultipleAudioSamples(videoBuffer, videoMimeType, duration)
                    : this.extractAudioSample(videoBuffer, videoMimeType, Math.min(60, duration)),
                // Extract 3 frames for better coverage: beginning, middle, end
                this.extractVideoFramesOptimized(videoBuffer, videoMimeType, 3, duration),
            ]);
            reportProgress(50, "analyzing", "Transcribing audio...");
            // Transcribe the audio sample(s)
            let transcript = "";
            try {
                // If multiple samples, combine transcripts
                if (Array.isArray(audioResult)) {
                    const transcripts = yield Promise.all(audioResult.map(sample => transcription_service_1.transcriptionService.transcribeAudio(sample.audioBuffer, "audio/mp3")));
                    transcript = transcripts.map(t => t.transcript).join(" ");
                }
                else {
                    const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(audioResult.audioBuffer, "audio/mp3");
                    transcript = transcriptionResult.transcript;
                }
                logger_1.default.info("Video transcription completed", {
                    transcriptLength: transcript.length,
                    uploadId,
                    segmentsProcessed: Array.isArray(audioResult) ? audioResult.length : 1,
                });
            }
            catch (error) {
                logger_1.default.warn("Transcription failed, continuing with frames only:", error);
            }
            reportProgress(70, "analyzing", "Processing complete!");
            onComplete(transcript, framesResult.frames);
        });
    }
    /**
     * Process audio content with optimized extraction
     */
    processAudioContent(audioBuffer, audioMimeType, uploadId, reportProgress, onComplete) {
        return __awaiter(this, void 0, void 0, function* () {
            reportProgress(20, "validating", "Validating audio format...");
            // Get audio duration
            const duration = yield this.getAudioDuration(audioBuffer, audioMimeType);
            logger_1.default.info("Audio duration detected", { duration, uploadId });
            reportProgress(30, "analyzing", "Preparing audio sample...");
            // For longer audio files, sample multiple segments to catch inappropriate content
            // For safety: Always check beginning, and check middle/end for longer files
            const shouldSampleMultiple = duration > 120; // If longer than 2 minutes
            const audioSample = shouldSampleMultiple
                ? yield this.extractMultipleAudioSamples(audioBuffer, audioMimeType, duration)
                : yield this.extractAudioSample(audioBuffer, audioMimeType, Math.min(60, duration));
            reportProgress(40, "analyzing", "Transcribing audio...");
            let transcript = "";
            try {
                // If multiple samples, combine transcripts
                if (Array.isArray(audioSample)) {
                    const transcripts = yield Promise.all(audioSample.map(sample => transcription_service_1.transcriptionService.transcribeAudio(sample.audioBuffer, audioMimeType === "audio/mpeg" ? "audio/mp3" : audioMimeType)));
                    transcript = transcripts.map(t => t.transcript).join(" ");
                }
                else {
                    const transcriptionResult = yield transcription_service_1.transcriptionService.transcribeAudio(audioSample.audioBuffer, audioMimeType === "audio/mpeg" ? "audio/mp3" : audioMimeType);
                    transcript = transcriptionResult.transcript;
                }
                logger_1.default.info("Audio transcription completed", {
                    transcriptLength: transcript.length,
                    uploadId,
                    segmentsProcessed: Array.isArray(audioSample) ? audioSample.length : 1,
                });
            }
            catch (error) {
                logger_1.default.warn("Transcription failed:", error);
            }
            reportProgress(70, "analyzing", "Processing complete!");
            onComplete(transcript);
        });
    }
    /**
     * Process book content
     */
    processBookContent(fileBuffer, fileMimeType, uploadId, reportProgress, onComplete) {
        return __awaiter(this, void 0, void 0, function* () {
            reportProgress(20, "validating", "Validating book format...");
            let text = "";
            try {
                if (fileMimeType === "application/pdf") {
                    reportProgress(30, "analyzing", "Extracting text from PDF...");
                    text = yield this.extractTextFromPDF(fileBuffer);
                    // Limit to first 5000 characters for faster moderation
                    text = text.substring(0, 5000);
                    logger_1.default.info("PDF text extraction completed", {
                        textLength: text.length,
                        uploadId,
                    });
                }
                else if (fileMimeType === "application/epub+zip") {
                    reportProgress(30, "analyzing", "Extracting text from EPUB...");
                    text = yield this.extractTextFromEPUB(fileBuffer);
                    text = text.substring(0, 5000);
                    logger_1.default.info("EPUB text extraction completed", {
                        textLength: text.length,
                        uploadId,
                    });
                }
                else {
                    logger_1.default.warn("Unsupported book file type", { fileMimeType, uploadId });
                }
            }
            catch (error) {
                logger_1.default.warn("Book text extraction failed:", error);
            }
            reportProgress(70, "analyzing", "Processing complete!");
            onComplete(text);
        });
    }
    /**
     * Extract text from PDF buffer
     */
    extractTextFromPDF(pdfBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Dynamic import for pdf-parse
                const pdfParseModule = yield new Function('return import("pdf-parse")')();
                const { PDFParse } = pdfParseModule;
                const pdfParser = new PDFParse({ data: pdfBuffer });
                const textResult = yield pdfParser.getText();
                yield pdfParser.destroy();
                let fullText = "";
                if (textResult.pages && textResult.pages.length > 0) {
                    fullText = textResult.pages
                        .map((pageData) => pageData.text || "")
                        .join("\n");
                }
                else if (textResult.text) {
                    fullText = textResult.text;
                }
                fullText = fullText.replace(/\s+/g, " ").trim();
                return fullText.substring(0, 10000);
            }
            catch (error) {
                logger_1.default.error("Failed to extract text from PDF", { error: error.message });
                return "";
            }
        });
    }
    /**
     * Extract text from EPUB buffer
     */
    extractTextFromEPUB(epubBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const JSZip = yield Promise.resolve(`${"jszip"}`).then(s => __importStar(require(s))).catch(() => null);
                if (!JSZip) {
                    logger_1.default.warn("JSZip not available, EPUB text extraction will be limited");
                    return "";
                }
                const zip = new JSZip.default();
                const zipData = yield zip.loadAsync(epubBuffer);
                let fullText = "";
                const contentFiles = [];
                zipData.forEach((relativePath, file) => {
                    if (!file.dir &&
                        (relativePath.endsWith(".html") ||
                            relativePath.endsWith(".xhtml") ||
                            relativePath.endsWith(".htm")) &&
                        !relativePath.includes("META-INF") &&
                        !relativePath.includes("mimetype")) {
                        contentFiles.push(relativePath);
                    }
                });
                // Limit to first 5 files for speed
                for (const filePath of contentFiles.slice(0, 5)) {
                    try {
                        const fileContent = yield ((_a = zipData.file(filePath)) === null || _a === void 0 ? void 0 : _a.async("string"));
                        if (fileContent) {
                            const textContent = fileContent
                                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                                .replace(/<[^>]+>/g, " ")
                                .replace(/\s+/g, " ")
                                .trim();
                            if (textContent) {
                                fullText += textContent + "\n";
                            }
                        }
                    }
                    catch (error) {
                        logger_1.default.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
                    }
                }
                fullText = fullText.trim();
                return fullText ? fullText.substring(0, 10000) : "";
            }
            catch (error) {
                logger_1.default.error("Failed to extract text from EPUB", { error: error.message });
                return "";
            }
        });
    }
    /**
     * Extract multiple audio samples from different segments
     * For safety: checks beginning, middle, and end to catch inappropriate content anywhere
     */
    extractMultipleAudioSamples(mediaBuffer, mimeType, totalDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            const samples = [];
            const sampleDuration = 60; // 60 seconds per sample
            // Sample 1: Beginning (first 60 seconds) - catches immediate inappropriate content
            samples.push(yield this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, 0));
            // Sample 2: Middle (around midpoint) - catches mid-video issues
            if (totalDuration > 180) {
                const middleStart = Math.max(0, (totalDuration / 2) - 30);
                samples.push(yield this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, middleStart));
            }
            // Sample 3: End (last 60 seconds) - catches inappropriate endings
            if (totalDuration > 120) {
                const endStart = Math.max(0, totalDuration - sampleDuration);
                samples.push(yield this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, endStart));
            }
            return samples;
        });
    }
    /**
     * Extract audio sample (N seconds starting from offset) for faster transcription
     */
    extractAudioSample(mediaBuffer_1, mimeType_1, maxDuration_1) {
        return __awaiter(this, arguments, void 0, function* (mediaBuffer, mimeType, maxDuration, startOffset = 0) {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                throw new Error("FFmpeg is required for audio extraction");
            }
            const tempId = `audio-sample-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            const outputPath = path.join(this.tempDir, `${tempId}-output.mp3`);
            try {
                // Write media buffer to temp file
                fs.writeFileSync(inputPath, mediaBuffer);
                // Extract N seconds of audio starting from offset
                // If startOffset is 0, extract from beginning
                // Otherwise, seek to offset first
                const command = startOffset > 0
                    ? `ffmpeg -i "${inputPath}" -ss ${startOffset} -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`
                    : `ffmpeg -i "${inputPath}" -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`;
                yield execAsync(command);
                // Read extracted audio
                const audioBuffer = fs.readFileSync(outputPath);
                // Cleanup
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                return { audioBuffer, duration: maxDuration };
            }
            catch (error) {
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                logger_1.default.error("Error extracting audio sample:", error);
                throw new Error(`Audio extraction failed: ${error.message}`);
            }
        });
    }
    /**
     * Optimized video frame extraction - extracts frames more efficiently
     */
    extractVideoFramesOptimized(videoBuffer, videoMimeType, frameCount, duration) {
        return __awaiter(this, void 0, void 0, function* () {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                throw new Error("FFmpeg is required for frame extraction");
            }
            const tempId = `frames-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            const framesDir = path.join(this.tempDir, tempId);
            if (!fs.existsSync(framesDir)) {
                fs.mkdirSync(framesDir, { recursive: true });
            }
            try {
                // Write video buffer to temp file
                fs.writeFileSync(inputPath, videoBuffer);
                const frames = [];
                // Extract frames at strategic points for maximum coverage
                // Critical: Always check beginning to catch immediate inappropriate content
                const timestamps = [];
                if (frameCount === 1) {
                    timestamps.push(Math.max(5, duration * 0.5)); // Middle or first 5 seconds
                }
                else if (frameCount === 2) {
                    // Beginning and middle for safety
                    timestamps.push(Math.max(5, duration * 0.1), duration * 0.5);
                }
                else if (frameCount === 3) {
                    // Beginning, middle, end - optimal coverage
                    timestamps.push(Math.max(5, duration * 0.05), duration * 0.5, Math.max(duration - 10, duration * 0.9));
                }
                else {
                    // More frames: beginning, distributed middle, end
                    timestamps.push(Math.max(5, duration * 0.05)); // Beginning
                    for (let i = 1; i < frameCount - 1; i++) {
                        timestamps.push((duration / frameCount) * i); // Middle frames
                    }
                    timestamps.push(Math.max(duration - 10, duration * 0.95)); // End
                }
                // Extract frames in parallel for speed
                const framePromises = timestamps.map((timestamp, index) => __awaiter(this, void 0, void 0, function* () {
                    const framePath = path.join(framesDir, `frame-${index}.jpg`);
                    // Use faster extraction settings: lower quality for speed, skip to exact timestamp
                    const command = `ffmpeg -ss ${timestamp} -i "${inputPath}" -vframes 1 -vf "scale=320:-1" -q:v 5 -y "${framePath}"`;
                    yield execAsync(command);
                    if (fs.existsSync(framePath)) {
                        const frameBuffer = fs.readFileSync(framePath);
                        const base64 = frameBuffer.toString("base64");
                        return `data:image/jpeg;base64,${base64}`;
                    }
                    return null;
                }));
                const frameResults = yield Promise.all(framePromises);
                frames.push(...frameResults.filter((f) => f !== null));
                // Cleanup
                this.cleanupFile(inputPath);
                if (fs.existsSync(framesDir)) {
                    fs.readdirSync(framesDir).forEach((file) => {
                        this.cleanupFile(path.join(framesDir, file));
                    });
                    fs.rmdirSync(framesDir);
                }
                return { frames };
            }
            catch (error) {
                this.cleanupFile(inputPath);
                if (fs.existsSync(framesDir)) {
                    try {
                        fs.readdirSync(framesDir).forEach((file) => {
                            this.cleanupFile(path.join(framesDir, file));
                        });
                        fs.rmdirSync(framesDir);
                    }
                    catch (_a) { }
                }
                logger_1.default.error("Error extracting video frames:", error);
                throw new Error(`Frame extraction failed: ${error.message}`);
            }
        });
    }
    /**
     * Get video duration quickly
     */
    getVideoDuration(videoBuffer, videoMimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                return 10; // Default fallback
            }
            const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            try {
                fs.writeFileSync(inputPath, videoBuffer);
                const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
                const { stdout } = yield execAsync(durationCommand);
                const duration = parseFloat(stdout.trim()) || 10;
                this.cleanupFile(inputPath);
                return duration;
            }
            catch (error) {
                this.cleanupFile(inputPath);
                logger_1.default.warn("Could not get video duration, using default");
                return 10;
            }
        });
    }
    /**
     * Get audio duration quickly
     */
    getAudioDuration(audioBuffer, audioMimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                return 60; // Default fallback
            }
            const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            try {
                fs.writeFileSync(inputPath, audioBuffer);
                const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
                const { stdout } = yield execAsync(durationCommand);
                const duration = parseFloat(stdout.trim()) || 60;
                this.cleanupFile(inputPath);
                return duration;
            }
            catch (error) {
                this.cleanupFile(inputPath);
                logger_1.default.warn("Could not get audio duration, using default");
                return 60;
            }
        });
    }
    /**
     * Check if FFmpeg is available
     */
    checkFFmpegAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield execAsync("ffmpeg -version");
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     * Cleanup temporary file
     */
    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        catch (error) {
            logger_1.default.warn(`Failed to cleanup file ${filePath}:`, error);
        }
    }
}
exports.OptimizedVerificationService = OptimizedVerificationService;
// Export singleton instance
exports.optimizedVerificationService = new OptimizedVerificationService();
