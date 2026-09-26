import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Sends a one-time code to an address through freebuff's mail relay.
 *
 * Shared by the auth provider's own OTP flow and by CLIPTIC's own email
 * verification for password accounts.
 */
export async function sendOtpEmail({
  to,
  otp,
  subject,
}: {
  to: string;
  otp: string;
  subject: string;
}): Promise<void> {
  const response = await fetch("https://auth.freebuff.app/send_otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
    },
    body: JSON.stringify({
      to,
      otp,
      subject,
      appName: process.env.VLY_APP_NAME || "a freebuff.com application",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `The mail relay rejected the request (${response.status}): ${detail.slice(0, 200)}`,
    );
  }
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendOtpEmail({
      to: email,
      otp: token,
      subject: "Your CLIPTIC sign-in code",
    });
  },
});
