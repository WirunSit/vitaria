# VITARIA — แผนสร้างโมเดล 3 มิติ (ที่ไม่ใช่ตัวละคร) ด้วย GPT

> ไฟล์นี้ใช้ส่งให้ GPT ควบคู่กับ `GPT_IMAGE_PROMPTS.md` (ใช้ `[GLOBAL STYLE]` เดิมได้) — สร้าง 2026-10-16
> เป้าหมาย: เปลี่ยนสิ่งก่อสร้าง ศัตรู และพร็อพที่ตอนนี้เป็นรูปทรงเรขาคณิตง่าย ๆ ให้เป็นโมเดลสวยแบบอนิเมะ

---

## 0. GPT ช่วยอะไรได้บ้าง (อ่านก่อน)

GPT ยัง **สร้างไฟล์โมเดล 3 มิติคุณภาพเกมโดยตรงไม่ได้** แต่ทำได้ดีมาก 2 อย่างที่ทำให้โมเดลออกมาสวยขึ้นหลายเท่า:

| GPT ทำ | แล้วนำไปใช้กับ | ได้อะไร |
|-------|--------------|--------|
| ① **ภาพต้นแบบ "พร้อมแปลงเป็น 3D"** — วัตถุชิ้นเดียว พื้นหลังขาว แสงเรียบ มุม 3/4 + ภาพหน้า/ข้าง/หลัง | เว็บ AI image-to-3D ฟรี (ข้อ 2) | ไฟล์ `.glb` พร้อมใส่เกม |
| ② **Texture ปูพื้นแบบต่อกันไร้รอยต่อ** (Seamless) | ใส่โฟลเดอร์ แล้วเกมปูให้อัตโนมัติ | พื้นหญ้า/หิมะมีรายละเอียดขึ้น |

> 💡 ภาพที่ GPT วาดไว้รอบก่อน (concept art) สวยแต่มี **ฉากหลัง แสงเงาจัด และวัตถุหลายชิ้น** — AI image-to-3D จะสับสนและปั้นฉากหลังติดมาด้วย
> ภาพในไฟล์นี้จึงต้องวาดแบบ **"ภาพอ้างอิงสำหรับปั้นโมเดล"** โดยเฉพาะ (ใช้ `[3D-READY]` ด้านล่าง)

---

## 1. บล็อก `[3D-READY]` — ใส่ต่อท้าย `[GLOBAL STYLE]` ทุก prompt ในไฟล์นี้

```
[3D-READY] Single isolated object, centered, full object visible with margin, pure white background,
soft even studio lighting, NO cast shadow, NO ground plane, NO pedestal unless described, NO text,
NO other objects, clean readable silhouette, 3/4 front view from slightly above,
stylized anime game-asset look (Genshin Impact style), simple flat-ish colors with soft gradients,
chunky readable shapes, no tiny noisy details.
```

**ถ้าเว็บ 3D รับได้หลายภาพ (multi-view)** ให้สั่ง GPT ทำ **แผ่นมุมมอง (turnaround)** เพิ่มด้วยประโยคนี้:
```
Make a 4-panel turnaround sheet of the SAME object on white background, panels left-to-right:
front, right side, back, 3/4 front. Same scale and lighting in every panel, panels clearly separated.
```

---

## 2. ขั้นตอน (ผู้พัฒนา/ผู้ใช้ทำ)

1. **ให้ GPT สร้างภาพ** ตาม prompt ในข้อ 4 (ทีละชิ้น) — ถ้าภาพมีพื้นหลังหรือเงา ให้สั่งแก้: *"remove the background and shadow, keep only the object"*
2. **แปลงเป็น 3D** ที่เว็บฟรีตัวใดตัวหนึ่ง (เรียงตามที่แนะนำ):

