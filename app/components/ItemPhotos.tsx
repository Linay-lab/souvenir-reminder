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
  const [previewId, setPreviewId] = useState<string | null>(null);

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
        setError("照片功能尚未啟用，請先完成資料表與 Storage 設定。");
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
    if (busy || !ready) { setError("照片功能尚未啟用，請先完成 Supabase 設定。"); return; }
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("請選擇 JPG、PNG、WebP 或 HEIC 圖片，單張不超過 5 MB。");
      return;
    }
    if (photos.length >= 10) { setError("每個商品最多 10 張照片。"); return; }
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
      setPreviewId((current) => current === photo.id ? null : current);
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      if (storageError) setError("照片紀錄已刪除，但雲端檔案清理失敗。");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      {photos.length > 0 && <div className="flex flex-wrap gap-2">
        {photos.map((photo) => <div key={photo.id} className="relative">
          {photo.url ? <button type="button" onClick={() => setPreviewId(photo.id)} title="放大預覽照片" aria-label="放大預覽照片">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="商品照片" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
          </button> : <div className="h-20 w-20 rounded-xl bg-slate-100" />}
          <button type="button" disabled={busy} onClick={() => void remove(photo)}
            aria-label="刪除這張照片" className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-sm text-red-600 shadow disabled:opacity-50">×</button>
        </div>)}
      </div>}
      {previewId && photos.some((photo) => photo.id === previewId && photo.url) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="照片放大預覽" onClick={() => setPreviewId(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/20 px-4 py-2 text-xl text-white" aria-label="關閉照片預覽" onClick={() => setPreviewId(null)}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos.find((photo) => photo.id === previewId)?.url} alt="商品照片放大預覽" className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
      <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
        {busy ? "處理照片中…" : photos.length >= 10 ? "已達 10 張上限" : "＋ 新增商品照片"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy || !ready || photos.length >= 10}
          className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }} />
      </label>
      {!ready && photos.length === 0 && !error && <p className="mt-1 text-xs text-slate-400">尚無照片，首次使用需先啟用 Supabase 照片設定。</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
