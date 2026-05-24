# 🎬 YouTube Auto Interaction Extension

Extension Chrome untuk interaksi otomatis di YouTube: nonton video, auto like, dan auto komentar dengan komentar random.

## Fitur

- ▶️ **Auto Watch** - Menonton video secara otomatis selama durasi yang ditentukan
- 👍 **Auto Like** - Otomatis like video yang sedang ditonton
- 💬 **Auto Comment** - Otomatis berkomentar dengan komentar random dari daftar yang bisa dikustomisasi
- ⏭️ **Auto Next** - Otomatis pindah ke video selanjutnya
- 📋 **Activity Log** - Log aktivitas real-time
- ⚙️ **Configurable** - Durasi tonton & delay bisa diatur

## Cara Install

1. Buka Chrome dan ketik `chrome://extensions/` di address bar
2. Aktifkan **Developer Mode** (toggle di pojok kanan atas)
3. Klik **"Load unpacked"**
4. Pilih folder `extention-interaksi-youtube` ini
5. Extension siap digunakan!

## Cara Pakai

1. Buka YouTube (https://www.youtube.com)
2. Klik icon extension di toolbar Chrome
3. Atur pengaturan sesuai keinginan:
   - Centang fitur yang ingin diaktifkan (like, komentar, next video)
   - Atur durasi tonton (berapa detik menonton sebelum interaksi)
   - Atur delay antar aksi
4. Tambahkan/edit daftar komentar random
5. Klik **"Mulai"** untuk memulai bot
6. Klik **"Berhenti"** untuk menghentikan

## Pengaturan

| Setting | Default | Keterangan |
|---------|---------|------------|
| Auto Like | ✅ On | Otomatis like video |
| Auto Komentar | ✅ On | Otomatis komentar |
| Auto Next | ✅ On | Otomatis pindah video |
| Durasi Tonton | 30 detik | Berapa lama menonton sebelum aksi |
| Delay Aksi | 3 detik | Jeda antar setiap aksi |

## Daftar Komentar

Extension sudah menyediakan 15 komentar default dalam Bahasa Indonesia. Kamu bisa:
- **Menambah** komentar baru via input field
- **Menghapus** komentar yang tidak diinginkan
- **Reset** ke daftar default

## Catatan Penting

⚠️ **Disclaimer:**
- Extension ini dibuat untuk tujuan edukasi
- Pastikan kamu sudah login ke akun YouTube sebelum menggunakan fitur komentar
- Penggunaan bot berlebihan bisa menyebabkan akun terkena limitasi dari YouTube
- Gunakan dengan bijak dan bertanggung jawab

## Struktur File

```
extention-interaksi-youtube/
├── manifest.json      # Konfigurasi extension
├── popup.html         # UI popup extension
├── popup.js           # Logic popup
├── content.js         # Script interaksi YouTube
├── background.js      # Service worker
├── styles.css         # Styling popup
├── icons/             # Icon extension
└── README.md          # Dokumentasi
```

## Icon

Untuk icon, kamu perlu menyediakan file PNG:
- `icons/icon16.png` (16x16 px)
- `icons/icon48.png` (48x48 px)
- `icons/icon128.png` (128x128 px)

Bisa buat sendiri atau buka file `icons/generate-icons.html` di browser, lalu save canvas sebagai PNG.
