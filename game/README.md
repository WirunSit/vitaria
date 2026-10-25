# VITARIA — ตัวเกม (v0.4)

เกม Open-World Action RPG สอนชีววิทยา ม.ปลาย — เวอร์ชันเว็บ (Three.js + TypeScript) เปิดเล่นในเบราว์เซอร์ได้ทันที

> เอกสารออกแบบทั้งหมดอยู่ที่ [`../docs`](../docs) และไฟล์สั่งภาพ GPT อยู่ที่ [`../GPT_IMAGE_PROMPTS.md`](../GPT_IMAGE_PROMPTS.md)

## วิธีรัน

```bash
npm install
```

```bash
npm run dev
```
แล้วเปิด http://localhost:5173

Build สำหรับนำขึ้นเว็บ (โฟลเดอร์ `dist/` วางบน GitHub Pages / Netlify / เว็บโรงเรียนได้เลย):
```bash
npm run build
```
> ⚠️ เปิด `dist/index.html` ด้วยการดับเบิลคลิกตรง ๆ ไม่ได้ (เบราว์เซอร์บล็อกการโหลดไฟล์ข้อมูล) ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ เช่น `npm run preview`

## สิ่งที่เล่นได้แล้ว
- **บทนำครบ 6 เควส** (~45–60 นาที): ตื่นในหุบเซลล์ → รูปปั้นต้นไม้แห่งชีวิต → ปริศนาวิธีการทางวิทยาศาสตร์ → ไมโทร่า → อัลวี + ร่อน → บอสราชาแบคทีเรีย → สอบเข้าสถาบัน
- **ตัวละครเล่นได้ 7 ตัว**: นักเดินทาง (Geo), ไมโทร่า (Pyro), อัลวี (Anemo), คลอเรน (Dendro) + ★5 จาก Gene Wish: ฮีม่า (Hydro), นิวรอส (Electro), เฮลิกซ์ (Cryo) — สกิล E/Q ครบ, ลำดับยีน C1–C6
- **ระบบธาตุและปฏิกิริยา 12 แบบ** (Aura, ICD, สูตรดาเมจตามเอกสาร 02) — ค้นพบครั้งแรกได้การ์ด + คำถาม
- **ศัตรู**: ค็อกคัส/บาซิลลัสสไลม์ (แบ่งตัวแบบทวิภาคได้จริง), เฟจโดรน (เกาะแบคทีเรียแล้วทำให้แตก = วัฏจักรไลติก), หุ่นฝึก, บอสราชาแบคทีเรีย (โล่ความรู้ 2 ครั้ง)
- **ยาปฏิชีวนะ (Z)**: ได้ผลกับแบคทีเรีย ไม่มีผลกับไวรัส
- **สำรวจ**: วิ่ง/วิ่งเร็ว/หลบ/กระโดด/ร่อน (ปีกซามารา), ความอึด, ลุยน้ำ, จุดวาร์ป 7 จุด, ลูกแก้ว 10 ลูก, หีบ 7 ใบ, กลางวัน–กลางคืน
- **ระบบเรียนรู้**: Quiz (ปรนัย/ถูก-ผิด/เรียงลำดับ) + คำใบ้ 3 ระดับ + คำอธิบายทุกข้อ, Mastery รายหัวข้อ, ทบทวนประจำวันแบบ Leitner, Bio-Scanner (T), Bio-Pedia 33 การ์ด, รายงานการเรียนรู้
- **ตัวละคร**: เลเวลด้วยน้ำตาล (EXP), เลื่อนขั้นต้องผ่าน "บททดสอบเซลล์"
- **Gene Wish (G)**: ตู้มือใหม่/แบนเนอร์/ถาวร, การันตี, 50/50, ห้องแล็บความน่าจะเป็น, โหมดห้องเรียนปิดระบบสุ่มได้
- **Lab Domain 3 แห่ง + พลังงาน ATP + ทาเลนต์**: เดินไปที่ประตูโดเมน (เปิดหลังจบบทนำ) · สภาพแวดล้อมผิดปกติประจำวันพร้อมคำอธิบายชีววิทยา · Lab Pre-check · ตำราทาเลนต์ตามวันในสัปดาห์
- **อาวุธ 15 ชิ้น + Bio-Relic 4 ชุด** (หน้าตัวละคร C → แท็บอาวุธ/Bio-Relic, กระเป๋า B) · ได้จากหีบ แคมป์ ทบทวนประจำวัน และบอสโลกราชาแบคทีเรียที่เกิดซ้ำหลังจบบทนำ
- **บันทึกอัตโนมัติ** (localStorage) ทุก 60 วินาที / จบเควส / ปิดหน้าเว็บ