| เว็บ | ฟรีไหม | หมายเหตุ |
|-----|-------|---------|
| **Hunyuan3D** (3d.hunyuan.tencent.com หรือค้น "Hunyuan3D" บน Hugging Face) | ✅ ดาวน์โหลด GLB ฟรี | สวย มีสี texture ดี — แนะนำอันดับ 1 |
| **TRELLIS** (ค้น "TRELLIS" บน Hugging Face Spaces) | ✅ ฟรี | รูปทรงแม่น บางครั้งต้องรอคิว |
| **Hyper3D Rodin – Gen-1.5** | ✅ ดาวน์โหลด Gen-1.5 ฟรี | (Gen-2.5 ต้องเสียเงิน) |
| **Tripo3D – Smart Mesh** | ⚠️ ฟรีจำกัด | โพลีกอนน้อย เหมาะกับเกม |

   **ค่าที่ควรตั้ง**: Low poly / ลดโพลีกอน · Texture **1K (1024)** · Format **GLB**
   **งบโพลีกอนโดยประมาณ**: พร็อพเล็ก ≤ 8,000 faces · ศัตรู ≤ 15,000 · อาคาร/บอส ≤ 30,000 · ไฟล์ไม่ควรเกิน 8 MB

3. **ตรวจไฟล์** (ไม่บังคับ): ลากไฟล์ไปเปิดที่ `gltf-viewer.donmccurdy.com` ดูว่าไม่มีพื้น/ฉากติดมา
4. **ตั้งชื่อไฟล์ให้ตรงตาราง** แล้ววางโฟลเดอร์:
   - สิ่งก่อสร้าง/พร็อพ (`BLD_…`, `PRP_…`) → `Assets/_Project/Models/Props/`
   - ศัตรู/บอส (`ENM_…`, `BOS_…`) → `Assets/_Project/Models/Enemies/`
   - Texture (`TEX_…png`) → `Assets/_Project/Art/Textures/`
5. รัน `python tools/import_assets.py` ในโฟลเดอร์ `game` แล้วรีเฟรชเกม

**เกมจัดการให้อัตโนมัติ**: ย่อ/ขยายให้พอดีขนาดเดิม · วางบนพื้น · แปลงเป็นแสงเงาแบบอนิเมะ (toon) + เส้นขอบ · กำแพงชนเหมือนเดิม · ส่วนที่ต้องขยับได้ (ประตูหอสมุด, ลูกแก้วจุดซินแนปส์, แกนเรืองแสงของรูปปั้น, วงพอร์ทัลโดเมน) ยังเป็นของเดิมและทำงานต่อได้
> ถ้าโมเดลหันผิดทาง/ใหญ่เล็กผิด แจ้งผู้พัฒนาชื่อไฟล์ — ปรับในโค้ดได้ทีละชิ้น

---

## 3. ลำดับการทำ (ทำทีละรอบ ไม่ต้องทำหมดทีเดียว)

| รอบ | เน้น | เหตุผล |
|----|-----|-------|
| **รอบ 1 🔴** | ศัตรูที่เจอบ่อย 4 แบบ + จุดซินแนปส์ + หีบ + รูปปั้น + Texture พื้น 2 แบบ | เห็นทุกนาทีที่เล่น คุ้มที่สุด |
| **รอบ 2 🟠** | บอส 3 ตัว + อาคารนครเซลลาเรีย 10 ย่าน + เรือเหาะ | ฉากสำคัญของเนื้อเรื่อง |
| **รอบ 3 🟡** | เจโนเวีย + พร็อพที่เหลือ | เก็บรายละเอียด |

---

## 4. รายการโมเดลและ Prompt

> ทุก prompt: `[GLOBAL STYLE] [3D-READY] + ข้อความในตาราง`

### 4.1 รอบ 1 🔴 — เห็นบ่อยที่สุด

