# MOTION-CATALOG-1

Katalog lengkap gerakan, efek visual, dan mesin 3D untuk WoundScan, ditambah katalog acuan dari proyek FaceStudio (wajah). Dipakai sebagai peta: apa yang sudah ada, di berkas mana, dengan angka berapa, dan apa yang sengaja tidak ditambahkan. Disimpan 2026-11-23, commit dasar `b66f9f8`.

Aturan utama: gerakan harus menjelaskan sesuatu (ukuran, lapisan, tahap operasi), bukan sekadar hiasan. Semua efek mati untuk `prefers-reduced-motion`, efek pointer mati di layar sentuh, dan halaman tetap terbaca tanpa WebGL.

---

## BAGIAN A. WoundScan (yang sudah berjalan)

### A1. Mesin dunia scroll
* Satu scene Three.js yang menetap; kamera, cahaya, material, dan objek berubah antar bab. Tidak ada pergantian scene. Berkas: `web/src/world/index.ts`, `choreography.ts`.
* `evaluate(chapters, scrollY, vh)` adalah fungsi murni dari posisi scroll, jadi scroll mundur memutar balik semuanya (reversibel).
* 7 kunci keadaan (`KEYS`), berurutan menurut DOM: `hero`, `layers`, `scan`, `measure`, `plan`, `body`, `private`.
* Setiap kunci memuat: `cam`, `tgt`, `fov`, `shiftX` (subjek didorong ke samping), `cut`, `outline`, `doubt`, `iso`, `mask`, `ruler`, `block`, `tile`, `body`, `lens`, `lensX`, `lensY`, `pulse`, `pulseR`, `explode`, `beam`, `span`.
* Antar bab: `f = easeInOut(clamp((u - 0.2) / 0.6))`, artinya 20 persen di awal dan akhir tiap bab "menahan" posisi (plateau) sebelum kamera pindah.
* Kamera melengkung selama penerbangan: `cam.y += sin(pi * f) * 1.4`, supaya bergerak, bukan meluncur lurus.
* Progres turunan: `scanProg` (bab 3, `scanX` dari -6,4 ke 6,8), `zp` (Z-plasti, bab 5), `bp` (tubuh, bab 6), `rulerP`.
* Napas kamera genggam (handheld breathing) sangat kecil; resolusi adaptif (lihat A4).

### A2. Objek 3D di dunia
| Objek | Berkas | Isi |
|---|---|---|
| Blok kulit | `skin.ts`, `textures.ts` | blok berlapis (epidermis, dermis, lemak, otot), kawah luka nyata, tekstur prosedural |
| Luka | `wound.ts` | kontur, isolines (iso), area "ragu" (doubt), topeng (mask) |
| Penggaris | `ruler.ts` | penggaris 3D dengan angka, dipakai bab ukuran |
| Z-plasti | `zplasty.ts` | dua segitiga flap yang berputar dan bertukar tempat |
| Tubuh | `body.ts` | manekin dan peta area tubuh |
| Lensa | `lens.ts` | lensa pemindai yang bergerak (`lensX`, `lensY`) mengikuti `scanX` |
| Label | `tags.ts` | label 3D yang menempel pada titik (Area, Width, Length) |
| Lantai dan cahaya | `index.ts` | pantulan planar di bawah piringan, beam cahaya, lapisan terurai (explode 1,15) di bab layers |

### A3. Kerja pasca (post-processing)
* `EffectComposer`, bingkai `HalfFloatType`, multisampling 4 (0 di layar sentuh kasar).
* Bloom: intensitas 0,85, ambang 0,82, smoothing 0,18, mipmapBlur, radius 0,7.
* Chromatic aberration radial (`modulationOffset` 0,35); kekuatan = `clamp(|kecepatan scroll| / 5200) * 0,0022`, jadi muncul hanya saat scroll cepat.
* Vignette, Noise, ToneMapping.

### A4. Performa
* Resolusi adaptif: setelah 150 bingkai, bila rata-rata (EMA) lebih dari 26 ms maka `level` naik; pixel ratio turun ke 1,25 lalu 1.
* Jumlah efek dikurangi di layar sentuh (`coarse`).

