"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const BUCKET = "shopping-item-photos";
type Photo = { id: string; storage_path: string; url: string };

export default function ItemPhotos({ itemId, tripId, userId }: { itemId: string; tripId: string; userId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function load() {
      const { data, error: readError } = await supabase.from("shopping_item_photos")
        .select("id,storage_path").eq("trip_id", tripId).eq("item_id", itemId)
        .order("sort_order").order("created_at");
      if (!active) return;
      if (readError) {
        setReady(false);
        return;
      }
      const results = await Promise.all((data ?? []).map(async (photo) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(photo.storage_path, 3600);
        return { ...photo, url: signed?.signedUrl ?? "" };
      }));
      if (active) { setPhotos(results); setReady(true); }
    }
    void load();
    return () => { active = false; };
  }, [itemId, tripId]);

  async function upload(file: File) {
    if (busy) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("請選擇 JPG、PNG、WebP 或 HEIC 圖片，單張不超過 5 MB。");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${tripId}/${itemId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      setError("照片上傳失敗。請確認已完成第四階段的資料表及 Storage 設定。");
      setBusy(false);
      return;
    }
    const { data, error: saveError } = await supabase.from("shopping_item_photos")
      .insert({ item_id: itemId, trip_id: tripId, owner_id: userId, storage_path: path, sort_order: photos.length })
      .select("id,storage_path").single();
    if (saveError || !data) {
      await supabase.storage.from(BUCKET).remove([path]);
      setError("照片資料儲存失敗，已嘗試清理剛上傳的檔案。");
      setBusy(false);
      return;
    }
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    setPhotos((previous) => [...previous, { id: data.id, storage_path: path, url: signed?.signedUrl ?? "" }]);
    setReady(true);
    setBusy(false);
  }

  async function remove(photo: Photo) {
    if (busy || !window.confirm("確定刪除這張商品照片嗎？商品本身不會刪除。")) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("shopping_item_photos").delete()
      .eq("id", photo.id).eq("item_id", itemId).eq("trip_id", tripId).eq("owner_id", userId);
    if (deleteError) {
      setError("照片刪除失敗，請稍後再試。");
    } else {
      setPhotos((previous) => previous.filter((row) => row.id !== photo.id));
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      if (storageError) setError("照片紀錄已刪除，但雲端檔案清理失敗。");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      {photos.length > 0 && <div className="flex flex-wrap gap-2">
        {photos.map((photo) => <div key={photo.id} className="relative">
          {photo.url ? <a href={photo.url} target="_blank" rel="noopener noreferrer" title="開啟原圖">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="商品照片" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
          </a> : <div className="h-20 w-20 rounded-xl bg-slate-100" />}
          <button type="button" disabled={busy} onClick={() => void remove(photo)}
            aria-label="刪除這張照片" className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-sm text-red-600 shadow disabled:opacity-50">×</button>
        </div>)}
      </div>}
      <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
        {busy ? "處理照片中…" : "＋ 新增商品照片"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy}
          className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }} />
      </label>
      {!ready && photos.length === 0 && <p className="mt-1 text-xs text-slate-400">首次使用照片功能前，需先啟用 Supabase 照片設定。</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