| ไฟล์ | สิ่งที่เป็น | Prompt (ภาษาอังกฤษ ใส่ต่อจาก [GLOBAL STYLE] [3D-READY]) |
|-----|-----------|------------------------------------------------------|
| `ENM_CoccusSlime.glb` | ค็อกคัสสไลม์ (ทรงกลม) | `Cute round jelly slime shaped like a coccus bacterium, translucent mint-green body with a small darker nucleus visible inside, big glossy black eyes, a smaller attached buddy blob on its back (diplococcus), no limbs. Neutral color (the game tints it by element).` |
| `ENM_BacillusSlime.glb` | บาซิลลัสสไลม์ (ทรงแท่ง) | `Cute capsule-shaped (rod) jelly slime like a bacillus bacterium, translucent green body, big eyes at the front, one long wavy whip-like flagellum tail at the back, lying horizontally.` |
| `ENM_PhageDrone.glb` | เฟจโดรน | `Bacteriophage virus as a small flying drone: icosahedral crystal head with a cute face, short metallic collar and tail tube, six thin spider-like legs folded below, mint and silver colors.` |
| `ENM_BlightTrooper.glb` | บลายต์ทรูปเปอร์ | `Short stocky tribal creature corrupted by purple "entropy blight": white bone mask with two small horns and glowing violet eyes, dark brown hooded cloak with a red fur mane, bandaged limbs with faint purple cracks, holding a crude bone club. Standing in a neutral A-pose-ish stance.` |
| `PRP_Waypoint.glb` | จุดซินแนปส์ (จุดวาร์ป) | `Teleport waypoint shrine shaped like a neuron synapse: hexagonal stone base, a slender pale-stone pillar that branches at the top into four dendrite-like prongs cradling an EMPTY space for an orb (no orb), small golden inlays. Height about 4 m.` |
| `PRP_Chest.glb` | หีบสมบัติ (ปิด) | `Treasure chest with a rounded lid, warm wood with brass trims shaped like cell membranes, a hexagonal glowing lock on the front, closed lid.` |
| `PRP_Chest_Open.glb` | หีบสมบัติ (เปิดแล้ว) | `The SAME treasure chest as before but with the lid wide open and empty inside.` |
| `PRP_Chest_Gold.glb` | หีบประณีต (ทอง) | `Luxurious golden treasure chest with white-and-blue enamel, rounded lid, hexagonal crystal lock, closed lid.` |
| `PRP_StatueTreeOfLife.glb` | รูปปั้นต้นไม้แห่งชีวิต | `Sacred statue of the "Tree of Life": hexagonal stone plinth, a carved pale stone trunk whose branches split like neurons and roots like veins, branches curving up to hold a large EMPTY spherical space at the top (no orb), golden accents. Tall and elegant, about 12 m.` |

**Texture พื้น (Seamless)** — วางที่ `Assets/_Project/Art/Textures/` (ภาพสี่เหลี่ยมจัตุรัส):
| ไฟล์ | Prompt |
|-----|-------|
| `TEX_Ground_Cytoria.png` | `Seamless tileable top-down ground texture, stylized hand-painted anime game style, short soft grass blades and tiny pebbles, VERY LIGHT and LOW CONTRAST, almost white pale-cream base with subtle light-grey detail only (the game multiplies its own colors on top), no shadows, no objects, square.` |
| `TEX_Ground_Genovia.png` | `Seamless tileable top-down fresh snow texture, stylized hand-painted anime style, soft drifts and tiny sparkles, VERY LIGHT and LOW CONTRAST, nearly white with faint pale-blue detail, no footprints, no objects, square.` |

### 4.2 รอบ 2 🟠 — บอสและนครเซลลาเรีย

