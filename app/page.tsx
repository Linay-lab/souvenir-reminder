"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

type Category = "送禮" | "託買" | "自用";

type Item = {
  id: string;
  name: string;
  quantity: number;
  forWho: string;
  category: Category;
  place: string;
  price: number;
  currency?: string;
  note: string;
  bought: boolean;
};

const initialItems: Item[] = [];

export default function Home() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [storageReady, setStorageReady] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"default" | "unbought" | "price-high" | "price-low">("default");
  const [filter, setFilter] = useState<
    "全部" | "未購買" | "已購買" | Category
  >("全部");
  const [tripName, setTripName] = useState("我的旅行");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tripReady, setTripReady] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const [currency, setCurrency] = useState("");
  const [currencyReady, setCurrencyReady] = useState(false);


  useEffect(() => {
  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
    setAuthReady(true);
  };

  getUser();
}, []);

useEffect(() => {
  if (!authReady || !user) return;

  const loadTrip = async () => {
    // Select only trips belonging to the signed-in user.
    const requestedTripId = new URLSearchParams(window.location.search).get("tripId");
    // Trip IDs are opaque database identifiers; do not assume they use UUID syntax.
    // Resolve the requested ID against the signed-in user's own trip list.
    const { data: ownedTrips, error } = await supabase
      .from("trips")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("讀取 Supabase 旅程失敗：", error);
      setListError("讀取旅行清單失敗，請重新整理後再試。");
      setTripReady(true);
      setCurrencyReady(true);
      return;
    }

    const data = requestedTripId
      ? ownedTrips?.find((trip) => String(trip.id) === requestedTripId)
      : ownedTrips?.[0];

    // Never substitute a different trip for an explicit selection.
    if (requestedTripId && !data) {
      setListError("找不到你選擇的旅行。請返回旅行首頁重新選擇，避免修改到其他旅行的商品。");
      setTripReady(true);
      setCurrencyReady(true);
      return;
    }

    if (data) {
  setTripId(data.id);
  setTripName(data.name || "我的旅行");
  setDestination(data.destination || "");
  setStartDate(data.start_date || "");
  setEndDate(data.end_date || "");
  setCurrency(data.currency || "TWD");
  setTripReady(true);
} else {
  const { data: newTrip, error: insertError } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name: tripName,
      destination: destination || null,
      start_date: startDate || null,
      end_date: endDate || null,
      currency: currency || "TWD",
    })
    .select()
    .single();

  if (insertError) {
    console.error("建立 Supabase 旅程失敗：", insertError);
    return;
  }

  setTripId(newTrip.id);
  setTripReady(true);
}
  };

  loadTrip();
}, [authReady, user]);

useEffect(() => {
  const savedItems = localStorage.getItem("souvenir-items");

  if (!user && savedItems) {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved local list after user resolution
      setItems(JSON.parse(savedItems));
    } catch {
      console.log("讀取本機清單失敗");
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mark local storage hydration complete
  setStorageReady(true);
}, [user]);

useEffect(() => {
  if (!storageReady || user) return;

  localStorage.setItem("souvenir-items", JSON.stringify(items));
}, [items, storageReady, user]);
  useEffect(() => {
  if (!tripId || !user) return;
  let active = true;
  // Clear the previous trip while the newly selected list loads.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- prevent showing another trip\u0027s items
  setItems([]);

  const loadItems = async () => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("trip_id", tripId);

    if (!active) return;
    if (error) {
      console.error("讀取 Supabase 商品失敗：", error);
      setListError("無法載入這趟旅行的購物清單，請重新整理再試。");
      return;
    }

    const loadedItems: Item[] = (data ?? []).map((row) => ({
  id: row.id,
  name: row.name,
  quantity: row.quantity,
  forWho: row.recipient || "自己",
  category: row.category as Category,
  place: row.place_name || "尚未設定地點",
  price: Number(row.price ?? 0),
  currency: row.currency || undefined,
  note: row.note || "",
  bought: row.bought,
}));

setItems(loadedItems);
setListError("");
  };

  void loadItems();
  return () => { active = false; };
}, [tripId, user]);
  const [showTripEdit, setShowTripEdit] = useState(false);
  const [editTripName, setEditTripName] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  useEffect(() => {
  if (!authReady || user) {
  return;
}

  const savedTrip = localStorage.getItem("souvenir-trip");

  if (savedTrip) {
    try {
      const trip = JSON.parse(savedTrip);

      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate anonymous trip settings from local storage
      setTripName(trip.tripName || "我的旅行");
      setDestination(trip.destination || "");
      setStartDate(trip.startDate || "");
      setEndDate(trip.endDate || "");
    } catch {
      console.log("讀取旅行資料失敗");
    }
  }

  setTripReady(true);
}, [authReady, user]);

