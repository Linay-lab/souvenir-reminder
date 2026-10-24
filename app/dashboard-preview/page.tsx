"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Trip = { id: string; name: string | null; destination: string | null; start_date: string | null; end_date: string | null };
type CoverRecord = { trip_id: string; storage_path: string; position_x: number; position_y: number; zoom: number };
type TripForm = { name: string; country: string; city: string; startDate: string; endDate: string };
const emptyTripForm: TripForm = { name: "", country: "", city: "", startDate: "", endDate: "" };
const destinationParts = (value: string | null) => {
  const parts = (value || "").split("・");
  return { country: parts[0]?.trim() || "", city: parts.slice(1).join("・").trim() };
};

const features = [
  { icon: "🗓️", name: "行程規劃", detail: "即將推出" },
  { icon: "🛍️", name: "購物清單", detail: "立即使用", href: "/" },
  { icon: "📍", name: "景點地圖", detail: "即將推出" },
  { icon: "✈️", name: "航班住宿", detail: "即將推出" },
  { icon: "💳", name: "旅費管理", detail: "即將推出" },
  { icon: "🧳", name: "行李清單", detail: "即將推出" },
];

export default function TravelDashboardPreview() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [savedCovers, setSavedCovers] = useState<CoverRecord[]>([]);
  const [tripForm, setTripForm] = useState<TripForm>(emptyTripForm);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripError, setTripError] = useState("");
  const [tripName, setTripName] = useState("我的下一趟旅行");
  const [destination, setDestination] = useState("開始規劃你的旅程");
  const [dates, setDates] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coverReady, setCoverReady] = useState(false);
  const [coverError, setCoverError] = useState("");
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
  const tripIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        setUserId(user.id);
        // Load the trip list and its cover metadata in parallel.
        const [tripsResult, coversResult] = await Promise.all([
          supabase.from("trips").select("id,name,destination,start_date,end_date")
            .eq("owner_id", user.id).order("created_at", { ascending: true }),
          supabase.from("trip_covers").select("trip_id,storage_path,position_x,position_y,zoom")
            .eq("owner_id", user.id).order("updated_at", { ascending: false })
        ]);
        if (!active) return;
        const trips = (tripsResult.data ?? []) as Trip[];
        const covers = (coversResult.data ?? []) as CoverRecord[];
        setTrips(trips);
        setSavedCovers(covers);
        if (tripsResult.error) setTripError("無法載入旅行清單，請稍後再試。");
        const coverRow = covers.find((row) => trips.some((trip) => trip.id === row.trip_id));
        const data = trips.find((trip) => trip.id === coverRow?.trip_id) ?? trips[0];
        if (data) {
          tripIdRef.current = data.id;
          setTripId(data.id);
          setTripName(data.name || "我的旅行");
          setDestination(data.destination || "尚未設定目的地");
          setDates([data.start_date, data.end_date].filter(Boolean).join(" — "));
          if (coverRow && coverRow.trip_id === data.id) {
            setCoverPosition({ x: Number(coverRow.position_x), y: Number(coverRow.position_y) });
            setCoverZoom(Number(coverRow.zoom));
            // Reuse a still-valid private signed URL for instant reloads in this tab.
            const cacheKey = `trip-cover:${user.id}:${data.id}`;
            let cached: { path: string; url: string; expiresAt: number } | null = null;
            try {
              cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
            } catch { /* stale cache is ignored */ }
            const isFresh = cached?.path === coverRow.storage_path
              && typeof cached?.url === "string"
              && cached.expiresAt > Date.now() + 60_000;
            if (isFresh && cached) {
              setCover(cached.url);
            } else {
              const { data: signed, error: signedError } = await supabase.storage
                .from("trip-covers").createSignedUrl(coverRow.storage_path, 3600);
              if (!active) return;
              if (signed?.signedUrl) {
                setCover(signed.signedUrl);
                try {
                  sessionStorage.setItem(cacheKey, JSON.stringify({
                    path: coverRow.storage_path,
                    url: signed.signedUrl,
                    expiresAt: Date.now() + 3600_000
                  }));
                } catch { /* storage may be unavailable */ }
              } else if (signedError) {
                setCoverError("封面載入失敗，請重新整理再試。");
              }
            }
          }
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

  async function selectTrip(trip: Trip, covers: CoverRecord[] = savedCovers) {
    if (pendingFile.current) {
      setTripError("請先儲存目前選擇的封面，再切換旅行。");
      return;
    }
    setTripError("");
    tripIdRef.current = trip.id;
    setTripId(trip.id);
    setTripName(trip.name || "我的旅行");
    setDestination(trip.destination || "尚未設定目的地");
    setDates([trip.start_date, trip.end_date].filter(Boolean).join(" — "));
    setCover(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverZoom(100);
    const record = covers.find((row) => row.trip_id === trip.id);
    if (!record || !userId) return;
    setCoverPosition({ x: Number(record.position_x), y: Number(record.position_y) });
    setCoverZoom(Number(record.zoom));
    const key = `trip-cover:${userId}:${trip.id}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached?.path === record.storage_path && cached?.expiresAt > Date.now() + 60000) {
        setCover(cached.url);
        return;
      }
    } catch { /* ignore cache */ }
    const { data, error } = await createClient().storage.from("trip-covers").createSignedUrl(record.storage_path, 3600);
    if (tripIdRef.current !== trip.id) return;
    if (error || !data?.signedUrl) {
      setCoverError("此趟旅行的封面暫時無法載入。");
      return;
    }
    setCover(data.signedUrl);
    try {
      sessionStorage.setItem(key, JSON.stringify({ path: record.storage_path, url: data.signedUrl, expiresAt: Date.now() + 3600000 }));
    } catch { /* ignore cache */ }
  }

  function openTripForm(trip?: Trip) {
    setTripError("");
    setEditingTripId(trip?.id || null);
    const parts = destinationParts(trip?.destination || null);
    setTripForm(trip ? { name: trip.name || "", country: parts.country, city: parts.city, startDate: trip.start_date || "", endDate: trip.end_date || "" } : { ...emptyTripForm });
    setShowTripForm(true);
  }

  async function submitTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || tripBusy) return;
    const name = tripForm.name.trim();
    const country = tripForm.country.trim();
    const city = tripForm.city.trim();
    if (!name || !country) { setTripError("請填寫旅行名稱與國家。"); return; }
    if (tripForm.startDate && tripForm.endDate && tripForm.endDate < tripForm.startDate) {
      setTripError("回程日期不可早於出發日期。"); return;
    }
    setTripBusy(true);
    setTripError("");
    const supabase = createClient();
    const values = {
      name, destination: [country, city].filter(Boolean).join("・"),
      start_date: tripForm.startDate || null, end_date: tripForm.endDate || null
    };
    try {
      if (editingTripId) {
        const { data, error } = await supabase.from("trips").update(values)
          .eq("id", editingTripId).eq("owner_id", userId)
          .select("id,name,destination,start_date,end_date").single();
        if (error) throw error;
        setTrips((previous) => previous.map((trip) => trip.id === editingTripId ? data as Trip : trip));
        if (tripId === editingTripId) {
          setTripName(data.name || "我的旅行");
          setDestination(data.destination || "尚未設定目的地");
          setDates([data.start_date, data.end_date].filter(Boolean).join(" — "));
        }
      } else {
        const { data, error } = await supabase.from("trips").insert({ ...values, owner_id: userId })
          .select("id,name,destination,start_date,end_date").single();
        if (error) throw error;
        setTrips((previous) => [...previous, data as Trip]);
        tripIdRef.current = data.id;
        setTripId(data.id);
        setTripName(data.name || "我的旅行");
        setDestination(data.destination || "尚未設定目的地");
        setDates([data.start_date, data.end_date].filter(Boolean).join(" — "));
        setCover(null);
        setCoverPosition({ x: 50, y: 50 });
        setCoverZoom(100);
      }
      setShowTripForm(false);
    } catch (error) {
      setTripError(error instanceof Error ? `儲存旅行失敗：${error.message}` : "儲存旅行失敗。");
    } finally { setTripBusy(false); }
  }

  async function deleteTrip(trip: Trip) {
    if (!userId || tripBusy || !window.confirm(`確定刪除「${trip.name || "未命名旅行"}」？此操作無法復原，且可能影響關聯的購物清單。`)) return;
    setTripBusy(true);
    setTripError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("trips").delete().eq("id", trip.id).eq("owner_id", userId);
      if (error) throw error;
      const remaining = trips.filter((item) => item.id !== trip.id);
      const covers = savedCovers.filter((item) => item.trip_id !== trip.id);
      setTrips(remaining);
      setSavedCovers(covers);
      try { sessionStorage.removeItem(`trip-cover:${userId}:${trip.id}`); } catch { /* ignore */ }
      if (tripId === trip.id) {
        const next = remaining[0];
        if (next) {
          tripIdRef.current = next.id;
          await selectTrip(next, covers);
        } else {
          tripIdRef.current = null;
          setTripId(null);
          setTripName("我的下一趟旅行");
          setDestination("開始規劃你的旅程");
          setDates("");
          setCover(null);
        }
      }
    } catch (error) {
      setTripError(error instanceof Error ? `刪除失敗：${error.message}` : "刪除失敗，請稍後再試。");
    } finally { setTripBusy(false); }
  }

  useEffect(() => {
    if (!cover) {
      setCoverReady(false);
      return;
    }
    let active = true;
    setCoverReady(false);
    const image = new Image();
    image.onload = () => { if (active) setCoverReady(true); };
    image.onerror = () => { if (active) setCoverReady(false); };
    image.src = cover;
    return () => { active = false; };
  }, [cover]);

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
        const { error } = await supabase.storage.from("trip-covers").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("trip_covers").select("storage_path").eq("trip_id", tripId).maybeSingle();
        if (error) throw error;
        path = data?.storage_path;
      }
      if (!path) throw new Error("請先上傳封面照片。");
      stage = "trip_covers 資料表寫入";
      const { error } = await supabase.from("trip_covers").upsert({
        trip_id: tripId, owner_id: userId, storage_path: path,
        position_x: coverPosition.x, position_y: coverPosition.y, zoom: coverZoom,
        updated_at: new Date().toISOString()
      }, { onConflict: "trip_id" });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("trip-covers").createSignedUrl(path, 3600);
      setSavedCovers((previous) => [...previous.filter((item) => item.trip_id !== tripId), { trip_id: tripId, storage_path: path, position_x: coverPosition.x, position_y: coverPosition.y, zoom: coverZoom }]);
      if (signed?.signedUrl) {
        setCover(signed.signedUrl);
        try {
          sessionStorage.setItem(`trip-cover:${userId}:${tripId}`, JSON.stringify({
            path,
            url: signed.signedUrl,
            expiresAt: Date.now() + 3600_000
          }));
        } catch { /* storage may be unavailable */ }
      }
      pendingFile.current = null;
      setEditingCover(false);
    } catch (error) {
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
          <div className="absolute inset-0 bg-gradient-to-br from-[#073b62] via-[#2b779e] to-[#7bc9cb]">
            <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-[-90px] right-[12%] h-52 w-[60%] rotate-[-9deg] rounded-[60%] bg-emerald-100/20 blur-xl" />
          </div>
          {cover && <div className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ease-out ${coverReady ? "opacity-100" : "opacity-0"}`} style={{ backgroundImage: `url("${cover}")`, backgroundPosition: `${coverPosition.x}% ${coverPosition.y}%`, backgroundSize: `${coverZoom}% auto` }} />}
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
        <section className="mt-8" aria-label="我的旅行管理">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">我的旅行清單</h2><p className="mt-1 text-sm text-slate-500">建立多趟旅程，點選卡片即可切換封面與旅行資訊。</p></div>
            <button type="button" disabled={!userId || tripBusy} onClick={() => openTripForm()} className="rounded-full bg-[#173f68] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">＋ 新增旅行</button>
          </div>
          {tripError && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{tripError}</p>}
          {!loading && !userId && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">請先登入，才能建立並管理雲端旅行。</p>}
          {!loading && userId && trips.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">目前沒有旅行，點選「新增旅行」開始規劃吧！</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <article key={trip.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${tripId === trip.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-100"}`}>
                <button type="button" onClick={() => { void selectTrip(trip); }} className="w-full text-left" aria-current={tripId === trip.id ? "true" : undefined}>
                  <p className="text-xs font-semibold text-blue-600">{tripId === trip.id ? "目前選擇" : "切換至此旅行"}</p>
                  <h3 className="mt-2 truncate text-lg font-bold">{trip.name || "我的旅行"}</h3>
                  <p className="mt-1 text-sm text-slate-600">📍 {trip.destination || "尚未設定目的地"}</p>
                  <p className="mt-1 text-xs text-slate-500">🗓 {[trip.start_date, trip.end_date].filter(Boolean).join(" — ") || "尚未設定日期"}</p>
                  <p className="mt-2 text-xs text-slate-400">{savedCovers.some((row) => row.trip_id === trip.id) ? "📷 已設定專屬封面" : "📷 可上傳專屬封面"}</p>
                </button>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <button type="button" disabled={tripBusy} onClick={() => openTripForm(trip)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium disabled:opacity-50">編輯</button>
                  <button type="button" disabled={tripBusy} onClick={() => void deleteTrip(trip)} className="rounded-full border border-red-100 px-4 py-2 text-xs font-medium text-red-600 disabled:opacity-50">刪除</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        {showTripForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={editingTripId ? "編輯旅行" : "新增旅行"}>
          <form onSubmit={submitTrip} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{editingTripId ? "編輯旅行" : "新增旅行"}</h2><button type="button" onClick={() => setShowTripForm(false)} aria-label="關閉視窗">✕</button></div>
            <label className="block text-sm font-medium">旅行名稱 *<input required maxLength={100} value={tripForm.name} onChange={(e) => setTripForm({ ...tripForm, name: e.target.value })} placeholder="例如：沖繩五日遊" className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">國家 *<input required maxLength={80} value={tripForm.country} onChange={(e) => setTripForm({ ...tripForm, country: e.target.value })} placeholder="日本" className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
              <label className="block text-sm font-medium">城市<input maxLength={80} value={tripForm.city} onChange={(e) => setTripForm({ ...tripForm, city: e.target.value })} placeholder="沖繩" className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
              <label className="block text-sm font-medium">出發日期<input type="date" value={tripForm.startDate} onChange={(e) => setTripForm({ ...tripForm, startDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
              <label className="block text-sm font-medium">回程日期<input type="date" min={tripForm.startDate || undefined} value={tripForm.endDate} onChange={(e) => setTripForm({ ...tripForm, endDate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label>
            </div>
            {tripError && <p role="alert" className="text-sm text-red-600">{tripError}</p>}
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowTripForm(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm">取消</button><button type="submit" disabled={tripBusy} className="rounded-full bg-[#173f68] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{tripBusy ? "儲存中…" : "儲存旅行"}</button></div>
          </form>
        </div>}
        {coverError && <p role="alert" className="mt-2 text-xs text-red-600">{coverError}</p>}
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
