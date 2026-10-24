"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const features = [
  { icon: "🗓️", name: "行程規劃", detail: "即將推出" },
  { icon: "🛍️", name: "購物清單", detail: "立即使用", href: "/" },
  { icon: "📍", name: "景點地圖", detail: "即將推出" },
  { icon: "✈️", name: "航班住宿", detail: "即將推出" },
  { icon: "💳", name: "旅費管理", detail: "即將推出" },
  { icon: "🧳", name: "行李清單", detail: "即將推出" },
];

export default function TravelDashboardPreview() {
  const [tripName, setTripName] = useState("我的下一趟旅行");
  const [destination, setDestination] = useState("開始規劃你的旅程");
  const [dates, setDates] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coverError, setCoverError] = useState("");
  const [coverDiagnostic, setCoverDiagnostic] = useState("");
  const [savingCover, setSavingCover] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const pendingFile = useRef<File | null>(null);
  const [editingCover, setEditingCover] = useState(false);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [coverZoom, setCoverZoom] = useState(100);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from("trips").select("id,name,destination,start_date,end_date")
          .eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (!active) return;
        if (data) {
          setTripId(data.id);
          const { data: coverRow } = await supabase.from("trip_covers")
            .select("storage_path,position_x,position_y,zoom").eq("trip_id", data.id).maybeSingle();
          if (active && coverRow) {
            const { data: signed } = await supabase.storage.from("trip-covers").createSignedUrl(coverRow.storage_path, 3600);
            if (active && signed?.signedUrl) {
              setCover(signed.signedUrl);
              setCoverPosition({ x: Number(coverRow.position_x), y: Number(coverRow.position_y) });
              setCoverZoom(Number(coverRow.zoom));
            }
          }
          setTripName(data.name || "我的旅行");
          setDestination(data.destination || "尚未設定目的地");
          setDates([data.start_date, data.end_date].filter(Boolean).join(" — "));
        }
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem("souvenir-trip") || "null");
          if (saved) {
            setTripName(saved.tripName || "我的旅行");
            setDestination(saved.destination || "尚未設定目的地");
            setDates([saved.startDate, saved.endDate].filter(Boolean).join(" — "));
          }
        } catch { /* ignore invalid local preview data */ }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  function chooseCover(file?: File) {
    if (!file) return;
    setCoverError("");
    if (!file.type.startsWith("image/")) {
      setCoverError("請選擇圖片檔案。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverError("請選擇小於 5 MB 的照片。");
      return;
    }
    pendingFile.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCover(reader.result);
        setCoverPosition({ x: 50, y: 50 });
        setCoverZoom(100);
        setEditingCover(true);
      }
    };
    reader.onerror = () => setCoverError("照片讀取失敗，請重試。");
    reader.readAsDataURL(file);
  }

  async function saveCover() {
    if (!tripId || !userId) {
      setCoverError("請先登入並建立旅行，才能把封面儲存到雲端。");
      setEditingCover(false);
      return;
    }
    setSavingCover(true);
    setCoverError("");
    setCoverDiagnostic(`階段：準備上傳｜帳號：${userId.slice(0, 8)}｜旅行：${tripId.slice(0, 8)}`);
    let stage = "準備上傳";
    try {
      const supabase = createClient();
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser || currentUser.id !== userId) throw new Error("登入狀態不一致，請重新登入。");
      const { data: ownedTrip, error: tripError } = await supabase.from("trips").select("id").eq("id", tripId).eq("owner_id", currentUser.id).maybeSingle();
      if (tripError || !ownedTrip) throw new Error("目前帳號無法確認這筆旅行的擁有權。");
      let path: string | undefined;
      if (pendingFile.current) {
        const file = pendingFile.current;
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : null;
        if (!extension) throw new Error("雲端僅支援 JPG、PNG 或 WebP 圖片。");
        path = `${userId}/${tripId}/${crypto.randomUUID()}.${extension}`;
        stage = "Storage 上傳";
        setCoverDiagnostic(`階段：${stage}｜帳號：${userId.slice(0, 8)}｜旅行：${tripId.slice(0, 8)}｜格式：${file.type}`);
        const { error } = await supabase.storage.from("trip-covers").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("trip_covers").select("storage_path").eq("trip_id", tripId).maybeSingle();
        if (error) throw error;
        path = data?.storage_path;
      }
      if (!path) throw new Error("請先上傳封面照片。");
      stage = "trip_covers 資料表寫入";
      setCoverDiagnostic(`階段：${stage}｜帳號：${userId.slice(0, 8)}｜旅行：${tripId.slice(0, 8)}`);
      const { error } = await supabase.from("trip_covers").upsert({
        trip_id: tripId, owner_id: userId, storage_path: path,
        position_x: coverPosition.x, position_y: coverPosition.y, zoom: coverZoom,
        updated_at: new Date().toISOString()
      }, { onConflict: "trip_id" });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("trip-covers").createSignedUrl(path, 3600);
      if (signed?.signedUrl) setCover(signed.signedUrl);
      pendingFile.current = null;
      setCoverDiagnostic("封面已成功儲存至雲端。");
      setEditingCover(false);
    } catch (error) {
      setCoverDiagnostic(`失敗階段：${stage}｜帳號：${userId.slice(0, 8)}｜旅行：${tripId.slice(0, 8)}`);
      setCoverError(error instanceof Error ? `儲存失敗：${error.message}` : "儲存失敗，請稍後再試。");
    } finally {
      setSavingCover(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xl font-bold tracking-tight text-[#16385b]">旅購 <span className="text-sm font-normal text-slate-400">Travel Studio</span></p>
            <p className="mt-1 text-xs text-slate-500">把每一趟旅行，都安排得剛剛好。</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">返回現有清單 ↗</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-7 md:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-medium text-[#48739d]">YOUR TRAVEL SPACE</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">我的旅行</h1></div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">A＋C 首頁測試版</span>
        </div>

        <section className="relative isolate min-h-[310px] overflow-hidden rounded-[28px] bg-[#123c63] text-white shadow-lg md:min-h-[380px]">
          {cover ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${cover}")`, backgroundPosition: `${coverPosition.x}% ${coverPosition.y}%`, backgroundSize: `${coverZoom}% auto` }} /> :
            <div className="absolute inset-0 bg-gradient-to-br from-[#073b62] via-[#2b779e] to-[#7bc9cb]">
              <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute bottom-[-90px] right-[12%] h-52 w-[60%] rotate-[-9deg] rounded-[60%] bg-emerald-100/20 blur-xl" />
            </div>}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b263d]/85 via-[#0b263d]/40 to-transparent" />
          <div className="relative flex min-h-[310px] flex-col justify-between p-6 md:min-h-[380px] md:p-10">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs backdrop-blur">✈ 下一趟旅行</span>
              <div>
                <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => { chooseCover(e.target.files?.[0]); e.target.value = ""; }} aria-label="選擇旅行封面照片" />
                <div className="flex flex-wrap justify-end gap-2">
                  {cover && <button type="button" onClick={() => setEditingCover(true)} className="rounded-full border border-white/60 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-slate-900/60">✥ 調整封面</button>}
                  <button type="button" onClick={() => picker.current?.click()} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#16385b] shadow-sm hover:bg-blue-50">📷 {cover ? "更換封面" : "上傳封面"}</button>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-white/80">每一段旅程，都值得好好收藏</p>
              <h2 className="max-w-xl text-3xl font-bold leading-tight md:text-5xl">{loading ? "旅程載入中…" : tripName}</h2>
              <p className="mt-4 text-sm text-white/90">📍 {destination}</p>
              {dates && <p className="mt-2 text-sm text-white/85">🗓 {dates}</p>}
              <Link href="/" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#123c63] hover:bg-blue-50">管理這趟旅行 →</Link>
            </div>
          </div>
        </section>
        {editingCover && cover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="調整旅行封面">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-5 text-slate-900 shadow-2xl md:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold">調整旅行封面</h2><p className="mt-1 text-sm text-slate-500">用滑鼠或手指拖曳照片，也能使用下方滑桿縮放。</p></div>
                <button type="button" onClick={() => setEditingCover(false)} className="rounded-full bg-slate-100 px-3 py-2 text-sm" aria-label="關閉調整視窗">✕</button>
              </div>
              <div
                className="relative h-52 cursor-grab touch-none overflow-hidden rounded-2xl bg-slate-200 active:cursor-grabbing md:h-72"
                style={{ backgroundImage: `url("${cover}")`, backgroundSize: `${coverZoom}% auto`, backgroundPosition: `${coverPosition.x}% ${coverPosition.y}%`, backgroundRepeat: "no-repeat" }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragStart.current = { x: event.clientX, y: event.clientY, px: coverPosition.x, py: coverPosition.y };
                }}
                onPointerMove={(event) => {
                  if (!dragStart.current) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const dx = (event.clientX - dragStart.current.x) / rect.width * 100;
                  const dy = (event.clientY - dragStart.current.y) / rect.height * 100;
                  setCoverPosition({
                    x: Math.max(0, Math.min(100, dragStart.current.px + dx)),
                    y: Math.max(0, Math.min(100, dragStart.current.py + dy)),
                  });
                }}
                onPointerUp={() => { dragStart.current = null; }}
                onPointerCancel={() => { dragStart.current = null; }}
              >
                <div className="pointer-events-none absolute inset-0 border-2 border-white/70" />
                <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white">拖曳移動照片</span>
              </div>
              <label htmlFor="cover-zoom" className="mt-5 flex justify-between text-sm font-medium"><span>照片縮放</span><span>{coverZoom}%</span></label>
              <input id="cover-zoom" type="range" min="100" max="250" step="5" value={coverZoom} onChange={(e) => setCoverZoom(Number(e.target.value))} className="mt-3 w-full accent-[#173f68]" />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => { setCoverPosition({ x: 50, y: 50 }); setCoverZoom(100); }} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium">重設位置</button>
                <button type="button" onClick={saveCover} disabled={savingCover} className="rounded-full bg-[#173f68] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{savingCover ? "儲存中…" : "儲存封面"}</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">登入後可將封面與調整位置儲存至私人雲端空間。</p>
            </div>
          </div>
        )}
        <div className="mt-2 min-h-5 text-xs text-slate-500">
          {coverError ? <span role="alert" className="text-red-600">{coverError}</span> : "登入並建立旅行後，可儲存封面及調整位置。第一次使用前須先完成 Supabase 資料庫設定。"}
        </div>

        {coverDiagnostic && <p role="status" className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">{coverDiagnostic}</p>}
        <section className="mt-8">
          <div className="mb-4"><h2 className="text-xl font-bold">旅行工具箱</h2><p className="mt-1 text-sm text-slate-500">從出發準備到旅途中的每個細節</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {features.map((feature) => (
              feature.href ? <Link key={feature.name} href={feature.href} className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="text-3xl">{feature.icon}</span><p className="mt-5 font-semibold">{feature.name}</p><p className="mt-1 text-xs font-medium text-blue-600">{feature.detail} →</p>
              </Link> : <div key={feature.name} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <span className="text-3xl">{feature.icon}</span><p className="mt-5 font-semibold">{feature.name}</p><p className="mt-1 text-xs text-slate-400">{feature.detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-semibold tracking-wide text-blue-600">PLAN BETTER</p><h3 className="mt-2 text-xl font-bold">想買的，旅途中別再錯過。</h3><p className="mt-2 text-sm leading-6 text-slate-500">現有購物清單仍然可以正常使用，先收藏想買的東西，再慢慢完善每趟旅程。</p><Link href="/" className="mt-5 inline-flex rounded-full bg-[#173f68] px-5 py-2.5 text-sm font-semibold text-white">開啟購物清單 →</Link></div>
          <div className="rounded-3xl bg-gradient-to-br from-[#e9f5f7] to-[#edf1ff] p-6"><p className="text-xs font-semibold tracking-wide text-[#397b9a]">COMING SOON</p><h3 className="mt-2 text-xl font-bold">下一站，更多精彩</h3><p className="mt-2 text-sm leading-6 text-slate-600">每日行程、景點地圖、旅費管理與多人協作會逐步加入。現在先體驗新版首頁的風格與操作。</p><div className="mt-5 text-4xl">🌊 ✈️ 🗺️</div></div>
        </section>
      </div>
    </main>
  );
}
