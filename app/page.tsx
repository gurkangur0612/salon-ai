"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

const hairStyles = [
  { id: "buzz-cut", name: "Buzz Cut", description: "Kısa, sade ve bakımı kolay.", emoji: "✂️" },
  { id: "low-fade", name: "Low Fade", description: "Yanlarda düşük seviyeden başlayan geçiş.", emoji: "💈" },
  { id: "mid-fade", name: "Mid Fade", description: "Dengeli ve modern orta geçiş.", emoji: "🔥" },
  { id: "high-fade", name: "High Fade", description: "Belirgin ve keskin yüksek geçiş.", emoji: "⚡" },
  { id: "french-crop", name: "French Crop", description: "Kısa üst ve öne doğru şekillendirme.", emoji: "🇫🇷" },
  { id: "crew-cut", name: "Crew Cut", description: "Klasik ve düzenli kısa saç modeli.", emoji: "👦" },
  { id: "quiff", name: "Quiff", description: "Ön tarafı hacimli ve yukarı şekillendirilmiş.", emoji: "🌊" },
  { id: "pompadour", name: "Pompadour", description: "Hacimli, dikkat çekici ve klasik.", emoji: "👑" },
  { id: "slick-back", name: "Slick Back", description: "Saçların geriye doğru tarandığı şık görünüm.", emoji: "✨" },
  { id: "undercut", name: "Undercut", description: "Yanlar kısa, üst kısım belirgin uzun.", emoji: "🎯" },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showHairStyles, setShowHairStyles] = useState(false);
  const [selectedHairStyle, setSelectedHairStyle] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
