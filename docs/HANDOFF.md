# ส่งต่องาน VITARIA — 2026-10-24

อ่านไฟล์นี้ก่อนเริ่มงาน แล้วทำ "งานที่ค้าง" ตามลำดับ ตอบผู้ใช้เป็นภาษาไทย

## โปรเจกต์
- เกม 3D สไตล์เกนชินสอนชีววิทยา (Three.js + TypeScript + Vite) โค้ดอยู่ `D:\Genshin Impact\game`
- รันเกม: Browser pane → `preview_start` ชื่อ `vitaria-dev` (port 5173) · ทดสอบในคอนโซล: `await import('/tools/test-harness.js')` แล้วใช้ `T.tp/T.step/T.skip`
- ตรวจ type: `cd game && npx tsc --noEmit -p .`
- ประวัติการเปลี่ยนแปลง: `docs/10_Roadmap_และการอัปเดต.md` (เวอร์ชันล่าสุดที่บันทึก v0.15.3) — เพิ่มรายการใหม่ทุกครั้งที่แก้
- การ์ดจอผู้ใช้: Intel UHD 630 → ต้องระวังประสิทธิภาพ (มีเมนู Esc → "แสดง FPS")

## ระบบโมเดล (ทำเสร็จแล้ว)
- รายการโมเดลที่ผู้ใช้เลือก: `game/tools/model_picks.json` (มีตัวเลือก `drop`, `baseColor`, `insideOut`, `pack`)
- นำเข้า: `python tools/import_downloads.py [CODE...]` (ลดโพลี + WebP + สร้าง `_lod.glb`; `--lod` สร้างเฉพาะ LOD) แล้ว `python tools/import_assets.py` คัดลอกเข้า `public/assets`
- เครดิต CC BY สร้างอัตโนมัติ → เมนู Esc "เครดิตโมเดล 3D"
- ต้นไม้/หิน/ดอกไม้: `src/world/Flora.ts` (แบ่งช่อง 40 ม., LOD, ซ่อนตามระยะ, หิมะ/ย้อมสีใน shader) วางใน `World.buildFlora()`, `Genovia.trees()`, `Zepheria.trees()`
- ศัตรู: `src/models/EnemyModels.ts` (เล่นคลิปในไฟล์ หรือขยับทั้งตัวตามประเภท) · ศัตรูไกล >140 ม. หลับ
- โมเดลมีโครงกระดูก: เส้นขอบตามโครง (`Materials.skinnedOutline`) · `relaxArms` ปรับแขนลงจากท่า T
- ดาวน์โหลด Sketchfab ผ่าน Claude in Chrome (ผู้ใช้ล็อกอินไว้) เลือก GLB 1k · ห้ามดาวน์โหลดด้วยบัญชีผู้ใช้โดยไม่ถาม

## เสร็จแล้ว (2026-10-17)
- v0.7.5 เอฟเฟกต์การต่อสู้ ตรวจในเกมแล้ว · v0.7.6 ท่าทาง Mixamo 11 ท่า (`src/models/MixamoAnims.ts`, `public/assets/anims/sword_*.fbx`) ต่อเข้า `VrmCharacterModel` แล้ว ทดสอบกับ `CHR_Sira.vrm` · ลบการสั่นกล้องตอนใช้ท่าไม้ตาย
- ดาวน์โหลด Mixamo: export ผ่าน API ในหน้าเว็บแล้วคลิกลิงก์ทีละไฟล์ (ผู้ใช้อนุญาตให้ mixamo.com ดาวน์โหลดหลายไฟล์ใน Chrome แล้ว) · ส่ง export ถี่เกินจะได้ 429 ต้องเว้นช่วง

