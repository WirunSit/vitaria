# 🎨 VITARIA — คำสั่งวาดภาพประกอบตัวละครใหม่ให้ตรงกับโมเดล 3D ปัจจุบัน
### (ไฟล์สำหรับส่งให้ GPT / Codex · เพิ่ม 2026-10-26)

ตอนนี้ตัวละครและ NPC ในเกมใช้โมเดล 3D ชุดใหม่ (VRoid) แล้ว แต่ภาพประกอบ (ไอคอน รูปบทสนทนา Splash) ยังเป็นดีไซน์เก่า หน้าตาจึงไม่ตรงกับตัวที่เดินอยู่ในเกม
ไฟล์นี้สั่งให้วาดภาพประกอบใหม่ทั้งหมด **ตามหน้าตาโมเดลปัจจุบัน** โดยมีภาพอ้างอิงของทุกตัวอยู่ใน `Assets/_Project/Art/_ModelRefs/`

---

## 📌 ข้อความถึง GPT (อ่านก่อนเริ่ม)

> **สวัสดี GPT** — ฉันพัฒนาเกม **"VITARIA: ตำนานธาตุแห่งชีวิต"** (Open-World Action RPG สไตล์อนิเมะ สอนชีววิทยา ม.ปลาย) ตัวละครในเกมเปลี่ยนเป็นโมเดล 3D ใหม่แล้ว ช่วยวาดภาพประกอบใหม่ให้ **หน้าตาตรงกับโมเดล** ตามกฎนี้:
>
> 1. **แนบภาพอ้างอิงทุกครั้ง**: ก่อนวาดตัวไหน ให้เปิด/แนบไฟล์ `Assets/_Project/Art/_ModelRefs/<ชื่อ>_ref.jpg` ของตัวนั้น (ซ้าย = เต็มตัว, ขวา = ใบหน้า) แล้ววาดให้ **ทรงผม สีผม สีตา ใบหน้า ชุด สีชุด และเครื่องประดับ เหมือนภาพอ้างอิง** — ภาพอ้างอิงสำคัญกว่าคำบรรยาย ถ้าขัดกันให้ยึดภาพ
> 2. **วาดเป็นภาพอนิเมะ 2D Cel-shaded คุณภาพสูง** ไม่ใช่ภาพเรนเดอร์ 3D — แปลงโมเดลเป็นภาพวาดแนวเกม Action RPG ยุคใหม่ ลายเส้นคม แสงเงาสวย
> 3. **อย่าเพิ่ม/ตัดรายละเอียดชุด** เองนอกจากที่ระบุใน "⚠️ ข้อยกเว้น" ของตัวนั้น (เช่น ไซร่าไม่มีดาบใหญ่ที่หลัง, ปีกวีต้าเป็นสีขาวโปร่งแสง)
> 4. สร้าง **ทีละ 1 ภาพ** ตามลำดับในไฟล์ — ถ้าฉันพิมพ์ "ต่อ" ให้ทำภาพถัดไป
> 5. **ห้ามมีตัวอักษร/ข้อความ/ลายน้ำในภาพ** (ภาพอ้างอิงบางภาพมีตัวหนังสือหรือกรอบการ์ด ห้ามลอกมา)
> 6. **ห้ามเลียนแบบตัวละครหรือโลโก้ของเกมอื่น** (Genshin Impact, Honkai ฯลฯ) — ใช้แค่ "แนวภาพ"
> 7. เหมาะกับอายุ **12+** ชุดไม่โป๊ (ถ้าภาพอ้างอิงเปิดเผยมาก ให้ปิดให้เรียบร้อยขึ้นเล็กน้อยโดยคงดีไซน์)
> 8. ขนาด: `1:1` = 1024×1024, `3:2` = 1536×1024 · "transparent background" = PNG พื้นโปร่งใส
> 9. **บันทึกไฟล์ตามชื่อ/โฟลเดอร์ที่ระบุ ทับไฟล์เดิมชื่อเดียวกันได้เลย** แล้วทำ "🧹 ขั้นตอนลบภาพเก่า" ท้ายไฟล์นี้
> 10. หลังแต่ละภาพ บอกชื่อไฟล์ที่บันทึก และถามว่าจะแก้หรือไปต่อ

---

## 🎨 GLOBAL STYLE (ใส่ในทุก Prompt)