## การควบคุม
| ปุ่ม | การกระทำ |
|-----|---------|
| WASD | เดิน (Shift ค้าง = วิ่งเร็ว) |
| เมาส์ | หมุนกล้อง (คลิกที่เกมเพื่อล็อกเมาส์) · ล้อเมาส์ = ซูม |
| Space | กระโดด / ร่อนกลางอากาศ |
| Shift / คลิกขวา | หลบ |
| คลิกซ้าย | โจมตี (ค้างแล้วปล่อย = โจมตีหนัก) |
| E / Q | สกิลธาตุ / ท่าไม้ตาย |
| 1–4 | สลับตัวละคร |
| F | คุย / ตรวจสอบ / เปิดหีบ |
| T | Bio-Scanner |
| Z | ยาปฏิชีวนะ |
| J / K / C / M / H | เควส / Bio-Pedia / ตัวละคร / แผนที่ / วิธีเล่น |
| B / G | กระเป๋า / Gene Wish |
| Esc | เมนู (ทบทวนประจำวัน, ตั้งค่า, บันทึก) |

## 🎨 นำภาพจาก GPT เข้าเกม

1. วางภาพที่ GPT สร้างไว้ใน `../Assets/_Project/Art/` ตามโครงสร้างโฟลเดอร์และชื่อไฟล์ใน `GPT_IMAGE_PROMPTS.md`
2. รันสคริปต์นำเข้า (ต้องมี Python + Pillow):
```bash
python tools/import_assets.py
```
3. รีเฟรชเกม — สคริปต์จะ
   - ตัดแผ่นรวมเป็นไฟล์แยกอัตโนมัติ (สีหน้า 8 แบบ, ไอคอนไอเทม, อาวุธ, Bio-Relic, ปฏิกิริยา, แกนชีวิต, อาหาร)
   - ลบพื้นหลังสีอ่อนของภาพ NPC/อะมีบี้ และทำขอบนุ่มให้ภาพที่มีพื้นหลัง
   - ย่อขนาด/บีบอัด (สีหน้าเป็น `.webp`, Splash/ฉากเป็น `.jpg`) แล้วเขียนลง `public/assets/` พร้อม `manifest.json`

ถ้ายังไม่มีภาพของบางอย่าง เกมจะใช้ภาพสำรองที่วาดเองอัตโนมัติ

## 🧍 โมเดล 3 มิติ (VRoid / AI)
วางไฟล์ `.vrm` (ตัวละคร/NPC จาก VRoid Studio) และ `.glb` (ศัตรูจาก AI image-to-3D) ใน `../Assets/_Project/Models/` ตามชื่อใน [README ของโฟลเดอร์นั้น](../Assets/_Project/Models/README.md) แล้วรัน `python tools/import_assets.py`
- ตัวละคร VRM ขยับด้วยแอนิเมชันกระดูกที่เกมสร้างให้ (เดิน วิ่ง กระโดด ร่อน โจมตี กะพริบตา) และติดอาวุธที่มือให้อัตโนมัติ
- ศัตรู GLB ถูกแปลงเป็นสไตล์การ์ตูน ย้อมสีตามธาตุ และปรับขนาดให้พอดีอัตโนมัติ
- ถ้าไม่มีไฟล์ เกมใช้โมเดลชั่วคราวเหมือนเดิม

| ภาพในเกม | ไฟล์ที่สคริปต์สร้าง |
|---------|-------------------|
| หน้าแรก / หน้าโหลด | `public/assets/ui/UI_TitleBackground.jpg`, `KEY_MainVisual.jpg`, `LOGO_Vitaria.png` |
| ไอคอน / สีหน้า / Splash ตัวละคร | `public/assets/characters/CHR_<ชื่อ>_Icon.png`, `_Portrait_<อารมณ์>.webp`, `_Splash.jpg` |
| NPC | `public/assets/characters/NPC_<ชื่อ>_Portrait.webp`, `_Icon.png` |
| ไอคอนสกิล / ธาตุ / ปฏิกิริยา | `public/assets/ui/SKL_*.png`, `UI_Element_*.png`, `UI_Reaction_*.png` |
| ไอเทม / อาวุธ / Relic | `public/assets/items/<ITEM_ID>.png`, `weapons/WPN_*.png`, `relics/RLC_<ชุด>_<ช่อง>.png` |
| การ์ด Bio-Pedia | `public/assets/codex/<CDX_ID>.png` |