## งานที่ค้าง
- v0.7.7 ดาวน์โหลด VRoid Hub แล้ว 8 ตัว ใช้แล้ว 7 ตัว (ดู Roadmap) · TW-01 ルイケ (สาวผมทองใส่เกราะ) อยู่ `Assets/_Project/VRoid_Unused/Ruike.vrm` ยังไม่ได้ใช้ (ผู้ใช้เลือก TW-07 เป็นทหารยามแทน → `World.buildGuards()`) (ย้ายไป `Models/NPCs/<Art>.vrm` แล้วรัน `import_assets.py` + แก้ `name`/`file` ของ NPC_Ruike ใน `tools/vroid_picks.json` ให้ตรงชื่อใหม่)
- เครดิต VRoid: `tools/vroid_picks.json` → `import_downloads.credits()`
- เรนเจอร์ไลลา (หมวกแม่มดใหญ่) ตัวเตี้ยกว่าคนอื่นนิดหน่อย เพราะปรับความสูงรวมหมวก
- v0.7.8 หญ้าแบบเกนชิน เปิดเป็นค่าเริ่มต้น (สวิตช์ Esc → หญ้าแบบใหม่) — รอผู้ใช้ยืนยันว่าชอบ ถ้าไม่ชอบให้ตั้ง `oldGrass` เป็นค่าเริ่มต้นหรือปรับต่อ
- v0.7.9 ทางดิน (`Ground.ts` mask + shader พื้น) + หญ้าสูงต่ำ/รวง/ดอกไม้ — ผู้ใช้ตั้งกราฟิก "ต่ำ" ไว้ (ตอนนี้ได้หญ้า 35%)
- ภาพหน้าจอตอนหน้าต่างแอปถูกซ่อน: render แล้ว `canvas.toDataURL` ส่ง POST ไปเซิร์ฟเวอร์เล็ก ๆ (scratchpad `recv.js` port 5199) แล้ว Read ไฟล์
- v0.8.0 ท่าตามอาวุธ/ตัวละคร: แก้ชุดท่าที่ `WEAPON_SETS` / `CHAR_SETS` ใน `src/models/MixamoAnims.ts` (ไฟล์ `public/assets/anims/<ชื่อ>.fbx`) · ตรวจภาพด้วย `tools/anim-sheet.js` + `recv.js`
- v0.8.1 เอฟเฟกต์สกิล: `efx()` จาก `src/render/ElementFX.ts` (cast / burst / ring / attach / streak / inhale) · Blast/RingPulse เรียกใช้อัตโนมัติ · ตรวจด้วย `tools/kit-fx.js` (ต้องรัน `recv.js`)
- 2026-10-18 ผู้ใช้ใส่โมเดลนักเดินทางชาย `Rigged Traveler male.vrm` → เปลี่ยนชื่อเป็น `Assets/_Project/Models/Characters/Sion.vrm` (เกมใช้ `CHR_Sion.vrm`) ท่าทางครบ 12 ท่า · ⚠️ ดูเหมือนโมเดล Aether จากเกนชินจริง (meta ผู้สร้าง = "a") ขัดกับกฎ 'ไม่ใช้โมเดลติดลิขสิทธิ์' — ผู้ใช้ยืนยัน 2026-10-18 ให้ใช้โมเดลนี้ต่อ (ถ้าจะเผยแพร่เกมควรเตือนเรื่องลิขสิทธิ์อีกครั้ง; ตัวสำรองจาก VRoid Hub: ファンタジー風イケメン id 4639133330857729324)
- v0.9.0 เสียง: `src/core/Audio.ts` (sfx / music / ambience / setListener) · ไฟล์ `public/assets/audio/{music,sfx}` ต้นฉบับ `Assets/_Project/Audio/_src` · เพิ่มกลุ่มเสียงใหม่ต้องแก้ `GROUPS` · เส้นแสงดาบ `src/models/WeaponTrail.ts`
- v0.9.2 ผู้ติดตามลอยตัว = โมเดล Paimon (แฟนเมด, ห้ามแจกต่อ) เลือกโดยผู้ใช้ · v0.16.1 ภาพพอร์เทรต/ไอคอนเรนเดอร์จากโมเดลแล้ว (`tools/companion-portraits.js`, ต้องรัน `recv-bin.cjs` ไปที่ `Assets/_Project/Art/Characters/Companion`) · ชื่อในเกมยังเป็น "อะมีบี้" (speaker id `AMOEBY`) — รอผู้ใช้บอกชื่อใหม่
- v0.10.0 บทที่ 4 ฟลอแรนทิส (`src/world/Florantis.ts`, ข้อมูลสร้างจาก `game/tools/ch4data.py` แบบ upsert (`python tools/ch4data.py .`)) · ทดสอบเควสทั้งบท: `(await import('/tools/ch4-test.js')).default()` แล้วอ่าน `window.__ch4log` (ใช้เวลา >45 วิ ต้องอ่านทีหลัง; สคริปต์แก้เซฟ → คืนค่าเซฟหลังทดสอบ) · ภาพหน้าจอ: `g.renderer.setSize(1280,720,false)` ก่อน render เพราะ canvas เป็น 0×0 ตอนซ่อนหน้าต่าง
- v0.11.0 บทที่ 5 เมแทบอลิส (`src/world/Metabolis.ts`, ข้อมูล `python tools/ch5data.py .`) · ทดสอบ `(await import('/tools/ch5-test.js')).default()` แล้วอ่าน `window.__ch5log` — ก่อนทดสอบสำรองเซฟ `localStorage['vitaria_save_v1']` แล้วคืนค่าหลังเสร็จ · สคริปต์ต้องกดปุ่ม "ดำเนินการต่อ" ของการ์ดบท และตอบควิซระหว่างรอ interaction (มีใน ch5-test แล้ว)
- ดินแดนแต่ละแห่งต่อเข้าระบบแบบเดียวกัน (World.h / resolve / visibility / waypoint suffix, Game zone+เรือเหาะ+เพลง, HUD/Menus map) — ถ้าจะเพิ่มดินแดนใหม่ให้ค้นคำว่า `inMetabolis` / `inAquorra` / `inNeurion` / `inRoots` แล้วทำตามทุกจุด
- v0.13.0 บทที่ 6 อควอร์รา (`src/world/Aquorra.ts`, น้ำ `src/render/Water.ts`, ข้อมูล `python tools/ch6data.py .`) · ทดสอบ `(await import('/tools/ch6-test.js')).default()` แล้วอ่าน `window.__ch6log` · ทีมทดสอบเลเวลต่ำ ต้องให้โล่ `g.combat.shield.hp = 1e9` และวาร์ปไปข้างบอสก่อนตี (มีในสคริปต์แล้ว)
- v0.13.1 โมเดลอควอร์รา 14 ชิ้นใส่ครบแล้ว (`game/tools/aqu_picks.json` → `python tools/add_picks_aqu.py` → `import_downloads.py <codes>` → `import_assets.py`) · ถ้าโมเดลนำเข้าแล้วมีชิ้นยืดผิดรูป ให้ลอง `pack: true` (เมทริกซ์โหนดที่มีการเฉือนพังตอนรวมโหนด) · พื้นที่ติดมากับโมเดลตัดด้วย `drop` · Sketchfab จำกัดการดาวน์โหลดถี่ (429) ต้องเว้นช่วง ~1 นาที · Browser pane ของแอปมี localStorage แยกจากเบราว์เซอร์ผู้ใช้ (เซฟทดสอบอยู่ในนั้น)
- v0.14.0 บทที่ 7 นิวรีออน (`src/world/Neurion.ts`, ข้อมูล `python tools/ch7data.py .`, ทดสอบ `tools/ch7-test.js` → `window.__ch7log`) · v0.15.0 บทสรุป รากต้นไม้แห่งชีวิต (`src/world/Roots.ts`, `tools/ch8data.py`, `tools/ch8-test.js` → `window.__ch8log`) — **เนื้อเรื่องหลักจบครบแล้ว** (ธง `game_complete`) · ตัวช่วยทดสอบร่วม `tools/chapter-kit.js` (bossFight / clear / board ฯลฯ)
- v0.15.1 โมเดลนิวรีออน+ราก 20 ชิ้นใส่ครบ (`tools/fin_picks.json` → `add_picks_fin.py`) · โมเดลมีกระดูกที่ใช้เป็นของในฉากวัดขนาดผ่าน `refreshSkins` แล้ว · ศัตรูมี `modelFlip`/`modelLift` · ตรวจ shader ทั้งหมดด้วย `g.renderer.info.programs` (diagnostics) เพราะ console ของ Browser pane เก็บ error เก่าค้างไว้
- v0.15.2 โมเดลบทแรก ๆ 30 ชิ้นใส่แล้ว (`tools/old_picks.json` → `add_picks_old.py`) · ยังใช้ของต่อเอง: ศูนย์รีไซเคิลไลโซโซม หอสมุดพันธุกรรม (ไม่มีตัวเลือกที่ดี) และรูปปั้นที่ใช้สอน (เสาจัดหมวดหมู่ กระดูกขาหน้า โมเลกุลในที่ราบ) ซึ่งตั้งใจคงไว้
- v0.15.3 ภาพพอร์เทรตปราชญ์ครบทั้งเจ็ดแล้ว (NPC Sheet จาก GPT หมวด Q → `import_assets.py`) · ชาวบ้านเจโนเวีย (โรซา เลนซ์ ฟอสส์) ใส่ภาพแล้ว v0.16.1 · ฝาแฝดหลังกลับมายังใช้ภาพ LostTwin
- ผู้ใช้ส่งชื่อไฟล์ "Vrm Models-20261018T030726Z-1-001" (zip จาก Google Drive) ให้ใช้เป็นตัวละคร — หาในเครื่องไม่เจอ และ connector Google Drive ขอสิทธิ์เพิ่ม → รอผู้ใช้บอกตำแหน่งไฟล์ / แตกไฟล์ไว้ใน `Assets/_Project/Models/` แล้วจัดเข้าเกมด้วย `import_assets.py`
- **กฎ 2026-10-18**: วัตถุในฉากใช้โมเดลสำเร็จรูป (Sketchfab ฯลฯ) ห้ามต่อรูปทรงเอง — ขั้นตอน: `tools/sketchfab_search.py` (กรอง CC BY/CC0/ท่าทาง) → ทำแผ่นภาพตัวเลือกมีรหัส → ผู้ใช้เลือก → ดาวน์โหลดผ่าน Chrome ที่ผู้ใช้ล็อกอิน: ในแท็บ sketchfab.com `fetch('/i/models/<uid>/download')` → `latest.gltf[0].url` (เป็น JSON ห่อ url จริงอีกชั้น) → blob → `<a download>` ลง Downloads → ย้ายเป็น `Assets/_Project/Downloads/<CODE>/` → เพิ่มใน `model_picks.json` (โมเดลมีกระดูกต้องใส่ `pack: true`) → `import_downloads.py <CODE>` → `import_assets.py`
- v0.12.0 ศัตรูมีโครงกระดูกใช้ `EnemyModels.clipAnimator` (หาคลิปจากชื่อ: idle/walk/run/attack/hit/death) · ทดสอบภาพศัตรู `tools/enemy-sheet.js` · กล้องทดสอบต้องตั้ง far > 400 ไม่งั้นท้องฟ้าถูกตัดเป็นสามเหลี่ยมดำ
- โทนภาพ v2 ปรับเทียบกับภาพเกนชิน (ภาพอ้างอิงอยู่ scratchpad `gref/`, สคริปต์วัด `colorstats.py`) — ถ้าผู้ใช้บอกว่ามืด/สว่างไป ปรับ `toneMappingExposure` ใน Game.ts และสีใน Terrain.ts (V2_GREEN) / World.ts (ฟ้า น้ำ hemisphere)
- งานต่อ: ฉากบทเก่า (ไซโทเรีย หอคอยไมโทซิส, เจโนเวีย, ซีเฟอเรีย, เมือง) ยังมีวัตถุที่ต่อเอง — ควรหาโมเดลสำเร็จรูปแทนตามกฎ (มี propSlot รออยู่แล้วหลายจุด)

- v0.16.0 มือถือ (`src/core/Device.ts`, `src/ui/TouchControls.ts`, ทดสอบด้วย `?touch=1`) · เซฟสำรอง/ส่งออก/นำเข้า · เว็บ https://wirunsit.github.io/vitaria/ (push `main` = deploy อัตโนมัติ)
- v0.16.1 ปีนเขา (`climbing` ใน PlayerController, ท่าในโค้ดที่ `VrmCharacterModel` — ถ้าผู้ใช้อนุญาตให้โหลด Mixamo ด้วยบัญชีเขา ให้ใส่คลิปปีน `climb` ใน `MixamoAnims` แทน) · ฝากล่องเปิดจริง (`PropModels.chestLid`)
- ⚠️ git: ไฟล์ใน repo เป็น LF บางไฟล์ CRLF — ก่อน commit ให้เทียบปลายบรรทัดกับ HEAD (เคยมี diff ทั้งไฟล์เพราะเรื่องนี้)
