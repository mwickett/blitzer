import { Resend } from "resend";
import { WelcomeEmail } from "@/components/email/welcome-template";
import { FriendRequestEmail } from "@/components/email/friend-request-template";
import { GameCompleteEmail } from "@/components/email/game-complete-template";

const resend = new Resend(process.env.RESEND_API_KEY);

const sender = "Blitzer <notifications@blitzer.fun>";

async function sendEmail(options: {
  to: string[];
  subject: string;
  react: any;
  text: string;
}): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to: options.to,
      subject: options.subject,
      react: options.react,
      text: options.text,
    });
    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendWelcomeEmail(params: {
  email: string;
  username: string;
}): Promise<EmailResult> {
  const emailTemplate = WelcomeEmail({ username: params.username });
  return await sendEmail({
    to: [params.email],
    subject: "Welcome to Blitzer!",
    react: emailTemplate.component,
    text: await emailTemplate.text,
  });
}

export async function sendGameCompleteEmail(params: {
  email: string;
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
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
  });
}

export async function sendFriendRequestEmail(params: {
  email: string;
  username: string;
  fromUsername: string;
}): Promise<EmailResult> {
  const emailTemplate = FriendRequestEmail({
    username: params.username,
    fromUsername: params.fromUsername,
  });
  return await sendEmail({
    to: [params.email],
    subject: `${params.fromUsername} sent you a friend request on Blitzer`,
    react: emailTemplate.component,
    text: await emailTemplate.text,
  });
}