### A5. Scroll dan antarmuka laman awal
| Elemen | Detail | Berkas |
|---|---|---|
| Lenis | `lerp` 0,1, `wheelMultiplier` 0,9; dengan reduced-motion `lerp` 1 dan smooth wheel mati; disambung ke ticker GSAP dan `ScrollTrigger.update` | `main.ts` |
| Judul blur-in | SplitText, judul bab muncul dari blur | `main.ts` |
| Rail bab | garis samping, tiap bab satu titik, menyala saat bab aktif (`start: top 50%`, `end: bottom 50%`), klik untuk lompat | `main.ts`, `story.css` |
| Scroll cue | petunjuk "gulir" hilang setelah scroll lebih dari 60 px | `main.ts` |
| Tirai (curtain) | kanvas 3D meredup ke opasitas 0,12 saat lembar kertas naik (`top bottom` sampai `top 15%`, scrub) | `main.ts` |
| Nada header | `body[data-tone='bone'|'night']` mengganti warna header dan rail | `main.ts`, `story.css` |
| Dua bahasa | tombol EN dan ID, semua teks bergantian tanpa muat ulang | `i18n.ts` |

### A6. Tambahan halus (commit `b66f9f8`, `web/src/ui/fx.ts`, `styles/story.css`)
| Efek | Perilaku | Nilai |
|---|---|---|
| Angka hantu 01 sampai 06 | huruf raksasa hanya garis tepi, melayang melawan arah scroll | tinggi `clamp(9rem, 24vw, 22rem)`, garis `rgba(242,182,50,.10)`, `yPercent` 18 sampai -22 (scrub) |
| HUD bab | kiri bawah: `03 ── MEASURE`; huruf diacak lalu mengunci satu per satu | 520 ms; tersembunyi di hero dan bagian kertas; hilang di layar sempit |
| Garis sapu | satu garis tipis kuning menyapu layar saat ganti bab, arah mengikuti arah scroll | 1,1 s, `power2.inOut`, opasitas 0,5 ke 0 |
| Kursor reticle | cincin 26 px mengikuti pointer, membesar 46 px di atas tombol dan tautan; kursor asli tetap ada | lerp 0,22; hanya `pointer: fine` |
| Tombol magnetik | CTA bergeser ke arah pointer | maks 8 px dan 6 px, kembali dengan `elastic.out(1,0.5)` |
| Skew kecepatan | blok teks miring mengikuti kecepatan scroll | maksimum 1,2 derajat, lerp 0,12 |

### A7. Workbench (alat kerja)
| Elemen | Perilaku | Berkas |
|---|---|---|
| Pemindaian | foto dengan garis kuning yang berayun 2,2 detik, daftar 6 langkah menyala berurutan | `workbench.ts`, `workbench.css` |
| Anotasi muncul | kontur tergambar bertahap, garis ukuran terbuka, lalu label; 1700 ms ease-out kubik | `plan/plate.ts`, `plan/draw.ts` |
| Tab | panel masuk dengan fade dan naik 10 px, 420 ms | `workbench.css` |
| Bilah diagnosis banding | bar yang melebar 500 ms mengikuti peringkat | `workbench.css` |
| Kuas kontur | lukis tambah dan hapus langsung di kanvas, semua angka dihitung ulang | `workbench.ts` |
| Tiga panel | foto terukur, marking operasi, ilustrasi hasil (bed bergranulasi, graft mesh, staples) | `plan/plate.ts`, `plan/sim.ts` |

### A8. Penampil 3D operasi (`web/src/plan/viewer3d.ts`, `cutaway.ts`)
* Dibangun dari foto yang diunggah: tekstur, kawah luka dari topeng, potongan flap dan graft dari poligon rencana. Berbeda untuk tiap foto.
* Kamera meluncur masuk 2,2 detik (`power3.out`), operasi berjalan sendiri 16 detik, jeda 2,4 detik, lalu mengulang; putar otomatis 0,7 sampai pengguna menyentuh.
* Dua mode, berpindah 1,1 detik (`power3.inOut`): **Permukaan** dan **Potongan lapisan**.
* Garis waktu per teknik, dengan tahap yang sama dipakai di panel penjelasan, bisa diklik:
  * tutup primer: marking, eksisi, undermining, jahitan dalam (subkutan, ungu), dermal (subdermal, teal), kulit (hitam), dressing;
  * flap: sayatan, elevasi, transposisi, jahitan tiga lapis, dressing;
  * graft: persiapan dasar, pengambilan donor, meshing, penempatan, fiksasi (staples), bolster atau tekanan negatif;
  * debridemen: marking, debridemen tajam, irigasi, dressing tekanan negatif (busa, film, selang hisap);
  * biopsi: marking, biopsi punch, spesimen dan dressing.
