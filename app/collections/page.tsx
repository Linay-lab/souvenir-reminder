"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import StudioNavigation from "@/app/components/StudioNavigation";

type TripOption = { id:string; name:string|null; currency:string|null };
type Kind = "商品" | "景點" | "美食" | "商店" | "其他";
type Collection = { id:string; user_id:string; title:string; kind:Kind; country:string; city:string; place_name:string; source_url:string; image_url:string; notes:string; created_at:string };
const kinds: Kind[] = ["商品","景點","美食","商店","其他"];
const blank = { title:"",kind:"商品" as Kind,country:"",city:"",place_name:"",source_url:"",image_url:"",notes:"" };
const db = createClient();

export default function CollectionsPage() {
  const [userId,setUserId]=useState("");
  const [rows,setRows]=useState<Collection[]>([]);
  const [trips,setTrips]=useState<TripOption[]>([]);
  const [tripChoice,setTripChoice]=useState<Record<string,string>>({});
  const [dateChoice,setDateChoice]=useState<Record<string,string>>({});
  const [copying,setCopying]=useState<string|null>(null);
  const [form,setForm]=useState(blank);
  const [editing,setEditing]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [query,setQuery]=useState("");
  const [kind,setKind]=useState("全部");
  const [busy,setBusy]=useState(false);
  const [photo,setPhoto]=useState<File|null>(null);
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
      setUserId(user.id);
      const {data:tripRows,error:tripError}=await db.from("trips").select("id,name,currency").eq("owner_id",user.id);
      if(!tripError)setTrips((tripRows??[]) as TripOption[]);
      await reload(user.id);
    })();
    return()=>{active=false};
  },[]);
  const visible=useMemo(()=>rows.filter(r=>(kind==="全部"||r.kind===kind)&&[r.title,r.country,r.city,r.place_name,r.notes].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[rows,kind,query]);
  function startEdit(r:Collection){setEditing(r.id);setForm({title:r.title,kind:r.kind,country:r.country,city:r.city,place_name:r.place_name,source_url:r.source_url,image_url:r.image_url,notes:r.notes});setShowForm(true);window.scrollTo({top:0,behavior:"smooth"});}
  function reset(){setForm(blank);setPhoto(null);setEditing(null);setShowForm(false);}
  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!userId||!form.title.trim())return;
    setBusy(true);setMessage("");
    let imageUrl=form.image_url;
    if(photo){
      if(!["image/jpeg","image/png","image/webp","image/gif"].includes(photo.type)){setMessage("請選擇圖片檔案。");setBusy(false);return;}
      if(photo.size>8*1024*1024){setMessage("圖片請勿超過 8 MB。");setBusy(false);return;}
      const extension=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"} as Record<string,string>)[photo.type];
      const key=`${userId}/${crypto.randomUUID()}.${extension}`;
      const uploaded=await db.storage.from("collection-photos").upload(key,photo,{contentType:photo.type,upsert:false});
      if(uploaded.error){setMessage("照片上傳失敗："+uploaded.error.message);setBusy(false);return;}
      const {data}=db.storage.from("collection-photos").getPublicUrl(key);
      imageUrl=data.publicUrl;
    }
    const payload={...form,image_url:imageUrl,title:form.title.trim(),user_id:userId,updated_at:new Date().toISOString()};
    const result=editing
      ? await db.from("saved_collections").update(payload).eq("id",editing).eq("user_id",userId)
      : await db.from("saved_collections").insert(payload);
    if(result.error)setMessage("儲存失敗："+result.error.message);
    else {reset();await reload(userId);}
    setBusy(false);
  }
  async function addToTrip(r:Collection) {
    const chosen=tripChoice[r.id]||trips[0]?.id;
    if(!userId||!chosen)return;
    if(r.kind==="其他"){setMessage("「其他」分類請先選擇商品、景點、美食或商店，再加入旅行。");return;}
    setCopying(r.id);setMessage("");
    const trip=trips.find(t=>t.id===chosen);
    if(r.kind!=="商品"){
      const date=(dateChoice[r.id]||"").trim();
      if(!date){setCopying(null);setMessage("請先選擇要安排的日期。");return;}
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){setCopying(null);setMessage("請輸入有效的日期，格式為 YYYY-MM-DD。");return;}
      const {error}=await db.from("itinerary_stops").insert({
        user_id:userId,trip_id:chosen,visit_date:date,title:r.title,
        place_name:r.place_name||"",address:"",notes:[r.notes,r.source_url].filter(Boolean).join("\n"),
        source_collection_id:r.id,sort_order:0
      });
      setCopying(null);
      if(error)setMessage("加入行程失敗："+error.message);
      else setMessage(`已將「${r.title}」安排在 ${date}，原收藏仍保留。`);
      return;
    }
    const {error}=await db.from("shopping_items").insert({
      trip_id:chosen,created_by:userId,name:r.title,quantity:1,recipient:"自己",
      category:"自用",price:0,currency:trip?.currency||"TWD",
      place_name:r.place_name||null,note:[r.notes,r.source_url].filter(Boolean).join("\n")||null,bought:false
    });
    setCopying(null);
    if(error)setMessage("加入旅行失敗："+error.message);
    else setMessage(`已將「${r.title}」加入「${trip?.name||"旅行"}」的購物清單，原收藏仍會保留。`);
  }
  async function remove(r:Collection){
    if(!userId||!window.confirm(`確定刪除「${r.title}」？`))return;
    const {error}=await db.from("saved_collections").delete().eq("id",r.id).eq("user_id",userId);
    if(error)setMessage("刪除失敗："+error.message);else await reload(userId);
  }
  return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-28 pt-8 text-[#34423D] sm:px-8">
 <StudioNavigation />
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
        <label className="sm:col-span-2 text-sm">從裝置上傳收藏照片（JPG、PNG、WebP、GIF，最多 8 MB）
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setPhoto(e.target.files?.[0]||null)} className="mt-2 block w-full rounded-xl border border-[#e4e7e2] bg-[#f8faf7] p-3 text-sm"/>
          <span className="mt-1 block text-xs text-[#7a8580]">照片會儲存在私人帳號路徑，並以公開圖片網址顯示；請勿上傳含敏感個資的照片。</span>
        </label>
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
          {r.kind!=="其他"&&trips.length>0&&<div className="mt-4 flex gap-2">
            <select aria-label={`將${r.title}加入哪趟旅行`} value={tripChoice[r.id]||trips[0].id} onChange={e=>setTripChoice({...tripChoice,[r.id]:e.target.value})} className="min-w-0 flex-1 rounded-xl border border-[#e2e7df] bg-white px-2 py-2 text-xs">{trips.map(t=><option key={t.id} value={t.id}>{t.name||"未命名旅行"}</option>)}</select>
            <button disabled={copying===r.id} onClick={()=>addToTrip(r)} className="shrink-0 rounded-xl bg-[#a5ad96] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{copying===r.id?"加入中…":r.kind==="商品"?"加入購物 ＋":"排入行程 ＋"}</button>
          </div>}
          {r.kind!=="商品"&&r.kind!=="其他"&&trips.length>0&&<label className="mt-2 block text-xs text-[#687b75]">安排日期<input type="date" aria-label={`${r.title}的行程日期`} value={dateChoice[r.id]||""} onChange={e=>setDateChoice(prev=>({...prev,[r.id]:e.target.value}))} className="mt-1 w-full rounded-xl border border-[#e2e7df] bg-white px-3 py-2 text-sm"/></label>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><button onClick={()=>startEdit(r)} className="font-semibold text-[#426b7d]">編輯</button><button onClick={()=>remove(r)} className="text-[#aa776b]">刪除</button>{r.source_url&&<a href={r.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#426b7d]">來源 ↗</a>}{r.place_name&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.place_name,r.city,r.country].filter(Boolean).join(" "))}`} target="_blank" rel="noopener noreferrer" className="text-[#426b7d]">地圖 ↗</a>}</div>
        </div>
      </article>)}</div>}
    </div>
    
  </main>;
}