const [analysisError, setAnalysisError] = useState("");
const [analysisResult, setAnalysisResult] = useState<{
  faceShape: string;
  forehead: string;
  jawline: string;
  beardSuggestion: string;
  recommendedHairstyles: string[];
} | null>(null);

  const selected = useMemo(
    () => hairStyles.find((item) => item.id === selectedHairStyle) ?? null,
    [selectedHairStyle]
  );

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Lütfen JPG, PNG veya WEBP formatında bir fotoğraf seç.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Fotoğraf 10 MB'dan küçük olmalıdır.");
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowHairStyles(false);
    setSelectedHairStyle(null);
    setGeneratedImage(null);
    setErrorMessage("");
  }

  function handleShowHairStyles() {
    if (!selectedFile) return;

    setShowHairStyles(true);
    setTimeout(() => {
      document.getElementById("hair-styles")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function handleCreatePreview() {
    if (!selectedFile || !selected) {
      setErrorMessage("Önce fotoğraf ve saç modeli seç.");
      return;
    }

    try {
      setIsGenerating(true);
      setGeneratedImage(null);
      setErrorMessage("");

      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("hairstyle", selected.name);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        image?: string;
        error?: string;
      };

      if (!response.ok || !data.success || !data.image) {
        throw new Error(data.error || "Görsel oluşturulamadı.");
      }

      setGeneratedImage(data.image);

      setTimeout(() => {
        document.getElementById("result")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `SalonAI-${selected?.id ?? "sonuc"}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(null);
    setPreviewUrl(null);
    setShowHairStyles(false);
    setSelectedHairStyle(null);
    setGeneratedImage(null);
    setErrorMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-700 to-violet-700 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-16 flex items-center justify-between">
          <h1 className="text-3xl font-black">SalonAI</h1>
          <span className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold">
            MVP
          </span>
        </header>

        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold tracking-[0.22em] text-violet-200">
            YAPAY ZEKÂ DESTEKLİ SAÇ ÖNİZLEME
          </p>

          <h2 className="mt-5 text-5xl font-black leading-tight md:text-7xl">
            Yeni saç modelini
            <br />
            kesimden önce gör
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-blue-100">
            Müşteri fotoğrafını yükle, saç modelini seç ve yapay zekâ destekli
            önizleme oluştur.
          </p>

          <div className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
            <div className="rounded-2xl border-2 border-dashed border-white/30 px-6 py-10">
              <div className="text-5xl">📸</div>
              <h3 className="mt-4 text-2xl font-bold">Müşteri fotoğrafını yükle</h3>
              <p className="mt-2 text-blue-100">
                Önden çekilmiş, net bir JPG, PNG veya WEBP fotoğraf seç.
              </p>

              <label className="mt-6 inline-block cursor-pointer rounded-xl bg-white px-6 py-3 font-extrabold text-blue-900">
                Fotoğraf Seç
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <p className="mt-4 break-words text-sm text-violet-100">
                  Seçilen dosya: {selectedFile.name}
                </p>
              )}
            </div>

            {previewUrl && (
              <div className="mt-6">
                <h3 className="mb-4 text-xl font-bold">Fotoğraf önizlemesi</h3>
                <img
                  src={previewUrl}
                  alt="Yüklenen müşteri fotoğrafı"
                  className="mx-auto max-h-[600px] w-full rounded-2xl bg-slate-900/50 object-contain"
                />
              </div>
            )}

            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleShowHairStyles}
              className="mt-6 w-full rounded-xl bg-slate-950 px-6 py-4 text-lg font-extrabold transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Saç Modellerini Göster
            </button>
          </div>
        </section>

        {showHairStyles && (
          <section id="hair-styles" className="mt-20 scroll-mt-6">
            <div className="text-center">
              <p className="text-sm font-extrabold tracking-[0.22em] text-violet-200">
                SAÇ MODELİNİ SEÇ
              </p>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                Müşteriye uygun modeli belirle
              </h2>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {hairStyles.map((hairStyle) => {
                const isSelected = selectedHairStyle === hairStyle.id;

                return (
                  <button
                    key={hairStyle.id}
                    type="button"
                    onClick={() => {
                      setSelectedHairStyle(hairStyle.id);
                      setGeneratedImage(null);
                      setErrorMessage("");
                    }}
                    className={`min-h-52 rounded-2xl p-6 text-left transition ${
                      isSelected
                        ? "-translate-y-1 border-2 border-white bg-white/25"
                        : "border border-white/20 bg-white/10 hover:bg-white/15"
                    }`}
                  >
                    <div className="text-4xl">{hairStyle.emoji}</div>
                    <h3 className="mt-4 text-xl font-bold">{hairStyle.name}</h3>
                    <p className="mt-2 leading-6 text-blue-100">
                      {hairStyle.description}
                    </p>
                    {isSelected && (
                      <strong className="mt-4 block">✓ Seçildi</strong>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!selectedHairStyle || isGenerating}
              onClick={handleCreatePreview}
              className="mx-auto mt-8 block w-full max-w-2xl rounded-xl bg-white px-6 py-4 text-lg font-extrabold text-blue-900 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating
                ? "Yapay zekâ önizlemesi hazırlanıyor…"
                : "Yapay Zekâ Önizlemesini Oluştur"}
            </button>

            {errorMessage && (
              <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-red-200/40 bg-red-950/70 p-4 text-center">
                {errorMessage}
              </div>
            )}
          </section>
        )}

        {generatedImage && previewUrl && (
          <section id="result" className="mt-20 scroll-mt-6">
            <div className="text-center">
              <p className="text-sm font-extrabold tracking-[0.22em] text-violet-200">
                SONUÇ
              </p>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                {selected?.name} önizlemesi
              </h2>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/20 bg-white/10 p-5">
                <h3 className="mb-4 text-xl font-bold">Önce</h3>
                <img
                  src={previewUrl}
                  alt="Orijinal fotoğraf"
                  className="max-h-[620px] w-full rounded-2xl bg-slate-900/50 object-contain"
                />
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-5">
                <h3 className="mb-4 text-xl font-bold">Yapay zekâ önizlemesi</h3>
                <img
                  src={generatedImage}
                  alt="Oluşturulan saç modeli"
                  className="max-h-[620px] w-full rounded-2xl bg-slate-900/50 object-contain"
                />
              </div>
            </div>

            <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-xl bg-white px-6 py-4 text-lg font-extrabold text-blue-900 transition hover:bg-blue-50"
              >
                Sonucu İndir
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-white/30 bg-white/10 px-6 py-4 text-lg font-extrabold transition hover:bg-white/20"
              >
                Yeni Deneme
              </button>
            </div>

            <p className="mt-5 text-center text-sm text-violet-100">
              Bu görsel yapay zekâ tarafından oluşturulan yaklaşık bir önizlemedir.
              Gerçek kesim sonucu farklı olabilir.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
