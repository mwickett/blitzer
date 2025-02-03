import { Resend } from "resend";
import { WelcomeEmail } from "@/components/email/welcome-template";
import { FriendRequestEmail } from "@/components/email/friend-request-template";

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
