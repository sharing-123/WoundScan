# WoundScan

Aplikasi web untuk IGD dan poli: segmentasi luka dari foto, ukuran terkalibrasi (cm², %TBSA), komposisi dasar luka,
rekomendasi tata laksana per jenis luka, dan **marking rencana bedah plastik** (jahitan, fusiform, flap, Z-plasti, cangkok)
dengan simulasi hasil dan lembar rencana operasi. Semua berjalan di browser (offline, foto tidak dikirim ke server).

## Jalankan lokal
```bash
python serve.py          # buka http://localhost:8765
```
Windows: klik dua kali `jalankan.bat`. Dari ponsel di Wi-Fi yang sama: `http://<IP-komputer>:8765`.

## Deploy ke Vercel
1. Push repo ini ke GitHub (disarankan **privat**, lihat peringatan lisensi di bawah).
2. Vercel > Add New > Project > impor repo. Framework Preset: **Other**. Biarkan Build Command kosong.
   `vercel.json` sudah mengatur `outputDirectory` ke `app`.
3. Deploy. HTTPS dari Vercel membuat kamera dan instalasi PWA berfungsi di ponsel.

## Cara pakai singkat
1. **Foto luka** (sertakan penggaris, kartu ID-1, atau telapak tangan; atau isi jarak kamera).
2. Segmentasi otomatis; koreksi dengan **Ketuk luka**, **Tambah**/**Hapus** bila perlu.
3. **Skala**: tandai dua titik berjarak diketahui, telapak tangan (0,8% BSA), atau jarak kamera + f35.
4. Isi tab **Klinis** (TB, BB, jenis dan regio luka, tanda infeksi, struktur terpapar).
5. Tab **Bedah**: teknik rekomendasi atau pilih manual, lihat **Marking bedah** dan **Simulasi hasil**, ekspor **lembar rencana operasi (PNG)**.

## Graft, flap, dan donor
Tab **Bedah** memutuskan graft atau flap dengan alasan eksplisit, lalu memberi angka:
* **Keputusan**: dasar siap atau belum, struktur terpapar, osteomielitis, radiasi, regio/zona, ukuran (anak tangga rekonstruksi).
* **STSG**: luas donor dibutuhkan (template / rasio mesh) dibanding luas tersedia (BSA x fraksi regio Lund-Browder x fraksi dapat-dipakai),
  dimensi strip, jumlah lintasan, sisi (kontralateral bila ekstremitas sama).
* **FTSG**: elips donor (rasio 3:1) dicocokkan ke batas donor (supraklavikula, pascaaurikular, lipat paha, dst.).
* **Flap**: peringkat lokal, regional, bebas menurut regio, sepertiga tungkai, ukuran, DM/PAD/radiasi/perokok; ukuran paddle (defek + 5 mm, +10%).
* **Peta donor**: manekin depan/belakang berskala tinggi badan pasien dengan lokasi donor bernomor dan dimensi (cm).
Angka donor/flap adalah ringkasan literatur umum dan harus dikonfirmasi pada pasien (laksitas, perforator via Doppler/CTA).
Modul `donor.js` dan `bodymap.js` menerima tinggi/BSA; keluaran pemindai seluruh tubuh dapat menggantikan asumsi proporsi.

## Akurasi (jujur)
* Model segmentasi (U-Net MobileNetV2, 256 px): Dice 0,827 / IoU 0,744 pada validasi FUSeg (median galat luas 11,5%);
  uji eksternal Medetec Dice 0,793. Lemah pada luka tusuk kecil, abrasi tipis, dan lesi ulseratif keganasan.
* Geometri ukur diuji pada bentuk analitik: galat luas <= 0,07%, keliling <= 0,2%.
* **Satu foto tanpa skala tidak dapat memberi ukuran absolut.** Skala adalah syarat; galat skala ± 2% (penggaris/kartu),
  ± 8% (jarak kamera), ± 10% (telapak tangan) pada panjang. Angka ditampilkan dengan ± ketidakpastian.
* Marking bedah adalah **usulan geometri dari foto 2D**: laksitas kulit, perfusi, kelengkungan, dan arah garis kulit
  tidak terukur. Konfirmasi dan sesuaikan pada pasien. Simulasi hasil bersifat ilustratif.
* Keganasan tidak dapat diputuskan dari foto: hanya penanda kecurigaan dan saran biopsi/margin.

## Lisensi dan data (penting)
* Model dilatih dari **WoundSeg (CC BY-NC 4.0)** dan **FUSeg (tanpa lisensi tertulis)**. Bobot turunannya sebaiknya
  diperlakukan **nonkomersial / riset**. Untuk layanan klinis resmi, minta izin penulis data atau latih ulang dengan data sendiri.
* Dataset **EBIS** (luka bakar) butuh permintaan akademik ke pemiliknya dan tidak disertakan.
* Kode belum memiliki lisensi; tambahkan `LICENSE` sesuai pilihan Anda.
* `onnxruntime-web` (MIT) dikemas di `app/lib`.

## Struktur
```
app/            situs statis (HTML, JS, model ONNX, onnxruntime-web)
  js/           geom, seg, tissue, render, clinical, knowledge, planner, sim, surg-ui, app
  models/       wound_seg.onnx + meta.json (metrik)
train/          skrip pelatihan dan evaluasi (butuh data sendiri di data/)
serve.py        server lokal tanpa cache
vercel.json     konfigurasi Vercel
```

## Latih ulang
Letakkan data di `data/` (lihat `train/train.py`), lalu:
```bash
python train/train.py round1 16 && python train/train.py refine && python train/train.py round2 7
```
Hasil: `models/wound_seg.onnx`; salin ke `app/models/`.
