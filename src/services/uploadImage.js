// src/services/uploadImage.js
// Firebase Storage'a REST API üzerinden görsel yükler. @react-native-firebase/storage
// gibi ayrı bir native modül (ve dolayısıyla yeni bir native build) gerektirmez —
// projenin zaten kullandığı Firebase Storage bucket'ına düz bir HTTPS isteğiyle yazar.
const STORAGE_BUCKET = "davinci-d30bc.firebasestorage.app";

// `key`: Storage'daki dosya adını belirler — çağıran taraf, aynı kelimeye
// birden fazla özel fotoğraf eklenebildiği için genelde benzersiz bir
// değer (ör. "${word.id}_${Date.now()}") geçer, böylece önceki yüklemelerin
// üzerine yazılmaz.
export async function uploadWordImage(localUri, key) {
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();
  const mime = blob.type || "image/jpeg";
  // Uzantı içeriğin gerçek tipine bakılmaksızın hep .jpg — dosya adındaki
  // uzantı sunuma etki etmiyor, Content-Type header'ı zaten doğru mime ile
  // ayarlanıyor.
  const path = `word-images/${key}.jpg`;

  const uploadRes = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(
      path
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": mime },
      body: blob,
    }
  );
  if (!uploadRes.ok) {
    throw new Error(`Fotoğraf yüklenemedi (HTTP ${uploadRes.status})`);
  }
  const data = await uploadRes.json();
  const token = data.downloadTokens;
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(
    path
  )}?alt=media${token ? `&token=${token}` : ""}`;
}

const STORAGE_URL_PREFIX = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/`;

// Admin, foto havuzundan bizim Storage'a yüklediğimiz bir fotoğrafı
// kaldırdığında, Storage'daki dosyayı da gerçekten siler (sadece
// Firestore'daki referansı temizlemekle kalmaz). Pexels linki gibi bizim
// yüklemediğimiz harici bir URL verilirse sessizce hiçbir şey yapmaz.
export async function deleteWordImageByUrl(url) {
  if (!url || !url.startsWith(STORAGE_URL_PREFIX)) return;
  const path = url.slice(STORAGE_URL_PREFIX.length).split("?")[0];
  const res = await fetch(`${STORAGE_URL_PREFIX}${path}`, { method: "DELETE" });
  // 404: zaten silinmiş/hiç yüklenmemiş — hata sayılmaz.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Fotoğraf silinemedi (HTTP ${res.status})`);
  }
}