```
GLOBAL STYLE: High-quality 2D anime cel-shaded illustration in the aesthetic of modern
open-world fantasy action RPGs. Clean crisp line art, soft cel shading with gentle gradients,
vibrant colors, luminous rim lighting. The character must match the attached 3D model
reference exactly: same face, hairstyle, hair color, eye color, outfit, colors and
accessories — redrawn as a polished anime illustration, not a 3D render.
Wholesome, suitable for teenagers (12+). Original designs only. No text, no letters,
no watermark, no card frame.
```

### 🧩 Template ภาพ (ใช้ซ้ำทุกตัว)

**① Character Sheet** — `CHR_[Name]_Sheet_01.png` · 3:2
```
[GLOBAL STYLE] Character design reference sheet on a plain light-gray background.
[CHARACTER LOCK]. Full-body front view, side view and back view in a neutral standing pose,
plus a face close-up and a close-up of the weapon. Consistent proportions. No text labels.
```

**② Splash Art** — `CHR_[Name]_Splash.png` · 3:2
```
[GLOBAL STYLE] Dynamic gacha splash art. [CHARACTER LOCK]. [SPLASH SCENE]. Dramatic
perspective, elemental VFX swirling around in [ELEMENT COLOR], detailed background,
cinematic lighting. No text.
```

**③ Dialogue Portraits (8 สีหน้า)** — `CHR_[Name]_Portraits.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Expression sheet for visual-novel dialogue: 8 half-body (waist-up) portraits
of the same character in identical outfit and angle, arranged in an even 4x2 grid (4 columns,
2 rows, equal cells, nothing crossing cell borders), in this order: neutral, happy, sad,
angry, surprised, worried/panic, crying-comic, thinking. [CHARACTER LOCK].
Transparent background, no text.
```

**④ Icon** — `CHR_[Name]_Icon.png` · 1:1 · transparent background
```
[GLOBAL STYLE] Character avatar icon: head-and-shoulders bust, slightly turned, cheerful
expression, inside a circular frame with a soft [ELEMENT COLOR] gradient background ring.
[CHARACTER LOCK]. No text.
```

**⑤ NPC Sheet** — `NPC_[Name]_Sheet.png` · 3:2 (พื้นหลังเรียบสีอ่อน ไม่ใช่โปร่งใส)
```
[GLOBAL STYLE] NPC sheet on a plain soft off-white background, no scenery: on the LEFT
(about 38% of the width) a full-body front view standing; on the RIGHT (the remaining 62%)
a large waist-up bust portrait of the same character, face in the upper half, friendly
expression. The two figures must not overlap. [CHARACTER LOCK]. No text.
```
> ⚠️ ระบบเกมตัดภาพ NPC อัตโนมัติ: ครึ่งขวาเป็นรูปบทสนทนา และส่วนบนขวาเป็นไอคอน จึงต้องวางตามนี้

---

# A. ตัวละครเล่นได้ (ทำครบ 4 ภาพ: Sheet → Portraits → Icon → Splash)
โฟลเดอร์: `Assets/_Project/Art/Characters/<Name>/`

### A1 — ไซออน (Sion) · นักเดินทางชาย · Geo · ดาบมือเดียว
- **Ref**: `_ModelRefs/Sion_ref.jpg`
- **CHARACTER LOCK**: `Slim teenage boy, messy fluffy shoulder-length pure white hair with an ahoge, red eyes, calm confident look. Long white open coat with black trim and black off-shoulder cut-outs, black high-collar inner top, dark trousers with flowing gold vine-like patterns, a glowing blue gem on the belt, dark boots. Wields an elegant straight sword.`
- **SPLASH SCENE**: `leaping forward slashing his sword, a wall of glowing amber hexagonal crystals erupting from the ground behind him, golden valley under a dawn sky`
- **ELEMENT COLOR**: amber-gold `#E8B54A`

