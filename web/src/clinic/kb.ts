import { lang } from '../i18n';
import { EXTRA } from './kb_extra';

export type L2 = { en: string; id: string };
export type L2s = { en: string[]; id: string[] };
/** Indonesian writes decimals with a comma */
export const dec = (t: string): string => (lang() === 'id' ? t.replace(/(\d)\.(\d)/g, '$1,$2') : t);
export const pick = (o: L2): string => dec(o[lang()]);
export const pickList = (o: L2s): string[] => o[lang()].map(dec);

export type TypeId = 'pressure' | 'diabetic' | 'venous' | 'surgical' | 'trauma' | 'other' | 'burn' | 'arterial' | 'malignant';
export type RegionId = 'sacrum' | 'heel' | 'foot' | 'lowerleg' | 'trunk' | 'limb' | 'face' | 'hand' | 'joint' | 'scalp';

export interface Protocol {
  name: L2;
  /** typical site used when the photo cannot tell us the site */
  region: RegionId;
  ed: L2s; // do now in the emergency department
  assess: L2s;
  clinic: L2s; // outpatient / poli plan
  definitive: L2s;
  abx: L2;
  recon: L2;
  refer: L2s;
  flags: L2s;
  source: string;
}

const BASE: Record<'pressure' | 'diabetic' | 'venous' | 'surgical' | 'trauma' | 'other', Protocol> = {
  pressure: {
    name: { en: 'Pressure injury', id: 'Luka tekan (dekubitus)' },
    region: 'sacrum',
    ed: {
      en: [
        'Take the pressure off first: reposition, pressure-redistributing surface, heels floated, 30 degree side lying.',
        'Look for infection and for a deeper pocket than the surface suggests; probe the base and probe to bone.',
        'Debride only what is clearly dead and wet. A dry, stable eschar on a heel stays until perfusion has been checked.',
        'Cultures from deep tissue after debridement, not a surface swab. Start IV antibiotics only for spreading cellulitis, sepsis or osteomyelitis.',
      ],
      id: [
        'Bebaskan tekanan dulu: reposisi, alas penyebar tekanan, tumit dibuat melayang, miring 30 derajat.',
        'Cari infeksi dan kantong yang lebih dalam dari tampak permukaan; sondase dasar luka dan tes probe-to-bone.',
        'Debridemen hanya jaringan yang jelas mati dan basah. Eskar kering yang stabil di tumit dibiarkan sampai perfusi diperiksa.',
        'Kultur jaringan dalam setelah debridemen, bukan swab permukaan. Antibiotik IV hanya untuk selulitis meluas, sepsis, atau osteomielitis.',
      ],
    },
    assess: {
      en: ['Stage (1 to 4, unstageable, deep tissue injury) and depth by probe', 'Nutrition, albumin as a marker only, glucose, continence, spasticity', 'Osteomyelitis: probe to bone, ESR/CRP, MRI for stage 4'],
      id: ['Stadium (1 sampai 4, tak dapat distadiumkan, cedera jaringan dalam) dan kedalaman dengan sondase', 'Nutrisi, albumin hanya sebagai penanda, gula darah, inkontinensia, spastisitas', 'Osteomielitis: probe-to-bone, LED/CRP, MRI untuk stadium 4'],
    },
    clinic: {
      en: ['Offloading plan agreed with the carers and checked at every visit', 'Moist dressing matched to the bed and the exudate, changed on schedule', 'Measure and photograph every visit; stalled for 2 to 4 weeks means reassess and refer'],
      id: ['Rencana mengurangi tekanan disepakati dengan pengasuh dan dicek tiap kunjungan', 'Dressing lembap sesuai dasar dan eksudat, diganti terjadwal', 'Ukur dan foto tiap kunjungan; tidak membaik 2 sampai 4 minggu berarti nilai ulang dan rujuk'],
    },
    definitive: {
      en: ['Stage 3 and 4: debridement, negative pressure wound therapy once the bed is clean', 'Reconstruction only after infection, nutrition, spasticity and pressure relief are under control (4 to 6 weeks of optimisation)', 'Sacrum and ischium: gluteal rotation or V-Y flap; trochanter: TFL or vastus lateralis flap'],
      id: ['Stadium 3 dan 4: debridemen, terapi tekanan negatif setelah dasar bersih', 'Rekonstruksi hanya setelah infeksi, nutrisi, spastisitas, dan tekanan terkendali (optimasi 4 sampai 6 minggu)', 'Sakrum dan iskium: flap rotasi atau V-Y gluteal; trokanter: flap TFL atau vastus lateralis'],
    },
    abx: { en: 'Systemic only for spreading cellulitis, sepsis or osteomyelitis (6 weeks if the bone is not resected).', id: 'Sistemik hanya untuk selulitis meluas, sepsis, atau osteomielitis (6 minggu bila tulang tidak direseksi).' },
    recon: { en: 'Flap, not graft, for full thickness sacral and ischial wounds once the patient is optimised.', id: 'Flap, bukan graft, untuk luka sakrum dan iskium tebal penuh setelah kondisi pasien optimal.' },
    refer: { en: ['Stage 3 or 4 or unstageable', 'Osteomyelitis', 'No progress after 2 to 4 weeks of good care'], id: ['Stadium 3, 4, atau tak dapat distadiumkan', 'Osteomielitis', 'Tidak membaik setelah 2 sampai 4 minggu perawatan baik'] },
    flags: { en: ['Sepsis from the wound', 'Bone exposed or palpable', 'Spreading cellulitis', 'A wound on an old scar that stops healing (Marjolin)'], id: ['Sepsis dari luka', 'Tulang terpapar atau teraba', 'Selulitis meluas', 'Luka di atas parut lama yang berhenti sembuh (Marjolin)'] },
    source: 'EPUAP/NPIAP/PPPIA 2019; WHS 2023',
  },
  diabetic: {
    name: { en: 'Diabetic foot ulcer', id: 'Ulkus kaki diabetik' },
    region: 'foot',
    ed: {
      en: [
        'Grade the infection (IWGDF/IDSA) and look for a limb threat: wet gangrene, abscess, spreading erythema, systemic signs. If any, admit.',
        'Probe to bone, plain film, and MRI if osteomyelitis is possible.',
        'Check perfusion before anything else is done to the wound: pulses, ABI (can read falsely high from calcification), toe pressure or TcPO2.',
        'Drain pus and debride after perfusion is known; deep tissue culture, not a swab.',
      ],
      id: [
        'Tentukan derajat infeksi (IWGDF/IDSA) dan cari ancaman terhadap tungkai: gangren basah, abses, eritema meluas, tanda sistemik. Bila ada, rawat inap.',
        'Probe-to-bone, rontgen, dan MRI bila osteomielitis mungkin.',
        'Nilai perfusi sebelum luka ditangani: nadi, ABI (bisa palsu tinggi karena kalsifikasi), tekanan jari atau TcPO2.',
        'Drainase pus dan debridemen setelah perfusi diketahui; kultur jaringan dalam, bukan swab.',
      ],
    },
    assess: {
      en: ['Wagner grade and IWGDF infection grade', 'Neuropathy (10 g monofilament), vascular status, glucose and HbA1c, kidney function', 'Footwear and the cause of the ulcer'],
      id: ['Derajat Wagner dan derajat infeksi IWGDF', 'Neuropati (monofilamen 10 g), status vaskular, gula darah dan HbA1c, fungsi ginjal', 'Alas kaki dan penyebab ulkus'],
    },
    clinic: {
      en: ['Offloading is the treatment: a non-removable knee-high device for a plantar neuropathic ulcer', 'Sharp debridement every visit and a dressing matched to exudate', 'Glycaemic control, stop smoking; review in 1 to 2 weeks'],
      id: ['Offloading adalah terapinya: alat non-removable setinggi lutut untuk ulkus plantar neuropati', 'Debridemen tajam tiap kunjungan dan dressing sesuai eksudat', 'Kontrol gula, berhenti merokok; kontrol 1 sampai 2 minggu'],
    },
    definitive: {
      en: ['Healing by secondary intention or a split thickness graft on a granulating bed', 'Plantar defects with exposed bone: local or perforator flap once perfusion is restored', 'Minor amputation and limb salvage belong to a multidisciplinary foot team'],
      id: ['Penyembuhan sekunder atau STSG pada dasar granulasi', 'Defek plantar dengan tulang terpapar: flap lokal atau perforator setelah perfusi pulih', 'Amputasi minor dan penyelamatan tungkai ditangani tim kaki multidisiplin'],
    },
    abx: { en: 'Only for clinical infection. Mild: cephalexin or amoxicillin-clavulanate 1 to 2 weeks. Moderate: add gram-negative cover. Severe: piperacillin-tazobactam or a carbapenem, with MRSA cover if needed. Osteomyelitis without resection: 6 weeks.', id: 'Hanya untuk infeksi klinis. Ringan: sefaleksin atau amoksisilin-klavulanat 1 sampai 2 minggu. Sedang: tambah gram negatif. Berat: piperasilin-tazobaktam atau karbapenem, plus MRSA bila perlu. Osteomielitis tanpa reseksi: 6 minggu.' },
    recon: { en: 'Graft or secondary healing on a clean granulating bed; flap when bone or tendon is exposed and perfusion allows.', id: 'Graft atau sembuh sekunder pada dasar granulasi bersih; flap bila tulang atau tendon terpapar dan perfusi memungkinkan.' },
    refer: { en: ['Moderate to severe infection', 'Critical ischaemia (toe pressure under 30 mmHg, TcPO2 under 25 mmHg, ABI under 0.5)', 'Osteomyelitis or acute Charcot foot', 'No healing in 4 to 6 weeks'], id: ['Infeksi sedang sampai berat', 'Iskemia kritis (tekanan jari di bawah 30 mmHg, TcPO2 di bawah 25 mmHg, ABI di bawah 0,5)', 'Osteomielitis atau Charcot akut', 'Tidak sembuh dalam 4 sampai 6 minggu'] },
    flags: { en: ['Wet or dry gangrene with sepsis', 'A hot red swollen foot of sudden onset (Charcot or infection)'], id: ['Gangren basah atau kering dengan sepsis', 'Kaki merah, panas, bengkak mendadak (Charcot atau infeksi)'] },
    source: 'IWGDF/IDSA 2023; WHS 2023',
  },
  venous: {
    name: { en: 'Venous leg ulcer', id: 'Ulkus vena' },
    region: 'lowerleg',
    ed: {
      en: ['Rule out infection and acute DVT before compression.', 'Measure the ABI before any compression: 0.8 or more for full compression, 0.5 to 0.8 for reduced, under 0.5 none.', 'Look for the signs of chronic venous disease: oedema, hemosiderin, lipodermatosclerosis, varicosities.'],
      id: ['Singkirkan infeksi dan DVT akut sebelum kompresi.', 'Ukur ABI sebelum kompresi: 0,8 atau lebih untuk kompresi penuh, 0,5 sampai 0,8 kompresi ringan, di bawah 0,5 jangan kompresi.', 'Cari tanda penyakit vena kronik: edema, hemosiderin, lipodermatosklerosis, varises.'],
    },
    assess: { en: ['ABI; duplex for superficial and deep reflux', 'Typical site is the gaiter area, shallow, irregular edge, heavy exudate', 'Biopsy if atypical or not healing in 3 months'], id: ['ABI; duplex untuk refluks superfisial dan dalam', 'Lokasi khas area gaiter, dangkal, tepi tidak teratur, eksudat banyak', 'Biopsi bila atipikal atau tidak sembuh dalam 3 bulan'] },
    clinic: { en: ['Multilayer compression 30 to 40 mmHg with leg elevation and walking', 'Foam or alginate for exudate; treat the surrounding eczema', 'Early referral for superficial reflux ablation'], id: ['Kompresi multilapis 30 sampai 40 mmHg dengan elevasi dan berjalan', 'Foam atau alginat untuk eksudat; obati eksim sekitar', 'Rujuk dini untuk ablasi refluks superfisial'] },
    definitive: { en: ['Treat the reflux (EVRA), which heals faster and recurs less', 'Pinch or split thickness graft only after the bed is clean and the reflux is treated', 'Compression for life; recurrence is high without it'], id: ['Tangani refluks (EVRA), sembuh lebih cepat dan jarang kambuh', 'Pinch atau STSG hanya setelah dasar bersih dan refluks ditangani', 'Kompresi seumur hidup; kekambuhan tinggi tanpa itu'] },
    abx: { en: 'Only for clinical infection, not for colonisation.', id: 'Hanya untuk infeksi klinis, bukan kolonisasi.' },
    recon: { en: 'Graft after the bed is clean and the venous cause is treated; compression afterwards.', id: 'Graft setelah dasar bersih dan penyebab vena ditangani; kompresi sesudahnya.' },
    refer: { en: ['Not healing at 12 weeks', 'ABI under 0.8 or a mixed picture', 'Atypical look or pain out of proportion'], id: ['Tidak sembuh pada 12 minggu', 'ABI di bawah 0,8 atau gambaran campuran', 'Tampilan atipikal atau nyeri tidak sebanding'] },
    flags: { en: ['Pale and cold limb (arterial)', 'Atypical growth (Marjolin, SCC)', 'Recurrent cellulitis'], id: ['Tungkai pucat dan dingin (arteri)', 'Pertumbuhan atipikal (Marjolin, SCC)', 'Selulitis berulang'] },
    source: 'ESVS 2022; WHS',
  },
  surgical: {
    name: { en: 'Surgical wound (dehiscence or infection)', id: 'Luka bedah (dehisensi atau infeksi)' },
    region: 'trunk',
    ed: {
      en: ['Open the infected part of the wound, drain it, and take a culture from the depth.', 'Fascial dehiscence or evisceration: cover with saline gauze, do not push back, keep nil by mouth and go to theatre.', 'Check glucose and look for a deep collection or necrotising infection (pain out of proportion, systemic toxicity).'],
      id: ['Buka bagian luka yang terinfeksi, drainase, dan kultur dari bagian dalam.', 'Dehisensi fasia atau eviserasi: tutup kasa NaCl lembap, jangan didorong masuk, puasa, dan ke kamar operasi.', 'Cek gula darah dan cari kolekasi dalam atau infeksi nekrotikans (nyeri tak sebanding, toksik sistemik).'],
    },
    assess: { en: ['Day after surgery, implants, glucose, nutrition, smoking, steroids', 'Erythema over 2 cm, heat, pus, fever', 'Superficial or fascial dehiscence'], id: ['Hari pascaoperasi, implan, gula darah, nutrisi, rokok, steroid', 'Eritema lebih dari 2 cm, panas, pus, demam', 'Dehisensi superfisial atau fasia'] },
    clinic: { en: ['Packing or a moisture dressing changed on schedule, or negative pressure once clean', 'Review in 2 to 3 days if infected, weekly if clean and granulating'], id: ['Packing atau dressing lembap diganti terjadwal, atau tekanan negatif bila sudah bersih', 'Kontrol 2 sampai 3 hari bila terinfeksi, mingguan bila bersih dan granulasi'] },
    definitive: { en: ['Debride dead tissue, negative pressure (-80 to -125 mmHg) once infection is controlled', 'Delayed closure or a flap if fascia or an implant is exposed'], id: ['Debridemen jaringan mati, tekanan negatif (-80 sampai -125 mmHg) setelah infeksi terkendali', 'Penutupan tertunda atau flap bila fasia atau implan terpapar'] },
    abx: { en: 'Only for spreading cellulitis, systemic signs or an implant: cefazolin or clindamycin (vancomycin or linezolid for MRSA), adjusted to culture, 5 to 7 days after source control.', id: 'Hanya untuk selulitis meluas, tanda sistemik, atau implan: sefazolin atau klindamisin (vankomisin atau linezolid untuk MRSA), sesuaikan kultur, 5 sampai 7 hari setelah kontrol sumber.' },
    recon: { en: 'Secondary healing with negative pressure for superficial wounds; muscle, omental or fasciocutaneous flap when an implant is exposed.', id: 'Sembuh sekunder dengan tekanan negatif untuk luka superfisial; flap otot, omentum, atau fasiokutan bila implan terpapar.' },
    refer: { en: ['Fascial dehiscence', 'Infected implant', 'Suspected necrotising fasciitis'], id: ['Dehisensi fasia', 'Implan terinfeksi', 'Curiga fasiitis nekrotikans'] },
    flags: { en: ['Pain out of proportion with systemic toxicity', 'Evisceration'], id: ['Nyeri tak sebanding dengan toksik sistemik', 'Eviserasi'] },
    source: 'CDC/NHSN; WSES',
  },
  trauma: {
    name: { en: 'Traumatic wound', id: 'Luka traumatik' },
    region: 'limb',
    ed: {
      en: ['Stop the bleeding with direct pressure; a tourniquet only for uncontrolled limb bleeding.', 'Check distal sensation, movement and perfusion, and look for tendon, nerve or joint involvement before anaesthetic.', 'Irrigate with at least 50 to 100 mL per cm of wound, debride only clearly dead tissue.', 'Tetanus status, and X-ray if glass, metal or a fracture is possible.'],
      id: ['Hentikan perdarahan dengan tekanan langsung; torniket hanya untuk perdarahan ekstremitas yang tidak terkontrol.', 'Periksa sensasi, gerak, dan perfusi distal, dan cari keterlibatan tendon, saraf, atau sendi sebelum anestesi.', 'Irigasi minimal 50 sampai 100 mL per cm panjang luka, debridemen hanya jaringan yang jelas mati.', 'Status tetanus, dan rontgen bila mungkin ada kaca, logam, atau fraktur.'],
    },
    assess: { en: ['Mechanism, time since injury, contamination', 'Depth: skin, fat, fascia, muscle, tendon or bone', 'High-tension site or a vital structure nearby (eyelid, lip, parotid duct)'], id: ['Mekanisme, waktu sejak cedera, kontaminasi', 'Kedalaman: kulit, lemak, fasia, otot, tendon, atau tulang', 'Lokasi tegangan tinggi atau struktur vital di dekatnya (kelopak, bibir, duktus parotis)'] },
    clinic: { en: ['Keep the dressing moist and non-adherent, review at 48 hours', 'Sutures out after 5 to 7 days on the face, 10 to 14 days on the trunk and limbs, 14 days over joints'], id: ['Jaga dressing lembap dan tidak lengket, kontrol 48 jam', 'Angkat jahitan 5 sampai 7 hari di wajah, 10 sampai 14 hari di badan dan tungkai, 14 hari di atas sendi'] },
    definitive: { en: ['Layered primary closure if clean: face to about 24 hours, trunk and limbs 12 to 18 hours, delayed closure for heavily contaminated hand and foot wounds', 'Tissue loss: local flap, or split thickness graft on a clean bed'], id: ['Tutup primer berlapis bila bersih: wajah sampai sekitar 24 jam, badan dan tungkai 12 sampai 18 jam, penutupan tertunda untuk luka tangan dan kaki yang sangat kotor', 'Kehilangan jaringan: flap lokal, atau STSG pada dasar bersih'] },
    abx: { en: 'Not routine. Consider for heavy contamination, deep hand or foot wounds, immunosuppression or presentation after 12 to 24 hours.', id: 'Tidak rutin. Pertimbangkan untuk kontaminasi berat, luka dalam tangan atau kaki, imunosupresi, atau datang setelah 12 sampai 24 jam.' },
    recon: { en: 'Primary closure first; a local flap if tension is high; a graft only on a clean vascular bed.', id: 'Tutup primer dulu; flap lokal bila tegangan tinggi; graft hanya pada dasar berpembuluh yang bersih.' },
    refer: { en: ['Tendon, nerve, vessel or joint injury', 'Open fracture', 'Difficult facial wound'], id: ['Cedera tendon, saraf, pembuluh, atau sendi', 'Fraktur terbuka', 'Luka wajah yang sulit'] },
    flags: { en: ['Neurovascular deficit', 'Foreign body left behind', 'Compartment syndrome'], id: ['Defisit neurovaskular', 'Benda asing tertinggal', 'Sindrom kompartemen'] },
    source: 'ATLS; ACEP wound care',
  },
  other: {
    name: { en: 'Unclassified chronic wound (consider biopsy)', id: 'Luka kronik tak terklasifikasi (pertimbangkan biopsi)' },
    region: 'limb',
    ed: {
      en: ['A wound that has not healed in 4 to 6 weeks despite good care needs a biopsy before any definitive reconstruction.', 'Punch biopsy of 4 mm at the edge including normal skin, more than one site for a large chronic wound.'],
      id: ['Luka yang tidak sembuh dalam 4 sampai 6 minggu meski perawatan baik perlu biopsi sebelum rekonstruksi definitif.', 'Biopsi punch 4 mm di tepi termasuk kulit normal, lebih dari satu tempat untuk luka kronik besar.'],
    },
    assess: { en: ['Rolled or pearly edge, nodule, friable tissue, hypergranulation, irregular pigment', 'Old burn scar or decades-old chronic wound (Marjolin), sun-exposed skin, immunosuppression, radiotherapy', 'Regional lymph nodes'], id: ['Tepi menggulung atau mutiara, nodul, jaringan rapuh, hipergranulasi, pigmen tidak teratur', 'Parut luka bakar lama atau luka kronik puluhan tahun (Marjolin), kulit terpapar matahari, imunosupresi, radioterapi', 'Kelenjar getah bening regional'] },
    clinic: { en: ['Biopsy first, treat the cause second, reconstruct last', 'Review with the histology result'], id: ['Biopsi dulu, tangani penyebab kemudian, rekonstruksi terakhir', 'Kontrol dengan hasil histologi'] },
    definitive: { en: ['Excision margins follow the histology: BCC about 4 mm, SCC 4 to 6 mm (6 to 10 mm if high risk), Marjolin at least 2 cm', 'Reconstruct after clear margins are confirmed'], id: ['Margin eksisi mengikuti histologi: BCC sekitar 4 mm, SCC 4 sampai 6 mm (6 sampai 10 mm bila risiko tinggi), Marjolin minimal 2 cm', 'Rekonstruksi setelah margin bersih terkonfirmasi'] },
    abx: { en: 'Not indicated unless there is infection.', id: 'Tidak diindikasikan kecuali ada infeksi.' },
    recon: { en: 'After clear margins only: local flap on the face, graft on the trunk, free flap for large defects with exposed bone.', id: 'Hanya setelah margin bersih: flap lokal di wajah, graft di badan, flap bebas untuk defek besar dengan tulang terpapar.' },
    refer: { en: ['Every suspected malignancy: plastic surgery, skin oncology, pathology'], id: ['Setiap kecurigaan keganasan: bedah plastik, onkologi kulit, patologi'] },
    flags: { en: ['Rapid growth, nerve pain, ulceration on an old scar', 'Enlarged nodes'], id: ['Pertumbuhan cepat, nyeri saraf, ulserasi pada parut lama', 'Kelenjar membesar'] },
    source: 'NCCN; BAD',
  },
};

