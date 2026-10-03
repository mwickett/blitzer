import { captureServerEvent } from "@/server/telemetry";
import crypto from "crypto";
import React from "react";
import { Resend } from "resend";
import { WelcomeEmail } from "@/components/email/welcome-template";
import { GameCompleteEmail } from "@/components/email/game-complete-template";
import posthogClient from "@/app/posthog";

const resend = new Resend(process.env.RESEND_API_KEY);

const sender = "Blitzer <hello@blitzer.fun>";

export const EMAIL_MAX_RETRY_ATTEMPTS = 3;
export const EMAIL_RETRY_BASE_DELAY_MS = 1000;
export const EMAIL_INTER_SEND_DELAY_MS = 600;

function createIdempotencyKey(scope: string, ...parts: string[]) {
  const digest = crypto
    .createHash("sha256")
    .update(parts.join(":"))
    .digest("hex")
    .slice(0, 32);

  return `${scope}/${digest}`;
}

async function sendEmail(options: {
  to: string[];
  subject: string;
  react: React.ReactElement;
  text: string;
  emailType?: string; // Type of email for analytics (welcome or game_complete)
  userId?: string; // User ID for analytics if available
  idempotencyKey?: string;
}): Promise<EmailResult> {
  const posthog = posthogClient();
  const distinctId = options.userId || "system";
  const maxAttempts = EMAIL_MAX_RETRY_ATTEMPTS;
  const baseDelay = EMAIL_RETRY_BASE_DELAY_MS;

  // Counts and categories only; recipients and content stay in the request
  const emailProperties = {
    emailType: options.emailType || "unknown",
    recipientCount: options.to.length,
  };
  const capture = (event: string, properties: Record<string, unknown>) =>
    captureServerEvent(posthog, {
      distinctId,
      event,
      properties: { ...emailProperties, ...properties },
    });

  for (let attempt = 1; ; attempt++) {
    if (attempt > 1) {
      capture("email_retry_attempt", {
        attemptNumber: attempt,
        maxAttempts,
        delay: baseDelay * attempt,
      });
    }

    // A provider error result is reported by name; a thrown error only as an
    // exception, since its message may echo the recipient
    let failure: {
      message: string;
      rateLimited: boolean;
      details: { errorName: string } | { errorType: "exception" };
      cause: unknown;
    };
    try {
      const { data, error } = await resend.emails.send(
        {
          from: sender,
          to: options.to,
          subject: options.subject,
          react: options.react,
          text: options.text,
        },
        { idempotencyKey: options.idempotencyKey },
      );

      if (!error) {
        capture("email_send_success", {
          attemptNumber: attempt,
          emailId: data?.id,
        });
        return { success: true };
      }
      failure = {
        message: error.message,
        rateLimited: error.name === "rate_limit_exceeded",
        details: { errorName: error.name },
        cause: error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failure = {
        message,
        rateLimited:
          message.includes("rate_limit") ||
          message.includes("too many requests"),
        details: { errorType: "exception" },
        cause: error,
      };
    }

    const thrown = "errorType" in failure.details;

    // Only rate limits are worth retrying
    if (!failure.rateLimited) {
      console.error(
        thrown ? "Error sending email:" : "Failed to send email:",
        failure.cause,
      );
      capture("email_send_failed", {
        ...failure.details,
        attemptNumber: attempt,
        reason: thrown ? "unexpected_exception" : "resend_api_error",
      });
      return { success: false, error: failure.message };
    }

    capture("email_rate_limit_hit", {
      ...failure.details,
      attemptNumber: attempt,
      maxAttempts,
    });

    if (attempt === maxAttempts) {
      console.error(
        `Failed to send email after ${maxAttempts} attempts:`,
        failure.cause,
      );
      capture("email_send_failed", {
        ...failure.details,
        attemptNumber: attempt,
        maxAttempts,
        reason: thrown
          ? "rate_limit_exception_max_retries"
          : "rate_limit_exceeded_max_retries",
      });
      return { success: false, error: failure.message };
    }

    await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));
  }
}

interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendWelcomeEmail(params: {
  email: string;
  username: string;
  userId?: string;
}): Promise<EmailResult> {
  const emailTemplate = WelcomeEmail({ username: params.username });
  return await sendEmail({
    to: [params.email],
    subject: "Welcome to Blitzer!",
    react: emailTemplate.component,
    text: await emailTemplate.text,
    emailType: "welcome",
    userId: params.userId,
    idempotencyKey: createIdempotencyKey(
      "welcome-email",
      params.userId ?? params.email
    ),
  });
}

export async function sendGameCompleteEmail(params: {
  email: string;
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
  userId?: string;
  /** AI recap, included only for recipients with llm-features enabled. */
  story?: string;
}): Promise<EmailResult> {
  const emailTemplate = GameCompleteEmail({
    username: params.username,
    winnerUsername: params.winnerUsername,
    isWinner: params.isWinner,
    gameId: params.gameId,
    story: params.story,
  });
  const subject = params.isWinner
    ? "Congratulations on your win! 🎉"
    : `Game Complete - ${params.winnerUsername} won!`;
  return await sendEmail({
    to: [params.email],
    subject,
    react: emailTemplate.component,
    text: await emailTemplate.text,
    emailType: "game_complete",
    userId: params.userId,
    idempotencyKey: createIdempotencyKey(
      "game-complete",
      params.gameId,
      params.email
    ),
  });
}