* Interaksi: kupas kulit seperti halaman (`R = 0,42`), tarik lapisan terpisah, marking dan ukuran bisa dimatikan, geser penggeser, klik tahap.
* Material kulit memakai foto sebagai tekstur, lubang (discard) di bawah potongan, lapisan marking dicampur lewat uniform `uMarkAmt`.

---

## BAGIAN B. Acuan: FaceStudio (proyek wajah)

Ini daftar fitur acuan yang Anda tempel. Ditulis ulang apa adanya sebagai bahan pilihan, bukan semua dipakai.

### B1. Mesin dunia scroll
* Satu scene persisten; kamera, cahaya, material, dan objek berubah antar 10 bab (`world/chapters.ts`), tanpa pergantian scene.
* Fungsi `evaluate(layout, scrollY, vh, portrait)` murni dan reversibel; tiap bab punya key dan fungsi `drive(sub)`.
* Easing plateau: tiap bab "menahan" posisi sebelum pindah, seperti pameran.
* Lenis disambung ke ticker GSAP; ada fallback untuk reduced-motion dan layar sentuh; layout portrait punya kamera dan skala sendiri.

### B2. Urutan pembuka (intro scan)
* Titik permukaan wajah muncul sebagai point cloud (`scan.ts`, dibagi merata menurut luas permukaan).
* Cincin laser menyapu dari atas ke bawah; wireframe muncul di belakang laser, lalu kulit solid dibangun dari atas ke bawah (uniform `uSolid`) dengan dissolve.
* HUD hidup: persen, jumlah titik, tahap, jumlah landmark ikut berjalan.

### B3. Elemen 3D
* Wajah: mesh kanonik MediaPipe 468 titik, subdivisi Hermite, lubang hidung dan mulut diisi dan dicekungkan, shell bertebal, overlay 2D diangkat ke permukaan dengan heightfield.
* Shader kulit kustom: pori, rim subsurface (SSS), dissolve, atlas tekstur 34 zona.
* Pita tinta (InkLines) dan titik tinta (InkDots): garis landmark, proporsi, RSTL yang menempel di permukaan.
* Layer anatomi: lemak, otot, tulang (Ecorche, CC BY-SA 4.0), dipotong dengan gltf-transform dan meshoptimizer, dicocokkan dengan Horn similarity; slider kupas dan explode; label dengan garis penunjuk.
* Cincin giroskop platinum dengan satelit bercahaya, lantai Reflector, dial instrumen (cincin skala, kolam cahaya), Sparks (partikel halus naik dari dial), god-ray planes, beam lampu, dust bertitik kecil, backdrop gelap, env map studio.

### B4. Post-processing dan cahaya
* Bloom per bab, tone mapping AgX, SMAA, chromatic aberration yang menguat saat scroll cepat, cahaya dan tint per bab (`s.light`).

### B5. Motion antarmuka (`fx.ts`, `landing.ts`)
* Rail bab dengan isi progres, tick per bab, label dua bahasa, klik lompat.
* Angka hantu raksasa 00 sampai 09 dengan parallax lawan arah scroll.
* Sweep line tiap ganti bab; scramble text pada HUD; kursor reticle yang menempel pada tombol (`hot`); tombol magnetik; skew berdasarkan kecepatan scroll (maks 2,5 derajat); tag 3D yang menempel pada titik wajah; veil transisi antara landing dan studio.

### B6. Tipografi dan warna
* Latar `#050506`, tinta aquamarine `#5fe8c8`, soft `#c8fff0`, aksen coral `#ff8f6e`, cincin platinum `#d3dbe2`.
* Hanken Grotesk (berat 320 dan 380), Instrument Serif miring berwarna krem untuk penekanan, JetBrains Mono untuk data dan HUD; warna sebagai token `:root`.

