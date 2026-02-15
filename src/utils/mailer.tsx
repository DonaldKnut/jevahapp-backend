// NOTE: SMTP (Zoho) mailer is disabled in favor of Resend-only configuration
// import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// SMTP transporter intentionally disabled
// const createTransporter = () => { ... }
// const transporter = createTransporter();

// Test email connection
export const testEmailConnection = async (): Promise<boolean> => {
  console.warn("SMTP test bypassed: Resend-only mode enabled");
  return false;
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
    // Resend-only mode: this SMTP path is disabled
    throw new Error(
      "SMTP mailer disabled: Resend is the enforced mail provider"
    );
  } catch (error) {
    console.error("❌ Email send failed (SMTP disabled):", {
      error: error instanceof Error ? error.message : String(error),
      to,
      subject,
      templateName,
    });
    throw error instanceof Error ? error : new Error(String(error));
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
