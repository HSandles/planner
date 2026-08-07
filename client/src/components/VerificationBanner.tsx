import { useState } from "react";

export default function VerificationBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSending(true);
    await fetch("/auth/resend-verification", {
      method: "POST",
      credentials: "include",
    });
    setSending(false);
    setSent(true);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-sm">
      <p className="text-amber-800">
        Please verify your email address to get the most out of Chronicle.
      </p>
      {sent ? (
        <span className="text-amber-600 font-medium">Email sent!</span>
      ) : (
        <button
          onClick={resend}
          disabled={sending}
          className="text-amber-700 font-medium underline hover:text-amber-900 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}