### A2 — ไซร่า (Sira) · นักเดินทางหญิง · Geo · ดาบมือเดียว
- **Ref**: `_ModelRefs/Sira_ref.jpg`
- **CHARACTER LOCK**: `Petite teenage girl with short white hair, bright blue eyes and mechanical cat-ear headgear. Sleek ice-themed mecha armor in white, pearl and navy with glowing ice-blue crystal accents: armored chest plate, layered skirt-like hip plates, black thigh-high leggings, armored boots with crystal blade fins. Wields an elegant straight sword.`
- ⚠️ **ข้อยกเว้น**: ภาพอ้างอิงมี **ดาบใหญ่สีฟ้าติดอยู่ที่หลัง — ห้ามวาด** (ในเกมถอดออกแล้ว) ให้ถือดาบมือเดียวธรรมดาแทน
- **SPLASH SCENE**: `twirling with her sword raised, a ring of glowing amber hexagonal crystal pillars rising around her, golden valley at dawn`
- **ELEMENT COLOR**: amber-gold `#E8B54A`

### A3 — ไมโทร่า (Mitora) · Pyro · Catalyst (ตะเกียง)
- **Ref**: `_ModelRefs/Mitora_ref.jpg`
- **CHARACTER LOCK**: `Cheerful girl with long crimson-red hair in two small side buns, amber eyes. Deep red Chinese-style lolita dress with gold embroidery and a gold sash, frilled layered skirt, wide sleeves. Holds a glowing ornate lantern catalyst.`
- **SPLASH SCENE**: `jumping joyfully with her lantern raised, a spinning ring of eight orange fire orbs circling her, a warm explosion of energy behind her, academy rooftop at sunset`
- **ELEMENT COLOR**: red-orange `#E8553A`

### A4 — อัลวี (Alvi) · Anemo · Catalyst
- **Ref**: `_ModelRefs/Alvi_ref.jpg`
- **CHARACTER LOCK**: `Gentle youth with soft light-aqua hair and a small hair clip, pale aqua eyes. White fantasy robe with wide sleeves, navy-blue sailor-style collar and cape trimmed with ornate gold filigree, cream sash with a white flower, brown boots. Holds a small wind catalyst.`
- **SPLASH SCENE**: `floating lazily in the air, a huge spiraling mint-teal tornado behind him lifting leaves and bubbles, floating islands and bright blue sky`
- **ELEMENT COLOR**: mint-teal `#5FD4B0`

### A5 — คลอเรน (Chloren) · Dendro · ธนู
- **Ref**: `_ModelRefs/Chloren_ref.jpg`
- **CHARACTER LOCK**: `Bright fairy girl with fresh green hair in two round buns and a bob, big joyful smile, green eyes. Leaf-green petal bodice with a gold flower brooch and green gem, soft pink petal skirt, gold arm cuffs. Holds a living-branch bow.`
- ⚠️ ในภาพอ้างอิงเท้าเปล่าและชุดสั้น — วาดให้สุภาพขึ้นเล็กน้อย (ใส่รองเท้าแบบกลีบไม้)
- **SPLASH SCENE**: `drawing her living-branch bow toward the sky, a sunbeam arrow glowing, a circle of glowing green plants blooming around her feet, sun rays through a lush greenhouse`
- **ELEMENT COLOR**: leaf-green `#8BC34A`

### A6 — ฮีม่า (Hema) · Hydro · ทวน
- **Ref**: `_ModelRefs/Hema_ref.jpg`
- **CHARACTER LOCK**: `Graceful girl with bright cyan hair, side ribbons and teal eyes, small blue star marks on her cheek. Sky-blue and royal-blue idol-style outfit with star motifs, sheer translucent aqua sleeves and overlay, white thigh-high stockings with blue bands, blue heels. Holds a glass polearm.`
- **SPLASH SCENE**: `striking a graceful pose with her glass polearm, a great circular river of sky-blue water with red streaks flowing around her, healing bubbles rising, canal city with waterfalls behind`
- **ELEMENT COLOR**: sky-blue `#3DA5F4` with red accents

### A7 — นิวรอส (Neuros) · Electro · ดาบมือเดียว
- **Ref**: `_ModelRefs/Neuros_ref.jpg`
- **CHARACTER LOCK**: `Tall elegant elf man with tan skin, long flowing violet hair, pointed ears, teal eyes and a small scar line on the cheek. Gothic noble outfit: black high-collared tailcoat with silver trim, gray waistcoat with buckles, white cravat, white trousers, black boots, a long cape with a crimson lining. Wields a sword.`
- **SPLASH SCENE**: `mid-dash leaving three afterimages connected by violet lightning, delivering a massive downward lightning slash, neon city at night behind him`
- **ELEMENT COLOR**: violet `#A65FE0`