| ไฟล์ | สิ่งที่เป็น | Prompt |
|-----|-----------|-------|
| `BOS_BacteriaKing.glb` | ราชาแบคทีเรีย | `Giant round jelly slime king (bacterial colony), translucent green body with a visible nucleus, big eyes, a golden spiky crown band on top, a smaller buddy blob attached, regal and cute.` |
| `BOS_CarcinomaGolem.glb` | โกเลมมะเร็ง | ใช้ภาพที่มีแล้ว `Art/Enemies/BOS_CarcinomaGolem_Concept.png` ให้ GPT วาดใหม่เป็น 3D-READY: `Huge golem made of chaotically stacked dark-purple hexagonal stone cells, golden crystal spikes growing out of the shoulders, a glowing red core in the chest, heavy fists, standing pose.` |
| `BOS_ChimeraBeast.glb` | ไคเมร่าบีสต์ | `Stitched-together chimera beast standing on four legs: frost-blue lion body and fluffy icy mane, white bird wings, a teal fish tail with fins, glowing green stitch seams, red eyes. Not gory, game-boss style.` |
| `PRP_Airship.glb` | เรือเหาะของสถาบัน | `Fantasy airship whose balloon is a translucent pale-blue CELL (capsule shape) with a purple nucleus inside and a golden band, a wooden gondola hanging below with ropes, a small propeller at the back.` |
| `BLD_NucleusPalace.glb` | ศาลากลาง (นิวเคลียส) | `Grand palace building that is a giant translucent purple sphere (a cell nucleus) with golden pore rings on its surface and a glowing nucleolus inside, resting on a white hexagonal marble platform with steps and four columns, a golden spire on top. Exterior only.` |
| `BLD_MitoPlant.glb` | โรงไฟฟ้าไมโทคอนเดรีย | `Power plant made of two large capsule-shaped (mitochondria) buildings lying side by side, orange translucent shells with golden folded inner walls (cristae) visible through windows, pylons with floating glowing ATP crystals.` |
| `BLD_RERForge.glb` | โรงตีเหล็ก ER ขรุขระ | `Blacksmith forge building made of stacked wavy folded blue sheets (rough endoplasmic reticulum) studded with many small dark-blue beads (ribosomes), an anvil and a small fire in front.` |
| `BLD_RiboKitchen.glb` | ครัวไรโบโซม | `Small food stall kiosk with a red awning, a counter with colorful bead-like ingredients, and a big sign on the roof shaped like a ribosome (a large and a small blue sphere stacked) reading a golden ribbon.` |
| `BLD_SERRefinery.glb` | โรงกลั่นไขมัน ER เรียบ | `Refinery made of smooth intertwined pink tubes and pipes (smooth ER), with golden oil droplet tanks, no beads on the tubes.` |
| `BLD_GolgiPost.glb` | ไปรษณีย์กอลจิ | `Post office building shaped like a stack of five curved golden pancake-like layers (Golgi apparatus), small bubble-like vesicles floating off the edges, wrapped parcels at the counter.` |
| `BLD_LysosomeCenter.glb` | ศูนย์รีไซเคิลไลโซโซม | `Recycling center that is a translucent lime-green sphere on a stone base with small green enzyme crystals floating inside, three colored recycling bins in front.` |
| `BLD_VacuoleReservoir.glb` | อ่างเก็บน้ำแวคิวโอล | `Large round water reservoir with a white stone rim, clear blue water, a low glassy membrane dome over it and a small fountain in the middle.` |
| `BLD_ChloroGreenhouse.glb` | เรือนกระจกคลอโรพลาสต์ | `Oval glass greenhouse dome with stacks of green disc-shaped thylakoids (grana) inside connected by thin lamellae, small green plants around the entrance.` |
| `BLD_Academy.glb` | สถาบันเซลลาเรีย | `Magic academy building: a long white hall with a golden roof and three white hexagonal towers with golden cone roofs and blue hexagon windows, a brass microscope statue in front.` |
| `PRP_CityFountain.glb` | น้ำพุเซลล์แบ่งตัว | `Round stone fountain with a statue of one cell dividing into two (two pale-blue spheres side by side) on a pedestal in the middle.` |
| `BLD_CellariaGate.glb` | ประตูนครเซลลาเรีย | `Grand city gate: two white hexagonal towers with golden cone roofs joined by a golden arch, a translucent cyan membrane filling the archway. Only the gate (no long walls).` |
| `PRP_DomainPortal.glb` | ทางเข้าโดเมน | `Ancient lab-portal gate: hexagonal stone base, two stone pillars topped with glowing crystals and a stone lintel, an EMPTY archway between (no portal effect).` |

### 4.3 รอบ 3 🟡 — สถานที่บทที่ 1–2 และพร็อพ

