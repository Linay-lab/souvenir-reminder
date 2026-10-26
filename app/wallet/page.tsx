"use client";
import {Suspense,useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
import {createClient} from "@/utils/supabase/client";
type Trip={id:string;name:string|null;currency:string|null};
type Expense={id:string;trip_id:string;user_id:string;expense_date:string;title:string;category:string;amount:number;currency:string;notes:string};
const categories=["交通","住宿","餐飲","購物","門票","其他"];
const db=createClient();
function WalletContent(){
 const requested=useSearchParams().get("tripId");
 const [userId,setUserId]=useState("");
 const [trips,setTrips]=useState<Trip[]>([]);
 const [selected,setSelected]=useState("");
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [title,setTitle]=useState("");
 const [date,setDate]=useState(new Date().toLocaleDateString("en-CA"));
 const [category,setCategory]=useState("餐飲");
 const [amount,setAmount]=useState("");
 const [currency,setCurrency]=useState("TWD");
 const [notes,setNotes]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let alive=true;(async()=>{const {data:{user}}=await db.auth.getUser();if(!alive)return;
 if(!user){setError("請先登入才能管理旅費。");setLoading(false);return;}
 setUserId(user.id);
 const {data,error:err}=await db.from("trips").select("id,name,currency").eq("owner_id",user.id).order("created_at");
 if(!alive)return;
 if(err)setError("讀取旅行失敗："+err.message);
 else{const list=(data??[]) as Trip[];setTrips(list);const id=list.find(t=>t.id===requested)?.id||list[0]?.id||"";setSelected(id);setCurrency(list.find(t=>t.id===id)?.currency||"TWD");}
 setLoading(false);})();return()=>{alive=false};},[requested]);
 useEffect(()=>{if(!selected||!userId)return;let alive=true;(async()=>{
 const {data,error:err}=await db.from("trip_expenses").select("*").eq("trip_id",selected).eq("user_id",userId).order("expense_date",{ascending:false}).order("created_at",{ascending:false});
 if(!alive)return;
 if(err){setError("支出資料表尚未啟用，或讀取失敗："+err.message);setExpenses([]);}
 else{setExpenses((data??[]) as Expense[]);setError("");}
 })();return()=>{alive=false};},[selected,userId]);
 const activeExpenses=useMemo(()=>expenses.filter(e=>e.trip_id===selected),[expenses,selected]);
 const totals=useMemo(()=>activeExpenses.reduce<Record<string,number>>((all,e)=>{all[e.currency]=(all[e.currency]||0)+Number(e.amount);return all;},{}),[activeExpenses]);
 function reset(){setEditing(null);setTitle("");setDate(new Date().toLocaleDateString("en-CA"));setCategory("餐飲");setAmount("");setCurrency(trips.find(t=>t.id===selected)?.currency||"TWD");setNotes("");}
 function edit(e:Expense){setEditing(e.id);setTitle(e.title);setDate(e.expense_date);setCategory(e.category);setAmount(String(e.amount));setCurrency(e.currency);setNotes(e.notes);window.scrollTo({top:0,behavior:"smooth"});}
 async function save(ev:React.FormEvent<HTMLFormElement>){ev.preventDefault();if(!userId||!selected)return;const n=Number(amount);if(!Number.isFinite(n)||n<0){setError("金額請輸入零或正數。");return;}
 setBusy(true);setError("");const payload={trip_id:selected,user_id:userId,expense_date:date,title:title.trim(),category,amount:n,currency,notes};
 const res=editing?await db.from("trip_expenses").update(payload).eq("id",editing).eq("user_id",userId).eq("trip_id",selected):await db.from("trip_expenses").insert(payload);
 if(res.error)setError("儲存失敗："+res.error.message);else{reset();const fresh=await db.from("trip_expenses").select("*").eq("trip_id",selected).eq("user_id",userId).order("expense_date",{ascending:false}).order("created_at",{ascending:false});if(fresh.error)setError(fresh.error.message);else setExpenses((fresh.data??[]) as Expense[]);}
 setBusy(false);}
 async function remove(e:Expense){if(!window.confirm("確定刪除這筆支出？"))return;const {error:err}=await db.from("trip_expenses").delete().eq("id",e.id).eq("user_id",userId).eq("trip_id",selected);if(err)setError(err.message);else setExpenses(x=>x.filter(y=>y.id!==e.id));}
 return <main className="min-h-screen bg-[#FAF9F6] px-4 pb-20 pt-8 text-[#34423D] sm:px-8"><div className="mx-auto max-w-4xl">
 <a href="/dashboard-preview" className="text-sm font-semibold text-[#537887]">← 返回旅行首頁</a>
 <h1 className="mt-4 text-3xl font-bold">💳 旅行錢包</h1><p className="mt-2 text-sm text-[#7b867f]">記錄每一筆花費，分幣別查看總額，不會自動換匯或重複計入購物清單。</p>
 {error&&<p role="alert" className="my-4 rounded-2xl bg-[#fff1e9] p-4 text-sm">{error}</p>}
 {loading?<p className="mt-6">讀取中…</p>:trips.length===0?<p className="mt-6 rounded-2xl bg-white p-6">還沒有旅行，請先建立旅行。</p>:<>
 <label className="mt-6 block text-sm font-semibold">選擇旅行<select value={selected} onChange={e=>{setSelected(e.target.value);reset();setCurrency(trips.find(t=>t.id===e.target.value)?.currency||"TWD")}} className="mt-2 w-full rounded-2xl border border-[#dfe6e0] bg-white p-3">{trips.map(t=><option key={t.id} value={t.id}>{t.name||"未命名旅行"}</option>)}</select></label>
 <section className="mt-5 rounded-3xl border border-[#e4e8df] bg-[#edf1ec] p-5"><h2 className="text-sm font-semibold">目前已記錄支出（依幣別）</h2><div className="mt-3 flex flex-wrap gap-5">{Object.entries(totals).length===0?<span className="text-sm text-[#7c887f]">尚未記錄支出</span>:Object.entries(totals).map(([c,v])=><div key={c}><span className="text-sm">{c}</span><p className="text-2xl font-bold">{v.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}</p></div>)}</div><p className="mt-3 text-xs text-[#78867e]">不同幣別不直接相加；此處是支出紀錄，不是原有旅行預算表。</p></section>
 <form onSubmit={save} className="mt-5 grid gap-3 rounded-3xl border border-[#e6e8e1] bg-white p-5 shadow-sm sm:grid-cols-2">
 <h2 className="sm:col-span-2 text-lg font-bold">{editing?"編輯支出":"＋ 新增支出"}</h2>
 <label className="text-sm">日期<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">類別<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
 <label className="text-sm sm:col-span-2">項目名稱 *<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：地鐵一日券" className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">金額 *<input required type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
 <label className="text-sm">幣別<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{["TWD","JPY","USD","KRW","EUR","CNY","HKD","THB","SGD"].map(c=><option key={c}>{c}</option>)}</select></label>
 <label className="text-sm sm:col-span-2">備註<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
 <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-[#91B3C3] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"儲存中…":"儲存支出"}</button>{editing&&<button type="button" onClick={reset} className="rounded-xl border px-4 py-3">取消編輯</button>}</div></form>
 <section className="mt-8 space-y-3"><h2 className="text-xl font-bold">支出明細</h2>{activeExpenses.length===0?<p className="rounded-2xl bg-white p-6 text-center text-sm">還沒有支出紀錄</p>:activeExpenses.map(e=><article key={e.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#e7e9e2] bg-white p-4"><div><p className="text-xs text-[#74877d]">{e.expense_date} · {e.category}</p><h3 className="mt-1 font-semibold">{e.title}</h3><p className="mt-1 text-lg font-bold">{e.currency} {Number(e.amount).toLocaleString()}</p>{e.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-[#79847d]">{e.notes}</p>}</div><div className="flex shrink-0 gap-2 text-sm"><button onClick={()=>edit(e)} className="text-[#527586]">編輯</button><button onClick={()=>remove(e)} className="text-[#b07c70]">刪除</button></div></article>)}</section>
 </>}
 </div></main>;
}
export default function WalletPage(){return <Suspense fallback={<main className="p-8">讀取旅行錢包中…</main>}><WalletContent/></Suspense>;}
