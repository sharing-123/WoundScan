/* Categories the photo model was not trained on. They are reached from the clinical questions or chosen by hand. */
import type { Protocol } from './kb';

export const EXTRA = {
  burn: {
    name: { en: 'Burn injury', id: 'Luka bakar' },
    region: 'limb',
    ed: {
      en: ['Stop the burning process, cool with running water for 20 minutes (useful up to 3 hours after the burn), remove rings, watches and clothing that is not stuck.', 'Airway first for face, neck or inhalation injury; then breathing, circulation, analgesia.', 'Estimate TBSA with the rule of nines or Lund-Browder and leave out simple erythema. Start fluids above about 15 percent in adults and 10 percent in children (Parkland: 4 mL per kg per percent TBSA, half in the first 8 hours).', 'Cover with clean cling film or a non-adherent dressing; keep the patient warm; tetanus status.'],
      id: ['Hentikan proses terbakar, dinginkan dengan air mengalir 20 menit (masih bermanfaat sampai 3 jam setelah luka), lepas cincin, jam, dan pakaian yang tidak lengket.', 'Jalan napas dulu untuk luka wajah, leher, atau inhalasi; lalu napas, sirkulasi, analgesia.', 'Perkirakan luas (TBSA) dengan rule of nines atau Lund-Browder, eritema sederhana tidak dihitung. Mulai cairan di atas sekitar 15 persen pada dewasa dan 10 persen pada anak (Parkland: 4 mL per kg per persen TBSA, separuh dalam 8 jam pertama).', 'Tutup dengan cling film bersih atau dressing non-lengket; jaga tetap hangat; status tetanus.'],
    },
    assess: {
      en: ['Depth: superficial (red, dry, painful, blanches), superficial partial (blisters, pink, moist, very painful), deep partial (blotchy, reduced sensation, slow or no blanching), full thickness (white, leathery or black, painless)', 'Circumferential burn of a limb or chest, burn of the face, hands, feet, perineum or over joints', 'Chemical or electrical mechanism, inhalation, child, elderly, comorbidity, possible non-accidental injury'],
      id: ['Kedalaman: superfisial (merah, kering, nyeri, memucat), parsial superfisial (lepuh, merah muda, lembap, sangat nyeri), parsial dalam (bercak, sensasi turun, pucat lambat atau tidak), ketebalan penuh (putih, keras seperti kulit atau hitam, tidak nyeri)', 'Luka bakar melingkar pada tungkai atau dada, luka pada wajah, tangan, kaki, perineum, atau di atas sendi', 'Mekanisme kimia atau listrik, inhalasi, anak, lansia, penyakit penyerta, kemungkinan kekerasan'],
    },
    clinic: {
      en: ['Superficial partial: a silver, hydrofibre or nanocrystalline dressing, review at 48 to 72 hours and re-judge the depth', 'A burn that has not healed by 14 days will scar badly and usually needs a graft'],
      id: ['Parsial superfisial: dressing perak, hidrofiber, atau nanokristalin, kontrol 48 sampai 72 jam dan nilai ulang kedalaman', 'Luka bakar yang belum sembuh pada hari ke-14 akan berparut buruk dan biasanya perlu graft'],
    },
    definitive: {
      en: ['Deep partial or full thickness: tangential excision and split thickness skin graft (meshed) within 3 to 5 days; sheet graft or dermal substitute on the face and hands', 'Escharotomy for a circumferential full thickness burn with compromised perfusion or breathing', 'Later: scar management, pressure garments, contracture release'],
      id: ['Parsial dalam atau ketebalan penuh: eksisi tangensial dan cangkok kulit tebal-terbelah (mesh) dalam 3 sampai 5 hari; sheet graft atau pengganti dermis di wajah dan tangan', 'Eskarotomi untuk luka bakar melingkar ketebalan penuh dengan perfusi atau napas terganggu', 'Selanjutnya: perawatan parut, garmen tekan, pelepasan kontraktur'],
    },
    abx: { en: 'No prophylactic systemic antibiotics. Topical agents by protocol; treat clinical infection and take cultures from deep tissue.', id: 'Tidak ada antibiotik sistemik profilaksis. Topikal sesuai protokol; terapi infeksi klinis dan kultur jaringan dalam.' },
    recon: { en: 'Meshed STSG for large areas; sheet STSG or FTSG for face, hands and joints; flaps only for exposed tendon, bone or joint.', id: 'STSG mesh untuk area luas; STSG sheet atau FTSG untuk wajah, tangan, dan sendi; flap hanya untuk tendon, tulang, atau sendi terpapar.' },
    refer: { en: ['Burn centre: more than 10 percent TBSA partial thickness, any full thickness, face, hands, feet, perineum, genitals, joints, chemical, electrical, inhalation, children, comorbidity'], id: ['Pusat luka bakar: lebih dari 10 persen TBSA parsial, setiap ketebalan penuh, wajah, tangan, kaki, perineum, genital, sendi, kimia, listrik, inhalasi, anak, penyakit penyerta'] },
    flags: { en: ['Airway compromise or hoarseness', 'Circumferential burn with falling perfusion', 'Electrical injury (cardiac rhythm, myoglobinuria)', 'Sepsis'], id: ['Gangguan jalan napas atau suara serak', 'Luka bakar melingkar dengan perfusi menurun', 'Cedera listrik (irama jantung, mioglobinuria)', 'Sepsis'] },
    source: 'ANZBA / ABA; ATLS; ISBI',
  },
  arterial: {
    name: { en: 'Arterial (ischaemic) ulcer', id: 'Ulkus arteri (iskemik)' },
    region: 'foot',
    ed: {
      en: ['Treat it as chronic limb-threatening ischaemia until perfusion is measured: rest pain, pale or cold foot, no pulses, dry black toes.', 'Check pulses, capillary refill and a Doppler signal; ABI under 0.5 is critical, but in diabetes use toe pressure or TcPO2 because arteries calcify and ABI reads falsely high.', 'Do not debride dry necrosis and do not use compression. Keep the foot warm and protected, give analgesia, treat infection.', 'Urgent vascular surgery opinion the same day for rest pain, gangrene or infection.'],
      id: ['Anggap sebagai iskemia tungkai yang mengancam sampai perfusi terukur: nyeri istirahat, kaki pucat atau dingin, nadi tidak teraba, jari hitam kering.', 'Periksa nadi, capillary refill, dan sinyal Doppler; ABI di bawah 0,5 kritis, tetapi pada diabetes pakai tekanan jari atau TcPO2 karena arteri mengalami kalsifikasi dan ABI terbaca palsu tinggi.', 'Jangan debridemen nekrosis kering dan jangan kompresi. Jaga kaki hangat dan terlindungi, beri analgesia, terapi infeksi.', 'Konsultasi bedah vaskular hari yang sama bila ada nyeri istirahat, gangren, atau infeksi.'],
    },
    assess: {
      en: ['Pulses, capillary refill, hair loss, skin temperature, pain at rest or on elevation', 'ABI, toe pressure or TcPO2; duplex scan', 'WIfI class: wound, ischaemia, foot infection', 'Smoking, diabetes, kidney disease, statin and antiplatelet use'],
      id: ['Nadi, capillary refill, kerontokan rambut, suhu kulit, nyeri saat istirahat atau diangkat', 'ABI, tekanan jari, atau TcPO2; duplex scan', 'Kelas WIfI: luka, iskemia, infeksi kaki', 'Merokok, diabetes, penyakit ginjal, penggunaan statin dan antiplatelet'],
    },
    clinic: {
      en: ['Keep dry necrosis dry (betadine or a dry dressing) until the limb is revascularised', 'Off-loading, stop smoking, statin and antiplatelet, glucose control', 'Vascular review is the main treatment, not the dressing'],
      id: ['Jaga nekrosis kering tetap kering (povidon iodin atau dressing kering) sampai tungkai direvaskularisasi', 'Off-loading, berhenti merokok, statin dan antiplatelet, kontrol gula', 'Evaluasi vaskular adalah terapi utama, bukan dressing'],
    },
    definitive: {
      en: ['Revascularisation first (endovascular or bypass); debridement or minor amputation only after flow is restored, unless infection is spreading', 'Reconstruct on a perfused bed: skin graft, local or muscle flap; reverse sural and propeller flaps are unreliable here'],
      id: ['Revaskularisasi dulu (endovaskular atau bypass); debridemen atau amputasi minor hanya setelah aliran pulih, kecuali infeksi menyebar', 'Rekonstruksi pada dasar berperfusi: cangkok kulit, flap lokal atau otot; flap reverse sural dan propeller tidak andal di sini'],
    },
    abx: { en: 'Only for infection, guided by deep tissue culture; wet gangrene is a surgical emergency.', id: 'Hanya untuk infeksi, berdasarkan kultur jaringan dalam; gangren basah adalah kedaruratan bedah.' },
    recon: { en: 'Not before revascularisation. Then a graft on a granulating bed or a flap that does not depend on distal flow.', id: 'Tidak sebelum revaskularisasi. Setelah itu cangkok pada dasar granulasi atau flap yang tidak bergantung pada aliran distal.' },
    refer: { en: ['Every suspected arterial ulcer: vascular surgery, urgent if rest pain, gangrene or infection'], id: ['Setiap ulkus arteri yang dicurigai: bedah vaskular, segera bila ada nyeri istirahat, gangren, atau infeksi'] },
    flags: { en: ['Cold pale limb, rest pain', 'Wet gangrene or spreading infection', 'Sepsis'], id: ['Tungkai dingin pucat, nyeri istirahat', 'Gangren basah atau infeksi menyebar', 'Sepsis'] },
    source: 'IWGDF / ESVS; WIfI',
  },
  malignant: {
    name: { en: 'Suspected skin cancer or Marjolin ulcer (biopsy first)', id: 'Dugaan kanker kulit atau ulkus Marjolin (biopsi dulu)' },
    region: 'face',
    ed: {
      en: ['Do not curette, debride or plan reconstruction before histology.', 'Photograph with a scale, record size, border, colour and the nodes in the drainage area.', 'Treat bleeding with pressure and a haemostatic dressing; treat infection.', 'Book a biopsy and a multidisciplinary review; a suspected melanoma goes on the urgent pathway.'],
      id: ['Jangan kuret, debridemen, atau merencanakan rekonstruksi sebelum histologi.', 'Foto dengan skala, catat ukuran, tepi, warna, dan kelenjar di area drainase.', 'Atasi perdarahan dengan tekanan dan dressing hemostatik; terapi infeksi.', 'Jadwalkan biopsi dan tinjauan multidisiplin; dugaan melanoma masuk jalur segera.'],
    },
    assess: {
      en: ['BCC: pearly or rolled border, telangiectasia, slow growth on sun-exposed skin', 'SCC: keratotic crust, rapid growth, tenderness, bleeding; arising on an old scar, burn or chronic ulcer is Marjolin until proven otherwise', 'Melanoma: asymmetry, irregular border, several colours, diameter, change; amelanotic forms look pink or red', 'Satellite nodules, enlarged nodes, immunosuppression, previous radiotherapy'],
      id: ['BCC: tepi mutiara atau menggulung, telangiektasia, tumbuh lambat pada kulit terpapar matahari', 'SCC: krusta keratotik, tumbuh cepat, nyeri tekan, berdarah; muncul pada parut lama, luka bakar, atau ulkus kronik adalah Marjolin sampai terbukti sebaliknya', 'Melanoma: asimetri, tepi tidak teratur, beberapa warna, diameter, perubahan; bentuk amelanotik tampak merah muda atau merah', 'Nodul satelit, kelenjar membesar, imunosupresi, radioterapi sebelumnya'],
    },
    clinic: {
      en: ['Punch biopsy of 4 mm from the edge including normal skin, several sites for a large ulcer; a suspected melanoma gets an excisional biopsy with a 2 mm margin, not a shave', 'Dermoscopy and examination of the nodal basin', 'Review with the histology report in 1 to 2 weeks'],
      id: ['Biopsi punch 4 mm dari tepi termasuk kulit normal, beberapa tempat untuk ulkus besar; dugaan melanoma dapat biopsi eksisional dengan margin 2 mm, bukan shave', 'Dermoskopi dan pemeriksaan kelenjar regional', 'Kontrol dengan hasil histologi dalam 1 sampai 2 minggu'],
    },
    definitive: {
      en: ['Margins follow the histology: BCC 4 mm (5 to 10 mm or Mohs for high-risk sites), SCC 4 to 6 mm (6 to 10 mm if high risk), melanoma by Breslow thickness (in situ 5 mm, up to 1 mm 1 cm, 1 to 2 mm 1 to 2 cm, over 2 mm 2 cm), Marjolin at least 2 cm and down to fascia', 'Sentinel node biopsy is discussed for melanoma over 0.8 mm and for high-risk SCC; Merkel cell carcinoma adds radiotherapy', 'Reconstruct only after clear margins are confirmed'],
      id: ['Margin mengikuti histologi: BCC 4 mm (5 sampai 10 mm atau Mohs untuk lokasi risiko tinggi), SCC 4 sampai 6 mm (6 sampai 10 mm bila risiko tinggi), melanoma menurut ketebalan Breslow (in situ 5 mm, hingga 1 mm 1 cm, 1 sampai 2 mm 1 sampai 2 cm, lebih dari 2 mm 2 cm), Marjolin minimal 2 cm hingga fasia', 'Biopsi sentinel node dibahas untuk melanoma di atas 0,8 mm dan SCC risiko tinggi; karsinoma sel Merkel ditambah radioterapi', 'Rekonstruksi hanya setelah margin bersih dikonfirmasi'],
    },
    abx: { en: 'Not indicated unless infected.', id: 'Tidak diindikasikan kecuali ada infeksi.' },
    recon: { en: 'After clear margins: local flap on the face, graft on the trunk, free flap for large defects with exposed bone. Do not graft over unconfirmed margins.', id: 'Setelah margin bersih: flap lokal di wajah, cangkok di badan, flap bebas untuk defek besar dengan tulang terpapar. Jangan mencangkok di atas margin yang belum terkonfirmasi.' },
    refer: { en: ['Every suspected malignancy: plastic surgery, dermatologic oncology and pathology; melanoma on the urgent two-week pathway'], id: ['Setiap dugaan keganasan: bedah plastik, onkologi kulit, dan patologi; melanoma lewat jalur segera dua minggu'] },
    flags: { en: ['Rapid growth, bleeding, pain or numbness', 'Ulceration on an old scar', 'Satellite lesions or enlarged nodes'], id: ['Tumbuh cepat, berdarah, nyeri atau baal', 'Ulserasi pada parut lama', 'Lesi satelit atau kelenjar membesar'] },
    source: 'NCCN; BAD; NICE',
  },
} satisfies Record<string, Protocol>;
