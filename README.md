# Evler Ligi · FC 27

Arkadaşlar arası FC 27 ligi için mobil öncelikli, statik web sitesi. Sunucu ve veritabanı yok: tüm veri [`data/league.json`](data/league.json) dosyasında. Puan tablosu, form ve kalan erteleme hakkı bu dosyadan tarayıcıda hesaplanır.

```
index.html          sayfa iskeleti
css/style.css       tasarım
js/standings.js     hesaplama (puan, averaj, ikili maçlar, erteleme)
js/views.js         sayfa çizimleri
js/app.js           yönlendirme, "takımım" hafızası
data/league.json    TÜM LİG VERİSİ (sadece bunu düzenlersin)
```

## Veriyi GitHub'dan düzenleme

1. GitHub'da repoyu aç → `data` → `league.json` → sağ üstte **kalem (Edit)** simgesi.
2. `Ctrl+F` ile maçı bul (ör. `"id": "m07"`). Her maç tek satırdır.
3. Aşağıdaki tariflerden birini uygula, sağ üstten **Commit changes…** → **Commit changes** de.
4. 1–2 dakika içinde site güncellenir (telefonda yenile).

> Dikkat: JSON'da tırnaklar `"` ve alanlar arası virgüller aynen kalmalı. Sayılar tırnaksız (`2`), metinler tırnaklı (`"oynandı"`), boş değer `null`. Emin değilsen kaydettikten sonra siteyi aç; veri hatalıysa "Veri yüklenemedi" yazar, dosyayı düzeltip tekrar kaydet.

### Skor girme

Maç satırında `homeGoals`, `awayGoals` ve `status` değişir. İsteğe bağlı `playedOn` (oynandığı tarih, `YYYY-MM-DD`).

```json
{"id": "m01", "round": 1, "home": "psg", "away": "city", "venue": "Vermo", "homeGoals": 2, "awayGoals": 1, "status": "oynandı", "postponedBy": null, "playedOn": "2026-10-16", "forfeitWinner": null}
```

Skor ekranının fotoğrafı gruba atılmadıysa maçı kaydetme.

### Erteleme

Maç ertelenince `status` → `"ertelendi"`, `postponedBy` → erteleyen takımın id'si. Skorlar `null` kalır. Maç tabloya girmez, o takımın erteleme hakkından 1 düşer.

```json
{"id": "m07", ..., "homeGoals": null, "awayGoals": null, "status": "ertelendi", "postponedBy": "real", "playedOn": null, "forfeitWinner": null}
```

**Ertelenen maç sonradan oynanınca:** skoru gir, `status` → `"oynandı"`, `playedOn` → tarih. **`postponedBy`'ı silme**; hak geri gelmez, site "ertelenmişti" diye gösterir. Bir takım 6'dan fazla erteleme yaparsa fikstürde ve takım sayfasında uyarı çıkar.

### Hükmen

- **Biri gelmedi:** `status` → `"hükmen"`, `forfeitWinner` → kazanan takımın id'si. Maç 3-0 sayılır; `homeGoals`/`awayGoals` boş kalabilir.
- **İki taraf da gelmedi:** `status` → `"hükmen"`, `forfeitWinner` → `null`. İki takıma 0 puan verilir, maç oynanmış sayılır (0-0).

```json
{"id": "m09", ..., "status": "hükmen", "postponedBy": "city", "forfeitWinner": "real"}
```

Telafide oynanmayan ertelenmiş maçta `postponedBy` genelde zaten doludur; engelleyen taraf yenik sayılır, yani `forfeitWinner` karşı takım olur.

### Eşitlikte penaltı sonucu

Puan, averaj, atılan gol ve ikili maçlar da eşit bırakırsa tabloda ilgili takımlarda `=` işareti çıkar. Penaltı oynayıp sonucu `tiebreakOverrides` içine **üstteki takım önde olacak şekilde** yaz:

```json
"tiebreakOverrides": [["inter", "bayern"]],
```

### Oyuncu isimleri

`teams` altında ilgili takımın `players` dizisini doldur:

```json
"players": ["Ali", "Veli"]
```

### Takım id'leri

`psg`, `real`, `inter`, `bayern`, `barca`, `city`

## Yerelde çalıştırma

`index.html`'i çift tıklayarak açma: tarayıcılar `file://` üzerinden JSON okutmaz. Küçük bir sunucu yeterli (Python gerekir):

```bash
python -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` aç. Durdurmak için terminalde `Ctrl+C`.

**Tarih simülasyonu:** `http://localhost:8000/?bugun=2026-11-20` gibi bir adres siteyi o güne göre gösterir (hangi hafta "şu anki hafta" olur, vb.). Yayındaki sitede de çalışır.

## GitHub Pages'e yayınlama

Build adımı yok, Actions gerekmiyor.

1. GitHub'da yeni bir repo oluştur (Public; ücretsiz hesapta Pages için gerekir) ve bu klasörü yükle:
   ```bash
   git remote add origin https://github.com/KULLANICI/evler-ligi.git
   git push -u origin main
   ```
2. Repo → **Settings** → **Pages**.
3. **Build and deployment** → Source: **Deploy from a branch**; Branch: **main**, klasör **/ (root)** → **Save**.
4. Birkaç dakika sonra site `https://KULLANICI.github.io/evler-ligi/` adresinde yayında. Bu adresi gruba at.
5. Her `league.json` değişikliği (commit) siteyi otomatik günceller.

Herkes kendi takımını üst menüden seçer; seçim o telefonun tarayıcısında hatırlanır.
