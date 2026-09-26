"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setMessage("");

    if (password.length < 6) {
      setMessage("密碼至少需要 6 個字元");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("兩次輸入的密碼不一致");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(`更新失敗：${error.message}`);
      return;
    }

    setMessage("密碼更新成功！");

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🧳</div>
          <h1 className="text-2xl font-bold text-slate-900">設定新密碼</h1>
          <p className="mt-2 text-sm text-slate-500">
            設定完成後，就可以重新登入旅購。
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="新密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
          />

          <input
            type="password"
            placeholder="再次輸入新密碼"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
          />

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "更新中..." : "更新密碼"}
          </button>

          {message && (
            <p className="text-center text-sm text-slate-600">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}