### B7. Studio (alat kerja)
* Overlay 2D (landmark, grid proporsi, zona, RSTL, kontur lesi); viewer 3D dengan slider kupas dan "Putar rencana" (`SurgeryAnim`); galeri contoh sebagai modal lembar 3 panel; pemuatan 3D satu promise agar tidak build ganda.

### B8. Teknik agar mulus
* Dunia = fungsi murni dari scroll, bukan timeline berjalan sendiri.
* Semua efek berat dikendalikan satu objek keadaan `HeroState`.
* Skala titik dan partikel dihitung dari ukuran layar dan pixel ratio; partikel dikurangi di perangkat sentuh (`stage.coarse`).
* `prefers-reduced-motion` mematikan skew, sweep, scramble, dan reticle.

---

## BAGIAN C. Keputusan: apa yang dipakai dari FaceStudio

| Elemen FaceStudio | Status di WoundScan | Alasan |
|---|---|---|
| Mesin dunia scroll, plateau, reversibel | sudah ada (A1) | inti desain |
| Lenis + GSAP satu jam | sudah ada | |
| Chromatic aberration fungsi kecepatan, bloom, vignette | sudah ada | |
| Rail bab | sudah ada | |
| Angka hantu, HUD scramble, sweep line, reticle, tombol magnetik, skew | **ditambahkan** (A6), versi lebih halus | cukup untuk terasa mahal tanpa ramai |
| Intro scan point cloud dan laser | belum | intro WoundScan memakai penggaris dan blok kulit; bisa jadi pilihan berikutnya |
| Cincin giroskop, satelit, dial, Sparks, god-ray tambahan | tidak | menambah keramaian; identitas WoundScan adalah blok klinis dan penggaris |
| Layer anatomi (lemak, otot, tulang) | sebagian (blok berlapis, potongan lapisan di penampil 3D) | tidak perlu model tulang untuk luka |
| Palet aquamarine dan coral | tidak | WoundScan memakai kuning pita, malam, kertas tulang, tinta penanda |
| Veil transisi landing ke studio | tirai kanvas dan lembar kertas (A5) | padanan yang sudah ada |

## BAGIAN D. Cara menyetel (berkas dan nilai)
| Ingin mengubah | Berkas | Parameter |
|---|---|---|
| Posisi dan sudut kamera tiap bab | `web/src/world/choreography.ts` | `KEYS[i].cam`, `tgt`, `fov`, `shiftX` |
| Lama menahan di tiap bab | `choreography.ts` | `(u - 0.2) / 0.6` |
| Kekuatan bloom dan aberrasi | `web/src/world/index.ts` | `BloomEffect.intensity`, `/ 5200 * 0.0022` |
| Keramaian efek laman awal | `web/src/ui/fx.ts`, `styles/story.css` | opasitas `.ghost`, `.hud`, durasi sweep, skew maks |
| Matikan satu efek | `web/src/ui/fx.ts` | hapus blok terkait (ghost, HUD, sweep, reticle, magnetik, skew) |
| Kecepatan operasi 3D | `web/src/plan/viewer3d.ts` | `dt / 16` (detik), `hold = 2.4` |
| Tahap dan teks operasi | `web/src/plan/cutaway.ts` | `timeline()` |

## BAGIAN E. Pemeriksaan sebelum merilis perubahan gerakan
1. `npx tsc --noEmit`, `npx vite build` tanpa error.
2. Lihat hasil dengan mata: pasang `preserveDrawingBuffer` lalu simpan `canvas.toDataURL()` ke berkas dan baca PNG-nya; panel browser terpotong dan melambat saat tidak di depan, jadi pakai `tabs_select` dan panggil `skipIntro`.
3. Uji `prefers-reduced-motion`, layar sentuh, dan lebar HP: tidak boleh ada gulir horizontal, HUD dan angka hantu hilang di layar sempit.
4. Tidak ada error konsol; bingkai tidak turun (resolusi adaptif bekerja).
5. Bangun ulang image Docker agar versi yang disajikan server sama dengan GitHub.
