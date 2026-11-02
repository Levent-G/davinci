# Ortak kelime veritabanı

Firebase projesi `davinci-d30bc`, Firestore koleksiyonu `words`, bütün projelerin tek kelime kaynağıdır. Şu an bu koleksiyonu davinci, QORVEX ve Word Duel kullanıyor. Kelimeler davinci admin panelinden düzenleniyor. İleride kurulacak masaüstü admin paneli de bu şemayı kullanmalı.

## Belge şeması

| Alan | Tür | Sahibi | Açıklama |
|---|---|---|---|
| `word` | string | ortak | İngilizce kelime, küçük harf |
| `translation` | string | ortak | Ana Türkçe çeviri. Birden fazlaysa virgülle ayrılır |
| `meanings` | string[] | ortak | Ek Türkçe anlamlar (isteğe bağlı) |
| `level` | `A1`…`C2` | ortak | CEFR seviyesi. Bütün projeler bu tek seviyeyi kullanır |
| `levelSource` | string | ortak | Seviyenin kaynağı: `cefr` (CEFR-J / Octanove listesi), `legacy` (eski seviye korundu) ya da `admin` (elle düzeltildi) |
| `freqRank` | number | ortak | Kullanım sıklığı sırası (1 = en yaygın), kaynağı Tatoeba. Aynı seviyedeki kelimeleri sıralamak için kullanılır |
| `example` / `exampleTr` | string | ortak | Ana örnek cümle ve Türkçesi |
| `examples` | `{en,tr}[]` | ortak | Ek örnek cümleler (isteğe bağlı) |
| `partOfSpeech` | string | ortak | `noun`, `verb`, `adjective`… |
| `category` | string | ortak | Konu (`food`, `travel`, `other`…) |
| `ipa` | string | ortak | Okunuş (isteğe bağlı) |
| `imageUrl` | string | ortak | Seçili fotoğraf |
| `photos` | string[] | ortak | Fotoğraf havuzu |
| `clue` | string (≤18) | QORVEX | Bulmaca ipucu. Boşsa kelime bulmacada kullanılmaz |
| `qorvexPos` | string | QORVEX | Yalnızca bulmacadaki tür `partOfSpeech`'ten farklıysa |
| `apps` | `{ [proje]: bool }` | ortak | `false` ise kelime o projede gizlenir. Alan yoksa kelime görünür |
| `source` | string | — | Kaydın kaynağı: `seed`, `admin` ya da `qorvex` |
| `createdAt` / `updatedAt` | timestamp | — | Oluşturulma ve güncellenme zamanı |

Kurallar:
- Ortak alanlar her projede aynı anlamda kullanılır. Bir proje yalnızca ihtiyaç duyduğu alanları okur.
- Projeye özel bir alan gerekiyorsa adı proje adıyla başlar (örneğin `qorvexPos`). Ortak alanın anlamı değiştirilmez.
- Admin panelinde bir kelimenin seviyesi elle değiştirilirse `levelSource: 'admin'` yazılmalı. Böylece ileride CEFR'e göre yapılan güncellemeler bu seviyeyi ezmez.
- Yeni bir proje bu koleksiyonu kullanmaya başladığında `apps.<proje>` bayrağıyla kelimeleri gizleyebilir.
- Kullanıcı ilerlemesi kelime belgesinde tutulmaz. Her proje bunu kendi koleksiyonunda saklar (davinci için `userProgress`).

## Projeler

- **davinci:** Uygulama Firestore'dan seviye seviye okur ve 24 saat önbellekte tutar. Admin panelinde ortak alanların yanında QORVEX ipucu ve okunuş da düzenlenebilir.
- **QORVEX:** Uygulama çalışırken Firebase'e bağlanmaz. Build almadan önce `npm run words:pull` komutu Firestore'daki kelimeleri `src/data/words.json` dosyasına yazar (betik: `scripts/firebase-words.mjs`). Bu komut için servis hesabı anahtarı gerekir. Anahtar repoların dışında tutulur ve asla commit'lenmez.
- **Word Duel:** Uygulama çalışırken bu veritabanına bağlanmaz. Çevrimiçi maçlar ayrı bir Firebase projesinde (`focus`, Realtime Database) oynanır. Build almadan önce `npm run words` komutu kelimeleri `src/data/words.json` dosyasına yazar (betik: `scripts/pull-words.mjs`). Bu betik `translation`, `level`, `example` ve `partOfSpeech` alanlarını okur. Kelimeyi bu uygulamada gizlemek için `apps.wordduel: false` kullanılır. Oyuncu geçmişleri kelime kimliğiyle tutulduğu için, daha önce çekilmiş bir kelime Firestore'da başka bir kimlikle gelse bile eski kimliğini korur. Çevrimiçi maçta sorular kelime verisiyle birlikte gönderilir. Böylece sözlüğü daha eski olan rakip de oynayabilir.
