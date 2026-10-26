"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Trip = { id: string; currency?: string | null; name: string | null; destination: string | null; start_date: string | null; end_date: string | null };
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
  const [shoppingSummary, setShoppingSummary] = useState<{ tripId: string; total: number; bought: number; amounts: { currency: string; amount: number; purchased: number }[] } | null>(null);
  const [shoppingSummaryError, setShoppingSummaryError] = useState("");
  const [budgets, setBudgets] = useState<{ tripId: string; currency: string; amount: number }[]>([]);
  const [budgetCurrency, setBudgetCurrency] = useState("TWD");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [budgetReadyTripId, setBudgetReadyTripId] = useState<string | null>(null);


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
  const coverSaveLock = useRef(false);
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
          supabase.from("trips").select("id,name,destination,start_date,end_date,currency")
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
        // Remember the selected trip for this signed-in account only.
        let rememberedTripId: string | null = null;
        try { rememberedTripId = sessionStorage.getItem(`travel-selected-trip:${user.id}`); } catch { /* storage unavailable */ }
        const data = trips.find((trip) => trip.id === rememberedTripId)
          ?? trips.find((trip) => trip.id === coverRow?.trip_id)
          ?? trips[0];
        if (data) {
          tripIdRef.current = data.id;
          setTripId(data.id);
          setTripName(data.name || "我的旅行");
          setDestination(data.destination || "尚未設定目的地");
          setDates([data.start_date, data.end_date].filter(Boolean).join(" — "));
          const selectedCover = covers.find((row) => row.trip_id === data.id);
          if (selectedCover) {
            setCoverPosition({ x: Number(selectedCover.position_x), y: Number(selectedCover.position_y) });
            setCoverZoom(Number(selectedCover.zoom));
            // Reuse a still-valid private signed URL for instant reloads in this tab.
            const cacheKey = `trip-cover:${user.id}:${data.id}`;
            let cached: { path: string; url: string; expiresAt: number } | null = null;
            try {
              cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
            } catch { /* stale cache is ignored */ }
            const isFresh = cached?.path === selectedCover.storage_path
              && typeof cached?.url === "string"
              && cached.expiresAt > Date.now() + 60_000;
            if (isFresh && cached) {
              setCover(cached.url);
            } else {
              const { data: signed, error: signedError } = await supabase.storage
                .from("trip-covers").createSignedUrl(selectedCover.storage_path, 3600);
              if (!active) return;
              if (signed?.signedUrl) {
                setCover(signed.signedUrl);
                try {
                  sessionStorage.setItem(cacheKey, JSON.stringify({
                    path: selectedCover.storage_path,
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

  useEffect(() => {
    if (!userId || !tripId) return;
    let active = true;
    const supabase = createClient();
    supabase.from("shopping_items").select("id,bought,price,quantity,currency")
      .eq("trip_id", tripId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setShoppingSummary(null);
          setShoppingSummaryError("購物統計暫時無法讀取。");
          return;
        }
        const rows = data ?? [];
        const amountsByCurrency = new Map<string, { amount: number; purchased: number }>();
        const tripCurrency = trips.find((trip) => trip.id === tripId)?.currency || "TWD";
        for (const item of rows) {
          const currency = item.currency || tripCurrency;
          const existing = amountsByCurrency.get(currency) ?? { amount: 0, purchased: 0 };
          const cost = Number(item.price ?? 0) * Number(item.quantity ?? 1);
          amountsByCurrency.set(currency, {
            amount: existing.amount + cost,
            purchased: existing.purchased + (item.bought ? cost : 0)
          });
        }
        setShoppingSummary({
          tripId,
          total: rows.length,
          bought: rows.filter((item) => item.bought).length,
          amounts: [...amountsByCurrency].map(([currency, totals]) => ({ currency, ...totals }))
        });
        setShoppingSummaryError("");
      });
    return () => { active = false; };
  }, [userId, tripId, trips]);

  useEffect(() => {
    if (!tripId || !userId) return;
    let active = true;
    const supabase = createClient();
    supabase.from("trip_budgets").select("currency,amount").eq("trip_id", tripId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const missingTable = error.code === "42P01" || error.code === "PGRST205" || error.message?.includes("Could not find the table");
          const denied = error.code === "42501" || error.message?.toLowerCase().includes("permission denied");
          setBudgetError(missingTable
            ? "找不到預算資料表。請確認 SQL 執行的是此測試網站所連接的 Supabase 專案；如果剛建好，請重新整理網頁。"
            : denied
              ? "預算資料表存取遭拒，請確認 Supabase 的 RLS 權限設定。"
              : `預算讀取失敗（${error.code || "未知錯誤"}）：${error.message || "請稍後重試"}`);
          setBudgetReadyTripId(null);
          return;
        }
        setBudgets((previous) => [
          ...previous.filter((row) => row.tripId !== tripId),
          ...(data ?? []).map((row) => ({ tripId, currency: row.currency, amount: Number(row.amount) }))
        ]);
        setBudgetReadyTripId(tripId);
        setBudgetError("");
      });
    return () => { active = false; };
  }, [tripId, userId]);

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tripId || !userId || budgetBusy || budgetReadyTripId !== tripId) return;
    const amount = Number(budgetAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999 || !/^\d+(\.\d{1,2})?$/.test(budgetAmount.trim())) {
      setBudgetError("請輸入有效的預算金額，最多兩位小數。");
      return;
    }
    setBudgetBusy(true);
    setBudgetError("");
    const targetTrip = tripId;
    const supabase = createClient();
    const { error } = await supabase.from("trip_budgets").upsert({
      trip_id: targetTrip, owner_id: userId, currency: budgetCurrency, amount
    }, { onConflict: "trip_id,currency" });
    if (error && tripIdRef.current === targetTrip) setBudgetError("預算儲存失敗，請稍後再試。");
    else {
      setBudgets((previous) => [...previous.filter((row) => !(row.tripId === targetTrip && row.currency === budgetCurrency)), { tripId: targetTrip, currency: budgetCurrency, amount }]);
      if (tripIdRef.current === targetTrip) setBudgetAmount("");
    }
    setBudgetBusy(false);
  }

  async function deleteBudget(currencyToDelete: string) {
    if (!tripId || !userId || budgetBusy || budgetReadyTripId !== tripId) return;
    if (!window.confirm(`確定刪除這趟旅行的 ${currencyToDelete} 預算嗎？\n\n只會刪除這一筆預算，不會刪除商品、旅行或其他幣別預算。`)) return;
    const targetTrip = tripId;
    setBudgetBusy(true);
    setBudgetError("");
    const supabase = createClient();
    const { error } = await supabase.from("trip_budgets")
      .delete()
      .eq("trip_id", targetTrip)
      .eq("owner_id", userId)
      .eq("currency", currencyToDelete);
    if (error) {
      if (tripIdRef.current === targetTrip) setBudgetError(`刪除 ${currencyToDelete} 預算失敗，請稍後再試。`);
    } else {
      setBudgets((previous) => previous.filter((row) => !(row.tripId === targetTrip && row.currency === currencyToDelete)));
      if (tripIdRef.current === targetTrip && budgetCurrency === currencyToDelete) setBudgetAmount("");
    }
    setBudgetBusy(false);
  }

  const activeSummary = shoppingSummary?.tripId === tripId ? shoppingSummary : null;

  async function selectTrip(trip: Trip, covers: CoverRecord[] = savedCovers) {
    if (coverSaveLock.current || savingCover || pendingFile.current || budgetBusy) {
      setTripError("請先完成或儲存目前的封面，再切換旅行。");
      return;
    }
    setTripError("");
    setBudgetAmount("");
    setBudgetCurrency(trip.currency || "TWD");
    tripIdRef.current = trip.id;
    try { if (userId) sessionStorage.setItem(`travel-selected-trip:${userId}`, trip.id); } catch { /* storage unavailable */ }
    setTripId(trip.id);
    setTripName(trip.name || "我的旅行");
    setDestination(trip.destination || "尚未設定目的地");
    setDates([trip.start_date, trip.end_date].filter(Boolean).join(" — "));
    setCover(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverZoom(100);
    setCoverError("");
    const record = covers.find((row) => row.trip_id === trip.id);
    if (!record || !userId) return;
    setCoverPosition({ x: Number(record.position_x), y: Number(record.position_y) });
    setCoverZoom(Number(record.zoom));
    const key = `trip-cover:${userId}:${trip.id}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      // eslint-disable-next-line react-hooks/purity -- invoked by an async event handler, not during render
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
      // eslint-disable-next-line react-hooks/purity -- invoked by an async event handler, not during render
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
    if (!userId || tripBusy || savingCover || coverSaveLock.current || budgetBusy) return;
    if (trip.id === tripId && pendingFile.current) {
      setTripError("這趟旅行有尚未儲存的封面，請先儲存或取消編輯，才能刪除。");
      return;
    }
    setTripBusy(true);
    setTripError("");
    try {
      const supabase = createClient();
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser || currentUser.id !== userId) {
        throw new Error("無法確認登入身分，已停止刪除。");
      }
      const { data: ownedTrip, error: ownerError } = await supabase.from("trips")
        .select("id").eq("id", trip.id).eq("owner_id", currentUser.id).maybeSingle();
      if (ownerError || !ownedTrip) {
        throw new Error("無法確認這趟旅行的擁有權，已停止刪除。");
      }
      // Never delete a trip with shopping items or a cover: its associated
      // records and private Storage objects need a dedicated cleanup flow.
      const [itemsCheck, coverCheck, budgetCheck] = await Promise.all([
        supabase.from("shopping_items").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
        supabase.from("trip_covers").select("trip_id").eq("trip_id", trip.id).maybeSingle(),
        supabase.from("trip_budgets").select("currency", { count: "exact", head: true }).eq("trip_id", trip.id)
      ]);
      if (itemsCheck.error || coverCheck.error || (budgetCheck.error && budgetCheck.error.code !== "42P01")) {
        throw new Error("無法確認旅行的關聯資料，已停止刪除以保護原有內容。");
      }
      if ((itemsCheck.count ?? 0) > 0) {
        throw new Error("這趟旅行已有購物清單，為避免資料遺失，目前不允許刪除。");
      }
      if ((budgetCheck.count ?? 0) > 0) {
        throw new Error("這趟旅行已有購物預算，請先保留旅行以免遺失預算設定。");
      }
      if (coverCheck.data) {
        throw new Error("這趟旅行已有雲端封面，為避免留下未清理的照片，目前不允許刪除。");
      }
      const coverFiles = await supabase.storage.from("trip-covers").list(`${userId}/${trip.id}`, { limit: 1 });
      if (coverFiles.error || (coverFiles.data?.length ?? 0) > 0) {
        throw new Error("雲端封面檔案尚未確認清空，請先保留這趟旅行。");
      }
      if (!window.confirm(`確定永久刪除「${trip.name || "未命名旅行"}」？\n\n已確認這趟旅行沒有購物清單或雲端封面。刪除後無法復原。`)) return;
      const { data: deleted, error } = await supabase.from("trips").delete()
        .eq("id", trip.id).eq("owner_id", userId).select("id");
      if (!error && (!deleted || deleted.length === 0)) throw new Error("找不到可刪除的旅行，請重新整理。");
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset image readiness when source is cleared
      setCoverReady(false);
      return;
    }
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset readiness before loading a different image
    setCoverReady(false);
    const image = new Image();
    image.onload = () => { if (active) setCoverReady(true); };
    image.onerror = () => { if (active) setCoverReady(false); };
    image.src = cover;
    return () => { active = false; };
  }, [cover]);

  function chooseCover(file?: File) {
    if (!file) return;
    if (coverSaveLock.current || savingCover || tripBusy) {
      setCoverError("目前正在儲存資料，請完成後再選擇照片。");
      return;
    }
    setCoverError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCoverError("請選擇 JPG、PNG 或 WebP 圖片。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverError("請選擇小於 5 MB 的照片。");
      return;
    }
    pendingFile.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      if (pendingFile.current !== file || coverSaveLock.current) return;
      if (typeof reader.result === "string") {
        setCover(reader.result);
        setCoverPosition({ x: 50, y: 50 });
        setCoverZoom(100);
        setEditingCover(true);
      }
    };
    reader.onerror = () => {
      if (pendingFile.current === file) {
        pendingFile.current = null;
        setCoverError("照片讀取失敗，請重試。");
      }
    };
    reader.readAsDataURL(file);
  }

  async function cancelCoverEdit() {
    if (coverSaveLock.current || savingCover) return;
    pendingFile.current = null;
    dragStart.current = null;
    setEditingCover(false);
    setCoverError("");
    const activeTrip = trips.find((trip) => trip.id === tripId);
    if (activeTrip) {
      await selectTrip(activeTrip);
    } else {
      setCover(null);
      setCoverPosition({ x: 50, y: 50 });
      setCoverZoom(100);
    }
  }

  async function saveCover() {
    if (!tripId || !userId) {
      setCoverError("請先登入並建立旅行，才能把封面儲存到雲端。");
      setEditingCover(false);
      return;
    }
    if (savingCover || tripBusy || coverSaveLock.current) return;
    coverSaveLock.current = true;
    setSavingCover(true);
    setCoverError("");
    let uploadedPath: string | null = null;
    let metadataSaved = false;
    let previousPath: string | null = null;
    const targetTripId = tripId;
    const supabase = createClient();
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser || currentUser.id !== userId) throw new Error("登入狀態不一致，請重新登入。");
      const { data: ownedTrip, error: tripError } = await supabase.from("trips").select("id").eq("id", targetTripId).eq("owner_id", currentUser.id).maybeSingle();
      if (tripError || !ownedTrip) throw new Error("目前帳號無法確認這筆旅行的擁有權。");
      let path: string | undefined;
      if (pendingFile.current) {
        const file = pendingFile.current;
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : null;
        if (!extension) throw new Error("雲端僅支援 JPG、PNG 或 WebP 圖片。");
        path = `${userId}/${targetTripId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("trip-covers").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedPath = path;
      } else {
        const { data, error } = await supabase.from("trip_covers").select("storage_path").eq("trip_id", targetTripId).maybeSingle();
        if (error) throw error;
        path = data?.storage_path;
      }
      if (!path) throw new Error("請先上傳封面照片。");
      const { data: previousRecord, error: previousError } = await supabase.from("trip_covers")
        .select("storage_path").eq("trip_id", targetTripId).maybeSingle();
      if (previousError) throw previousError;
      previousPath = previousRecord?.storage_path ?? null;
      const { error } = await supabase.from("trip_covers").upsert({
        trip_id: targetTripId, owner_id: userId, storage_path: path,
        position_x: coverPosition.x, position_y: coverPosition.y, zoom: coverZoom,
        updated_at: new Date().toISOString()
      }, { onConflict: "trip_id" });
      if (error) throw error;
      metadataSaved = true;
      const { data: signed } = await supabase.storage.from("trip-covers").createSignedUrl(path, 3600);
      setSavedCovers((previous) => [...previous.filter((item) => item.trip_id !== targetTripId), { trip_id: targetTripId, storage_path: path, position_x: coverPosition.x, position_y: coverPosition.y, zoom: coverZoom }]);
      if (signed?.signedUrl && tripIdRef.current === targetTripId) {
        setCover(signed.signedUrl);
        try {
          sessionStorage.setItem(`trip-cover:${userId}:${targetTripId}`, JSON.stringify({
            path,
            url: signed.signedUrl,
            expiresAt: Date.now() + 3600_000
          }));
        } catch { /* storage may be unavailable */ }
      }
      pendingFile.current = null;
      setEditingCover(false);
      if (uploadedPath && previousPath && uploadedPath !== previousPath) {
        const { error: cleanupError } = await supabase.storage.from("trip-covers").remove([previousPath]);
        if (cleanupError) setCoverError("新封面已儲存，但舊照片清理失敗。");
      }
    } catch (error) {
      let detail = error instanceof Error ? error.message : "請稍後再試。";
      if (uploadedPath && !metadataSaved) {
        const { error: cleanupError } = await supabase.storage.from("trip-covers").remove([uploadedPath]);
        if (cleanupError) detail += "；上傳照片清理失敗，請聯絡管理員。";
      }
      setCoverError(`儲存失敗：${detail}`);
    } finally {
      coverSaveLock.current = false;
      setSavingCover(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-[#34423D]">
      <style>{`
        .travel-studio-bottom {position:fixed;z-index:35;bottom:0;left:0;right:0;display:flex;justify-content:space-around;gap:6px;padding:9px 10px max(10px,env(safe-area-inset-bottom));background:#ffffffef;border-top:1px solid #e7e5df;box-shadow:0 -4px 18px #34423d0a}
        .travel-studio-bottom a {text-align:center;min-width:64px;padding:7px 5px;border-radius:14px;font-size:12px;line-height:1.6}
        .travel-studio-bottom a[aria-current] {background:#e7f0f4;color:#39718b}
        @media(min-width:768px){.travel-studio-bottom{max-width:440px;left:50%;transform:translateX(-50%);border:1px solid #e7e5df;border-radius:20px 20px 0 0}}
      `}</style>
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xl font-bold tracking-tight text-[#16385b]">旅購 <span className="text-sm font-normal text-slate-400">Travel Studio</span></p>
            <p className="mt-1 text-xs text-slate-500">把喜歡的世界，慢慢收進來。</p>
          </div>
          <a href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : "/"} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">返回現有清單 ↗</a>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-7 md:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-medium text-[#8B796B]">TRAVEL JOURNAL · 旅行手帳</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">把下一站，寫進生活裡 ✈</h1></div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">旅行手帳風格 · 測試版</span>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-[24px] border border-[#e7e4dc] bg-gradient-to-r from-[#eef2ed] to-[#f8f2e9] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-lg font-bold text-[#34423D]">📮 發現喜歡的東西？</p>
            <p className="mt-1 text-sm text-[#728079]">把想買、想去的先記下來，下一站再帶著走。</p>
          </div>
          <a href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : "/"} className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#91B3C3] px-5 py-3 text-sm font-semibold text-[#244A5B] shadow-sm hover:bg-[#A8C4D0]">＋ 新增購物項目 →</a>
        </div>
        <section className="relative isolate min-h-[260px] overflow-hidden rounded-[28px] bg-[#B5CAD4] text-white shadow-md md:min-h-[350px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#A5AD96] via-[#B5CAD4] to-[#E5DED3]">
            <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-[-90px] right-[12%] h-52 w-[60%] rotate-[-9deg] rounded-[60%] bg-emerald-100/20 blur-xl" />
          </div>
          {cover && <div className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ease-out ${coverReady ? "opacity-100" : "opacity-0"}`} style={{ backgroundImage: `url("${cover}")`, backgroundPosition: `${coverPosition.x}% ${coverPosition.y}%`, backgroundSize: `${coverZoom}% auto` }} />}
          <div className="absolute inset-0 bg-gradient-to-r from-[#34423D]/80 via-[#34423D]/30 to-transparent" />
          <div className="relative flex min-h-[260px] flex-col justify-between p-6 md:min-h-[350px] md:p-10">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs backdrop-blur">✈ NEXT STOP · 下一站</span>
              <div>
                <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => { chooseCover(e.target.files?.[0]); e.target.value = ""; }} aria-label="選擇旅行封面照片" />
                <div className="flex flex-wrap justify-end gap-2">
                  {cover && <button type="button" onClick={() => setEditingCover(true)} className="rounded-full border border-white/60 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-slate-900/60">✥ 調整封面</button>}
                  <button type="button" onClick={() => picker.current?.click()} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#16385b] shadow-sm hover:bg-blue-50">📷 {cover ? "更換封面" : "上傳封面"}</button>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-white/80">每一段旅程，都值得好好收藏 · Good trip!</p>
              <h2 className="max-w-xl text-3xl font-bold leading-tight drop-shadow-sm md:text-5xl">{loading ? "旅程載入中…" : tripName}</h2>
              <p className="mt-4 text-sm text-white/90">📍 {destination}</p>
              {dates && <p className="mt-2 text-sm text-white/85">🗓 {dates}</p>}
              <a href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : "/"} className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#123c63] hover:bg-blue-50">管理這趟旅行 →</a>
            </div>
          </div>
        </section>
        {editingCover && cover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="調整旅行封面">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-5 text-slate-900 shadow-2xl md:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold">調整旅行封面</h2><p className="mt-1 text-sm text-slate-500">用滑鼠或手指拖曳照片，也能使用下方滑桿縮放。</p></div>
                <button type="button" onClick={() => { void cancelCoverEdit(); }} disabled={savingCover} className="rounded-full bg-slate-100 px-3 py-2 text-sm disabled:opacity-50" aria-label="關閉調整視窗">✕</button>
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
        <section className="mt-4" aria-label="旅行常用工具">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <a href={tripId ? `/itinerary?tripId=${encodeURIComponent(tripId)}` : "/itinerary"} className="rounded-2xl border border-[#e6e9e2] bg-[#edf1ec] p-3 text-center"><span className="text-2xl">🗓️</span><p className="mt-1 text-sm font-semibold">行程</p><p className="mt-1 text-[10px] text-[#718079]">每日規劃 →</p></a>
            <a href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : "/"} className="rounded-2xl border border-[#f1e4d8] bg-[#f8eee5] p-3 text-center"><span className="text-2xl">🛍️</span><p className="mt-1 text-sm font-semibold">購物</p><p className="mt-1 text-[10px] text-[#718079]">{activeSummary?.total ?? "—"} 項</p></a>
            <a href={tripId ? `/wallet?tripId=${encodeURIComponent(tripId)}` : "/wallet"} className="rounded-2xl border border-[#dce8ed] bg-[#e9f0f3] p-3 text-center"><span className="text-2xl">💳</span><p className="mt-1 text-sm font-semibold">錢包</p><p className="mt-1 text-[10px] text-[#718079]">支出紀錄 →</p></a>
            <div className="rounded-2xl border border-[#eae4dd] bg-[#eeeae5] p-3 text-center"><span className="text-2xl">📍</span><p className="mt-1 text-sm font-semibold">地點</p><p className="mt-1 text-[10px] text-[#718079]">規劃中</p></div>
          </div>
        </section>
        {tripId && <section className="mt-8" aria-label="目前旅行購物進度">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">這趟旅行的購物進度</h2>
            <a href={`/?tripId=${encodeURIComponent(tripId)}`} className="text-sm font-semibold text-blue-700 hover:underline">查看清單 →</a>
          </div>
          {shoppingSummaryError && <p role="alert" className="mb-3 text-sm text-red-600">{shoppingSummaryError}</p>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">購物品項</p><p className="mt-2 text-2xl font-bold">{activeSummary?.total ?? "—"} <span className="text-sm font-normal">項</span></p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">已購買進度</p><p className="mt-2 text-2xl font-bold">{activeSummary ? `${activeSummary.bought} / ${activeSummary.total}` : "—"}</p></div>
            <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm md:col-span-1"><p className="text-sm text-slate-500">商品預估總額</p><p className="mt-2 text-2xl font-bold">{activeSummary ? (activeSummary.amounts.length ? activeSummary.amounts.map(({ currency, amount }) => `${currency} ${amount.toLocaleString()}`).join(" / ") : "尚無金額") : "—"}</p><p className="mt-1 text-xs text-slate-400">依商品單價 × 數量加總；不同幣別分開統計</p>
              {activeSummary && activeSummary.amounts.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-600">已購買商品金額</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{activeSummary.amounts.map(({ currency, purchased }) => `${currency} ${purchased.toLocaleString()}`).join(" / ")}</p>
                <p className="mt-2 text-xs text-slate-400">依已標記購買的商品估算，並非實際付款紀錄</p>
              </div>}</div>
          </div>
        </section>}
        {tripId && <section id="travel-budget" className="mt-8 scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm" aria-label="旅行購物預算">
          <h2 className="text-xl font-bold">購物預算管理</h2>
          <p className="mt-1 text-sm text-slate-500">每趟旅行、每種幣別獨立設定；金額會儲存在帳號中。</p>
          {budgetError && <p role="alert" className="mt-3 text-sm text-red-600">{budgetError}</p>}
          {budgetReadyTripId === tripId && <>
            <form onSubmit={saveBudget} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">幣別
                <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2">
                  {["TWD","JPY","USD","KRW","EUR","CNY","HKD","THB","SGD"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="min-w-[160px] flex-1 text-sm">預算金額
                <input type="number" min="0" max="999999999999" step="0.01" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} required placeholder="輸入預算"
                  className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <button type="submit" disabled={budgetBusy} className="rounded-xl bg-[#173f68] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{budgetBusy ? "儲存中…" : "儲存預算"}</button>
            </form>
            {budgets.filter((row) => row.tripId === tripId).length === 0 && (
              <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                這趟旅行尚未設定購物預算。選擇幣別並輸入金額，就能開始追蹤。
              </p>
            )}
            {activeSummary && activeSummary.amounts.filter((amount) => amount.amount > 0 && !budgets.some((row) => row.tripId === tripId && row.currency === amount.currency)).length > 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                以下幣別已有商品金額，但尚未設定預算：{activeSummary.amounts.filter((amount) => amount.amount > 0 && !budgets.some((row) => row.tripId === tripId && row.currency === amount.currency)).map((amount) => amount.currency).join("、")}。不同幣別不會直接相加。
              </p>
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {budgets.filter((row) => row.tripId === tripId).map((row) => {
                const totals = activeSummary?.amounts.find((amount) => amount.currency === row.currency);
                const planned = totals?.amount ?? 0;
                const remaining = row.amount - planned;
                const percentUsed = row.amount > 0 ? Math.round((planned / row.amount) * 100) : (planned > 0 ? 100 : 0);
                const percentBought = planned > 0 ? Math.min(100, ((totals?.purchased ?? 0) / planned) * 100) : 0;
                return <div key={row.currency} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{row.currency} 預算 {row.amount.toLocaleString()}</p>
                    <button type="button" disabled={budgetBusy} onClick={() => { setBudgetCurrency(row.currency); setBudgetAmount(String(row.amount)); setBudgetError(""); }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50">修改預算</button>
                    <button type="button" disabled={budgetBusy} onClick={() => void deleteBudget(row.currency)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">刪除預算</button>
                  </div>
                  {activeSummary && <div className="mt-4" aria-label={`預算使用比例 ${percentUsed}%`}>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>預算使用進度</span>
                      <span className={remaining < 0 ? "font-bold text-red-600" : "font-medium"}>{percentUsed}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percentUsed)}>
                      <div className={`relative h-full rounded-full ${remaining < 0 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, percentUsed)}%` }}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentBought}%` }} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">綠色：已購買估算　藍色：尚未購買估算　紅色：預估超支</p>
                  </div>}
                  <p className="mt-2 text-sm text-slate-600">預估購物總額：{activeSummary ? planned.toLocaleString() : "載入中…"}</p>
                  <p className="mt-1 text-sm text-slate-600">已購買估算：{activeSummary ? (totals?.purchased ?? 0).toLocaleString() : "載入中…"}</p>
                  <p className="mt-1 text-sm text-slate-600">待購買估算：{activeSummary ? Math.max(0, planned - (totals?.purchased ?? 0)).toLocaleString() : "載入中…"}</p>
                  <p className={`mt-2 font-bold ${remaining < 0 ? "text-red-600" : "text-emerald-700"}`}>{activeSummary ? (remaining < 0 ? `超出預算 ${Math.abs(remaining).toLocaleString()}` : `剩餘預算 ${remaining.toLocaleString()}`) : "計算中…"}</p>
                  <p className="mt-2 text-xs text-slate-400">剩餘預算＝預算－全部商品預估金額</p>
                </div>;
              })}
            </div>
          </>}
        </section>}
        <section id="my-trips" className="mt-8 scroll-mt-8" aria-label="我的旅行管理">
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
              feature.href ? <a key={feature.name} href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : feature.href} className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <span className="text-3xl">{feature.icon}</span><p className="mt-5 font-semibold">{feature.name}</p><p className="mt-1 text-xs font-medium text-blue-600">{feature.detail} →</p>
              </a> : <div key={feature.name} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <span className="text-3xl">{feature.icon}</span><p className="mt-5 font-semibold">{feature.name}</p><p className="mt-1 text-xs text-slate-400">{feature.detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-semibold tracking-wide text-blue-600">PLAN BETTER</p><h3 className="mt-2 text-xl font-bold">想買的，旅途中別再錯過。</h3><p className="mt-2 text-sm leading-6 text-slate-500">現有購物清單仍然可以正常使用，先收藏想買的東西，再慢慢完善每趟旅程。</p><a href={tripId ? `/?tripId=${encodeURIComponent(tripId)}` : "/"} className="mt-5 inline-flex rounded-full bg-[#173f68] px-5 py-2.5 text-sm font-semibold text-white">開啟購物清單 →</a></div>
          <div className="rounded-3xl bg-gradient-to-br from-[#e9f5f7] to-[#edf1ff] p-6"><p className="text-xs font-semibold tracking-wide text-[#397b9a]">COMING SOON</p><h3 className="mt-2 text-xl font-bold">下一站，更多精彩</h3><p className="mt-2 text-sm leading-6 text-slate-600">每日行程、景點地圖、旅費管理與多人協作會逐步加入。現在先體驗新版首頁的風格與操作。</p><div className="mt-5 text-4xl">🌊 ✈️ 🗺️</div></div>
        </section>
      </div>
      <a href="/feedback" className="fixed bottom-20 right-4 z-30 rounded-full border border-[#dfe6dd] bg-[#FAF9F6] px-4 py-3 text-sm font-semibold text-[#426b7d] shadow-lg">💌 Beta 回饋</a>
      <nav className="travel-studio-bottom" aria-label="旅購導覽">
        <a href="/dashboard-preview" aria-current="page">⌂<br/>首頁</a>
        <a href="/collections">♡<br/>收藏庫</a>
        <a href="/dashboard-preview#my-trips">▤<br/>我的旅行</a>
        <a href="/profile">◉<br/>個人中心</a>
      </nav>
    </main>
  );
}
