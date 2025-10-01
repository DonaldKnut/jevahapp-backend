"use strict";
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
        // SMTP fallback is disabled to enforce Resend-only delivery
        this.fallbackEnabled = false;
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
                // Resend-only mode: do not attempt SMTP fallback
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
            // Resend-only mode
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
                    // Fallback disabled
                    throw error;
                }
            }
            // Resend not configured and fallback disabled
            throw new Error("Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled");
        });
    }
    /**
     * Send verification email via SMTP
     */
    sendVerificationEmailSMTP(email, firstName, code) {
        return __awaiter(this, void 0, void 0, function* () {
            // SMTP path disabled in Resend-only mode
            throw new Error("SMTP (Zoho) is disabled. Resend is the only email provider in use.");
        });
    }
    /**
     * Send password reset email with fallback
     */
    sendPasswordResetEmail(email, firstName, resetCode) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Resend-only mode
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
                    // Fallback disabled
                    throw error;
                }
            }
            // Resend not configured and fallback disabled
            throw new Error("Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled");
        });
    }
    /**
     * Send password reset email via SMTP
     */
    sendPasswordResetEmailSMTP(email, firstName, resetCode) {
        return __awaiter(this, void 0, void 0, function* () {
            // SMTP path disabled in Resend-only mode
            throw new Error("SMTP (Zoho) is disabled. Resend is the only email provider in use.");
        });
    }
    /**
     * Send welcome email with fallback
     */
    sendWelcomeEmail(email, firstName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Resend-only mode
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
                    // Fallback disabled
                    throw error;
                }
            }
            // Resend not configured and fallback disabled
            throw new Error("Resend is not configured (RESEND_API_KEY missing) and SMTP fallback is disabled");
        });
    }
    /**
     * Send welcome email via SMTP
     */
    sendWelcomeEmailSMTP(email, firstName) {
        return __awaiter(this, void 0, void 0, function* () {
            // SMTP path disabled in Resend-only mode
            throw new Error("SMTP (Zoho) is disabled. Resend is the only email provider in use.");
        });
    }
    /**
     * Get email service status
     */
    getServiceStatus() {
        return {
            resendConfigured: this.useResend,
            fallbackEnabled: false,
            primaryService: "resend",
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
