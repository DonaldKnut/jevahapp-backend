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
const nodemailer_1 = __importDefault(require("nodemailer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Enhanced transporter configuration with better error handling
const createTransporter = () => {
    const config = {
        host: process.env.SMTP_HOST || "smtp.zoho.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER || "support@jevahapp.com",
            pass: process.env.SMTP_PASS || "",
        },
        // Add connection timeout and other settings for better reliability
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000, // 60 seconds
        // Enable debug logging in development
        debug: process.env.NODE_ENV === "development",
        logger: process.env.NODE_ENV === "development",
    };
    console.log("📧 Email Configuration:", {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        // Don't log the password for security
    });
    return nodemailer_1.default.createTransport(config);
};
const transporter = createTransporter();
// Test email connection
const testEmailConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield transporter.verify();
        console.log("✅ Email connection verified successfully");
        return true;
    }
    catch (error) {
        console.error("❌ Email connection failed:", error);
        return false;
    }
});
exports.testEmailConnection = testEmailConnection;
const sendEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, templateName, context }) {
    const templatePath = path_1.default.join(__dirname, "../emails/templates", `${templateName}.ejs`);
    try {
        // Verify connection before sending
        yield transporter.verify();
        const html = yield ejs_1.default.renderFile(templatePath, context);
        const mailOptions = {
            from: `"Jevah Support" <${process.env.SMTP_USER || "support@jevahapp.com"}>`,
            to,
            subject,
            html,
        };
        const info = yield transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully:", {
            messageId: info.messageId,
            to: mailOptions.to,
            subject: mailOptions.subject,
        });
        return info;
    }
    catch (error) {
        console.error("❌ Email send failed:", {
            error: error instanceof Error ? error.message : String(error),
            to,
            subject,
            templateName,
        });
        // Provide more specific error messages
        if (error instanceof Error) {
            const emailError = error; // Type assertion for nodemailer error
            if (emailError.code === "EAUTH") {
                throw new Error("Email authentication failed. Please check SMTP credentials.");
            }
            else if (emailError.code === "ECONNECTION") {
                throw new Error("Email connection failed. Please check SMTP settings.");
            }
            else if (emailError.code === "ETIMEDOUT") {
                throw new Error("Email connection timed out. Please try again later.");
            }
            else {
                throw new Error(`Failed to send email: ${error.message}`);
            }
        }
        else {
            throw new Error("Failed to send email: Unknown error occurred");
        }
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
