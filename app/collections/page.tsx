"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Kind = "商品" | "景點" | "美食" | "商店" | "其他";
type Collection = { id:string; user_id:string; title:string; kind:Kind; country:string; city:string; place_name:string; source_url:string; image_url:string; notes:string; created_at:string };
const kinds: Kind[] = ["商品","景點","美食","商店","其他"];
const blank = { title:"",kind:"商品" as Kind,country:"",city:"",place_name:"",source_url:"",image_url:"",notes:"" };
const db = createClient();

export default function CollectionsPage() {
  const [userId,setUserId]=useState("");
  const [rows,setRows]=useState<Collection[]>([]);
  const [form,setForm]=useState(blank);
  const [editing,setEditing]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [query,setQuery]=useState("");
  const [kind,setKind]=useState("全部");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  async function reload(uid:string) {
    const {data,error}=await db.from("saved_collections").select("*").eq("user_id",uid).order("created_at",{ascending:false});
    if(error) setMessage("收藏庫資料表尚未啟用，或讀取失敗。請先確認資料庫 migration 已套用。");
    else {setRows((data??[]) as Collection[]);setMessage("");}
    setLoading(false);
  }
  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{user}}=await db.auth.getUser();
      if(!active)return;
      if(!user){setLoading(false);setMessage("請先登入，才能使用私人收藏庫。");return;}
      setUserId(user.id);await reload(user.id);
    })();
    return()=>{active=false};
  },[]);
  const visible=useMemo(()=>rows.filter(r=>(kind==="全部"||r.kind===kind)&&[r.title,r.country,r.city,r.place_name,r.notes].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[rows,kind,query]);
  function startEdit(r:Collection){setEditing(r.id);setForm({title:r.title,kind:r.kind,country:r.country,city:r.city,place_name:r.place_name,source_url:r.source_url,image_url:r.image_url,notes:r.notes});setShowForm(true);window.scrollTo({top:0,behavior:"smooth"});}
  function reset(){setForm(blank);setEditing(null);setShowForm(false);}
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!userId||!form.title.trim())return;
    setBusy(true);setMessage("");
    const payload={...form,title:form.title.trim(),user_id:userId,updated_at:new Date().toISOString()};
    const result=editing
      ? await db.from("saved_collections").update(payload).eq("id",editing).eq("user_id",userId)
      : await db.from("saved_collections").insert(payload);
    if(result.error)setMessage("儲存失敗："+result.error.message);
    else {reset();await reload(userId);}
    setBusy(false);
  }
  async function remove(r:Collection){
    if(!userId||!window.confirm(`確定刪除「${r.title}」？`))return;
    const {error}=await db.from("saved_collections").delete().eq("id",r.id).eq("user_id",userId);
    if(error)setMessage("刪除失敗："+error.message);else await reload(userId);
  }
  return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-28 pt-8 text-[#34423D] sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><a href="/dashboard-preview" className="text-xs font-semibold tracking-widest text-[#7897A0]">TRAVEL STUDIO · 旅購</a><h1 className="mt-2 text-3xl font-bold">我的靈感收藏庫 ♡</h1><p className="mt-2 text-sm text-[#77837C]">喜歡的商品、景點與美食，先收藏起來。無須先建立旅行。</p></div>
        <button disabled={!userId} onClick={()=>{reset();setShowForm(true)}} className="rounded-2xl bg-[#A5AD96] px-5 py-3 font-semibold text-white disabled:opacity-50">＋ 新增收藏</button>
      </header>
      {message&&<p role="alert" className="mb-5 rounded-xl border border-[#ead6c7] bg-[#fff4eb] p-4 text-sm">{message}</p>}
      {showForm&&<form onSubmit={save} className="mb-7 grid gap-3 rounded-3xl border border-[#e7e4dc] bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-bold">{editing?"編輯收藏":"新增一筆收藏"}</h2>
        <label className="text-sm">名稱 *<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：博多車站伴手禮" className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm">分類<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as Kind})} className="mt-1 w-full rounded-xl border p-3">{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
        {(["country","city","place_name","source_url","image_url"] as const).map((key)=><label key={key} className="text-sm">{{country:"國家",city:"城市",place_name:"地點名稱",source_url:"來源網址",image_url:"圖片網址"}[key]}<input type={key.endsWith("url")?"url":"text"} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>)}
        <label className="sm:col-span-2 text-sm">備註<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
        <div className="flex gap-3 sm:col-span-2"><button disabled={busy} type="submit" className="rounded-xl bg-[#91B3C3] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"儲存中…":"儲存收藏"}</button><button type="button" onClick={reset} className="rounded-xl border px-5 py-3">取消</button></div>
      </form>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input aria-label="搜尋收藏" value={query} onChange={e=>setQuery(e.target.value)} placeholder="🔎 搜尋收藏名稱、城市或備註" className="min-w-0 flex-1 rounded-2xl border border-[#e5e7e2] bg-white px-4 py-3"/>
        <select aria-label="收藏分類" value={kind} onChange={e=>setKind(e.target.value)} className="rounded-2xl border border-[#e5e7e2] bg-white px-4 py-3"><option>全部</option>{kinds.map(k=><option key={k}>{k}</option>)}</select>
      </div>
      {loading?<p className="py-12 text-center">讀取收藏中…</p>:userId&&visible.length===0?<div className="rounded-3xl border border-dashed border-[#d8ddd5] bg-white px-5 py-16 text-center"><p className="text-4xl">📮</p><p className="mt-3 font-semibold">{rows.length?"找不到符合的收藏":"收藏庫還是空的"}</p><p className="mt-2 text-sm text-[#7c8880]">看到喜歡的東西，就從這裡開始記錄。</p></div>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(r=><article key={r.id} className="overflow-hidden rounded-3xl border border-[#e7e5df] bg-white shadow-sm">
        {r.image_url?<div className="h-40 bg-[#f2f0ea]" style={{backgroundImage:`url("${r.image_url.replaceAll('"','%22')}")`,backgroundSize:"cover",backgroundPosition:"center"}} role="img" aria-label={r.title}/>:<div className="flex h-32 items-center justify-center bg-[#edf1ec] text-5xl">{r.kind==="美食"?"🍜":r.kind==="景點"?"🏞️":r.kind==="商店"?"🏬":"🎁"}</div>}
        <div className="p-4"><p className="text-xs font-semibold text-[#839E92]">{r.kind} · {[r.country,r.city].filter(Boolean).join(" / ")||"未分類地區"}</p><h2 className="mt-2 text-lg font-bold">{r.title}</h2>{r.place_name&&<p className="mt-1 text-sm text-[#687b75]">📍 {r.place_name}</p>}{r.notes&&<p className="mt-2 line-clamp-2 text-sm text-[#7a8580]">{r.notes}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><button onClick={()=>startEdit(r)} className="font-semibold text-[#426b7d]">編輯</button><button onClick={()=>remove(r)} className="text-[#aa776b]">刪除</button>{r.source_url&&<a href={r.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#426b7d]">來源 ↗</a>}{r.place_name&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.place_name,r.city,r.country].filter(Boolean).join(" "))}`} target="_blank" rel="noopener noreferrer" className="text-[#426b7d]">地圖 ↗</a>}</div>
        </div>
      </article>)}</div>}
    </div>
    <nav aria-label="旅購導覽" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-[#e8e7e1] bg-[#FAF9F6]/95 px-3 py-3 text-center text-xs shadow-lg backdrop-blur"><a href="/dashboard-preview">⌂<br/>首頁</a><a href="/collections" aria-current="page" className="font-bold text-[#426b7d]">♡<br/>收藏庫</a><a href="/dashboard-preview#my-trips">▤<br/>我的旅行</a><a href="/">▣<br/>購物清單</a></nav>
  </main>;
}
