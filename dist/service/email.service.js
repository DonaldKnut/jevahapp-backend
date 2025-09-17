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
const resendEmail_service_1 = __importDefault(require("./resendEmail.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class EmailService {
    constructor() {
        this.useResend = !!process.env.RESEND_API_KEY;
        this.fallbackEnabled = true;
    }
    /**
     * Test email connection
     */
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.useResend) {
                    logger_1.default.info("Testing Resend connection...");
                    const resendConnected = yield resendEmail_service_1.default.testConnection();
                    if (resendConnected) {
                        logger_1.default.info("✅ Resend connection successful");
                        return true;
                    }
                }
                if (this.fallbackEnabled) {
                    logger_1.default.info("Testing SMTP fallback connection...");
                    const { testEmailConnection } = yield Promise.resolve().then(() => __importStar(require("../utils/mailer")));
                    const smtpConnected = yield testEmailConnection();
                    if (smtpConnected) {
                        logger_1.default.info("✅ SMTP fallback connection successful");
                        return true;
                    }
                }
                logger_1.default.error("❌ All email connections failed");
                return false;
            }
            catch (error) {
                logger_1.default.error("❌ Email connection test failed:", error);
                return false;
            }
        });
    }
    /**
     * Send verification email with fallback
     */
    sendVerificationEmail(email, firstName, code) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Try Resend first
            if (this.useResend) {
                try {
                    logger_1.default.info("Sending verification email via Resend...", { email });
                    const result = yield resendEmail_service_1.default.sendVerificationEmail(email, firstName, code);
                    logger_1.default.info("✅ Verification email sent via Resend", {
                        email,
                        messageId: (_a = result.data) === null || _a === void 0 ? void 0 : _a.id,
                    });
                    return {
                        success: true,
                        messageId: (_b = result.data) === null || _b === void 0 ? void 0 : _b.id,
                        service: "resend",
                    };
                }
                catch (error) {
                    logger_1.default.error("❌ Resend verification email failed:", error);
                    if (this.fallbackEnabled) {
                        logger_1.default.info("Trying SMTP fallback for verification email...");
                        return this.sendVerificationEmailSMTP(email, firstName, code);
                    }
                    else {
                        throw error;
                    }
                }
            }
            // Use SMTP directly if Resend not configured
            return this.sendVerificationEmailSMTP(email, firstName, code);
        });
    }
    /**
     * Send verification email via SMTP
     */
    sendVerificationEmailSMTP(email, firstName, code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sendVerificationEmail } = yield Promise.resolve().then(() => __importStar(require("../utils/mailer")));
                const result = yield sendVerificationEmail(email, firstName, code);
                logger_1.default.info("✅ Verification email sent via SMTP", {
                    email,
                    messageId: result.messageId,
                });
                return {
                    success: true,
                    messageId: result.messageId,
                    service: "smtp",
                };
            }
            catch (error) {
                logger_1.default.error("❌ SMTP verification email failed:", error);
                return {
                    success: false,
                    service: "smtp",
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }
    /**
     * Send password reset email with fallback
     */
    sendPasswordResetEmail(email, firstName, resetCode) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Try Resend first
            if (this.useResend) {
                try {
                    logger_1.default.info("Sending password reset email via Resend...", { email });
                    const result = yield resendEmail_service_1.default.sendPasswordResetEmail(email, firstName, resetCode);
                    logger_1.default.info("✅ Password reset email sent via Resend", {
                        email,
                        messageId: (_a = result.data) === null || _a === void 0 ? void 0 : _a.id,
                    });
                    return {
                        success: true,
                        messageId: (_b = result.data) === null || _b === void 0 ? void 0 : _b.id,
                        service: "resend",
                    };
                }
                catch (error) {
                    logger_1.default.error("❌ Resend password reset email failed:", error);
                    if (this.fallbackEnabled) {
                        logger_1.default.info("Trying SMTP fallback for password reset email...");
                        return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
                    }
                    else {
                        throw error;
                    }
                }
            }
            // Use SMTP directly if Resend not configured
            return this.sendPasswordResetEmailSMTP(email, firstName, resetCode);
        });
    }
    /**
     * Send password reset email via SMTP
     */
    sendPasswordResetEmailSMTP(email, firstName, resetCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sendResetPasswordEmail } = yield Promise.resolve().then(() => __importStar(require("../utils/mailer")));
                const result = yield sendResetPasswordEmail(email, firstName, resetCode);
                logger_1.default.info("✅ Password reset email sent via SMTP", {
                    email,
                    messageId: result.messageId,
                });
                return {
                    success: true,
                    messageId: result.messageId,
                    service: "smtp",
                };
            }
            catch (error) {
                logger_1.default.error("❌ SMTP password reset email failed:", error);
                return {
                    success: false,
                    service: "smtp",
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }
    /**
     * Send welcome email with fallback
     */
    sendWelcomeEmail(email, firstName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Try Resend first
            if (this.useResend) {
                try {
                    logger_1.default.info("Sending welcome email via Resend...", { email });
                    const result = yield resendEmail_service_1.default.sendWelcomeEmail(email, firstName);
                    logger_1.default.info("✅ Welcome email sent via Resend", {
                        email,
                        messageId: (_a = result.data) === null || _a === void 0 ? void 0 : _a.id,
                    });
                    return {
                        success: true,
                        messageId: (_b = result.data) === null || _b === void 0 ? void 0 : _b.id,
                        service: "resend",
                    };
                }
                catch (error) {
                    logger_1.default.error("❌ Resend welcome email failed:", error);
                    if (this.fallbackEnabled) {
                        logger_1.default.info("Trying SMTP fallback for welcome email...");
                        return this.sendWelcomeEmailSMTP(email, firstName);
                    }
                    else {
                        throw error;
                    }
                }
            }
            // Use SMTP directly if Resend not configured
            return this.sendWelcomeEmailSMTP(email, firstName);
        });
    }
    /**
     * Send welcome email via SMTP
     */
    sendWelcomeEmailSMTP(email, firstName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sendWelcomeEmail } = yield Promise.resolve().then(() => __importStar(require("../utils/mailer")));
                const result = yield sendWelcomeEmail(email, firstName);
                logger_1.default.info("✅ Welcome email sent via SMTP", {
                    email,
                    messageId: result.messageId,
                });
                return {
                    success: true,
                    messageId: result.messageId,
                    service: "smtp",
                };
            }
            catch (error) {
                logger_1.default.error("❌ SMTP welcome email failed:", error);
                return {
                    success: false,
                    service: "smtp",
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }
    /**
     * Get email service status
     */
    getServiceStatus() {
        return {
            resendConfigured: this.useResend,
            fallbackEnabled: this.fallbackEnabled,
            primaryService: this.useResend ? "resend" : "smtp",
            resendApiKey: this.useResend ? "configured" : "not configured",
        };
    }
    /**
     * Enable/disable fallback
     */
    setFallbackEnabled(enabled) {
        this.fallbackEnabled = enabled;
        logger_1.default.info(`Email fallback ${enabled ? "enabled" : "disabled"}`);
    }
    /**
     * Force use specific service
     */
    forceService(service) {
        return __awaiter(this, void 0, void 0, function* () {
            if (service === "resend" && !this.useResend) {
                throw new Error("Resend is not configured");
            }
            const originalUseResend = this.useResend;
            const originalFallback = this.fallbackEnabled;
            if (service === "resend") {
                this.useResend = true;
                this.fallbackEnabled = false;
            }
            else {
                this.useResend = false;
                this.fallbackEnabled = false;
            }
            logger_1.default.info(`Forced email service to: ${service}`);
            return () => {
                this.useResend = originalUseResend;
                this.fallbackEnabled = originalFallback;
                logger_1.default.info("Restored original email service configuration");
            };
        });
    }
}
exports.default = new EmailService();
