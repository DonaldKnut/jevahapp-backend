import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

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

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

// Test email connection
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log("✅ Email connection verified successfully");
    return true;
  } catch (error) {
    console.error("❌ Email connection failed:", error);
    return false;
  }
};

interface MailData {
  to: string;
  subject: string;
  templateName: string;
  context: Record<string, any>;
}

const sendEmail = async ({ to, subject, templateName, context }: MailData) => {
  const templatePath = path.join(
    __dirname,
    "../emails/templates",
    `${templateName}.ejs`
  );

  try {
    // Verify connection before sending
    await transporter.verify();

    const html = await ejs.renderFile(templatePath, context);

    const mailOptions = {
      from: `"Jevah Support" <${process.env.SMTP_USER || "support@jevahapp.com"}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", {
      messageId: info.messageId,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    return info;
  } catch (error) {
    console.error("❌ Email send failed:", {
      error: error instanceof Error ? error.message : String(error),
      to,
      subject,
      templateName,
    });

    // Provide more specific error messages
    if (error instanceof Error) {
      const emailError = error as any; // Type assertion for nodemailer error
      if (emailError.code === "EAUTH") {
        throw new Error(
          "Email authentication failed. Please check SMTP credentials."
        );
      } else if (emailError.code === "ECONNECTION") {
        throw new Error("Email connection failed. Please check SMTP settings.");
      } else if (emailError.code === "ETIMEDOUT") {
        throw new Error("Email connection timed out. Please try again later.");
      } else {
        throw new Error(`Failed to send email: ${error.message}`);
      }
    } else {
      throw new Error("Failed to send email: Unknown error occurred");
    }
  }
};

export const sendWelcomeEmail = async (email: string, firstName: string) => {
  return sendEmail({
    to: email,
    subject: "Welcome to Tevah 🎉",
    templateName: "welcome",
    context: { firstName },
  });
};

export const sendVerificationEmail = async (
  email: string,
  firstName: string,
  code: string
) => {
  return sendEmail({
    to: email,
    subject: "Verify Your Email Address",
    templateName: "verify",
    context: { firstName, code },
  });
};

export const sendResetPasswordEmail = async (
  email: string,
  firstName: string,
  resetCode: string
) => {
  return sendEmail({
    to: email,
    subject: "Reset Your Password - Verification Code",
    templateName: "reset",
    context: { firstName, resetCode },
  });
};