### A8 — เฮลิกซ์ (Helix) · Cryo · ดาบใหญ่
- **Ref**: `_ModelRefs/Helix_ref.jpg`
- **CHARACTER LOCK**: `Calm young woman with long wavy silver-white hair and pale blue eyes. Navy and indigo kimono-style dress with white floral prints, a big white ruffled collar, purple tassel cord at the neck, purple obi sash with silver buckle, indigo outer jacket. Wields a twisted ice claymore.`
- **SPLASH SCENE**: `swinging her twisted ice claymore, an ice clone of herself mirroring the pose, two spiraling ice tornadoes intertwining like a DNA double helix, snowy library of ice crystals behind`
- **ELEMENT COLOR**: icy-cyan `#9FE3F0`

---

# B. วีต้า (Vita) — ภูตนำทางที่ลอยตามผู้เล่น (แทน Paimon เดิม)
โฟลเดอร์: `Assets/_Project/Art/Characters/Companion/` · ทำ 2 ภาพ: Portraits แล้ว Icon

- **Ref**: `_ModelRefs/Vita_ref.jpg`
- **CHARACTER LOCK**: `Small cute fairy-guide girl (floating companion, child-like proportions) with very long golden-blonde hair, big blue eyes, a black butterfly-shaped hair bow with cyan inner wings and a long magenta ribbon curling like antennae. White mandarin-collar top with blue-and-white porcelain floral pattern and blue knot buttons, black skirt with porcelain-blue flower pattern, white stockings, blue shoes. Large translucent glowing WHITE butterfly wings on her back.`
- ⚠️ **ข้อยกเว้น**: ปีกในภาพอ้างอิงเป็น **สีฟ้า** — ให้วาดเป็น **ปีกผีเสื้อสีขาว โปร่งใสราว 50% เรืองแสงอ่อน ๆ** (ไม่จ้ามาก) ตามในเกม
- **Portraits** → `CHR_Companion_Portraits.png` · 3:2 · transparent · ใช้ Template ③ (8 สีหน้า 4x2 ลำดับเดิม)
- **Icon** → `CHR_Companion_Icon.png` · 1:1 · transparent · ใช้ Template ④ โดย **[ELEMENT COLOR]** = soft pearl-white with pale sky-blue `#CFE3F5`

---

# C. NPC (แผ่นละ 1 ภาพ ใช้ Template ⑤)
โฟลเดอร์: `Assets/_Project/Art/Characters/NPC/` · ชื่อไฟล์ `NPC_[Name]_Sheet.png`

