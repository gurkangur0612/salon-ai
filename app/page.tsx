"use client";

/* eslint-disable @next/next/no-img-element */
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BARBER_HAIRSTYLES, findHairstyle } from "./lib/hairstyles";
import { validateImageFile } from "./lib/imageValidation";
import { createHairBeardMask, type MaskResult } from "./lib/mask";
import { compositeImages } from "./lib/composite";
import type { BarberAnalysis, EditMode, PreservationMetrics } from "./lib/types";

const MODES: { id: EditMode; label: string; detail: string }[] = [
  { id: "hair", label: "Yalnızca saç", detail: "Mevcut sakal tamamen korunur." },
  { id: "beard", label: "Yalnızca sakal", detail: "Saç modeline dokunulmaz." },
  { id: "hair-and-beard", label: "Saç ve sakal", detail: "İki bölge birlikte düzenlenir." },
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
 const [rightFile, setRightFile] = useState<File | null>(null);
const [rightPreview, setRightPreview] = useState<string | null>(null);

const [leftFile, setLeftFile] = useState<File | null>(null);
const [leftPreview, setLeftPreview] = useState<string | null>(null);

const [backFile, setBackFile] = useState<File | null>(null);
const [backPreview, setBackPreview] = useState<string | null>(null);

const [topFile, setTopFile] = useState<File | null>(null);
const [topPreview, setTopPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BarberAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditMode>("hair");
  const [beardStyle, setBeardStyle] = useState("");
  const [busy, setBusy] = useState<"analyze" | "mask" | "generate" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [normalizedOriginal, setNormalizedOriginal] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PreservationMetrics | null>(null);
  const [debugMasks, setDebugMasks] = useState<Record<EditMode, MaskResult> | null>(null);
  const [maskPreview, setMaskPreview] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const selected = useMemo(() => selectedId ? findHairstyle(selectedId) : undefined, [selectedId]);

  function selectFile(next: File) {
    const message = validateImageFile(next);
    if (message) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null); setPreview(null); setAnalysis(null); setSelectedId(null); setResult(null); setRawImage(null); setMetrics(null); setMaskPreview(null);
      setError(message); return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setAnalysis(null); setSelectedId(null);
    setResult(null); setRawImage(null); setNormalizedOriginal(null); setMetrics(null); setDebugMasks(null); setMaskPreview(null); setError(""); setMode("hair");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]; if (next) selectFile(next);
    event.target.value = "";
  }

  async function analyze() {
    if (!file || busy) return;
    setBusy("analyze"); setError(""); setAnalysis(null);
    try {
     const body = new FormData();
body.append("image", file);

if (rightFile) body.append("rightImage", rightFile);
if (leftFile) body.append("leftImage", leftFile);
if (backFile) body.append("backImage", backFile);
if (topFile) body.append("topImage", topFile);
      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Fotoğraf analiz edilemedi.");
      setAnalysis(data.analysis); setSelectedId(data.analysis.recommendedHairstyles[0]?.id ?? null);
      requestAnimationFrame(() => document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Fotoğraf analiz edilemedi."); }
    finally { setBusy(null); }
  }

  async function generate() {
    if (!file || !analysis || busy || (mode !== "beard" && !selected)) { setError("Önce Berber Danışmanı analizini çalıştırın ve modeli seçin."); return; }
    setBusy("mask"); setError(""); setResult(null); setRawImage(null); setMetrics(null); setMaskPreview(null);
    try {
      const mask = await createHairBeardMask(file, mode, analysis?.faceBox, selected?.id);
      setMaskPreview(mask.previewUrl); setNormalizedOriginal(mask.normalizedPreviewUrl);
      if (process.env.NODE_ENV === "development") {
        const variants = await Promise.all(MODES.map((item) => createHairBeardMask(file, item.id, analysis.faceBox, selected?.id)));
        setDebugMasks({ hair: variants[0], beard: variants[1], "hair-and-beard": variants[2] });
      }
      setBusy("generate");
      const body = new FormData(); body.append("image", mask.normalizedImage, "normalized-original.png"); body.append("mask", mask.blob, "mask.png");
      body.append("editMode", mode); if (selected) body.append("hairstyleId", selected.id);
      body.append("imageWidth", String(mask.width)); body.append("imageHeight", String(mask.height));
      body.append("editableRatio", String(mask.editableRatio));
      body.append("requestId", `${Date.now()}-${crypto.randomUUID()}`);
      if (beardStyle.trim()) body.append("beardStyle", beardStyle.trim());
      const recommendation = analysis?.recommendedHairstyles.find((item) => item.id === selected?.id);
      if (recommendation) body.append("barberInstruction", recommendation.barberInstruction);
      const requestEdit = async () => {
        const response = await fetch(`/api/generate?t=${Date.now()}`, { method: "POST", body, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success || !data.image) throw new Error(data.error || "Önizleme oluşturulamadı.");
        return data.image as string;
      };
      let editedImage = await requestEdit();
      let composite = await compositeImages({ original: mask.normalizedImage, editedDataUrl: editedImage, mask: mask.blob, faceBox: analysis.faceBox, mode });
      if (mode === "hair" && composite.metrics.editableRegionChangedPixels < 0.18) {
        body.set("requestId", `${Date.now()}-${crypto.randomUUID()}`);
        body.set("retryStrength", "maximum");
        editedImage = await requestEdit();
        composite = await compositeImages({ original: mask.normalizedImage, editedDataUrl: editedImage, mask: mask.blob, faceBox: analysis.faceBox, mode });
      }
      if (mode === "hair" && composite.metrics.editableRegionChangedPixels < 0.18) throw new Error(`Saç modeli yeterince belirgin uygulanmadı (%${(composite.metrics.editableRegionChangedPixels * 100).toFixed(3)}). Sonuç güvenli biçimde reddedildi.`);
      setRawImage(editedImage);
      setMetrics(composite.metrics); setResult(composite.dataUrl);
      requestAnimationFrame(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason || "Önizleme oluşturulamadı.")); }
    finally { setBusy(null); }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setAnalysis(null); setSelectedId(null); setResult(null); setRawImage(null);
    setNormalizedOriginal(null); setMetrics(null); setDebugMasks(null); setMaskPreview(null); setShowMask(false); setMode("hair"); setBeardStyle(""); setError(""); setBusy(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const status = busy === "analyze" ? "Fotoğrafın görünür özellikleri inceleniyor…" : busy === "mask" ? "Güvenli düzenleme alanı hazırlanıyor…" : busy === "generate" ? "Gerçekçi önizleme oluşturuluyor…" : null;

  return <main className="min-h-screen bg-[#f4f1ea] text-[#18211f]">
    <header className="border-b border-black/10 bg-[#f4f1ea]/90 px-5 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#173c35] text-xl text-white">S</span><div><p className="text-lg font-black tracking-tight">SANAL SALON</p><p className="text-xs font-semibold text-[#59706a]">Berber Danışmanı</p></div></div><span className="rounded-full border border-[#173c35]/20 px-3 py-1 text-xs font-bold text-[#173c35]">GİZLİLİK ODAKLI</span></div>
    </header>
    <section className="relative overflow-hidden px-5 pb-16 pt-14"><div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#d59b63]/20 blur-3xl" /><div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
      <div className="pt-5"><p className="text-sm font-black tracking-[.22em] text-[#9b6339]">KESİMDEN ÖNCE KARAR VER</p><h1 className="mt-4 text-5xl font-black leading-[.98] tracking-[-.045em] sm:text-7xl">Sana yakışanı<br /><span className="text-[#2d6a5e]">önce gör.</span></h1><p className="mt-6 max-w-xl text-lg leading-8 text-[#55635f]">Portre fotoğrafını yükle, berber danışmanından öneri al ve yalnızca seçtiğin saç veya sakal bölgesinde gerçekçi bir önizleme oluştur.</p><div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-[#52635f]"><span>✓ Fotoğraflar saklanmaz</span><span>✓ Yüz özellikleri korunur</span><span>✓ Mobil uyumlu</span></div></div>
      <div className="rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_28px_80px_rgba(31,48,43,.14)] sm:p-7">
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const dropped = e.dataTransfer.files[0]; if (dropped) selectFile(dropped); }} className="rounded-3xl border-2 border-dashed border-[#2d6a5e]/25 bg-[#eef3f0] p-5 text-center">
          {preview ? <img src={preview} alt="Yüklenen portre" className="mx-auto max-h-[520px] w-full rounded-2xl object-contain" /> : <div className="py-16"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-sm">↥</div><h2 className="mt-5 text-2xl font-black">Portre fotoğrafını yükle</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#687873]">Önden çekilmiş, iyi aydınlatılmış ve tek kişi içeren JPG, PNG veya WEBP.</p></div>}
          <button onClick={() => inputRef.current?.click()} className="mt-4 rounded-full bg-[#173c35] px-6 py-3 font-bold text-white hover:bg-[#24584e]">{file ? "Fotoğrafı değiştir" : "Fotoğraf seç"}</button><input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp"
      capture="user" onChange={onFileChange} /><ul className="mt-3 space-y-1 text-left text-xs text-[#687873]"><li>• Telefon göz hizasında olsun.</li><li>• Yüz ve saç çizgisi tamamen görünsün.</li><li>• Işık önden gelsin, filtre kullanılmasın.</li></ul>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
  <label className="rounded-2xl border border-dashed border-[#2d6a5e]/30 bg-[#eef3f0] p-4 text-left">
    <span className="block text-sm font-bold text-[#173c35]">Sağ profil fotoğrafı</span>
    <span className="mt-1 block text-xs text-[#687873]">
      Kafa yapısını ve şakak geçişlerini daha iyi anlamamız için isteğe bağlıdır.
    </span>
    <input
      className="mt-3 block w-full text-sm"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      onChange={(event) => {
        const next = event.target.files?.[0] ?? null;
        if (rightPreview) URL.revokeObjectURL(rightPreview);
       setRightFile(next);
setRightPreview(next ? URL.createObjectURL(next) : null);
      }}
    />
    {rightPreview && (
      <img
        src={rightPreview}
        alt="45 derece önizleme"
        className="mt-3 h-40 w-full rounded-xl object-cover"
      />
    )}
  </label>

  <label className="rounded-2xl border border-dashed border-[#2d6a5e]/30 bg-[#eef3f0] p-4 text-left">
    <span className="block text-sm font-bold text-[#173c35]">Sol profil fotoğrafı</span>
    <span className="mt-1 block text-xs text-[#687873]">
      Kafanın yan derinliğini ve saç çizgisini değerlendirmek için isteğe bağlıdır.
    </span>
    <input
      className="mt-3 block w-full text-sm"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      onChange={(event) => {
        const next = event.target.files?.[0] ?? null;
        if (leftPreview) URL.revokeObjectURL(leftPreview);
        setLeftFile(next);
        setLeftPreview(next ? URL.createObjectURL(next) : null);
      }}
    />
    {leftPreview && (
      <img
        src={leftPreview}
        alt="Sol profil önizleme"
        className="mt-3 h-40 w-full rounded-xl object-cover"
      />
    )}
  </label>
  <label className="rounded-2xl border border-dashed border-[#2d6a5e]/30 bg-[#eef3f0] p-4 text-left">
  <span className="block text-sm font-bold text-[#173c35]">Arka fotoğraf</span>
  <span className="mt-1 block text-xs text-[#687873]">
    Ense çizgisi, başın arka eğimi ve saç yoğunluğunu değerlendirmek için kullanılır.
  </span>

  <input
    className="mt-3 block w-full text-sm"
    type="file"
    accept="image/jpeg,image/png,image/webp"
      capture="environment"
    onChange={(event) => {
      const next = event.target.files?.[0] ?? null;
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(next);
      setBackPreview(next ? URL.createObjectURL(next) : null);
    }}
  />

  {backPreview && (
    <img
      src={backPreview}
      alt="Arka fotoğraf önizleme"
      className="mt-3 h-40 w-full rounded-xl object-cover"
    />
  )}
</label>
<label className="rounded-2xl border border-dashed border-[#2d6a5e]/30 bg-[#eef3f0] p-4 text-left">
  <span className="block text-sm font-bold text-[#173c35]">Üstten fotoğraf</span>
  <span className="mt-1 block text-xs text-[#687873]">
    Tepe bölgesi, saç ayrımı ve saç yoğunluğunu değerlendirmek için kullanılır.
  </span>

  <input
    className="mt-3 block w-full text-sm"
    type="file"
    accept="image/jpeg,image/png,image/webp"
      capture="environment"
    onChange={(event) => {
      const next = event.target.files?.[0] ?? null;
      if (topPreview) URL.revokeObjectURL(topPreview);
      setTopFile(next);
      setTopPreview(next ? URL.createObjectURL(next) : null);
    }}
  />

  {topPreview && (
    <img
      src={topPreview}
      alt="Üstten fotoğraf önizleme"
      className="mt-3 h-40 w-full rounded-xl object-cover"
    />
  )}
</label>
</div>
        </div>
        <button onClick={analyze} disabled={!file || !!busy} className="mt-4 w-full rounded-2xl bg-[#d59b63] px-5 py-4 text-lg font-black text-[#2d2118] disabled:opacity-45">{busy === "analyze" ? "Danışman inceliyor…" : "Berber Danışmanına Sor"}</button>
      </div>
    </div></section>

    {error && <div role="alert" className="mx-auto mb-8 max-w-3xl px-5"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center font-semibold text-red-800">{error}</div></div>}
    {status && <div aria-live="polite" className="mx-auto mb-10 max-w-xl px-5 text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#2d6a5e]/20 border-t-[#2d6a5e]" /><p className="font-bold text-[#2d6a5e]">{status}</p><p className="mt-1 text-sm text-[#687873]">Bu işlem bir dakika sürebilir.</p></div>}

    {analysis && <section id="analysis" className="scroll-mt-6 border-y border-black/10 bg-[#173c35] px-5 py-16 text-white"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black tracking-[.22em] text-[#e1b181]">Kİ�?İSEL ANALİZ</p><h2 className="mt-2 text-4xl font-black">Berber için net bir yol haritası</h2></div><p className="max-w-md text-sm leading-6 text-white/65">Fotoğrafta açıkça görülen kozmetik özelliklere dayalı yaklaşık değerlendirme.</p></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Yüz formu",analysis.faceShape],["Alın",analysis.forehead],["Çene hattı",analysis.jawline],["Mevcut saç",analysis.existingHair],["Mevcut sakal",analysis.existingBeard]].map(([label,value]) => <div key={label} className="rounded-2xl bg-white/8 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#e1b181]">{label}</p><p className="mt-2 text-sm leading-6">{value}</p></div>)}</div>
      <div className="mt-5 grid gap-5 md:grid-cols-2"><div className="rounded-2xl bg-white/8 p-5"><h3 className="font-black text-[#e1b181]">Sakal önerisi</h3><p className="mt-2 leading-7">{analysis.beardSuggestion}</p></div><div className="rounded-2xl bg-white/8 p-5"><h3 className="font-black text-[#e1b181]">Berber notları</h3><ul className="mt-2 space-y-2 text-sm text-white/80">{analysis.barberNotes.map((note) => <li key={note}>• {note}</li>)}</ul></div></div>
      {analysis.limitations.length > 0 && <p className="mt-5 text-sm text-white/60">Sınırlamalar: {analysis.limitations.join(" • ")}</p>}
      {process.env.NODE_ENV === "development" && debugMasks && showMask && <div className="mx-auto mb-6 grid max-w-6xl gap-2 rounded-2xl border border-amber-300 bg-white p-4 text-sm sm:grid-cols-4"><p>Hair mask area: <b>%{(debugMasks.hair.editableRatio * 100).toFixed(3)}</b></p><p>Beard mask area: <b>%{(debugMasks.beard.editableRatio * 100).toFixed(3)}</b></p><p>Protected pixels: <b>%{(debugMasks[mode].opaqueRatio * 100).toFixed(3)}</b></p><p>Editable pixels: <b>%{(debugMasks[mode].editableRatio * 100).toFixed(3)}</b></p></div>}
      {process.env.NODE_ENV === "development" && metrics && showMask && <div className="mx-auto mb-6 max-w-6xl rounded-2xl border border-amber-300 bg-white p-4 text-sm text-black">Hair region change: <b>%{(metrics.editableRegionChangedPixels * 100).toFixed(3)}</b></div>}
    </div></section>}

    {file && <section className="px-5 py-16"><div className="mx-auto max-w-6xl"><div className="max-w-2xl"><p className="text-xs font-black tracking-[.22em] text-[#9b6339]">MODEL SEÇİMİ</p><h2 className="mt-2 text-4xl font-black">Kesimin karakterini belirle</h2><p className="mt-3 text-[#61706c]">Danışman önerileri puanlarıyla öne çıkar; katalogdan farklı bir model de seçebilirsin.</p></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{BARBER_HAIRSTYLES.map((style) => { const rec = analysis?.recommendedHairstyles.find((item) => item.id === style.id); const active = selectedId === style.id; return <button key={style.id} onClick={() => { setSelectedId(style.id); setResult(null); }} className={`relative min-h-48 rounded-2xl border p-5 text-left transition ${active ? "-translate-y-1 border-[#2d6a5e] bg-[#e3eee9] shadow-lg" : "border-black/10 bg-white hover:border-[#2d6a5e]/40"}`}><div className="flex items-center justify-between"><span className="text-2xl">✂</span>{rec && <span className="rounded-full bg-[#d59b63] px-2 py-1 text-xs font-black">%{rec.suitabilityScore}</span>}</div><h3 className="mt-5 text-xl font-black">{style.name}</h3><p className="mt-2 text-sm leading-6 text-[#63716e]">{rec?.reason ?? style.description}</p>{active && <p className="mt-3 text-xs font-black text-[#2d6a5e]">SEÇİLDİ</p>}</button>; })}</div>
      <div className="mt-12 grid gap-6 rounded-3xl border border-black/10 bg-white p-6 lg:grid-cols-2"><div><h3 className="text-xl font-black">Neyi değiştirelim?</h3><div className="mt-4 grid gap-3">{MODES.map((item) => <button key={item.id} onClick={() => { setMode(item.id); setResult(null); }} className={`rounded-2xl border p-4 text-left ${mode === item.id ? "border-[#2d6a5e] bg-[#e8f0ed]" : "border-black/10"}`}><span className="font-black">{item.label}</span><span className="ml-2 text-sm text-[#667470]">{item.detail}</span></button>)}</div></div><div><h3 className="text-xl font-black">Seçim özeti</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between border-b pb-3"><dt className="text-[#697772]">Saç modeli</dt><dd className="font-black">{mode === "beard" ? "Korunacak" : selected?.name ?? "Seçilmedi"}</dd></div><div className="flex justify-between border-b pb-3"><dt className="text-[#697772]">Düzenleme</dt><dd className="font-black">{MODES.find((item) => item.id === mode)?.label}</dd></div></dl>{mode !== "hair" && <label className="mt-4 block text-sm font-bold">Sakal tercihi (isteğe bağlı)<input value={beardStyle} onChange={(e) => setBeardStyle(e.target.value)} maxLength={160} placeholder="Örn. kısa kirli sakal, doğal hatlar" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal outline-none focus:border-[#2d6a5e]" /></label>}</div></div>
      <button onClick={generate} disabled={!analysis || !!busy || (mode !== "beard" && !selected)} className="mx-auto mt-7 block w-full max-w-2xl rounded-2xl bg-[#173c35] px-6 py-4 text-lg font-black text-white disabled:opacity-40">Yapay Zekâ Önizlemesini Oluştur</button>
      {process.env.NODE_ENV === "development" && maskPreview && <div className="mx-auto mt-5 max-w-6xl text-center"><button onClick={() => setShowMask(!showMask)} className="text-sm font-bold text-[#2d6a5e] underline">{showMask ? "Debug panelini gizle" : "Görsel üretim debug panelini göster"}</button>{showMask && <div className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 p-5 text-left"><h3 className="text-xl font-black">Development: görsel üretim hattı</h3><div className="mt-2 grid gap-2 text-sm sm:grid-cols-3"><p>Boyut: <b>{debugMasks?.hair.width}×{debugMasks?.hair.height}</b></p><p>Aktif edit alanı: <b>%{((debugMasks?.[mode].editableRatio ?? 0) * 100).toFixed(2)}</b></p><p>Feather: <b>%{((debugMasks?.[mode].featherRatio ?? 0) * 100).toFixed(3)}</b></p></div><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{normalizedOriginal && <DebugImage label="1. Normalize orijinal" src={normalizedOriginal} />}{rawImage && <DebugImage label="2. Ham OpenAI çıktısı" src={rawImage} />}{debugMasks && <div className="space-y-3"><DebugImage label="3a. Saç maskesi" src={debugMasks.hair.previewUrl} /><DebugImage label="3b. Sakal maskesi" src={debugMasks.beard.previewUrl} /><DebugImage label="3c. Saç + sakal maskesi" src={debugMasks["hair-and-beard"].previewUrl} /></div>}{result && <DebugImage label="4. Final composited" src={result} />}</div>{metrics && <div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Maske dışı koruma" value={metrics.protectedPixelPreservation} /><Metric label="Yüz merkezi koruma" value={metrics.faceCenterPreservation} /><Metric label="Sakal koruma" value={metrics.beardRegionPreservation} /><Metric label="Ham → final farkı" value={metrics.rawToFinalChangedPixels} /></div>}</div>}</div>}
    </div></section>}

    {result && normalizedOriginal && <section id="result" className="scroll-mt-6 bg-[#e6e0d5] px-5 py-16"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="text-xs font-black tracking-[.22em] text-[#9b6339]">ÖNCE / SONRA</p><h2 className="mt-2 text-4xl font-black">Yeni görünümün hazır</h2></div><div className="mt-8 grid gap-5 md:grid-cols-2">{[["Orijinal",normalizedOriginal],["Sanal önizleme",result]].map(([label,src]) => <figure key={label} className="rounded-3xl bg-white p-4 shadow-sm"><figcaption className="mb-3 font-black">{label}</figcaption><img src={src} alt={label} className="aspect-[4/5] w-full rounded-2xl bg-[#d6d1c8] object-contain" /></figure>)}</div><div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3"><a href={result} download={`sanal-salon-${selected?.id ?? "sakal"}.png`} className="rounded-2xl bg-[#173c35] px-5 py-4 text-center font-black text-white">Sonucu İndir</a><button onClick={() => { setResult(null); setRawImage(null); setMetrics(null); document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-2xl border border-black/15 bg-white px-5 py-4 font-black">Yeni Model Dene</button><button onClick={reset} className="rounded-2xl border border-black/15 px-5 py-4 font-black">Baştan Başla</button></div><p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-6 text-[#65716e]">Bu görüntü dijital ve yaklaşık bir önizlemedir. Gerçek kesim; saç yapısı, uygulama ve ışığa göre farklılık gösterebilir.</p></div></section>}
    <footer className="bg-[#101c19] px-5 py-8 text-center text-sm text-white/55">Fotoğraflar yalnızca talep edilen analiz ve önizleme için işlenir; uygulama tarafından kalıcı olarak saklanmaz.</footer>
  </main>;
}

function DebugImage({ label, src }: { label: string; src: string }) {
  return <figure><figcaption className="mb-2 text-sm font-black">{label}</figcaption><img src={src} alt={label} className="max-h-80 w-full rounded-xl bg-black/10 object-contain" /></figure>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-lg font-black">%{(value * 100).toFixed(3)}</p></div>;
}