useEffect(() => {
  if (!tripReady || user) return;

  localStorage.setItem(
    "souvenir-trip",
    JSON.stringify({
      tripName,
      destination,
      startDate,
      endDate,
    })
  );
}, [tripName, destination, startDate, endDate, tripReady, user]);
  useEffect(() => {
  if (user) {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- currency initialization after auth resolution
    setCurrencyReady(true);
    return;
  }

  const savedCurrency = localStorage.getItem("souvenir-currency");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize persisted currency
  setCurrency(savedCurrency || "");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mark currency initialization complete
  setCurrencyReady(true);
}, [user]);

useEffect(() => {
  if (!currencyReady || user) return;

  localStorage.setItem("souvenir-currency", currency);
}, [currency, currencyReady, user]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [forWho, setForWho] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState<Category>("自用");
  const [price, setPrice] = useState<number | "">("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");

  const boughtCount = items.filter((item) => item.bought).length;
  

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const result = items.filter((item) => {
      const matchesFilter = filter === "全部"
        || (filter === "未購買" && !item.bought)
        || (filter === "已購買" && item.bought)
        || item.category === filter;
      const matchesSearch = !query || [item.name, item.forWho, item.place, item.note]
        .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
    if (sortMode === "unbought") return result.sort((a, b) => Number(a.bought) - Number(b.bought));
    if (sortMode === "price-high") return result.sort((a, b) => b.price * b.quantity - a.price * a.quantity);
    if (sortMode === "price-low") return result.sort((a, b) => a.price * a.quantity - b.price * b.quantity);
    return result;
  }, [filter, items, searchQuery, sortMode]);

 async function toggleBought(id: string) {
  const item = items.find((item) => item.id === id);
  if (!item) return;

  const newBought = !item.bought;

  const { error } = await supabase
    .from("shopping_items")
    .update({ bought: newBought })
    .eq("id", id)
    .eq("trip_id", tripId);

  if (error) {
    console.error("更新購買狀態失敗：", error);
    setListError("購買狀態更新失敗，請稍後重試。");
    return;
  }

  setItems((prev) =>
    prev.map((item) =>
      item.id === id ? { ...item, bought: newBought } : item
    )
  );
}
  async function deleteItem(id: string) {
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId);

  if (error) {
    console.error("刪除商品失敗：", error);
    setListError("刪除商品失敗，請稍後重試。");
    return;
  }

  setItems((prev) => prev.filter((item) => item.id !== id));
}
function startEdit(item: Item) {
  setEditingId(item.id);
  setName(item.name);
  setForWho(item.forWho);
  setQuantity(item.quantity);
  setCategory(item.category);
  setPrice(item.price === 0 ? "" : item.price);
  setPlace(item.place === "尚未設定地點" ? "" : item.place);
  setNote(item.note);
  setShowAdd(true);
}
  async function addItem() {
    if (!name.trim()) return;

 if (editingId !== null) {
  const updatedItem = {
    name,
    quantity,
    recipient: forWho || "自己",
    category,
    place_name: place || "尚未設定地點",
    price: price === "" ? 0 : price,
    note,
  };

  const { error } = await supabase
    .from("shopping_items")
    .update(updatedItem)
    .eq("id", editingId)
    .eq("trip_id", tripId);

  if (error) {
    console.error("編輯商品失敗：", JSON.stringify(error, null, 2));
    setListError("編輯商品失敗，請稍後重試。");
    return;
  }

  setItems((prev) =>
    prev.map((item) =>
      item.id === editingId
        ? {
            ...item,
            name,
            quantity,
            forWho: forWho || "自己",
            category,
            place: place || "尚未設定地點",
            price: price === "" ? 0 : price,
            note,
          }
        : item
    )
  );
} else {

  if (!user || !tripId) return;

  const { data: newItem, error } = await supabase
    .from("shopping_items")
    .insert({
      trip_id: tripId,
      created_by: user.id,
      name,
      quantity,
      recipient: forWho || "自己",
      category,
      price: price === "" ? 0 : price,
      currency: currency || null,
      place_name: place || null,
      note: note || null,
      bought: false,
    })
    .select()
    .single();

  if (error) {
    console.error("新增商品失敗：", error);
    setListError("新增商品失敗，請稍後重試。");
    return;
  }

  setItems((prev) => [
    ...prev,
    {
      id: newItem.id,
      name: newItem.name || "",
      quantity: newItem.quantity,
      forWho: newItem.recipient || "自己",
      category: newItem.category as Category,
      place: newItem.place_name || "尚未設定地點",
      price: Number(newItem.price ?? 0),
      currency: newItem.currency || currency,
      note: newItem.note || "",
      bought: newItem.bought,
    },
  ]);
}

    setName("");
    setForWho("");
    setQuantity(1);
    setCategory("自用");
    setPrice("");
    setPlace("");
    setNote("");
    setEditingId(null);
    setShowAdd(false);
  }
