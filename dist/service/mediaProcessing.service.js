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
exports.mediaProcessingService = exports.MediaProcessingService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const logger_1 = __importDefault(require("../utils/logger"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class MediaProcessingService {
    constructor() {
        // Create temp directory for processing
        this.tempDir = path.join(os.tmpdir(), "jevah-media-processing");
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
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
                logger_1.default.warn("FFmpeg not found. Media processing will be limited.");
                return false;
            }
        });
    }
    /**
     * Extract audio from video file
     */
    extractAudio(videoBuffer_1, videoMimeType_1) {
        return __awaiter(this, arguments, void 0, function* (videoBuffer, videoMimeType, outputFormat = "mp3") {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                throw new Error("FFmpeg is required for audio extraction");
            }
            const tempId = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            const outputPath = path.join(this.tempDir, `${tempId}-output.${outputFormat}`);
            try {
                // Write video buffer to temp file
                fs.writeFileSync(inputPath, videoBuffer);
                // Extract audio using FFmpeg
                const command = `ffmpeg -i "${inputPath}" -vn -acodec ${outputFormat === "mp3" ? "libmp3lame" : "pcm_s16le"} -ar 44100 -ac 2 -y "${outputPath}"`;
                yield execAsync(command);
                // Read extracted audio
                const audioBuffer = fs.readFileSync(outputPath);
                // Get duration if possible
                let duration;
                try {
                    const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
                    const { stdout } = yield execAsync(durationCommand);
                    duration = parseFloat(stdout.trim());
                }
                catch (error) {
                    // Duration extraction failed, continue without it
                }
                // Cleanup temp files
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                return {
                    audioPath: outputPath,
                    audioBuffer,
                    duration,
                };
            }
            catch (error) {
                // Cleanup on error
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                logger_1.default.error("Error extracting audio:", error);
                throw new Error(`Audio extraction failed: ${error.message}`);
            }
        });
    }
    /**
     * Extract key frames from video
     */
    extractVideoFrames(videoBuffer_1, videoMimeType_1) {
        return __awaiter(this, arguments, void 0, function* (videoBuffer, videoMimeType, frameCount = 3) {
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                throw new Error("FFmpeg is required for frame extraction");
            }
            const tempId = `frames-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            const framesDir = path.join(this.tempDir, tempId);
            if (!fs.existsSync(framesDir)) {
                fs.mkdirSync(framesDir, { recursive: true });
            }
            try {
                // Write video buffer to temp file
                fs.writeFileSync(inputPath, videoBuffer);
                // Extract frames evenly distributed throughout the video
                // First, get video duration
                let duration = 10; // Default fallback
                try {
                    const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
                    const { stdout } = yield execAsync(durationCommand);
                    duration = parseFloat(stdout.trim()) || 10;
                }
                catch (error) {
                    logger_1.default.warn("Could not get video duration, using default");
                }
                // Calculate frame timestamps
                const framePaths = [];
                const frames = [];
                for (let i = 0; i < frameCount; i++) {
                    const timestamp = (duration / (frameCount + 1)) * (i + 1);
                    const framePath = path.join(framesDir, `frame-${i}.jpg`);
                    // Extract frame at specific timestamp
                    const command = `ffmpeg -i "${inputPath}" -ss ${timestamp} -vframes 1 -q:v 2 -y "${framePath}"`;
                    yield execAsync(command);
                    if (fs.existsSync(framePath)) {
                        const frameBuffer = fs.readFileSync(framePath);
                        const base64 = frameBuffer.toString("base64");
                        frames.push(`data:image/jpeg;base64,${base64}`);
                        framePaths.push(framePath);
                    }
                }
                // Cleanup temp files
                this.cleanupFile(inputPath);
                framePaths.forEach(framePath => this.cleanupFile(framePath));
                if (fs.existsSync(framesDir)) {
                    fs.rmdirSync(framesDir);
                }
                return {
                    frames,
                    framePaths: [], // Already cleaned up
                };
            }
            catch (error) {
                // Cleanup on error
                this.cleanupFile(inputPath);
                if (fs.existsSync(framesDir)) {
                    fs.readdirSync(framesDir).forEach(file => {
                        this.cleanupFile(path.join(framesDir, file));
                    });
                    fs.rmdirSync(framesDir);
                }
                logger_1.default.error("Error extracting video frames:", error);
                throw new Error(`Frame extraction failed: ${error.message}`);
            }
        });
    }
    /**
     * Extract audio from audio file (for transcription)
     * This is mainly for format conversion if needed
     */
    prepareAudioForTranscription(audioBuffer, audioMimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            // If already in a supported format, return as-is
            if (audioMimeType === "audio/wav" || audioMimeType === "audio/mpeg") {
                return audioBuffer;
            }
            // Otherwise, convert to WAV using FFmpeg
            const ffmpegAvailable = yield this.checkFFmpegAvailable();
            if (!ffmpegAvailable) {
                // Return original if FFmpeg not available
                return audioBuffer;
            }
            const tempId = `transcribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const inputPath = path.join(this.tempDir, `${tempId}-input`);
            const outputPath = path.join(this.tempDir, `${tempId}-output.wav`);
            try {
                fs.writeFileSync(inputPath, audioBuffer);
                const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -y "${outputPath}"`;
                yield execAsync(command);
                const convertedBuffer = fs.readFileSync(outputPath);
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                return convertedBuffer;
            }
            catch (error) {
                this.cleanupFile(inputPath);
                this.cleanupFile(outputPath);
                logger_1.default.warn("Audio conversion failed, using original:", error);
                return audioBuffer;
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
    /**
     * Cleanup all temp files (for periodic cleanup)
     */
    cleanupTempFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (fs.existsSync(this.tempDir)) {
                    const files = fs.readdirSync(this.tempDir);
                    for (const file of files) {
                        const filePath = path.join(this.tempDir, file);
                        const stats = fs.statSync(filePath);
                        // Delete files older than 1 hour
                        if (Date.now() - stats.mtimeMs > 3600000) {
                            if (stats.isDirectory()) {
                                fs.rmSync(filePath, { recursive: true, force: true });
                            }
                            else {
                                fs.unlinkSync(filePath);
                            }
                        }
                    }
                }
            }
            catch (error) {
                logger_1.default.warn("Failed to cleanup temp files:", error);
            }
        });
    }
}
exports.MediaProcessingService = MediaProcessingService;
// Export singleton instance
exports.mediaProcessingService = new MediaProcessingService();