| NPC | ไฟล์ / Ref | CHARACTER LOCK |
|-----|-----------|----------------|
| ปราชญ์ฮูเคีย | `NPC_SageHookia_Sheet.png` · `SageHookia_ref.jpg` | `Petite scholarly girl with very long silver-white hair, straight bangs and pink-magenta eyes, a navy beret with a small gold wreath. Navy long coat with gold trim and embroidered floral patterns over a cream lace blouse, ornate gold brooch, dark tights.` |
| ศาสตราจารย์ไลโซ | `NPC_ProfLyso_Sheet.png` · `ProfLyso_ref.jpg` | `Friendly young professor with short neat mint-gray hair and light blue eyes, warm smile. Long white lab coat over a light-blue shirt, beige trousers, black shoes.` |
| ป้ากอลจี | `NPC_AuntieGolgi_Sheet.png` · `AuntieGolgi_ref.jpg` | `Kind woman with brown hair in a neat bun under a white maid headpiece, teal eyes. Classic long black dress with a long white pinafore apron, white collar and cuffs (a cheerful post-office keeper).` |
| ลุงอีอาร์ | `NPC_UncleER_Sheet.png` · `UncleER_ref.jpg` | `Muscular tan-skinned man with swept-back silver-white hair and gray eyes, red tribal tattoo on his chest and neck. Black cropped top, a dramatic crimson coat with one huge armored shoulder, red gauntlets, belt, dark trousers, red boots (a forge blacksmith).` |
| ไรโบ | `NPC_Ribo_Sheet.png` · `Ribo_ref.jpg` | `Small cheerful boy with fluffy golden-blond hair, round bear ears and big blue eyes. White jacket with a navy collar and gold star buttons, navy ribbon tie, black shorts with white frills, navy boots (an eager kitchen apprentice).` |
| ดร.ไคเมร่า | `NPC_DrChimera_Sheet.png` · `DrChimera_ref.jpg` | `Smug young man with messy black hair, black cat ears, red eyes and faint stitch-like scars on his face, ornate black-and-gold tattoo pattern on his chest. Black fitted top with gold patterns, black trousers with silver motifs, black sneakers, arms crossed (villain scientist).` |
| ฝาแฝดของเธอ | `NPC_LostTwin_Sheet.png` · `LostTwin_ref.jpg` | `Mysterious young man with dark-gray hair covering one eye and a single red eye visible. Black long tailcoat with violet lining and silver-violet trim, purple waistcoat and tie, black trousers and shoes, faint dark mist around him, melancholic look.` |
| ปราชญ์เมนเดลิออน | `NPC_SageMendelion_Sheet.png` · `SageMendelion_ref.jpg` | `Calm young man with short silver hair, blue eyes and two curved black horns. White open shirt-jacket with black brushstroke patterns, dark gray inner shirt, black cargo trousers.` |
| คุณแม่โรซา | `NPC_VillagerRosa_Sheet.png` · `VillagerRosa_ref.jpg` | `Gentle young mother with long brown hair in a side braid and brown eyes. Tyrolean-style dirndl: white puff-sleeve blouse, dark brown laced bodice, red skirt with a white frilled apron, red bow brooch.` |
| เด็กชายเลนซ์ | `NPC_VillagerLens_Sheet.png` · `VillagerLens_ref.jpg` | `Cute small robot-headed child: a round black visor face with big glowing orange cartoon eyes, white helmet with tall orange fox ears, chunky blue knitted scarf, black coat with orange stripes, white boots (a curious village kid).` |
| ลุงฟอสส์ | `NPC_VillagerFoss_Sheet.png` · `VillagerFoss_ref.jpg` | `Gentle man with tousled white hair and red eyes, holding a teacup. Green and black long robe with bold yellow stripes and a red braided rope sash, wide black trousers, red sandals. Wears a woven straw hat (conical farmer's hat).` |
| ยายเซฟีรา | `NPC_GrannyZephyra_Sheet.png` · `GrannyZephyra_ref.jpg` | `Elegant witch-like lady with long wavy violet hair covering one eye, heterochromatic eyes (one orange, one violet), a beauty mark. Black gothic dress with gold star patterns and a gold bow, black gloves, black lace choker.` |
| เรนเจอร์ไลลา | `NPC_RangerLila_Sheet.png` · `RangerLila_ref.jpg` | `Cheerful girl with a short brown bob and brown eyes, a tall white witch hat with a sky-blue band. White and pale-blue mage robe with navy collar and gold filigree, a white flower brooch, brown belt with pouches, white stockings, brown boots.` |
| ปราชญ์ลินนาร่า | `NPC_SageLinnara_Sheet.png` · `SageLinnara_ref.jpg` | `Playful girl with brown bob hair, a long ahoge, pink eyes and a yellow X hair clip, making a cute pose. Yellow and dark-brown checkered kimono-style top with wide sheer amber sleeves, dark frilled shorts, white socks and sandals.` |
| ราชินีฮาร์วีน่า | `NPC_QueenHarvena_Sheet.png` · `QueenHarvena_ref.jpg` | `Sweet queen with long pale pink-blonde hair and pink eyes, a jeweled silver tiara. Pink and white layered frilly princess dress with a big pink bow, lace armbands, pink stockings, silver shoes.` |
| จักรพรรดิคาฮาลิส | `NPC_SageCajalis_Sheet.png` · `SageCajalis_ref.jpg` | `Aloof sage with very long straight violet hair, a skull hair ornament over one eye, violet eyes, black choker. Loose dark charcoal robe with violet geometric patterns, wide sleeves, sandals, lounging confidently.` |
| กัปตันดาร์วิน | `NPC_SageDarwyn_Sheet.png` · `SageDarwyn_ref.jpg` | `Lanky adventurous explorer captain (redrawn as an anime character, adult man): wide-brimmed olive hat with a green feather, a red scarf pulled over the lower face, glowing teal eyes, yellow-ochre shoulder cape, olive-green tunic, brown trousers and boots, holding a tall wooden staff with a curled top.` |
| ปราชญ์เครบิออน | `NPC_SageKrebion_Sheet.png` · `SageKrebion_ref.jpg` | `Huge muscular elderly master blacksmith (redrawn as an anime character): bald head, long braided white beard, heavy dark steel armor plates with bronze trim, a leather apron, holding a big forge hammer, standing beside a glowing anvil.` |