if (!storageReady || !tripReady || !currencyReady) {
  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="text-sm text-slate-400">旅程載入中...</div>
    </main>
  );
}
  if (user && !tripId) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-6 py-16 text-slate-800">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold">無法開啟指定旅行</h1>
          <p role="alert" className="mt-3 text-sm text-red-700">{listError || "旅行尚未載入，請稍後重新整理。"}</p>
          <a href="/dashboard-preview" className="mt-6 inline-block rounded-full bg-[#173f68] px-5 py-3 text-sm font-semibold text-white">返回旅行首頁</a>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-800">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xl font-bold tracking-tight">
              🧳 旅購
            </div>
            <div className="text-xs text-slate-500">
              想買的，旅途中別再錯過。
            </div>
          </div>

         {!authReady ? (
  <div className="h-9 w-16 animate-pulse rounded-full bg-slate-200" />
) : user ? (
  <button
    type="button"
    onClick={async () => {
      await supabase.auth.signOut();
      setUser(null);
    }}
    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
  >
    登出
  </button>
) : (
  <button
    type="button"
    onClick={() => {
      window.location.href = "/login";
    }}
    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
  >
    登入
  </button>
)}
        </div>
      </header>

      {user && <div className="mx-auto max-w-6xl px-5 pt-4">
        <a href="/dashboard-preview" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#173f68] hover:bg-slate-50">← 返回旅行首頁</a>
      </div>}
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {listError && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{listError}</div>}
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-100 via-white to-rose-100 p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-medium shadow-sm">
                🇯🇵 旅行清單
              </div>

              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {tripName}
              </h1>
              <button
               type="button"
              onClick={() => {
                setEditTripName(tripName);
                setEditDestination(destination);
                setEditStartDate(startDate);
                setEditEndDate(endDate);
                setEditCurrency(currency);
                setShowTripEdit(true);
              }}
               className="mt-2 text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                {destination || startDate || endDate ? "✏️ 編輯旅行" : "＋ 建立旅行"}
              </button>
