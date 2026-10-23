"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("請輸入 Email 和密碼");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: "https://souvenir-reminder.vercel.app/",
          },
        });

        if (error) throw error;

        setMessage("註冊成功！請到信箱完成 Email 驗證 ✉️");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "Invalid login credentials"
          ? "Email 或密碼錯誤，請重新確認"
          : error instanceof Error
            ? error.message
            : "發生錯誤，請稍後再試"
      );
    } finally {
      setLoading(false);
    }
  }
    async function handleForgotPassword() {
    setMessage("");

    if (!email.trim()) {
      setMessage("請先輸入 Email");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: "http://localhost:3000/auth/callback?next=/reset-password",
      }
    );

    if (error) {
      setMessage(`寄送失敗：${error.message}`);
      return;
    }

    setMessage("重設密碼信已寄出，請到信箱查看 📩");
  }
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="text-4xl">🧳</div>
          <h1 className="mt-3 text-3xl font-bold text-slate-800">旅購</h1>
          <p className="mt-2 text-sm text-slate-500">
            想買的，旅途中別再錯過。
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-lg py-2 text-sm font-medium ${
                mode === "login"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              登入
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={`rounded-lg py-2 text-sm font-medium ${
                mode === "signup"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              註冊
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                密碼
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5.3 0 9 4.5 10 7a12.9 12.9 0 0 1-3.1 4.2" />
                        <path d="M6.1 6.1C3.9 7.5 2.5 9.8 2 12c1 2.5 4.7 7 10 7a10.9 10.9 0 0 0 4.1-.8" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            {mode === "login" && (
  <div className="text-right">
    <button
      type="button"
      onClick={handleForgotPassword}
      className="text-sm text-slate-500 hover:text-slate-900"
    >
      忘記密碼？
    </button>
  </div>
)}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading
                ? "處理中..."
                : mode === "login"
                  ? "登入旅購"
                  : "建立旅購帳號"}
            </button>

            {message && (
              <p className="text-center text-sm text-slate-600">{message}</p>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          登入後，未來即可跨裝置同步旅行清單與商品照片。
        </p>
      </div>
    </main>
  );
}