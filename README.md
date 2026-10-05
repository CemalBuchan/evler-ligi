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

## Veriyi GitHub'dan elle düzenleme

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
"tiebreakOverrides": [["inter", "atletico"]],
```

### Gol atanlar (elle)

Oynanan maçın `scorers` listesine yazılır (skor yine `homeGoals`/`awayGoals`'dan gelir; liste toplamı skordan küçük olabilir):

```json
"scorers": [{"team": "psg", "player": "Alparslan", "goals": 2}]
```

### Oyuncu isimleri

`teams` altında ilgili takımın `players` dizisini doldur:

```json
"players": ["Ali", "Veli"]
```

### Takım id'leri

`psg`, `real`, `inter`, `atletico`, `barca`, `city`

## Admin modu (sitenin içinden skor girme)

Sağ altta soluk bir **kilit** düğmesi var. Giriş yapınca her maçta **"Maçı düzenle"** çıkar: durum (bekliyor / oynandı / ertelendi / hükmen), skor, **gol atan oyuncular**, erteleyen takım, hükmen sonucu, tarih ve maçın evi ayarlanır. **Kaydet** deyince değişiklik `data/league.json`'a otomatik commit olur ve 1–2 dakikada herkese yansır. Elle JSON düzenlemene gerek kalmaz (istersen yine yapabilirsin).

**Nasıl çalışıyor:** Sunucu olmadığı için kaydetme GitHub üzerinden yapılır. Yazma izni olan bir GitHub token'ı, **seçtiğin kullanıcı adı + parola ile şifrelenip** `data/admin.json` olarak repoya konur. Siteye bu kullanıcı adı ve parolayı giren herkes admin olur; site token'ın şifresini çözüp kaydı yapar. Düz metin token ya da parola repoda yoktur.

> **Dikkat:** Parola basitse (ör. `ruhi123`) şifre bilgisayarla kolayca kırılabilir; bilen biri token'ı çıkarıp repoyu değiştirebilir. Zararı sadece bu repoyla sınırlı (token'ı aşağıdaki gibi tek repoya ve sadece Contents iznine kısıtla). Arkadaş ligi için yeterli bir tercih; istersen daha uzun bir parola seç.

**İlk kurulum (bir kez)**
1. Aşağıdaki gibi bir token oluştur.
2. Yayındaki sitede kilit düğmesi → **İlk kurulum (sadece bir kez)** → token'ı, repoyu (`kullanici/evler-ligi`, otomatik dolar) ve seçeceğin **admin kullanıcı adı + parolasını** yaz → **Kurulumu yap**.
3. Bir dakika sonra yukarıdaki forma bu kullanıcı adı + parolayla giriş yap.

Parolayı değiştirmek ya da token süresi dolunca yenilemek için aynı kurulumu yeni bilgilerle tekrarla.

**Token oluşturma (bir kez, ~2 dk)**
1. GitHub → sağ üst profil → **Settings** → en altta **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Token name: `evler-ligi-admin`. Expiration: istediğin süre (ör. 1 yıl).
3. **Repository access** → *Only select repositories* → sadece `evler-ligi`.
4. **Permissions** → *Repository permissions* → **Contents: Read and write**.
5. **Generate token**; çıkan `github_pat_...` kodunu kopyala (bir daha gösterilmez) ve kurulum formundaki "GitHub token" alanına yapıştır.

"Bu cihazda hatırla" işaretliyse oturum o telefonun tarayıcısında saklanır, bir daha sorulmaz. Başkasının cihazında işaretleme; **Çıkış** düğmesi (sarı şerit) oturumu siler. Token kaybolursa ya da sızarsa GitHub'dan silip yenisini üretip kurulumu tekrarla.

**Gol atanlar:** skor girerken oyuncuların yanındaki **+** ile golü yaz; takımın skoru kendiliğinden artar. Kendi kalesine gol gibi kimin attığı belli olmayan goller için üstteki takım skorunu **+** ile artır. "Gol krallığı" Tablo ve Ana sayfada, oyuncunun gol sayısı da takım sayfasında görünür.

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