<p className="mt-2 text-sm font-medium text-slate-600">
  📍 {destination || "尚未設定目的地"}
</p>
              <p className="mt-2 text-sm text-slate-500">
  {startDate && endDate
    ? `${startDate.replaceAll("-", "/")} ～ ${endDate.replaceAll("-", "/")} ・ ${
        Math.floor(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      } 天`
    : "📅 尚未設定日期"}
</p>
             <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
  <span>💰 幣別</span>
  <span className="font-medium text-slate-700">
  {!currency && "尚未設定幣別"}
  {currency === "JPY" && "JPY 日圓 ¥"}
  {currency === "KRW" && "KRW 韓元 ₩"}
  {currency === "TWD" && "TWD 台幣 NT$"}
  {currency === "USD" && "USD 美元 $"}
  {currency === "EUR" && "EUR 歐元 €"}
  {currency === "GBP" && "GBP 英鎊 £"}
  {currency === "THB" && "THB 泰銖 ฿"}
</span>
</div>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-2 w-48 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: `${
                        items.length
                          ? (boughtCount / items.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {boughtCount} / {items.length}
                </span>
              </div>
            </div>

            <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5">
              🔗 分享清單
            </button>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3">
          <StatCard
            icon="🛍️"
            label="全部"
            value={items.length}
            bg="bg-sky-50"
          />
          <StatCard
            icon="✅"
            label="已購買"
            value={boughtCount}
            bg="bg-emerald-50"
          />
          <StatCard
            icon="⏳"
            label="未購買"
            value={items.length - boughtCount}
            bg="bg-rose-50"
          />
        </section>

        {items.length > 0 && (
          <section className="mt-5 rounded-[24px] border border-rose-100 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📍</div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-600">
                  附近提醒
                </p>

                <h2 className="mt-1 text-lg font-bold">
  定位提醒功能準備中
</h2>

                <p className="mt-1 text-sm text-slate-500">
  未來可依照你的所在位置，提醒附近是否有清單中的商品。
</p>

                
              </div>
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">我的伴手禮</h2>
              <p className="text-sm text-slate-500">
  {items.length === 0
    ? "還沒有商品，把旅行中想買的東西加入清單吧！"
    : "整理自己要買、送人與朋友託買的東西"}
</p>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {items.length === 0 ? "＋ 新增第一個商品" : "＋ 新增商品"}
            </button>
          </div>
        {items.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="sr-only">搜尋商品、收件人、地點或備註</span>
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="🔎 搜尋商品、收件人、地點、備註"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400" />
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
              <span className="text-xs text-slate-500">排序</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none">
                <option value="default">原本順序</option>
                <option value="unbought">未購買優先</option>
                <option value="price-high">小計高到低</option>
                <option value="price-low">小計低到高</option>
              </select>
            </label>
          </div>
        )}
        {items.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            {(
              [
                "全部",
                "未購買",
                "已購買",
                "送禮",
                "託買",
                "自用",
              ] as const
            ).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter === value
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-500 shadow-sm"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        )}
          {items.length > 0 && filteredItems.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">找不到符合條件的商品，試著清除搜尋或切換分類。</p>}
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className={`rounded-[22px] border bg-white p-4 shadow-sm transition ${
                  item.bought ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleBought(item.id)}
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      item.bought
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-200"
                    }`}
                  >
                    {item.bought ? "✓" : ""}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3
                          className={`font-semibold ${
                            item.bought ? "line-through" : ""
                          }`}
                        >
                          {item.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          給：{item.forWho}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
  <span className="whitespace-nowrap text-lg font-bold">
    × {item.quantity}
  </span>
<button
  type="button"
  onClick={() => startEdit(item)}
  className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-blue-50 hover:text-blue-500"
  title="編輯商品"
>
  ✏️
</button>
  <button
    type="button"
    onClick={() => {
      if (window.confirm(`確定要刪除「${item.name}」嗎？`)) {
        deleteItem(item.id);
      }
    }}
    className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
    title="刪除商品"
  >
    🗑️
  </button>
</div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CategoryBadge category={item.category} />

                      {item.place && item.place !== "尚未設定地點" ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.place, destination].filter(Boolean).join(" "))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`在 Google 地圖搜尋 ${item.place}（開啟新分頁）`}
                          title="在 Google 地圖搜尋購買地點"
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          📍 {item.place} · 查看地圖 ↗
                        </a>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                          📍 尚未設定地點
                        </span>
                      )}

                    </div>

                    {item.price > 0 && (
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        {(item.currency || currency)
  ? new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: item.currency || currency,
      maximumFractionDigits: 0,
    }).format(item.price)
  : item.price.toLocaleString("zh-TW")}
／個 ・ 小計{" "}
{(item.currency || currency)
  ? new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: item.currency || currency,
      maximumFractionDigits: 0,
    }).format(item.price * item.quantity)
  : (item.price * item.quantity).toLocaleString("zh-TW")}
                      </p>
                     )}

                     {item.note && (
                       <p className="mt-2 text-sm text-slate-500">
                         📝 {item.note}
                       </p>
                     )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-[24px] bg-slate-900 p-6 text-white">
          <p className="text-sm text-slate-400">未來功能</p>
          <h2 className="mt-1 text-xl font-bold">
            到附近，自動提醒你別忘了買
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Feature icon="📍" text="定位附近商店" />
            <Feature icon="🔔" text="靠近自動提醒" />
            <Feature icon="👥" text="朋友一起加清單" />
          </div>
        </section>
      </div>
{showTripEdit && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">✏️ 編輯旅行</h2>

        <button
          type="button"
          onClick={() => setShowTripEdit(false)}
          className="text-xl text-slate-400"
        >
          ×
        </button>
      </div>

      <div className="mt-5">
  <label className="text-sm font-medium">旅行名稱</label>
  <input
    value={editTripName}
    onChange={(e) => setEditTripName(e.target.value)}
    placeholder="例如：巴黎之旅"
    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
  />
</div>
<div className="mt-4">
  <label className="text-sm font-medium">目的地</label>
  <input
    value={editDestination}
    onChange={(e) => setEditDestination(e.target.value)} 
    placeholder="例如：法國・巴黎"
    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
  />
</div>
<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div>
    <label className="text-sm font-medium">出發日期</label>
    <input
      type="date"
      value={editStartDate}
      onChange={(e) => setEditStartDate(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
    />
  </div>

  <div>
    <label className="text-sm font-medium">回程日期</label>
    <input
      type="date"
      value={editEndDate}
      onChange={(e) => setEditEndDate(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-400"
    />
  </div>
</div>
<div className="mt-4">
  <label className="text-sm font-medium">使用幣別</label>
  <select
    value={editCurrency}
    onChange={(e) => setEditCurrency(e.target.value)}
    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-400"
  >
    <option value="">請選擇幣別</option>
    <option value="JPY">JPY 日圓 ¥</option>
    <option value="KRW">KRW 韓元 ₩</option>
    <option value="TWD">TWD 台幣 NT$</option>
    <option value="USD">USD 美元 $</option>
    <option value="EUR">EUR 歐元 €</option>
    <option value="GBP">GBP 英鎊 £</option>
    <option value="THB">THB 泰銖 ฿</option>
  </select>
</div>
<div className="mt-6 flex gap-3">
  <button
    type="button"
    onClick={() => setShowTripEdit(false)}
    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-medium text-slate-600"
  >
    取消
  </button>

  <button
    type="button"
    onClick={async () => {
      if (!tripId) return;
      if ((editCurrency || "TWD") !== currency && items.some((item) => item.price > 0)) {
        const confirmed = window.confirm(
          "你正在修改旅行的預設幣別。\n\n已建立商品的金額和原始幣別不會自動換算或改寫；既有預算也會依原幣別保留。\n\n確定只修改這趟旅行之後新增商品的預設幣別嗎？"
        );
        if (!confirmed) return;
      }

const { error } = await supabase
  .from("trips")
  .update({
    name: editTripName,
    destination: editDestination || null,
    start_date: editStartDate || null,
    end_date: editEndDate || null,
    currency: editCurrency || "TWD",
  })
  .eq("id", tripId);

if (error) {
  console.error("更新旅程失敗：", JSON.stringify(error, null, 2));
  return;
}
      setTripName(editTripName);
      setDestination(editDestination);
      setStartDate(editStartDate);
      setEndDate(editEndDate);
      setCurrency(editCurrency);
      setShowTripEdit(false);
    }}
    className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white"
  >
    儲存修改
  </button>
</div>
    </div>
  </div>
)}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm md:items-center md:p-6">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl md:rounded-[28px]">            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
  {editingId !== null ? "編輯商品" : "新增想買的東西"}
</h2>

              <button
                onClick={() => setShowAdd(false)}
                className="text-xl text-slate-400"
              >
                ×
              </button>
            </div>

            <label className="text-sm font-medium">商品名稱</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：雪鹽金楚糕"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
            />

            <label className="mt-4 block text-sm font-medium">
              給誰
            </label>
            <input
              value={forWho}
              onChange={(e) => setForWho(e.target.value)}
              placeholder="媽媽、朋友、自己..."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
            />

            <label className="mt-4 block text-sm font-medium">
              數量
            </label>

            <div className="mt-2 flex items-center gap-4">
              <button
                onClick={() =>
                  setQuantity((q) => Math.max(1, q - 1))
                }
                className="h-11 w-11 rounded-xl bg-slate-100 text-xl"
              >
                −
              </button>

              <span className="w-8 text-center text-lg font-bold">
                {quantity}
              </span>

              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-11 w-11 rounded-xl bg-slate-100 text-xl"
              >
                ＋
              </button>
            </div>
<label className="mt-4 block text-sm font-medium">
  分類
</label>

<div className="mt-2 grid grid-cols-3 gap-2">
  {(["送禮", "託買", "自用"] as Category[]).map((value) => (
    <button
      key={value}
      type="button"
      onClick={() => setCategory(value)}
      className={`rounded-xl px-3 py-2 text-sm font-medium ${
        category === value
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {value}
    </button>
  ))}
