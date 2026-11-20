/* Basis pengetahuan klinis WoundScan. Ringkasan dari pedoman yang dirujuk di tiap entri.
   Dosis dan ambang adalah pegangan cepat IGD; sesuaikan dengan protokol RS setempat. */
window.KB = (() => {

  const TYPES = [
    { id: 'laserasi',  label: 'Laserasi / luka robek',  group: 'Akut' },
    { id: 'abrasi',    label: 'Abrasi / luka lecet',    group: 'Akut' },
    { id: 'tusuk',     label: 'Luka tusuk',             group: 'Akut' },
    { id: 'gigitan',   label: 'Gigitan hewan / manusia',group: 'Akut' },
    { id: 'avulsi',    label: 'Avulsi / kehilangan jaringan', group: 'Akut' },
    { id: 'bakar',     label: 'Luka bakar',             group: 'Akut' },
    { id: 'bedah',     label: 'Luka bedah / dehisensi / ISK',group: 'Subakut' },
    { id: 'dekubitus', label: 'Dekubitus (luka tekan)', group: 'Kronik' },
    { id: 'dfu',       label: 'Ulkus kaki diabetik',    group: 'Kronik' },
    { id: 'vena',      label: 'Ulkus vena',             group: 'Kronik' },
    { id: 'arteri',    label: 'Ulkus arteri / iskemik', group: 'Kronik' },
    { id: 'curiga',    label: 'Luka tidak sembuh / curiga keganasan', group: 'Kronik' },
  ];

  /* ---- Protokol per jenis luka ---- */
  const P = {};

  P.laserasi = {
    sumber: 'ATLS; ACEP wound care; AAFP laceration repair',
    nilai: ['Mekanisme, waktu kejadian, kontaminasi (tanah, kaca, logam)',
            'Fungsi distal: sensorik, motorik, perfusi, ROM; eksplorasi tendon/saraf sebelum anestesi',
            'Benda asing: rontgen bila kaca, logam, atau kecurigaan fraktur',
            'Lokasi tegangan tinggi (sendi, garis Langer), struktur vital (duktus parotis, kelopak, bibir vermilion)'],
    segera: ['Hentikan perdarahan: tekanan langsung; torniket hanya bila perdarahan ekstremitas yang tidak terkontrol',
             'Anestesi lokal: lidokain 1 persen maks 4,5 mg/kgBB (7 mg/kgBB dengan epinefrin); blok saraf pada telapak/jari',
             'Irigasi tekanan tinggi NaCl 0,9 persen atau air keran bersih, minimal 50 sampai 100 mL per cm panjang luka',
             'Debridemen jaringan tidak viable secukupnya; jangan memotong kulit wajah berlebihan',
             'Profilaksis tetanus (lihat modul tetanus)'],
    definitif: ['Tutup primer berlapis bila bersih; wajah umumnya hingga 24 jam, tubuh dan ekstremitas hingga 12 sampai 18 jam, tangan dan kaki kontaminasi tinggi pertimbangkan tutup tertunda',
                'Benang: wajah 6-0 monofilamen, tubuh 4-0 sampai 5-0, kulit kepala 3-0 atau staples, dermis 4-0 absorbable',
                'Lem jaringan atau steri-strip untuk luka bersih tegangan rendah',
                'Angkat jahitan: wajah 5 sampai 7 hari, kulit kepala 7 sampai 10, badan dan lengan 10 sampai 14, tungkai 10 sampai 14, sendi 14'],
    antibiotik: 'Tidak rutin. Pertimbangkan bila kontaminasi berat, luka tangan/kaki dalam, imunokompromais, atau terlambat lebih dari 12 sampai 24 jam: sefaleksin 4 x 500 mg 3 sampai 5 hari.',
    rekonstruksi: 'Tutup primer; bila defek (tegangan tinggi) gunakan flap lokal (advancement, rotation, rhomboid). Kehilangan kulit kecil dengan dasar bersih: STSG atau penyembuhan sekunder.',
    rujuk: ['Cedera tendon, saraf, pembuluh darah, duktus, kelopak/margo bibir, kelenjar lakrimal', 'Luka wajah luas atau kosmetik sulit', 'Fraktur terbuka'],
    bendera: ['Defisit neurovaskular distal', 'Perdarahan arteri memancar', 'Benda asing tertinggal', 'Luka sendi (tes salin intra-artikular)'],
  };

  P.abrasi = {
    sumber: 'Praktik umum; ACEP',
    nilai: ['Luas dan kedalaman (hanya epidermis atau sampai dermis)', 'Kontaminasi partikel (road rash, aspal): tato traumatik bila tidak dibersihkan'],
    segera: ['Bersihkan dan sikat partikel di bawah anestesi topikal atau lokal dalam 24 jam pertama untuk mencegah tato traumatik', 'Irigasi banyak', 'Tetanus'],
    definitif: ['Dressing lembap non-adheren: hidrokoloid tipis, foam silikon, atau tulle parafin', 'Ganti 24 sampai 48 jam; re-epitelisasi 7 sampai 14 hari', 'Hindari paparan matahari 6 sampai 12 bulan (hiperpigmentasi), tabir surya'],
    antibiotik: 'Tidak diperlukan kecuali tanda infeksi.',
    rekonstruksi: 'Umumnya sembuh spontan. STSG hanya bila meluas ke dermis dalam dan tidak sembuh lebih dari 3 minggu.',
    rujuk: ['Dermis dalam luas', 'Abrasi wajah dengan partikel menempel', 'Tanda infeksi'],
    bendera: ['Cedera tersembunyi di bawah (rontgen)', 'Infeksi dini pada kulit yang luas'],
  };

  P.tusuk = {
    sumber: 'ATLS; praktik umum',
    nilai: ['Benda penyebab dan kedalaman perkiraan; trajektori; struktur vital terdekat', 'Benda masih tertancap: jangan dicabut di IGD, imobilisasi dan siapkan ke kamar operasi',
            'Tangan/kaki: rontgen untuk benda asing; telapak kaki menembus sepatu: Pseudomonas'],
    segera: ['Irigasi; jangan menutup primer luka tusuk', 'Tetanus', 'Eksplorasi hanya bila dapat melihat dasar secara jelas; hindari memperdalam di area neurovaskular'],
    definitif: ['Biarkan terbuka atau dressing; evaluasi ulang 24 sampai 48 jam', 'Luka tusuk dada, abdomen, leher: algoritme trauma, bukan luka superfisial'],
    antibiotik: 'Luka tusuk telapak kaki menembus sol: pertimbangkan ciprofloxacin 2 x 500 mg 7 sampai 10 hari bila dalam atau melibatkan sendi/tulang. Lainnya tidak rutin.',
    rekonstruksi: 'Umumnya tidak diperlukan.',
    rujuk: ['Kecurigaan penetrasi rongga tubuh', 'Cedera tendon/sendi/tulang', 'Benda asing organik'],
    bendera: ['Nyeri tidak sebanding, bengkak progresif (abses, osteomielitis)', 'Benda organik tertinggal'],
  };

  P.gigitan = {
    sumber: 'IDSA SSTI; WHO rabies 2018 (PEP); praktik umum',
    nilai: ['Spesies, waktu, status vaksinasi hewan, provokasi', 'Lokasi: tangan, wajah, genital, dekat sendi; fight bite (buku jari)', 'Rontgen bila gigitan manusia atau luka dalam tangan: fraktur, gigi'],
    segera: ['Cuci luka dengan sabun dan air mengalir minimal 15 menit lalu antiseptik povidon iodin', 'Irigasi banyak; debridemen jaringan mati', 'Tetanus', 'Nilai rabies: kategori WHO II (gigitan kecil tanpa darah) VAR; kategori III (luka tembus, darah, mukosa) VAR ditambah SAR/RIG di sekitar luka'],
    definitif: ['Hindari tutup primer pada luka tusuk, tangan, kaki, atau luka kontaminasi/dua hari; wajah dapat ditutup primer setelah irigasi', 'Evaluasi ulang 24 sampai 48 jam'],
    antibiotik: 'Profilaksis 3 sampai 5 hari untuk risiko tinggi (tangan, tusuk dalam, kucing, imunokompromais, dekat sendi, wajah luas, genital): amoksisilin-klavulanat 3 x 625 mg. Alergi penisilin: doksisiklin + metronidazol. Gigitan manusia: amoksisilin-klavulanat.',
    rekonstruksi: 'Wajah: tutup primer berlapis, flap lokal bila defek; avulsi telinga/hidung: komposit graft atau flap. Rekonstruksi tertunda setelah infeksi tertangani.',
    rujuk: ['Fight bite: bedah tangan', 'Cedera tendon/sendi/tulang', 'Gigitan wajah pada anak', 'Infeksi progresif'],
    bendera: ['Fight bite', 'Gigitan kucing (Pasteurella)', 'Tanda tenosinovitis (Kanavel)', 'Hewan tersangka rabies'],
  };

  P.avulsi = {
    sumber: 'ATLS; BAPRAS; praktik bedah plastik',
    nilai: ['Jaringan avulsi masih ada? Bawa ke RS (bungkus kasa lembap NaCl, dalam kantong, di atas es; jangan kontak langsung es)', 'Kedalaman: kulit, lemak, fasia, otot, tendon, tulang terpapar', 'Degloving tertutup (Morel-Lavallee) di panggul/paha', 'Vaskularisasi flap: warna, pengisian kapiler, pin-prick bleeding'],
    segera: ['Hentikan perdarahan; irigasi; tetanus; antibiotik profilaksis untuk luka kotor', 'Fiksasi dan rontgen bila ada fraktur terbuka (Gustilo)', 'Amputasi: bungkus bagian terputus kasa lembap NaCl dalam kantong di atas es. Toleransi iskemia: digit sekitar 12 jam hangat dan 24 jam dingin; ekstremitas proksimal (banyak otot) sekitar 6 jam hangat dan 12 jam dingin'],
    definitif: ['Debridemen serial hingga jaringan viabel', 'Pasang flap avulsi kembali sebagai graft hanya bila baik; jangan reinsersi dengan tegangan', 'NPWT sementara hingga penutupan definitif'],
    antibiotik: 'Fraktur terbuka: sefazolin (Gustilo I-II), tambah gram negatif untuk III; luka kotor tambah penisilin. Mulai dalam 1 jam.',
    rekonstruksi: 'Tangga rekonstruksi: STSG untuk dasar granulasi tanpa struktur terpapar; flap lokal/regional untuk tulang, tendon, implan terpapar; flap bebas untuk defek besar ekstremitas bawah. Penutupan dini (di bawah 72 jam, maksimal 7 hari) lebih baik untuk fraktur terbuka Gustilo IIIB (Godina).',
    rujuk: ['Semua avulsi dengan struktur dalam terpapar', 'Amputasi (replantasi)', 'Gustilo IIIB/IIIC'],
    bendera: ['Sindrom kompartemen', 'Cedera vaskular', 'Kontaminasi berat/tanah (Clostridium)'],
  };

  P.bakar = {
    sumber: 'ATLS 10; ABA referral criteria; ISBI Practice Guidelines 2016; EMSB',
    nilai: ['Mekanisme (termal, listrik, kimia, kontak), waktu, tempat tertutup (inhalasi)', 'Kedalaman: superfisial (merah, kering, nyeri, tanpa lepuh), parsial superfisial (lepuh, basah, merah muda, pucat saat ditekan dan cepat kembali, nyeri hebat), parsial dalam (putih-merah bercak, lambat kembali atau tidak, sensasi menurun), tebal penuh (putih/cokelat/hitam, kasar, tidak nyeri, tidak pucat)', 'Hanya parsial dan tebal penuh yang dihitung dalam TBSA',
            'Cincin: sirkumferensial pada ekstremitas/dada; periksa perfusi distal dan ventilasi'],
    segera: ['Hentikan proses pembakaran; lepas perhiasan/pakaian', 'Dinginkan dengan air mengalir 20 menit dalam 3 jam pertama (bukan es); cegah hipotermia',
             'ABC; waspada inhalasi (jelaga, suara serak, wajah/leher): intubasi dini', 'Dua jalur IV pada luka ≥ 20 persen TBSA dewasa dan ≥ 10 persen anak; kateter urin',
             'Analgesia IV (opioid titrasi)', 'Tetanus; jangan antibiotik sistemik profilaksis', 'Bakar kimia: irigasi banyak minimal 30 menit; listrik: EKG dan CK/mioglobin'],
    resusitasi: 'Ringer Laktat. Dewasa: awal 2 mL x kgBB x %TBSA per 24 jam (ATLS 10; Parkland klasik 4 mL), setengah dalam 8 jam pertama sejak kejadian, setengah 16 jam berikutnya. Anak ≤ 14 tahun: 3 mL x kgBB x %TBSA dengan cairan pemeliharaan mengandung dekstrosa. Listrik: 4 mL. Titrasi ke diuresis 0,5 mL/kg/jam dewasa, 1 mL/kg/jam anak ≤ 30 kg.',
    definitif: ['Superfisial: pelembap, analgesik, tanpa dressing khusus', 'Parsial superfisial: bersihkan lepuh pecah, dressing perak (Aquacel Ag / sulfadiazin tipis) atau foam silikon; ganti 3 sampai 7 hari', 'Parsial dalam dan tebal penuh: eksisi tangensial dini dan STSG dalam 3 sampai 5 hari; hindari pembalut perak berkepanjangan bila akan dieksisi',
                'Eskarotomi pada sirkumferensial dengan gangguan perfusi/ventilasi', 'Elevasi ekstremitas; fisioterapi dini; nutrisi enteral dini'],
    antibiotik: 'Tidak profilaksis. Terapi bila infeksi nyata (selulitis, sepsis).',
    rekonstruksi: 'Eksisi tangensial lalu STSG meshed 1:1,5 sampai 1:3 untuk batang badan dan tungkai; STSG lembaran (tidak meshed) atau FTSG pada wajah, tangan, leher, sendi; substitusi dermal (Integra, NovoSorb) untuk defek dalam dan fungsi tinggi. Luas > 50 persen: cultured epithelial autograft dan alloskin sebagai penutup sementara. Parut: terapi tekanan, silikon, kontraktur: Z-plasti/flap/pelepasan.',
    rujuk: ['Kriteria ABA: parsial > 10 persen TBSA; semua tebal penuh; wajah, tangan, kaki, genital, perineum, sendi besar; listrik (termasuk petir); kimia; inhalasi; riwayat komorbid; trauma penyerta; anak di RS tanpa fasilitas', 'Tebal penuh sirkumferensial'],
    bendera: ['Inhalasi', 'Sirkumferensial', 'Listrik tegangan tinggi (rabdomiolisis, aritmia)', 'Kecurigaan non-accidental injury pada anak'],
  };

  P.bedah = {
    sumber: 'CDC/NHSN SSI; WSES; praktik umum',
    nilai: ['Hari pascaoperasi; implan; kontrol gula, nutrisi, merokok, steroid', 'Tanda infeksi: eritema > 2 cm, panas, bengkak, nyeri, pus, demam', 'Dehisensi: superfisial atau fasia; evisceration'],
    segera: ['Buka luka infeksi, drainase, kultur dari jaringan dalam', 'Evisceration: tutup kasa NaCl lembap, jangan dikembalikan paksa, NPO, ke kamar operasi', 'Cek gula darah'],
    definitif: ['Debridemen jaringan nekrotik', 'NPWT (−80 sampai −125 mmHg) setelah infeksi terkendali dan dasar bersih', 'Penutupan tertunda atau flap (rektus, fasiokutan) bila fasia/implan terpapar'],
    antibiotik: 'Hanya bila selulitis meluas, sistemik, atau implan: sefazolin/klindamisin (MRSA: vankomisin/linezolid), sesuaikan kultur. Durasi 5 sampai 7 hari setelah kontrol sumber.',
    rekonstruksi: 'Superfisial: penyembuhan sekunder dengan NPWT; dalam dengan implan terpapar: debridemen, flap otot/omentum/fasiokutan. Hernia insisional: rekonstruksi dinding abdomen oleh tim.',
    rujuk: ['Fasia dehisensi', 'Implan terinfeksi', 'Kecurigaan fasiitis nekrotikans'],
    bendera: ['Nyeri tidak sebanding dan sistemik toksik (fasiitis nekrotikans)', 'Eviserasi'],
  };

  P.dekubitus = {
    sumber: 'EPUAP/NPIAP/PPPIA International Guideline 2019 dan edisi 2025; WHS 2023',
    nilai: ['Stadium: 1 eritema tidak pucat, kulit utuh; 2 dermis terpapar, tanpa slough/lemak; 3 hilang kulit penuh, lemak terlihat, tanpa fasia/otot/tulang; 4 fasia, otot, tendon, ligamen, tulang terpapar atau teraba; tak dapat distadiumkan (slough/eskar menutupi dasar); cedera jaringan dalam (ungu/marun menetap)',
            'Lokasi: sakrum, iskium, trokanter, tumit', 'Penyebab: imobilitas, gesekan, kelembapan, nutrisi, gula', 'Osteomielitis: probe-to-bone, LED/CRP, MRI, biopsi tulang bila stadium 4'],
    segera: ['Hilangkan tekanan: reposisi tiap 2 jam, permukaan penopang (kasur dinamis/tekanan alternating), 30 derajat lateral, tumit mengambang', 'Nutrisi: energi 30 sampai 35 kcal/kg dan protein 1,25 sampai 1,5 g/kg/hari; koreksi albumin hanya sebagai penanda', 'Debridemen jaringan non-viabel (kecuali eskar kering stabil di tumit dengan iskemia)'],
    definitif: ['Dressing lembap: stadium 2 hidrokoloid/foam silikon; stadium 3 sampai 4 alginat/hidrofiber, foam; infeksi: perak/iodin kadeksomer', 'NPWT untuk stadium 3 sampai 4 setelah debridemen', 'Kelola spastisitas, inkontinensia, gula darah'],
    antibiotik: 'Sistemik bila selulitis meluas, sepsis, osteomielitis (6 minggu bila tanpa reseksi).',
    rekonstruksi: 'Setelah dasar bersih, infeksi dan osteomielitis tertangani, nutrisi dan spastisitas teroptimal: sakrum: flap rotasi gluteus atau V-Y gluteus maksimus (perforator); iskium: flap paha inferior gluteal, hamstring V-Y; trokanter: TFL atau vastus lateralis; tumit: umumnya konservatif atau flap plantar medial. Pertahankan penurunan tekanan 4 sampai 6 minggu pasca flap.',
    rujuk: ['Stadium 3 sampai 4, tak dapat distadiumkan', 'Osteomielitis', 'Gagal sembuh 2 sampai 4 minggu dengan perawatan optimal'],
    bendera: ['Sepsis dari sumber dekubitus', 'Osteomielitis', 'Selulitis meluas', 'Keganasan Marjolin pada luka kronik'],
  };

  P.dfu = {
    sumber: 'IWGDF/IDSA 2023; IWGDF wound healing 2023; WHS 2023',
    nilai: ['Wagner 0 sampai 5; infeksi IWGDF/IDSA: tidak ada, ringan (≥ 2 tanda inflamasi, eritema 0,5 sampai 2 cm), sedang (eritema > 2 cm atau struktur dalam), berat (≥ 2 SIRS)', 'Probe-to-bone; rontgen; MRI bila osteomielitis dicurigai',
            'Vaskular: ABI, tekanan jari/TBI, TcPO2 (ABI bisa palsu tinggi karena kalsifikasi)', 'Neuropati: monofilamen 10 g', 'Gula darah, HbA1c, fungsi ginjal'],
    segera: ['Bila infeksi berat atau iskemia kritis: rawat, kontrol sumber, drainase abses', 'Kultur jaringan dalam setelah debridemen (bukan swab permukaan)', 'Rujuk vaskular segera: tekanan jari < 30 mmHg, TcPO2 < 25 mmHg, ABI < 0,5, atau tidak sembuh 4 sampai 6 minggu'],
    definitif: ['Offloading: alat non-removable setinggi lutut (total contact cast) untuk ulkus plantar neuropati', 'Debridemen tajam; dressing lembap sesuai eksudat', 'Kontrol glikemik; nutrisi; berhenti merokok'],
    antibiotik: 'Hanya bila infeksi klinis. Ringan: sefaleksin atau amoksisilin-klavulanat 1 sampai 2 minggu; sedang: amoksisilin-klavulanat atau seftriakson + metronidazol; berat: piperasilin-tazobaktam atau karbapenem ± vankomisin/linezolid. Osteomielitis tanpa reseksi: 6 minggu.',
    rekonstruksi: 'Sembuh sekunder atau STSG pada dasar granulasi. Defek plantar: flap plantar medial, reverse sural; kaki dengan tulang terpapar: flap lokal/perforator, flap bebas bila iskemia sudah direvaskularisasi. Amputasi minor dan penyelamatan ekstremitas oleh tim multidisipliner.',
    rujuk: ['Infeksi sedang sampai berat', 'Iskemia kritis', 'Osteomielitis', 'Charcot akut'],
    bendera: ['Gangren basah/kering dengan sepsis', 'Kaki merah panas bengkak mendadak (Charcot atau infeksi)'],
  };

  P.vena = {
    sumber: 'ESVS 2022; WHS; praktik vaskular',
    nilai: ['Lokasi gaiter (malleolus medial), dangkal, tepi tidak teratur, dasar granulasi/slough, eksudat banyak', 'Tanda penyerta: edema, hemosiderin, lipodermatosklerosis, varises, atrophie blanche, eksim stasis', 'ABI wajib: ≥ 0,8 untuk kompresi penuh; 0,5 sampai 0,8 kompresi lebih ringan; < 0,5 jangan kompresi', 'Duplex vena: refluks superfisial/dalam'],
    segera: ['Hitung ABI sebelum kompresi', 'Singkirkan infeksi dan DVT akut'],
    definitif: ['Kompresi multi-lapis 30 sampai 40 mmHg (bila ABI ≥ 0,8) plus elevasi dan jalan', 'Dressing: foam/alginat untuk eksudat; kulit sekitar dengan pelembap/steroid topikal bila eksim', 'Ablasi dini refluks superfisial (EVRA): mempercepat penyembuhan dan mengurangi rekurensi', 'Pentoksifilin 3 x 400 mg sebagai adjuvan'],
    antibiotik: 'Hanya untuk infeksi klinis, bukan kolonisasi.',
    rekonstruksi: 'STSG/pinch graft hanya setelah dasar bersih dan refluks diterapi; rekurensi tinggi tanpa kompresi seumur hidup. Biopsi bila tidak sembuh > 3 bulan atau atipikal.',
    rujuk: ['Tidak sembuh 12 minggu', 'ABI < 0,8 atau campuran', 'Atipikal atau nyeri tidak sebanding'],
    bendera: ['Pucat/dingin (arteri)', 'Pertumbuhan atipikal (Marjolin/SCC)', 'Selulitis berulang'],
  };

  P.arteri = {
    sumber: 'Pedoman GVG 2019 CLTI; ESVS 2024; WHS',
    nilai: ['Lokasi akral (jari, tumit, malleolus lateral), tepi seperti dipotong, dasar pucat/nekrotik, nyeri terutama malam atau saat berbaring', 'Nadi pedis hilang, kulit dingin mengilap, rambut hilang, pucat saat elevasi, rubor saat menggantung', 'ABI < 0,9; ABI palsu tinggi pada diabetes/GGK: pakai tekanan jari, TBI, TcPO2', 'CLTI: nyeri istirahat, ulkus, atau gangren lebih dari 2 minggu'],
    segera: ['Rujukan vaskular segera untuk revaskularisasi', 'Analgesia memadai; jangan kompresi', 'Jangan debridemen tajam luas pada eskar kering stabil sebelum perfusi pulih', 'Infeksi dengan iskemia: drainase dulu, lalu revaskularisasi'],
    definitif: ['Revaskularisasi (endovaskular atau bypass)', 'Antiplatelet, statin, berhenti merokok, kontrol gula/hipertensi', 'Dressing kering stabil: iodin atau antiseptik; jaga kering'],
    antibiotik: 'Hanya bila infeksi.',
    rekonstruksi: 'Setelah revaskularisasi berhasil: STSG/flap lokal; amputasi minor/mayor bila tidak dapat dipulihkan.',
    rujuk: ['Semua ulkus arteri atau CLTI'],
    bendera: ['Tungkai dingin pucat tanpa nadi (iskemia akut): bedah vaskular emergensi', 'Gangren basah dengan sepsis'],
  };

  P.curiga = {
    sumber: 'NCCN BCC/SCC/Melanoma; BAD guideline; WHS',
    nilai: ['Tidak sembuh > 4 sampai 6 minggu meski perawatan optimal', 'Tepi menggulung/mutiara, nodul, rapuh mudah berdarah, hipergranulasi, pigmentasi tidak teratur (ABCDE)', 'Riwayat: parut luka bakar lama atau luka kronik puluhan tahun (Marjolin), kulit terpapar matahari, imunosupresi, radioterapi', 'Kelenjar getah bening regional'],
    segera: ['Biopsi: punch 4 mm di tepi mencakup kulit normal, atau insisional; ambil lebih dari satu tempat untuk luka kronik besar; kirim histopatologi', 'Jangan eksisi total sebelum diagnosis bila margin penting (melanoma)'],
    definitif: ['BCC risiko rendah: margin 4 mm; SCC risiko rendah: 4 sampai 6 mm; SCC risiko tinggi (> 2 cm, zona H, invasif): 6 sampai 10 mm; Mohs untuk zona H wajah', 'Melanoma: in situ 0,5 sampai 1 cm; Breslow ≤ 1 mm: 1 cm; 1,01 sampai 2 mm: 1 sampai 2 cm; > 2 mm: 2 cm', 'Marjolin: eksisi luas dengan margin sedikitnya 2 cm dan evaluasi kelenjar regional', 'Pencitraan sesuai stadium'],
    antibiotik: 'Bukan indikasi.',
    rekonstruksi: 'Rekonstruksi setelah margin bersih terkonfirmasi (tertunda bila frozen section tidak tersedia): flap lokal untuk wajah, STSG/FTSG untuk tubuh, flap bebas untuk defek besar dengan tulang terpapar. Pilih berdasarkan zona estetik dan fungsional.',
    rujuk: ['Semua kecurigaan keganasan: bedah plastik/onkologi kulit/patologi', 'Melanoma: onkologi dan SLNB sesuai Breslow'],
    bendera: ['Pertumbuhan cepat, nyeri saraf, ulserasi pada parut lama (Marjolin)', 'Kelenjar membesar'],
  };

  /* ---- Modul lintas ---- */
  const tetanus = (dosis, tahunSejakTerakhir, bersihMinor) => {
    // dosis: 0 = tidak tahu / <3, 3 = ≥3
    if (dosis < 3) {
      return bersihMinor ? 'Td/Tdap sekarang. Lanjutkan seri primer.' : 'Td/Tdap sekarang + TIG 250 IU IM (lokasi terpisah). Lanjutkan seri primer.';
    }
    const batas = bersihMinor ? 10 : 5;
    return tahunSejakTerakhir >= batas ? 'Td/Tdap booster sekarang. TIG tidak perlu.' : 'Tidak perlu vaksin atau TIG.';
  };

  const infeksi = {
    tanda: ['Eritema melebar > 2 cm', 'Hangat, bengkak/indurasi', 'Nyeri meningkat', 'Pus/eksudat berbau', 'Penyembuhan tertunda', 'Tepi rapuh, granulasi mudah berdarah (NERDS/STONEES)'],
    bendera: ['Nyeri tidak sebanding, bula hemoragik, krepitasi, kulit anestesi, toksik sistemik: fasiitis nekrotikans (LRINEC ≥ 6 meningkatkan kecurigaan; tidak menyingkirkan). Debridemen darurat + piperasilin-tazobaktam/karbapenem + vankomisin/linezolid + klindamisin.'],
  };

  const TIME = {
    T: 'Tissue: nekrotik/slough dibersihkan (autolitik, tajam, enzimatik, mekanis)',
    I: 'Infection/inflammation: kontrol bioburden (antiseptik, perak, iodin, antibiotik sistemik bila perlu)',
    M: 'Moisture: seimbangkan kelembapan (foam, alginat, hidrofiber, hidrokoloid)',
    E: 'Edge: tepi tidak maju: evaluasi etiologi, debridemen tepi, NPWT, graft',
  };

  /* ---- Pilihan dressing otomatis dari komposisi jaringan ---- */
  const dressing = (t) => {
    // t = {gran, slough, nekro, epi} dalam persen
    const out = [];
    if (t.nekro >= 30) out.push('Dominan nekrotik: debridemen (tajam di OK/IGD bila tidak iskemik, atau autolitik hidrogel/hidrokoloid). Jangan debridemen eskar kering stabil pada tungkai iskemik.');
    else if (t.nekro >= 10) out.push('Nekrotik sebagian: debridemen autolitik atau tajam berurutan.');
    if (t.slough >= 30) out.push('Slough luas: hidrogel, madu medis, atau hidrofiber/alginat sesuai eksudat; debridemen tajam bertahap.');
    else if (t.slough >= 10) out.push('Slough sebagian: alginat atau hidrofiber; pertimbangkan debridemen.');
    if (t.gran >= 50) out.push('Granulasi dominan: foam/hidrokoloid tipis, pertahankan lembap; bila dasar bersih pertimbangkan STSG atau NPWT.');
    if (t.epi >= 30) out.push('Epitelisasi aktif: dressing non-adheren (silikon/tulle), ganti jarang.');
    if (!out.length) out.push('Komposisi tidak jelas: foto ulang dengan pencahayaan merata.');
    return out;
  };

  /* ---- Mesin saran rekonstruksi (tangga rekonstruksi) ---- */
  const REGIONS = [
    { id: 'wajah',   label: 'Wajah',                     zone: 'estetik' },
    { id: 'kulit-kepala', label: 'Kulit kepala',          zone: 'umum' },
    { id: 'leher',   label: 'Leher',                      zone: 'fungsional' },
    { id: 'badan',   label: 'Badan (dada/perut/punggung)', zone: 'umum' },
    { id: 'sakrum',  label: 'Sakrum / glutea',            zone: 'tekanan' },
    { id: 'tangan',  label: 'Tangan / jari',              zone: 'fungsional' },
    { id: 'lengan',  label: 'Lengan atas / bawah',        zone: 'umum' },
    { id: 'sendi',   label: 'Sendi (siku/lutut/aksila)',  zone: 'fungsional' },
    { id: 'tungkai', label: 'Paha / tungkai atas',        zone: 'umum' },
    { id: 'pretibia',label: 'Pretibia / betis / tungkai bawah', zone: 'tungkai-bawah' },
    { id: 'tumit',   label: 'Tumit / kaki',               zone: 'tekanan' },
    { id: 'genital', label: 'Genital / perineum',         zone: 'khusus' },
  ];

  const STRUCT = [
    { id: 'tulang',   label: 'Tulang terpapar tanpa periosteum' },
    { id: 'tendon',   label: 'Tendon terpapar tanpa paratenon' },
    { id: 'implan',   label: 'Implan / hardware terpapar' },
    { id: 'sendi',    label: 'Kapsul sendi / pembuluh / saraf terpapar' },
  ];

  const rekonstruksi = ({ areaCm2, region, depth, exposed, bedReady, infected, onkologi }) => {
    const r = REGIONS.find(x => x.id === region) || {};
    const lines = [];
    const rungs = [];
    const exp = exposed && exposed.length > 0;
    const a = areaCm2;

    if (infected) lines.push('Dasar belum siap: kendalikan infeksi, debridemen serial, NPWT sampai dasar bersih. Rekonstruksi definitif setelah itu.');
    if (!bedReady && !infected) lines.push('Dasar belum optimal: kondisikan (debridemen, NPWT, nutrisi, glukosa) sebelum penutupan.');

    if (onkologi) rungs.push('Rekonstruksi setelah margin bebas tumor terkonfirmasi (frozen section atau tertunda).');

    if (depth === 'partial') {
      rungs.push('Penyembuhan sekunder dengan dressing lembap (partial-thickness).');
      if (a > 50 || r.zone === 'fungsional') rungs.push('STSG tipis bila epitelisasi tidak terjadi dalam 2 sampai 3 minggu atau area fungsional.');
    } else {
      if (exp) {
        rungs.push('Struktur penting terpapar: butuh jaringan vaskularisasi sendiri (flap), bukan graft langsung.');
        if (a <= 25 && r.zone === 'tungkai-bawah') rungs.push('Defek ≤ 25 cm² tungkai bawah: pertimbangkan NPWT + substitusi dermal sebelum STSG; flap bila gagal (algoritma satu-institusi, bukti terbatas).');
        if (r.id === 'wajah') rungs.push('Wajah: flap lokal (advancement, rotation, bilobed, rhomboid, V-Y); FTSG untuk kulit tipis pada kantong.');
        else if (r.id === 'pretibia' || r.id === 'tumit') rungs.push('Tungkai bawah/kaki: flap perforator lokal (sural, MPAP) untuk defek kecil sampai sedang; flap bebas (ALT, gracilis, latissimus) untuk defek besar atau zona cedera.');
        else if (r.id === 'tangan') rungs.push('Tangan: flap lokal/ regional (cross-finger, kutaneus dorsal), flap fasia radial/posterior interosseus; jangan graft pada tendon tanpa paratenon.');
        else if (r.id === 'kulit-kepala') rungs.push('Kulit kepala: flap kulit kepala lokal dengan galea scoring; bila kalvaria terpapar luas: flap bebas (latissimus, ALT).');
        else rungs.push('Flap fasiokutan/muskulokutan lokal; flap bebas bila defek besar atau zona cedera.');
      } else if (!bedReady) {
        rungs.push('Dasar belum siap: NPWT sebagai jembatan.');
      } else {
        if (a <= 4 && r.zone !== 'tekanan') rungs.push('Defek kecil: tutup primer (undermining) atau flap lokal; kulit kecil ≤ 2 cm sering sembuh sekunder.');
        if (r.zone === 'estetik' || r.zone === 'fungsional') rungs.push('FTSG (atau flap lokal) untuk wajah, tangan, leher, sendi: kontraktur dan warna lebih baik.');
        rungs.push('STSG untuk dasar granulasi: meshed 1:1,5 untuk area luas; lembaran bila terlihat; fiksasi dengan NPWT atau bolster.');
        if (a > 100) rungs.push('Luas besar: pertimbangkan substitusi dermal (Integra, Matriderm, NovoSorb) bila fungsi atau estetika penting, atau graft bertahap.');
      }
      if (r.zone === 'tekanan' && depth !== 'partial') rungs.push('Zona tekanan: flap (rotasi gluteal, V-Y, hamstring, TFL) dengan optimasi nutrisi, spastisitas, dan penurunan tekanan 4 sampai 6 minggu.');
    }
    return { lines, rungs };
  };

  /* ---- Matematika klinis ---- */
  const bsaMosteller = (tbCm, bbKg) => Math.sqrt((tbCm * bbKg) / 3600); // m²
  const luasTotalCm2 = (bsaM2) => bsaM2 * 10000;
  const tbsa = (areaCm2, bsaM2) => (areaCm2 / (bsaM2 * 10000)) * 100;
  const fluidParkland = (bbKg, tbsaPct, anak, listrik) => {
    const f = listrik ? 4 : (anak ? 3 : 2);
    const total24 = f * bbKg * tbsaPct;
    return { faktor: f, total24, jam8: total24 / 2, perJam8: total24 / 16, perJam16: total24 / 32, parkland4: 4 * bbKg * tbsaPct };
  };

  return { TYPES, P, tetanus, infeksi, TIME, dressing, REGIONS, STRUCT, rekonstruksi, bsaMosteller, luasTotalCm2, tbsa, fluidParkland };
})();
