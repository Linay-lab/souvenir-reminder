"use client";
import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {createClient} from "@/utils/supabase/client";

type Trip={id:string;name:string|null;start_date:string|null;end_date:string|null};
type Stop={id:string;trip_id:string;user_id:string;visit_date:string;visit_time:string|null;title:string;place_name:string;address:string;notes:string;sort_order:number};
const client=createClient();
const initial={title:"",visit_date:"",visit_time:"",place_name:"",address:"",notes:""};
function ItineraryContent(){
 const params=useSearchParams(),requested=params.get("tripId");
 const [userId,setUserId]=useState("");
 const [trips,setTrips]=useState<Trip[]>([]);
 const [selected,setSelected]=useState("");
 const [stops,setStops]=useState<Stop[]>([]);
 const [form,setForm]=useState(initial);
 const [editId,setEditId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{
  const {data:{user}}=await client.auth.getUser();if(!active)return;
  if(!user){setError("請先登入，才能管理旅行行程。");setLoading(false);return;}
  setUserId(user.id);
  const {data,error:err}=await client.from("trips").select("id,name,start_date,end_date").eq("owner_id",user.id).order("created_at",{ascending:true});
  if(!active)return;
  if(err){setError("讀取旅行失敗："+err.message);setLoading(false);return;}
  const available=(data??[]) as Trip[];setTrips(available);
  setSelected(available.find(t=>t.id===requested)?.id||available[0]?.id||"");setLoading(false);
 })();return()=>{active=false};},[requested]);
 useEffect(()=>{if(!userId||!selected)return;let active=true;
 (async()=>{setError("");const {data,error:err}=await client.from("itinerary_stops").select("*").eq("trip_id",selected).eq("user_id",userId).order("visit_date",{ascending:true}).order("visit_time",{ascending:true}).order("sort_order",{ascending:true});
 if(!active)return;if(err){setError("行程資料表尚未啟用，或讀取失敗："+err.message);setStops([]);}else setStops((data??[]) as Stop[]);
 })();return()=>{active=false};},[userId,selected]);
 const trip=trips.find(t=>t.id===selected);
 const grouped=useMemo(()=>Object.entries(stops.filter(stop=>stop.trip_id===selected).reduce<Record<string,Stop[]>>((acc,stop)=>{(acc[stop.visit_date]??=[]).push(stop);return acc;},{})).sort(([a],[b])=>a.localeCompare(b)),[stops,selected]);
 function reset(){setEditId(null);setForm({...initial,visit_date:trip?.start_date||""});}
 function edit(s:Stop){setEditId(s.id);setForm({title:s.title,visit_date:s.visit_date,visit_time:s.visit_time||"",place_name:s.place_name,address:s.address,notes:s.notes});window.scrollTo({top:0,behavior:"smooth"});}
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!userId||!selected||!form.title.trim()||!form.visit_date)return;setBusy(true);setError("");
 const payload={...form,title:form.title.trim(),visit_time:form.visit_time||null,user_id:userId,trip_id:selected};
 const res=editId?await client.from("itinerary_stops").update(payload).eq("id",editId).eq("user_id",userId).eq("trip_id",selected):await client.from("itinerary_stops").insert(payload);
 if(res.error)setError("儲存失敗："+res.error.message);else{reset();const result=await client.from("itinerary_stops").select("*").eq("trip_id",selected).eq("user_id",userId).order("visit_date").order("visit_time");if(result.error)setError(result.error.message);else setStops((result.data??[]) as Stop[]);}
 setBusy(false);}
 async function remove(s:Stop){if(!window.confirm("確定刪除這個行程？"))return;const {error:err}=await client.from("itinerary_stops").delete().eq("id",s.id).eq("user_id",userId).eq("trip_id",selected);if(err)setError(err.message);else setStops(prev=>prev.filter(x=>x.id!==s.id));}
 return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-16 pt-8 text-[#34423D] sm:px-8"><div className="mx-auto max-w-4xl">
 <a href="/dashboard-preview" className="text-sm font-semibold text-[#527586]">← 返回我的旅行</a>
 <h1 className="mt-4 text-3xl font-bold">🗓️ 每日行程手帳</h1><p className="mt-2 text-sm text-[#718078]">先安排日期與時間，再慢慢把旅行填滿。</p>
 {error&&<p role="alert" className="my-4 rounded-xl bg-[#fff1e9] p-4 text-sm">{error}</p>}
 {loading?<p className="mt-8">載入中…</p>:trips.length===0?<p className="mt-8 rounded-2xl bg-white p-6">還沒有旅行，請先到「我的旅行」建立。</p>:<>
 <label className="mt-6 block text-sm font-semibold">選擇旅行<select value={selected} onChange={e=>{setSelected(e.target.value);setEditId(null);setForm(initial)}} className="mt-2 w-full rounded-2xl border border-[#dce4dd] bg-white p-3">{trips.map(t=><option key={t.id} value={t.id}>{t.name||"未命名旅行"}</option>)}</select></label>
 <form onSubmit={save} className="mt-5 grid gap-3 rounded-3xl border border-[#e6e8e1] bg-white p-5 shadow-sm sm:grid-cols-2">
 <h2 className="sm:col-span-2 text-lg font-bold">{editId?"編輯行程":"＋ 新增行程"}</h2>
 <label className="text-sm">日期 *<input required type="date" value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">時間（可不填）<input type="time" value={form.visit_time} onChange={e=>setForm({...form,visit_time:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm sm:col-span-2">行程名稱 *<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：太宰府天滿宮" className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">地點<input value={form.place_name} onChange={e=>setForm({...form,place_name:e.target.value})} placeholder="店名或景點" className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">地址<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm sm:col-span-2">備註<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="mt-1 w-full rounded-xl border p-3"/></label>
 <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-[#A5AD96] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"儲存中…":"儲存行程"}</button>{editId&&<button type="button" onClick={reset} className="rounded-xl border px-4 py-3">取消編輯</button>}</div>
 </form>
 <div className="mt-8 space-y-6">{grouped.length===0?<p className="rounded-3xl border border-dashed border-[#d7ded7] bg-white p-10 text-center">這趟旅行還沒有行程，先新增第一站吧！</p>:grouped.map(([date,items])=><section key={date}><h2 className="mb-3 text-lg font-bold">📅 {date}</h2><div className="space-y-3">{items.map(s=><article key={s.id} className="rounded-2xl border border-[#e6e8e1] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-[#6b8b98]">{s.visit_time?.slice(0,5)||"彈性時間"}</p><h3 className="mt-1 font-bold">{s.title}</h3>{s.place_name&&<p className="mt-1 text-sm">📍 {s.place_name}</p>}{s.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-[#758078]">{s.notes}</p>}</div><div className="flex shrink-0 gap-2 text-sm"><button onClick={()=>edit(s)} className="text-[#527586]">編輯</button><button onClick={()=>remove(s)} className="text-[#ae7369]">刪除</button></div></div>{(s.place_name||s.address)&&<a className="mt-3 inline-block text-sm font-semibold text-[#527586]" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.place_name,s.address].filter(Boolean).join(" "))}`}>Google Maps 搜尋 ↗</a>}</article>)}</div></section>)}</div>
 </>}
 </div></main>;
}
export default function ItineraryPage(){return <Suspense fallback={<main className="p-8">載入行程中…</main>}><ItineraryContent/></Suspense>;}