> โมเดล 3 มิติของตัวละครตอนนี้เป็นโมเดลชั่วคราวที่สร้างด้วยโค้ดจากข้อมูลรูปลักษณ์ (สีผม ทรงผม ชุด) — จะแทนที่ด้วยโมเดลจริง (VRoid/Blender → .glb) ในเฟสถัดไป

## โครงสร้างโค้ด
```
game/
├── public/
│   ├── data/            ← เนื้อหาเกมทั้งหมด (JSON) แก้ได้โดยไม่ต้องเขียนโค้ด
│   │   ├── characters.json  quests.json  dialogues.json  questions.json
│   │   ├── quizsets.json    codex.json   enemies.json    items.json  locations.json  npcs.json
│   │   └── weapons.json     relics.json
│   └── assets/          ← วางภาพจาก GPT ที่นี่
├── src/
│   ├── core/            EventBus, Input, Data, Save, Assets, Audio, types
│   ├── world/           Terrain (ภูมิประเทศ), World (ฉาก/สิ่งของ), Materials (toon shader)
│   ├── player/          PlayerController, CharacterModel, Party (ค่าสถานะ)
│   ├── combat/          Elements (ปฏิกิริยา), Combat (ดาเมจ), Skills (ชุดสกิลตัวละคร), Effects
│   ├── enemies/         Enemy (AI + โมเดล)
│   ├── quest/           QuestManager
│   ├── learning/        Learning (Mastery + Leitner)
│   ├── gacha/           Gacha (อัตรา, การันตี, 50/50)
│   ├── gear/            Gear (อาวุธ, Bio-Relic, ค่าสถานะ), GearEffects (ความสามารถพิเศษ/โบนัสชุด)
│   ├── domain/          Atp (พลังงาน ATP), DomainController (โดเมน คลื่นศัตรู รางวัล)
│   ├── models/          ModelLibrary, CharacterModels (VRM), EnemyModels (GLB)
│   ├── ui/              HUD, WorldUI, DialogueUI, QuizUI, Menus, Title
│   ├── Game.ts          ตัวรวมทุกระบบ
│   └── main.ts
└── tools/               import_assets.py, crop_sheet.py, test-harness.js
```

## เพิ่มเนื้อหาใหม่ (ไม่ต้องแก้โค้ด)
- **คำถามใหม่** → เพิ่มใน `public/data/questions.json` (รูปแบบตามเอกสาร `docs/07`) แล้วใส่ id ลงใน `quizsets.json`
- **เควสใหม่** → เพิ่มใน `quests.json` + บทสนทนาใน `dialogues.json` (Objective 11 แบบ: TALK, GOTO, COLLECT, DEFEAT, SCAN, QUIZ, PUZZLE, INTERACT, USE_SKILL, REACTION, DELIVER)
- **การ์ดความรู้ใหม่** → `codex.json`
- **ตัวละครใหม่** → ข้อมูลใน `characters.json` + ชุดสกิลใน `src/combat/Skills.ts` (ส่วนนี้ต้องเขียนโค้ด)

## ทดสอบอัตโนมัติ (สำหรับนักพัฒนา)
เปิดเกม แล้วใน Console ของเบราว์เซอร์:
```js
await import('/tools/test-harness.js')
```
จากนั้นใช้ `T.tpLoc('LOC_STATUE')`, `T.fight()`, `T.answer()`, `T.skip()`, `T.quest()` ฯลฯ

## ข้อจำกัดที่รู้แล้ว (จะทำต่อ)
- ยังไม่มีทำอาหาร, คราฟต์, Terrarium, Teacher Dashboard, บทที่ 1 · อาวุธ/ตัวละครเลื่อนขั้นได้ถึงเลเวล 40
- ยังปีนผาไม่ได้ (เดินขึ้นได้เฉพาะทางลาด) · ยังไม่มีเพลงประกอบ (มีแค่เสียงเอฟเฟกต์สังเคราะห์)
- Passive ของตัวละครปลดเมื่อเลื่อนขั้นครั้งแรก (ในเอกสารคือขั้น 1 และ 4 — ย่อให้เห็นผลใน Vertical Slice)
- เนื้อหาชีววิทยาทั้งหมดยังเป็นร่าง **ต้องให้ครูตรวจ** ก่อนใช้จริง
