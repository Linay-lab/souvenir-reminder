"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "@/utils/supabase/client";
const db=createClient();
const areas=["首頁","收藏庫","我的旅行","購物清單","每日行程","旅行錢包","帳號登入","其他"];
const types=["問題回報","功能建議","使用感想"];
export default function FeedbackPage(){
 const [uid,setUid]=useState("");
 const [loading,setLoading]=useState(true);
 const [area,setArea]=useState("收藏庫");
 const [type,setType]=useState("使用感想");
 const [rating,setRating]=useState(0);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 const [sent,setSent]=useState(false);
 useEffect(()=>{let active=true;db.auth.getUser().then(({data:{user},error})=>{if(!active)return;setUid(user?.id||"");if(error)setStatus(error.message);setLoading(false)});return()=>{active=false};},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!uid){setStatus("請先登入測試帳號再提交。");return;}if(message.trim().length<10){setStatus("請至少寫 10 個字，讓我們知道你的體驗。");return;}setBusy(true);setStatus("");
 const {error}=await db.from("beta_feedback").insert({user_id:uid,area,feedback_type:type,rating:rating||null,message:message.trim(),page_path:window.location.pathname});
 if(error)setStatus("提交失敗，請稍後再試。若持續失敗，可能是回饋資料表尚未啟用。");
 else{setSent(true);setMessage("");}
 setBusy(false);}
 return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-20 pt-8 text-[#34423D] sm:px-8"><div className="mx-auto max-w-2xl"><Link href="/dashboard-preview" className="text-sm font-semibold text-[#537887]">← 返回旅購</Link>
 <p className="mt-8 text-xs font-semibold tracking-[.22em] text-[#7e9b9c]">TRAVEL STUDIO · BETA</p><h1 className="mt-2 text-3xl font-bold">一起把旅購變得更好 ♡</h1>
 <p className="mt-3 text-sm leading-7 text-[#718078]">謝謝你願意體驗旅購！使用過程中哪裡不順、最喜歡什麼、希望增加什麼，都可以告訴我們。</p>
 {sent?<section className="mt-8 rounded-3xl border border-[#dfe8dc] bg-white p-8 text-center"><p className="text-4xl">💌</p><h2 className="mt-4 text-xl font-bold">收到你的回饋了！</h2><p className="mt-2 text-sm text-[#74857c]">謝謝你幫助旅購成長。</p><div className="mt-6 flex justify-center gap-3"><button onClick={()=>{setSent(false);setRating(0);setStatus("")}} className="rounded-xl border px-4 py-3 text-sm">再填一則</button><Link href="/dashboard-preview" className="rounded-xl bg-[#a5ad96] px-4 py-3 text-sm font-semibold text-white">返回網站</Link></div></section>:<form onSubmit={submit} className="mt-7 space-y-5 rounded-3xl border border-[#e8e7df] bg-white p-5 shadow-sm sm:p-7">
 <div className="rounded-2xl bg-[#edf1ec] p-4 text-xs leading-6 text-[#63796e]">此表單供登入的 Beta 測試者使用。回饋會連結到你的測試帳號以協助追查問題；請不要填寫密碼、身分證、電話或其他敏感資料。回饋僅供網站改善使用，不會公開展示。</div>
 <label className="block text-sm font-semibold">你體驗的是哪個功能？<select value={area} onChange={e=>setArea(e.target.value)} className="mt-2 w-full rounded-xl border border-[#e0e5df] bg-white p-3">{areas.map(a=><option key={a}>{a}</option>)}</select></label>
 <fieldset><legend className="text-sm font-semibold">回饋類型</legend><div className="mt-2 flex flex-wrap gap-2">{types.map(t=><button type="button" key={t} onClick={()=>setType(t)} aria-pressed={type===t} className={`rounded-full border px-4 py-2 text-sm ${type===t?"border-[#a5ad96] bg-[#edf1ec] font-semibold":"border-[#e1e4de]"}`}>{t}</button>)}</div></fieldset>
 <fieldset><legend className="text-sm font-semibold">這次體驗給幾顆星？（可不填）</legend><div className="mt-2 flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setRating(rating===n?0:n)} aria-label={`${n} 顆星`} aria-pressed={rating===n} className="text-3xl" style={{color:n<=rating?"#d1a764":"#d9ddd6"}}>★</button>)}</div></fieldset>
 <label className="block text-sm font-semibold">想告訴我們什麼？ *<textarea required minLength={10} maxLength={2000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="例如：我在收藏庫新增照片時遇到什麼問題，或希望能有什麼功能…" className="mt-2 w-full rounded-xl border border-[#e0e5df] p-3 text-sm leading-7"/></label>
 <p className="text-xs text-[#89948a]">{message.length} / 2000 字</p>
 {status&&<p role="alert" className="rounded-xl bg-[#fff0e8] p-3 text-sm">{status}</p>}
 {loading?<p className="text-sm">正在確認登入狀態…</p>:!uid?<p className="text-sm">請先<Link href="/" className="mx-1 font-bold underline">登入網站</Link>再回來提交回饋。</p>:null}
 <button type="submit" disabled={!uid||busy||loading} className="w-full rounded-xl bg-[#a5ad96] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"傳送中…":"送出回饋 💌"}</button>
 </form>}
 <p className="mt-5 text-center text-xs text-[#839087]">Beta 測試期間功能仍在調整，感謝你的耐心與建議。</p></div></main>;
}
