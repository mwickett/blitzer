import { Resend } from "resend";
import { WelcomeEmail } from "@/components/email/welcome-template";
import { FriendRequestEmail } from "@/components/email/friend-request-template";
import { GameCompleteEmail } from "@/components/email/game-complete-template";

const resend = new Resend(process.env.RESEND_API_KEY);

const sender = "Blitzer <notifications@blitzer.fun>";

interface EmailResult {
  success: boolean;
  error?: string;
}

export async function sendWelcomeEmail(params: {
  email: string;
  username: string;
}): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to: [params.email],
      subject: "Welcome to Blitzer!",
      react: WelcomeEmail({ username: params.username }),
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendGameCompleteEmail(params: {
  email: string;
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
}): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to: [params.email],
      subject: params.isWinner
        ? "Congratulations on your win! 🎉"
        : `Game Complete - ${params.winnerUsername} won!`,
      react: GameCompleteEmail({
        username: params.username,
        winnerUsername: params.winnerUsername,
        isWinner: params.isWinner,
        gameId: params.gameId,
      }),
    });

    if (error) {
      console.error("Failed to send game complete email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending game complete email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendFriendRequestEmail(params: {
  email: string;
  username: string;
  fromUsername: string;
}): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to: [params.email],
      subject: `${params.fromUsername} sent you a friend request on Blitzer`,
      react: FriendRequestEmail({
        username: params.username,
        fromUsername: params.fromUsername,
      }),
    });

    if (error) {
      console.error("Failed to send friend request email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending friend request email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