export const TYPES: Record<TypeId, Protocol> = { ...BASE, ...EXTRA };

export const REGIONS: Record<RegionId, { name: L2; zone: string }> = {
  sacrum: { name: { en: 'Sacrum or buttock', id: 'Sakrum atau glutea' }, zone: 'tekanan' },
  heel: { name: { en: 'Heel', id: 'Tumit' }, zone: 'tekanan' },
  foot: { name: { en: 'Foot', id: 'Kaki' }, zone: 'tekanan' },
  lowerleg: { name: { en: 'Lower leg', id: 'Tungkai bawah' }, zone: 'tungkai-bawah' },
  trunk: { name: { en: 'Trunk', id: 'Badan' }, zone: 'umum' },
  limb: { name: { en: 'Limb', id: 'Anggota gerak' }, zone: 'umum' },
  face: { name: { en: 'Face', id: 'Wajah' }, zone: 'estetik' },
  hand: { name: { en: 'Hand', id: 'Tangan' }, zone: 'fungsional' },
  joint: { name: { en: 'Over a joint', id: 'Di atas sendi' }, zone: 'fungsional' },
  scalp: { name: { en: 'Scalp', id: 'Kulit kepala' }, zone: 'umum' },
};

export const TIME_RULES = {
  necrosis30: { en: 'Mostly necrotic: debride (sharp if the limb is not ischaemic, otherwise autolytic with hydrogel). Leave a dry stable eschar on an ischaemic limb.', id: 'Dominan nekrotik: debridemen (tajam bila tungkai tidak iskemik, atau autolitik dengan hidrogel). Eskar kering stabil pada tungkai iskemik dibiarkan.' },
  necrosis10: { en: 'Some necrosis: serial sharp or autolytic debridement.', id: 'Sebagian nekrotik: debridemen tajam berurutan atau autolitik.' },
  slough30: { en: 'Heavy slough: hydrogel, medical honey or hydrofibre/alginate according to exudate, with staged sharp debridement.', id: 'Slough luas: hidrogel, madu medis, atau hidrofiber/alginat sesuai eksudat, dengan debridemen tajam bertahap.' },
  slough10: { en: 'Some slough: alginate or hydrofibre, and think about debridement.', id: 'Sebagian slough: alginat atau hidrofiber, pertimbangkan debridemen.' },
  gran50: { en: 'Mostly granulating: thin foam or hydrocolloid to keep it moist; a clean bed is ready for a graft or negative pressure.', id: 'Dominan granulasi: foam atau hidrokoloid tipis agar tetap lembap; dasar bersih siap untuk graft atau tekanan negatif.' },
  epi30: { en: 'Epithelialising: a non-adherent silicone or tulle dressing, changed as rarely as possible.', id: 'Epitelisasi: dressing silikon atau tulle non-lengket, diganti sejarang mungkin.' },
  unclear: { en: 'Composition unclear: retake the photo in even light.', id: 'Komposisi tidak jelas: foto ulang dengan cahaya merata.' },
};

export const tetanus = {
  en: 'Tetanus: give a booster if the last dose was more than 5 years ago for a dirty wound (10 years for a clean minor one); add immunoglobulin 250 IU when the primary course is incomplete or unknown and the wound is high risk.',
  id: 'Tetanus: booster bila dosis terakhir lebih dari 5 tahun untuk luka kotor (10 tahun untuk luka bersih minor); tambahkan imunoglobulin 250 IU bila seri primer belum lengkap atau tidak diketahui dan luka berisiko tinggi.',
};