> 💡 ดาร์วินและเครบิออนใช้โมเดลการ์ตูนตะวันตกจาก Sketchfab — ให้ **แปลงเป็นแนวอนิเมะ** แต่คงชุด สี และอุปกรณ์ตามภาพอ้างอิง
> 💡 **ไม่ต้องวาดใหม่**: `NPC_EntropyHerald_Sheet.png` (ยังไม่มีโมเดล ใช้ภาพเดิม) · Mitora / Alvi / Chloren / Hema / Neuros / Helix ตอนเป็น NPC ใช้ภาพจากหมวด A อยู่แล้ว

---

## 🧹 ขั้นตอนลบภาพเก่า (ทำหลังได้ภาพใหม่มาแทนแล้วเท่านั้น)

> ⚠️ ลบเฉพาะไฟล์ที่ **มีภาพใหม่มาแทนแล้ว** — ตัวไหนยังไม่ได้วาดใหม่ ห้ามลบ ไม่งั้นเกมจะไม่มีรูป

1. **ภาพที่ชื่อเดิม** (`CHR_*_Sheet_01.png`, `CHR_*_Portraits.png`, `CHR_*_Icon.png`, `CHR_*_Splash.png`, `NPC_*_Sheet.png`) — บันทึกทับไฟล์เดิมได้เลย ไม่ต้องลบแยก
2. **วีต้า** — หลังได้ `CHR_Companion_Portraits.png` และ `CHR_Companion_Icon.png` ใหม่แล้ว ให้ลบรูปเก่า 8 ไฟล์ที่เรนเดอร์จากโมเดล Paimon:
   - `Assets/_Project/Art/Characters/Companion/CHR_Companion_Portrait_*.png`
3. **อะมีบี้ (มาสคอตเก่า ไม่ได้ใช้แล้ว)** — ลบได้ทันทีหลังวีต้าเสร็จ:
   - โฟลเดอร์ `Assets/_Project/Art/Characters/Amoeby/`
   - `game/public/assets/characters/CHR_Amoeby_Icon.png` และ `CHR_Amoeby_Portrait_Neutral.webp`
4. ถ้าเผลอบันทึกเป็นชื่ออื่น (เช่น `CHR_Sira_Sheet_02.png`) ให้เปลี่ยนชื่อเป็นชื่อในไฟล์นี้ แล้วลบไฟล์ชื่อผิดทิ้ง
5. **ห้ามลบ** โฟลเดอร์ `Assets/_Project/Art/_ModelRefs/` (ภาพอ้างอิง) และ `NPC_EntropyHerald_Sheet.png`
6. เสร็จแล้วรันคำสั่งนำเข้าภาพเข้าเกม (สคริปต์จะตัดรูปสีหน้า ไอคอน และบีบอัดให้เอง):
   ```
   cd game
   python tools/import_assets.py
   ```
7. แจ้งรายชื่อไฟล์ที่สร้างใหม่และไฟล์ที่ลบ

---

## ✅ Checklist (52 ภาพ)
- [ ] A1 ไซออน — Sheet · Portraits · Icon · Splash
- [ ] A2 ไซร่า — Sheet · Portraits · Icon · Splash
- [ ] A3 ไมโทร่า — Sheet · Portraits · Icon · Splash
- [ ] A4 อัลวี — Sheet · Portraits · Icon · Splash
- [ ] A5 คลอเรน — Sheet · Portraits · Icon · Splash
- [ ] A6 ฮีม่า — Sheet · Portraits · Icon · Splash
- [ ] A7 นิวรอส — Sheet · Portraits · Icon · Splash
- [ ] A8 เฮลิกซ์ — Sheet · Portraits · Icon · Splash
- [ ] B วีต้า — Portraits · Icon
- [ ] C NPC 18 แผ่น — ฮูเคีย · ไลโซ · กอลจี · อีอาร์ · ไรโบ · ไคเมร่า · ฝาแฝด · เมนเดลิออน · โรซา · เลนซ์ · ฟอสส์ · เซฟีรา · ไลลา · ลินนาร่า · ฮาร์วีน่า · คาฮาลิส · ดาร์วิน · เครบิออน
- [ ] 🧹 ลบภาพเก่า + รัน `import_assets.py`