</div>
<label className="mt-4 block text-sm font-medium">
  單價
</label>

<input
  type="number"
  value={price}
  onChange={(e) =>
    setPrice(e.target.value === "" ? "" : Number(e.target.value))
  }
  placeholder="例如：1080"
  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
/>
<label className="mt-4 block text-sm font-medium">
  購買地點
</label>

<input
  value={place}
  onChange={(e) => setPlace(e.target.value)}
  placeholder="例如：機場、百貨公司、當地商店"
  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
/>
<label className="mt-4 block text-sm font-medium">
  備註
</label>

<textarea
  value={note}
  onChange={(e) => setNote(e.target.value)}
  placeholder="例如：原味、機場看到再買"
  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
/>
            <button
              onClick={addItem}
              className="mt-6 w-full rounded-2xl bg-blue-600 py-3.5 font-semibold text-white"
            >
              {editingId !== null ? "儲存修改" : "加入清單"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: string;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-[20px] p-4 text-center`}>
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const styles = {
    送禮: "bg-rose-100 text-rose-600",
    託買: "bg-blue-100 text-blue-600",
    自用: "bg-emerald-100 text-emerald-600",
  };

  const icons = {
    送禮: "🎁",
    託買: "🤝",
    自用: "❤️",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${styles[category]}`}
    >
      {icons[category]} {category}
    </span>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <div className="text-xl">{icon}</div>
      <p className="mt-2 text-sm font-medium">{text}</p>
    </div>
  );
}