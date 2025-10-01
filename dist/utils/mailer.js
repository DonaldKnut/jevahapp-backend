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
exports.sendResetPasswordEmail = exports.sendVerificationEmail = exports.sendWelcomeEmail = exports.testEmailConnection = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// SMTP transporter intentionally disabled
// const createTransporter = () => { ... }
// const transporter = createTransporter();
// Test email connection
const testEmailConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    console.warn("SMTP test bypassed: Resend-only mode enabled");
    return false;
});
exports.testEmailConnection = testEmailConnection;
const sendEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, templateName, context }) {
    const templatePath = path_1.default.join(__dirname, "../emails/templates", `${templateName}.ejs`);
    try {
        // Resend-only mode: this SMTP path is disabled
        throw new Error("SMTP mailer disabled: Resend is the enforced mail provider");
    }
    catch (error) {
        console.error("❌ Email send failed (SMTP disabled):", {
            error: error instanceof Error ? error.message : String(error),
            to,
            subject,
            templateName,
        });
        throw error instanceof Error ? error : new Error(String(error));
    }
});
const sendWelcomeEmail = (email, firstName) => __awaiter(void 0, void 0, void 0, function* () {
    return sendEmail({
        to: email,
        subject: "Welcome to Tevah 🎉",
        templateName: "welcome",
        context: { firstName },
    });
});
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendVerificationEmail = (email, firstName, code) => __awaiter(void 0, void 0, void 0, function* () {
    return sendEmail({
        to: email,
        subject: "Verify Your Email Address",
        templateName: "verify",
        context: { firstName, code },
    });
});
exports.sendVerificationEmail = sendVerificationEmail;
const sendResetPasswordEmail = (email, firstName, resetCode) => __awaiter(void 0, void 0, void 0, function* () {
    return sendEmail({
        to: email,
        subject: "Reset Your Password - Verification Code",
        templateName: "reset",
        context: { firstName, resetCode },
    });
});
exports.sendResetPasswordEmail = sendResetPasswordEmail;
