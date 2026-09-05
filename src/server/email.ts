import { captureServerEvent } from "@/server/telemetry";
import crypto from "crypto";
import React from "react";
import { Resend } from "resend";
import { WelcomeEmail } from "@/components/email/welcome-template";
import { GameCompleteEmail } from "@/components/email/game-complete-template";
import { GuestInvitationEmail } from "@/components/email/guest-invitation-template";
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
  emailType?: string; // Type of email for analytics (welcome, game_complete, friend_request, etc.)
  userId?: string; // User ID for analytics if available
  idempotencyKey?: string;
}): Promise<EmailResult> {
  const posthog = posthogClient();
  const distinctId = options.userId || "system";
  const emailType = options.emailType || "unknown";

  const maxAttempts = EMAIL_MAX_RETRY_ATTEMPTS;
  const baseDelay = EMAIL_RETRY_BASE_DELAY_MS;

  // Common properties for PostHog events
  const emailProperties = {
    emailType,
    recipientCount: options.to.length,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Track attempt if it's a retry
      if (attempt > 1) {
        captureServerEvent(posthog, {
          distinctId,
          event: "email_retry_attempt",
          properties: {
            ...emailProperties,
            attemptNumber: attempt,
            maxAttempts,
            delay: baseDelay * attempt,
          },
        });
      }

      const { data, error } = await resend.emails.send(
        {
          from: sender,
          to: options.to,
          subject: options.subject,
          react: options.react,
          text: options.text,
        },
        {
          idempotencyKey: options.idempotencyKey,
        }
      );

      if (error) {
        // Check if it's a rate limit error
        if (error.name === "rate_limit_exceeded") {
          // Track rate limit hit
          captureServerEvent(posthog, {
            distinctId,
            event: "email_rate_limit_hit",
            properties: {
              ...emailProperties,
              errorName: error.name,
              attemptNumber: attempt,
              maxAttempts,
            },
          });

          // If we've reached the max attempts, return failure
          if (attempt === maxAttempts) {
            console.error(
              `Failed to send email after ${maxAttempts} attempts:`,
              error
            );

            // Track final failure
            captureServerEvent(posthog, {
              distinctId,
              event: "email_send_failed",
              properties: {
                ...emailProperties,
                errorName: error.name,
                attemptNumber: attempt,
                maxAttempts,
                reason: "rate_limit_exceeded_max_retries",
              },
            });

            return { success: false, error: error.message };
          }

          // Otherwise, wait and retry
          const delay = baseDelay * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // For non-rate-limit errors, return failure immediately
        console.error("Failed to send email:", error);

        // Track other API errors
        captureServerEvent(posthog, {
          distinctId,
          event: "email_send_failed",
          properties: {
            ...emailProperties,
            errorName: error.name,
            attemptNumber: attempt,
            reason: "resend_api_error",
          },
        });

        return { success: false, error: error.message };
      }

      // Success! Track and return early
      captureServerEvent(posthog, {
        distinctId,
        event: "email_send_success",
        properties: {
          ...emailProperties,
          attemptNumber: attempt,
          emailId: data?.id,
        },
      });

      return { success: true };
    } catch (error) {
      // For unexpected errors, determine if it's rate limiting
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRateLimit =
        errorMessage.includes("rate_limit") ||
        errorMessage.includes("too many requests");

      if (isRateLimit) {
        // Track rate limit error
        captureServerEvent(posthog, {
          distinctId,
          event: "email_rate_limit_hit",
          properties: {
            ...emailProperties,
            attemptNumber: attempt,
            maxAttempts,
            errorType: "exception",
          },
        });

        // If we've reached the max attempts, return failure
        if (attempt === maxAttempts) {
          console.error(
            `Failed to send email after ${maxAttempts} attempts:`,
            error
          );

          // Track final failure
          captureServerEvent(posthog, {
            distinctId,
            event: "email_send_failed",
            properties: {
              ...emailProperties,
                attemptNumber: attempt,
              maxAttempts,
              reason: "rate_limit_exception_max_retries",
              errorType: "exception",
            },
          });

          return {
            success: false,
            error: errorMessage,
          };
        }

        // Otherwise, wait and retry
        const delay = baseDelay * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // For non-rate-limit errors, return failure immediately
      console.error("Error sending email:", error);

      // Track unexpected errors
      captureServerEvent(posthog, {
        distinctId,
        event: "email_send_failed",
        properties: {
          ...emailProperties,
          attemptNumber: attempt,
          reason: "unexpected_exception",
          errorType: "exception",
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // This should never be reached due to the returns above
  captureServerEvent(posthog, {
    distinctId,
    event: "email_send_failed",
    properties: {
      ...emailProperties,
      reason: "max_attempts_reached_unexpected",
    },
  });

  return {
    success: false,
    error: "Maximum retry attempts reached",
  };
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
}): Promise<EmailResult> {
  const emailTemplate = GameCompleteEmail({
    username: params.username,
    winnerUsername: params.winnerUsername,
    isWinner: params.isWinner,
    gameId: params.gameId,
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

export async function sendGuestInvitationEmail(params: {
  email: string;
  guestName: string;
  inviterUsername: string;
  guestId: string;
  userId?: string;
}): Promise<EmailResult> {
  const emailTemplate = GuestInvitationEmail({
    guestName: params.guestName,
    inviterUsername: params.inviterUsername,
  });

  return await sendEmail({
    to: [params.email],
    subject: `${params.inviterUsername} invited you to join Blitzer`,
    react: emailTemplate.component,
    text: await emailTemplate.text,
    emailType: "guest_invitation",
    userId: params.userId,
    idempotencyKey: createIdempotencyKey(
      "guest-invitation",
      params.guestId,
      params.email
    ),
  });
}