| ไฟล์ | สิ่งที่เป็น | Prompt |
|-----|-----------|-------|
| `BLD_MitosisSpire.glb` | หอคอยไมโทซิส | `Tall stepped tower of dark-purple hexagonal stone tiers with glowing violet crystal cell-buds bulging out of every tier, a crystal tip on top, ominous but stylized.` |
| `PRP_EnzymeGate.glb` | ประตูเอนไซม์ | `Arch gate shaped like an enzyme: purple stone arch on two short legs, on top a ring-shaped head with a notch cut out (the active site). No floating key.` |
| `PRP_SaltPile.glb` | กองเกลือ | `Pile of white salt crystals with a few cube-shaped crystals around and a dark sack with a green half-helix logo leaning on it.` |
| `PRP_DNASpire.glb` | เกลียวน้ำแข็ง DNA | `Natural ice crystal formation growing as a DNA double helix: two twisting translucent icy strands joined by rungs in four colors (red, yellow, green, blue), on a small snowy rock base.` |
| `BLD_GenHouse.glb` | บ้านหมู่บ้านอัลลีล | `Cozy small snowy village house: pastel walls, a steep purple roof covered with thick snow, a colored door and a round window, a little chimney.` |
| `BLD_PeaGreenhouse.glb` | เรือนกระจกถั่วลันเตา | `Frosty glass greenhouse dome with a golden frame and a doorway, rows of pea plants with purple and white flowers inside.` |
| `BLD_GeneLibrary.glb` | หอสมุดพันธุกรรม | `Grand library facade carved into a glacier ice wall: white columns, a big arched doorway (EMPTY opening, no door), a glowing DNA double-helix emblem above the door, icy bookshelves with colorful books on both sides.` |
| `PRP_PCRMachine.glb` | เครื่อง PCR | `Sci-fi lab PCR thermal cycler machine: white box with a dark grey lid, a small green screen, tube slots.` |
| `PRP_GelBench.glb` | โต๊ะเจลอิเล็กโทรโฟรีซิส | `Wooden lab bench with a translucent blue gel electrophoresis slab showing glowing pink DNA bands in lanes.` |
| `ENM_SyndicateHeater.glb` | เครื่องทำความร้อนซินดิเคต | `Industrial heater machine on four short legs: metal box with a glowing orange coil on the front, a gauge, a chimney, green half-double-helix logo.` |
| `ENM_TumorNode.glb` | ก้อนเนื้องอก | `Lumpy cluster of purple crystalline cell-blobs with a faint red glow from within and a small golden crystal spike on top. Stylized, not gross.` |
| `ENM_GeneSplicer.glb` | นักวิจัยซินดิเคต | `Syndicate researcher in a long dark lab coat with glowing green goggles, holding a futuristic syringe-gun with a green vial. Standing pose.` |

---

## 5. ข้อควรรู้

- **โมเดลจาก AI ยังไม่มีกระดูก/ท่าทาง** — เกมขยับให้แบบง่าย (กระโดด ยืดหด หมุน) ศัตรูรูปคน (บลายต์ทรูปเปอร์, นักวิจัย) จะดูแข็งกว่าตัวละคร ถ้าอยากให้ขยับได้จริง ภายหลังใช้ **Mixamo (ฟรี)** หรือ Tripo Auto-Rig ได้ — ค่อยทำทีหลัง
- **อย่าใช้ภาพ concept เดิมที่มีฉากหลังไปแปลงตรง ๆ** — ให้ GPT วาดใหม่ด้วย `[3D-READY]` ก่อนเสมอ
- **ศัตรูธาตุต่าง ๆ ไม่ต้องทำหลายสี** — เกมย้อมสีตามธาตุให้เอง (สไลม์ไฟ/น้ำ/น้ำแข็ง)
- **ต้นไม้และหญ้า** ยังไม่อยู่ในแผนนี้ เพราะมีจำนวนหลายร้อยต้น ถ้าใช้โมเดล AI ที่โพลีกอนเยอะจะทำให้เกมช้า (จะทำเป็นชุด low-poly แยกภายหลัง)
