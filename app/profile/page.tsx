"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "@/utils/supabase/client";
const db=createClient();
export default function ProfilePage(){
 const [email,setEmail]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;db.auth.getUser().then(({data:{user},error})=>{if(!active)return;if(error)setMessage(error.message);setEmail(user?.email||"");setLoading(false)});return()=>{active=false};},[]);
 async function logout(){setBusy(true);setMessage("");const {error}=await db.auth.signOut();if(error){setMessage("登出失敗："+error.message);setBusy(false);return;}window.location.assign("/");}
 return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-28 pt-8 text-[#34423D] sm:px-8"><div className="mx-auto max-w-3xl">
 <Link href="/dashboard-preview" className="text-sm font-semibold text-[#527586]">← 回首頁</Link>
 <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-[#7e9b9c]">TRAVEL STUDIO · 旅購</p><h1 className="mt-2 text-3xl font-bold">個人中心</h1>
 <section className="mt-7 rounded-3xl border border-[#e4e7df] bg-white p-6 shadow-sm"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7eee8] text-2xl">👤</span><div><p className="font-semibold">我的旅購帳號</p><p className="mt-1 break-all text-sm text-[#77877e]">{loading?"讀取中…":email||"尚未登入"}</p></div></div>
 {message&&<p role="alert" className="mt-4 rounded-xl bg-[#fff1e9] p-3 text-sm">{message}</p>}
 {email?<button disabled={busy} onClick={logout} className="mt-6 rounded-xl border border-[#d9deda] px-5 py-3 text-sm font-semibold disabled:opacity-50">{busy?"登出中…":"登出帳號"}</button>:!loading&&<Link href="/" className="mt-6 inline-block rounded-xl bg-[#a5ad96] px-5 py-3 text-sm font-semibold text-white">前往登入</Link>}</section>
 <section className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/dashboard-preview#my-trips" className="rounded-2xl border border-[#e4e7df] bg-white p-5"><span className="text-2xl">🧳</span><p className="mt-2 font-bold">我的旅行</p><p className="mt-1 text-xs text-[#79847c]">管理旅行與封面</p></Link><Link href="/collections" className="rounded-2xl border border-[#e4e7df] bg-white p-5"><span className="text-2xl">♡</span><p className="mt-2 font-bold">我的收藏</p><p className="mt-1 text-xs text-[#79847c]">旅行前先收集靈感</p></Link><Link href="/itinerary" className="rounded-2xl border border-[#e4e7df] bg-white p-5"><span className="text-2xl">🗓️</span><p className="mt-2 font-bold">每日行程</p><p className="mt-1 text-xs text-[#79847c]">安排每一站</p></Link><Link href="/wallet" className="rounded-2xl border border-[#e4e7df] bg-white p-5"><span className="text-2xl">💳</span><p className="mt-2 font-bold">旅行錢包</p><p className="mt-1 text-xs text-[#79847c]">整理各幣別支出</p></Link></section>
 <Link href="/feedback" className="mt-5 block rounded-2xl border border-[#dbe5db] bg-[#edf1ec] p-5"><span className="text-2xl">💌</span><p className="mt-2 font-bold">Beta 體驗回饋</p><p className="mt-1 text-xs text-[#79847c]">回報問題、提供建議，幫助旅購持續改善 →</p></Link>
 <p className="mt-6 text-xs leading-6 text-[#849087]">目前保留原本的帳號登入與旅行資料；個人中心不會修改你的 Supabase 資料。</p>
 </div><nav aria-label="旅購導覽" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-[#e8e7e1] bg-[#FAF9F6]/95 px-3 py-3 text-center text-xs shadow-lg backdrop-blur"><Link href="/dashboard-preview">⌂<span className="block">首頁</span></Link><Link href="/collections">♡<span className="block">收藏庫</span></Link><Link href="/dashboard-preview#my-trips">▤<span className="block">我的旅行</span></Link><Link href="/profile" aria-current="page" className="font-bold text-[#426b7d]">◉<span className="block">個人中心</span></Link></nav></main>;
}
