# 🎨 VITARIA — Image Generation Brief for GPT
### (ไฟล์สำหรับส่งให้ ChatGPT สร้างภาพ)

---

## 📌 ข้อความถึง GPT (อ่านก่อนเริ่ม)

> **สวัสดี GPT** — ฉันกำลังพัฒนาเกม **"VITARIA: ตำนานธาตุแห่งชีวิต"** เกม Open-World Action RPG สไตล์อนิเมะสำหรับสอนวิชา **ชีววิทยา ม.ปลาย** ตัวละคร ศัตรู และฉากทั้งหมดได้แรงบันดาลใจจากโครงสร้างและกระบวนการทางชีววิทยาจริง (เซลล์ ออร์แกเนลล์ DNA เซลล์ประสาท ฯลฯ)
>
> **ช่วยสร้างภาพตามรายการในไฟล์นี้ โดยทำตามกฎต่อไปนี้:**
> 1. สร้าง **ทีละ 1 ภาพ** ตามลำดับ Priority (เริ่มจาก 🔴 P1) — ถ้าฉันพิมพ์ "ต่อ" ให้สร้างภาพถัดไปในรายการ
> 2. **ทุกภาพ** ให้นำ `GLOBAL STYLE` (ด้านล่าง) มารวมกับ Prompt ของภาพนั้นเสมอ เพื่อให้สไตล์สม่ำเสมอ
> 3. ตัวละครแต่ละตัวมี **CHARACTER LOCK** — ใช้คำบรรยายนั้น **ทุกครั้ง** ที่วาดตัวละครนั้น และยึดภาพ Character Sheet ที่สร้างไปแล้วเป็นต้นแบบ (หน้าตา ทรงผม สี ชุด ต้องเหมือนเดิม)
> 4. **ห้ามใส่ตัวอักษร/ข้อความใด ๆ ในภาพ** ยกเว้นภาพที่ระบุให้มีโลโก้ (ตัวอักษรภาษาไทยในภาพมักผิด)
> 5. **ห้ามเลียนแบบตัวละคร ชื่อ โลโก้ หรือไอคอนของเกมที่มีลิขสิทธิ์ใด ๆ** (เช่น Genshin Impact) — ใช้แค่ "แนวภาพอนิเมะ Cel-shaded ของเกม Action RPG ยุคใหม่" ทุกดีไซน์ต้องเป็นต้นฉบับ
> 6. เนื้อหาเหมาะกับ **อายุ 12+**: ไม่มีเลือดสาด ไม่มีความสยดสยอง ชุดไม่โป๊ อวัยวะ/เชื้อโรคออกแบบให้น่ารักหรือเป็นสัญลักษณ์
> 7. หลังสร้างแต่ละภาพ ให้บอก **ชื่อไฟล์** (ตามที่ระบุในแต่ละรายการ) และถามว่าต้องการแก้ไขหรือไปภาพถัดไป
> 8. ใช้ขนาดภาพตามที่ระบุ: `1:1` = 1024×1024, `3:2` = 1536×1024, `2:3` = 1024×1536 · ถ้าระบุ **"transparent background"** ให้ทำพื้นหลังโปร่งใส (PNG)

---

## 🎨 GLOBAL STYLE (ใส่ในทุก Prompt)

```
GLOBAL STYLE: High-quality anime cel-shaded illustration in the aesthetic of modern
open-world fantasy action RPGs. Clean crisp line art, soft cel shading with gentle gradients,
vibrant saturated colors, luminous rim lighting, painterly fantasy backgrounds.
Theme: "fantasy world built from biology" — subtle motifs of cells, hexagonal cell walls,
organelles, DNA helices, neurons, leaves and chloroplasts woven elegantly into clothing,
architecture and VFX. Wholesome, adventurous, bright, suitable for teenagers (12+).
Original designs only — no copyrighted characters, logos or symbols. No text, no letters,
no watermark unless explicitly requested.
```

### 🎨 Element Color Palette (ใช้ให้ตรง)
| Element | HEX | คำบรรยายสี |
|--------|-----|----------|
| Pyro (energy / metabolism) | `#E8553A` | warm red-orange flame |
| Hydro (fluid / blood) | `#3DA5F4` | clear sky-blue water |
| Anemo (diffusion / breath) | `#5FD4B0` | mint-teal wind |
| Electro (nerve signal) | `#A65FE0` | vivid violet lightning |
| Dendro (plants) | `#8BC34A` | fresh leaf green |
| Cryo (DNA / genetics) | `#9FE3F0` | pale icy cyan |
| Geo (structure / cell wall) | `#E8B54A` | warm amber gold |
| UI base | `#1B2340` navy, `#F5EFE0` cream, `#E8C468` gold | |

---

## 📋 ลำดับความสำคัญ (Priority Order)

| Priority | หมวด | จำนวนภาพ |
|---------|-----|---------|
| 🔴 P1 | A1 Key Art · C Character Sheets (7 ตัว + อะมีบี้) · B1 ไอคอนธาตุ | ~10 |
| 🟠 P2 | C Splash Art · C Portrait · E บอส/ศัตรูหลัก · F ฉากไซโทเรีย | ~25 |
| 🟡 P3 | D ไอคอนปฏิกิริยา · G อาวุธ · H Relic · I ไอเทม · J UI Mockup | ~40 |
| 🟢 P4 | NPC, ไอคอนสกิล, ฉากเพิ่มเติม, ดินแดนอื่น | ตามต้องการ |

---

# A. Key Art & Logo

### A1 — Main Key Visual 🔴 P1
- **File**: `KEY_MainVisual.png` · **Size**: 3:2
```
[GLOBAL STYLE] Epic key visual for the game "VITARIA". In the center, a colossal glowing
World Tree whose roots and branches look like neurons and blood vessels, its canopy
shaped like a giant translucent cell with glowing organelles inside. Seven streams of
elemental light (red-orange, sky-blue, mint-teal, violet, leaf-green, icy-cyan, amber-gold)
flow from the roots across a vast fantasy landscape of floating islands, crystal mountains,
a hexagon-patterned city, a giant rainforest, a volcano city and a neon city at night on the
horizon. In the foreground, a young traveler with pearl-white hair stands on a cliff with
back half-turned, a small floating jelly-like amoeba mascot beside them. Golden hour light,
sense of wonder and adventure. No text.
```

### A2 — Logo 🟠 P2
- **File**: `LOGO_Vitaria.png` · **Size**: 3:2 · transparent background
```
[GLOBAL STYLE] Fantasy game logo with the word "VITARIA" in elegant serif capital letters,
gold with soft glow. The letter "I" is shaped like a DNA double helix, the "A" letters contain
a small hexagonal cell motif, a thin ring of seven colored elemental gems orbits behind the
word (red-orange, blue, mint, violet, green, icy cyan, amber). Ornamental leaf and neuron
filigree flourishes. Transparent background. Only the word "VITARIA", no other text.
```

### A3 — Title Screen Background 🟡 P3
- **File**: `UI_TitleBackground.png` · **Size**: 3:2
```
[GLOBAL STYLE] Serene title screen background: a misty valley at dawn with giant translucent
cell-shaped bubbles floating in the sky, golden grass fields, hexagonal crystal rock
formations, and the silhouette of the colossal World Tree of Life far in the distance.
Calm, dreamy, lots of empty sky space in the upper middle for a logo. No text, no characters.
```

---

# B. Elements & Core Symbols

### B1 — Element Icon Set (7 icons in one sheet) 🔴 P1
- **File**: `UI_Element_Sheet.png` · **Size**: 3:2 · transparent background
```
[GLOBAL STYLE] Game UI icon sheet: seven elemental emblem icons arranged in a neat row,
each a glossy gem-like badge with consistent style, each with a DISTINCT SILHOUETTE for
color-blind accessibility:
1) Pyro – red-orange flame whose inner shape resembles a mitochondrion with folded cristae.
2) Hydro – sky-blue water droplet with a tiny biconcave red blood cell shape inside.
3) Anemo – mint-teal swirl of wind ending in a cluster of round alveoli bubbles.
4) Electro – violet lightning bolt shaped like a neuron with branching dendrites.
5) Dendro – leaf-green leaf with visible chloroplast ovals and veins.
6) Cryo – icy-cyan snowflake whose arms twist into a DNA double helix.
7) Geo – amber-gold hexagon crystal resembling a plant cell wall.
Transparent background, evenly spaced, no text.
```
> หลังได้ภาพ จะตัดเป็นไฟล์ `UI_Element_Pyro.png` ฯลฯ เอง (หรือ GPT สร้างแยกทีละไอคอนก็ได้)

### B2 — Vital Core (แกนชีวิต) 🟠 P2
- **File**: `ITM_VitalCore_Sheet.png` · **Size**: 3:2 · transparent background
```
[GLOBAL STYLE] Item design sheet of the "Vital Core": a magical gem pendant shaped like a
stylized eukaryotic cell — a round translucent crystal with an outer membrane ring, a
glowing nucleus in the center and small organelle sparkles inside, set in an ornate metal
frame. Show 8 variants side by side: one clear/empty hollow version (pearl white) and seven
elemental versions glowing in red-orange, sky-blue, mint-teal, violet, leaf-green, icy-cyan,
amber-gold. Transparent background, no text.
```

---

# C. Characters

> **ขั้นตอนต่อตัวละคร**: ① Character Sheet (P1) → ② Splash Art (P2) → ③ Portrait 8 สีหน้า (P2) → ④ Icon (P3)
> ทุกภาพของตัวละครเดียวกันต้องใช้ **CHARACTER LOCK** และอ้างอิง Character Sheet ที่สร้างแล้ว

### 🧩 Template ภาพของตัวละคร (ใช้ซ้ำทุกตัว)

**① Character Sheet** — `CHR_[Name]_Sheet_01.png` · 3:2
```
[GLOBAL STYLE] Character design reference sheet on a plain light-gray background.
[CHARACTER LOCK]. Show: full-body front view, side view, and back view standing in neutral
pose; a close-up of the face; a close-up of the weapon; small detail callouts of the
accessories and the Vital Core gem. Clean, consistent proportions (anime 7.5-head-tall for
adults/teens). No text labels.
```

**② Splash Art** — `CHR_[Name]_Splash.png` · 3:2
```
[GLOBAL STYLE] Dynamic gacha splash art. [CHARACTER LOCK]. [SPLASH SCENE]. Dramatic
perspective, elemental VFX swirling around in [ELEMENT COLOR], detailed background,
cinematic lighting. No text.
```

**③ Dialogue Portrait (8 expressions)** — `CHR_[Name]_Portraits.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Expression sheet for visual-novel dialogue: 8 half-body (waist-up) portraits of
the same character in identical outfit and angle, arranged in a 4x2 grid: neutral, happy,
sad, angry, surprised, worried/panic, crying-comic, thinking. [CHARACTER LOCK].
Transparent background, no text.
```

**④ Icon** — `CHR_[Name]_Icon.png` · 1:1 · transparent background
```
[GLOBAL STYLE] Character avatar icon: head-and-shoulders bust, slightly turned, cheerful
expression, inside a circular frame with a soft [ELEMENT COLOR] gradient background ring.
[CHARACTER LOCK]. No text.
```

---

### C0 — นักเดินทาง ชาย: ไซออน (Sion) — Traveler / Geo
**CHARACTER LOCK (Sion)**:
```
CHARACTER: "Sion", a 17-year-old male traveler. Slim athletic build. Shoulder-length
pearl-white hair whose tips fade into warm amber-gold, soft bangs. Calm golden eyes.
Short white-and-navy tailored jacket with subtle hexagonal cell-wall patterns, gold trim,
high collar, a flowing amber-gold scarf, one fingerless glove, dark navy pants, tall boots.
On his right wrist a bracelet holding a round crystal gem shaped like a cell (the Vital Core)
glowing amber. Wields an elegant straight sword with a hexagon-crystal guard.
```
**SPLASH SCENE**: `leaping forward slashing his sword, a wall of glowing amber hexagonal cell-wall crystals erupting from the ground behind him, golden valley under a dawn sky`

### C0b — นักเดินทาง หญิง: ไซร่า (Sira) — Traveler / Geo
**CHARACTER LOCK (Sira)**:
```
CHARACTER: "Sira", a 17-year-old female traveler. Slim build. Long pearl-white hair in a
half-up style with tips fading into warm amber-gold. Calm golden eyes. White-and-navy short
dress with subtle hexagonal cell-wall patterns and gold trim, a short shoulder cape, navy
leggings and tall boots, amber-gold ribbon. On her right wrist a bracelet holding a round
crystal cell-shaped gem (the Vital Core) glowing amber. Wields an elegant straight sword
with a hexagon-crystal guard.
```
**SPLASH SCENE**: `twirling with her sword raised, ring of glowing amber hexagonal crystal pillars rising around her like microtubules, golden valley at dawn`

---

### C1 — ไมโทร่า (Mitora) — Pyro ★4 · Catalyst · แรงบันดาลใจ: ไมโทคอนเดรีย
**CHARACTER LOCK (Mitora)**:
```
CHARACTER: "Mitora", a 16-year-old energetic girl, petite. Long red-orange hair in two
twin-tails that are folded into layered wavy ripples (resembling mitochondrial cristae).
Bright amber eyes, big confident grin. Safety goggles pushed up on her head. Academy uniform
in white and red: a vest with a double-layered outlined border (double membrane), short
pleated skirt, rolled sleeves, mechanic gloves, utility belt with a red-orange glowing
cell-shaped gem (Vital Core). Her catalyst weapon is a capsule-shaped lantern resembling a
mitochondrion, with a warm orange flame swirling inside, floating beside her.
```
**SPLASH SCENE**: `jumping joyfully with her lantern raised, a spinning ring of eight orange fire orbs circling her (Krebs cycle), a massive warm explosion of energy behind her, industrial academy rooftop with sunset sky`
**ELEMENT COLOR**: red-orange `#E8553A`

### C2 — อัลวี (Alvi) — Anemo ★4 · Catalyst · แรงบันดาลใจ: ถุงลมปอด
**CHARACTER LOCK (Alvi)**:
```
CHARACTER: "Alvi", a 16-year-old laid-back boy, slender. Fluffy cloud-like mint-green hair.
Sleepy half-closed teal-blue eyes, gentle smile. Loose white shirt, short mint shoulder cape
whose hem ends in clusters of small round pom-poms like bunches of grapes (alveoli), knee-
length shorts, cloth sandals. A mint-teal Vital Core gem on his collar. His catalyst is a
floating branching wooden-and-glass flute whose pipes branch like bronchioles, wind
ribbons swirling around it.
```
**SPLASH SCENE**: `floating lazily in the air playing his branching flute, a huge spiraling mint-teal tornado behind him lifting leaves and bubbles, floating islands and bright blue sky`
**ELEMENT COLOR**: mint-teal `#5FD4B0`

### C3 — คลอเรน (Chloren) — Dendro ★4 · Bow · แรงบันดาลใจ: คลอโรพลาสต์
**CHARACTER LOCK (Chloren)**:
```
CHARACTER: "Chloren", a 15-year-old shy gentle girl, small. Shoulder-length leaf-green hair
styled in soft layered tiers (like stacked thylakoid grana), a hairpin of stacked green
discs. Emerald eyes, blushing shy expression. Wide-brim straw sun hat decorated with fresh
leaves and a green Vital Core gem. Pale green and cream dress with a gardening apron, a
leaf-shaped short cape. Her bow is made of a living curved branch sprouting small leaves;
arrows tipped with glowing seeds.
```
**SPLASH SCENE**: `drawing her living-branch bow toward the sky, a sunbeam arrow glowing, a circular garden of glowing green plants blooming around her feet, sun rays through a lush greenhouse`
**ELEMENT COLOR**: leaf-green `#8BC34A`

### C4 — ฮีม่า (Hema) — Hydro ★5 · Polearm · แรงบันดาลใจ: เม็ดเลือดแดง
**CHARACTER LOCK (Hema)**:
```
CHARACTER: "Hema", an 18-year-old elegant and dignified young woman, tall. Very long dark
navy-blue hair gradient to cherry-red at the tips, tied in a high ponytail with a red
biconcave-disc shaped hair ornament (red blood cell). Ruby-red eyes, composed confident
expression. Student-council-president uniform in white and deep navy, with flowing red
line patterns swirling around the outfit like a circulatory system, a long navy back cape,
white gloves. A sky-blue Vital Core gem at her chest. Tiny shimmering air bubbles (oxygen)
float around her. Weapon: a crystal-clear glass polearm with red liquid flowing inside.
```
**SPLASH SCENE**: `striking a graceful pose with her glass polearm, a great circular river of sky-blue water with red streaks flowing in a ring around her, healing bubbles rising, canal city with waterfalls behind`
**ELEMENT COLOR**: sky-blue `#3DA5F4` with red accents

### C5 — นิวรอส (Neuros) — Electro ★5 · Sword · แรงบันดาลใจ: เซลล์ประสาท
**CHARACTER LOCK (Neuros)**:
```
CHARACTER: "Neuros", a 22-year-old stoic tall young man. Dark purple hair to the collar with
lighter violet highlight strands that branch like dendrites. Glowing violet eyes, serious
expression. Long black-and-purple coat patterned with branching dendrite-like lines, coat
tails split into several points. Segmented white arm guards separated by small glowing
violet gaps (myelin sheath with nodes of Ranvier). Weapon: a long slender sword with glowing
nodes spaced along the blade, violet lightning jumping from node to node. Violet Vital Core
gem on the sword hilt.
```
**SPLASH SCENE**: `mid-dash leaving three afterimages connected by violet lightning (saltatory conduction), delivering a massive downward lightning slash, neon cyber city at night behind him`
**ELEMENT COLOR**: violet `#A65FE0`

### C6 — เฮลิกซ์ (Helix) — Cryo ★5 · Claymore · แรงบันดาลใจ: DNA
**CHARACTER LOCK (Helix)**:
```
CHARACTER: "Helix", a 20-year-old cool and aloof young man, tall and slender. Long
icy white-blue hair to mid-back braided into two braids twisted around each other like a
double helix. Ice-blue eyes, a silver monocle, calm serious face. Long white and pale-blue
coat; down the front runs a ladder pattern of base pairs in four colors (red, yellow, green,
blue). Navy gloves. Weapon: a huge claymore made of two ice-crystal blades twisted around
each other in a spiral. Icy-cyan Vital Core gem on his collar.
```
**SPLASH SCENE**: `swinging his twisted ice claymore, an ice clone of himself mirroring the same pose beside him, two spiraling ice tornadoes intertwining like a DNA double helix, snowy library of ice crystals behind`
**ELEMENT COLOR**: icy-cyan `#9FE3F0`

### C7 — อะมีบี้ (Amoeby) — มาสคอต 🔴 P1
**CHARACTER LOCK (Amoeby)**:
```
CHARACTER: "Amoeby", a cute floating mascot creature: a translucent jelly blob the size of a
watermelon, pastel blue fading to pink, slightly irregular wobbly shape with small
pseudopod nubs used as little arms. Two big round sparkly eyes, small expressive mouth.
Inside the translucent body a pink heart-shaped nucleus is visible. Wears a tiny scientist
hat shaped like a magnifying glass. Chibi, adorable, very expressive.
```
- **Sheet**: `CHR_Amoeby_Sheet_01.png` (3:2) — front/side/back + 8 expressions (happy, excited, hungry/drooling, panic, crying, thinking, proud, sleepy) + one pose "swallowing an item" (comic phagocytosis)

---

### C8 — NPC หลัก 🟢 P4 (Sheet แบบเต็มตัว ด้านหน้า + ใบหน้า)
| NPC | File | CHARACTER LOCK |
|-----|------|---------------|
| ปราชญ์ฮูเคีย | `NPC_SageHookia_Sheet.png` | `Wise but youthful-looking woman, long flowing amber hair, golden eyes behind elaborate brass multi-lens spectacles resembling an antique microscope, long gold-and-brown academic robe with hexagonal patterns, holding a brass microscope-topped staff, serene smile.` |
| ศาสตราจารย์ไลโซ | `NPC_ProfLyso_Sheet.png` | `Kind middle-aged man, short gray hair, round glasses, white lab coat with small round bubble-like badges (lysosomes), holding a flask of glowing liquid, warm fatherly smile.` |
| ป้ากอลจี | `NPC_AuntieGolgi_Sheet.png` | `Plump cheerful middle-aged shopkeeper woman, apron patterned with stacked curved pouch layers (Golgi cisternae), carrying neatly wrapped parcels with ribbons.` |
| ลุงอีอาร์ | `NPC_UncleER_Sheet.png` | `Muscular blacksmith man with a beard, leather apron patterned with folded maze-like tubes (endoplasmic reticulum), big hammer, friendly laugh.` |
| ไรโบ | `NPC_Ribo_Sheet.png` | `Small energetic 12-year-old boy apprentice, a two-part hat (a large round cap with a smaller cap on top, like ribosome subunits), oversized hammer, holding a long paper scroll (mRNA).` |
| ผู้ประกาศเอนโทรปี | `NPC_EntropyHerald_Sheet.png` | `Mysterious villain in a cracked white porcelain mask, tall slender figure in a long black cloak whose edges constantly crumble into drifting dust particles, behind them a broken ring of seven dim elemental symbols. Menacing but not gory.` |
| ดร.ไคเมร่า | `NPC_DrChimera_Sheet.png` | `Cold-looking scientist man in a black lab coat, one mechanical arm with syringe-like tools, green tinted goggles, slicked-back dark hair, smug smirk.` |
| ฝาแฝดผู้ถูกครอบงำ | `NPC_LostTwin_Sheet.png` | `Same face as the traveler but with black hair, deep purple eyes, black-and-violet version of the traveler's outfit with cracked hexagon patterns, dark mist around them, sorrowful expression.` |

---

# D. Reaction Icons (ไอคอนปฏิกิริยาธาตุ) 🟡 P3
- **File**: `UI_Reaction_Sheet.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Game UI icon sheet: 12 round badge icons in a 6x2 grid, consistent glossy
style, each combining two elemental colors and depicting a biology concept:
1) Thermoregulation – water droplets evaporating from a flame (red-orange + blue)
2) Denaturation – a coiled protein ribbon unraveling over flame and ice (red-orange + icy cyan)
3) Fever Shock – a thermometer struck by violet lightning (red-orange + violet)
4) Oxidation – a glucose hexagon ring burning (red-orange + green)
5) Cryostasis – a cell frozen inside an ice cube (blue + icy cyan)
6) Electrolyte Conduction – water with sparks and small ion dots (blue + violet)
7) Germination – a seed sprouting from a water drop (blue + green)
8) Synaptic Block – a neuron synapse with ice crystals in the gap (violet + icy cyan)
9) Catalysis – an enzyme pac-man shape gripping a molecule with sparks (violet + green)
10) Diffusion – dots spreading outward in a swirl (mint-teal + white)
11) Membrane Shield – a hexagonal amber shield shaped like a cell membrane (amber gold)
12) Lysis – a frozen cell shattering into pieces (icy cyan + white)
Transparent background, no text.
```

---

# E. Enemies & Bosses

### E1 — Bacterio-Slimes Sheet 🟠 P2
- **File**: `ENM_BacterioSlimes_Sheet.png` · 3:2
```
[GLOBAL STYLE] Enemy concept sheet on light gray background: cute but mischievous slime
monsters based on bacteria shapes. Three body types: (1) Coccus slime – round ball slimes
that cling together in a chain; (2) Bacillus slime – capsule rod-shaped slime with a
whip-like flagellum tail; (3) Spirillum slime – corkscrew spiral-shaped slime. Show each in
elemental variants with glowing color tints: amber-gold Geo, red-orange Pyro, sky-blue Hydro,
violet Electro. Also show one slime in the middle of splitting into two (binary fission)
and one "antibiotic-resistant" variant with a red outline and a small shield aura.
Big expressive eyes, jelly translucency. No gore, no text.
```

### E2 — Phage Drone 🟠 P2
- **File**: `ENM_PhageDrone_Concept.png` · 1:1
```
[GLOBAL STYLE] Enemy concept: a flying "phage drone" based on a bacteriophage virus — an
icosahedral crystal head on a short tail with six thin spider-like legs, glowing mint-teal
energy, small mechanical-insect feel, slightly cute menacing eyes in the head facets. Show
front view and an action pose latching onto a round slime. Light gray background, no text.
```

### E3 — Spore Mage 🟡 P3
- **File**: `ENM_SporeMage_Concept.png` · 1:1
```
[GLOBAL STYLE] Enemy concept: a small mushroom-mage creature based on fungi (Penicillium /
bread mold), a fuzzy green-blue mold cap like a wizard hat, tiny glowing eyes in shadow,
holding a staff topped with a puffball, clouds of glowing spores drifting around. Cute and
eerie, green and teal tones. Light gray background, no text.
```

### E4 — Blight Troopers 🟡 P3
- **File**: `ENM_BlightTroopers_Sheet.png` · 3:2
```
[GLOBAL STYLE] Enemy concept sheet: "Blight Troopers", short stocky tribal creatures corrupted
by entropy, wearing cracked bone-white masks with hexagon cracks, dark ragged cloth wraps with
dusty particles, three classes: club warrior with a bone club, archer with a thorn bow, shaman
with a glowing staff. Stylized, not scary, slightly comical. Light gray background, no text.
```

### E5 — Boss: Carcinoma Golem (โกเลมมะเร็ง) 🟠 P2
- **File**: `BOS_CarcinomaGolem_Concept.png` · 3:2
```
[GLOBAL STYLE] Boss concept art: a colossal stone-crystal golem made of hexagonal cell-like
blocks piled chaotically and asymmetrically, with extra crystal clusters bulging and
sprouting uncontrollably from its shoulders and back (uncontrolled cell division), colors
dark purple mixed with amber gold, a glowing red core in its chest. Standing atop a tall
spiral tower arena under a stormy sky. Imposing but stylized, not gory, no flesh. No text.
```

### E6 — Boss: Toxin Hydra (ไฮดราพิษ) 🟡 P3
- **File**: `BOS_ToxinHydra_Concept.png` · 3:2
```
[GLOBAL STYLE] Boss concept art: a multi-headed water serpent made of translucent blue-green
jelly, with purple toxic bubbles drifting inside its bodies, one neck stump regrowing a new
head with glowing light, rising from a shimmering lake with membrane-like bubble surfaces.
Majestic and menacing, stylized, no gore. No text.
```

### E7 — Boss: Viral Tempest (พายุไวรัส) 🟡 P3
- **File**: `BOS_ViralTempest_Concept.png` · 3:2
```
[GLOBAL STYLE] Boss concept art: a giant floating icosahedral (20-faced) crystal entity
covered in protein spike crowns, translucent green shell revealing a coiled glowing genetic
strand inside, surrounded by a swirling mint-teal storm and many tiny copies of itself,
hovering above golden grassland. Awe-inspiring, stylized. No text.
```

### E8 — Weekly Boss: Herald's Shadow 🟢 P4
- **File**: `BOS_HeraldShadow_Concept.png` · 3:2
```
[GLOBAL STYLE] Boss concept art: a towering shadowy figure in a cracked porcelain mask and a
vast black cloak dissolving into dust, a broken halo of seven dim elemental symbols behind,
the arena floor showing a giant balance-gauge-like circular sigil split into warm and cold
halves. Ominous, elegant, not gory. No text.
```

---

# F. Environments — Cytoria (ไซโทเรีย)

| # | File | Size | Prompt (+ GLOBAL STYLE) | Priority |
|---|------|------|------------------------|---------|
| F1 | `ENV_Cytoria_CellHollow.png` | 3:2 | `A peaceful starting valley "Cell Hollow": golden grass meadows, gentle hills, giant translucent bubble-like cell spheres resting on the ground with visible organelles inside, hexagonal amber crystal rock formations, a small ancient stone statue of a tree, morning light.` | 🟠 P2 |
| F2 | `ENV_Cytoria_CellariaCity.png` | 3:2 | `Capital city "Cellaria" built inside a gigantic transparent cell dome: the central palace is a glowing round nucleus building, a power-plant district shaped like capsule mitochondria, stacked curved Golgi-like warehouses, maze-like ER streets, academy towers with hexagon windows, bustling and bright, aerial view.` | 🟠 P2 |
| F3 | `ENV_Cytoria_CellariaAcademy.png` | 3:2 | `Grand academy courtyard of "Cellaria Academy": elegant white and gold buildings with hexagonal motifs, a fountain shaped like a DNA helix, students in white-navy uniforms, greenhouse dome, flowering trees.` | 🟠 P2 |
| F4 | `ENV_Cytoria_MoleculePlains.png` | 3:2 | `Wide plains where giant floating molecule models (ball-and-stick sculptures, hexagonal sugar rings, long protein ribbons) hover over rolling hills, wind turbines made of chain-like polymers, sunny sky.` | 🟡 P3 |
| F5 | `ENV_Cytoria_EnzymeGrove.png` | 3:2 | `A mystical forest whose trees have trunks shaped like twisted protein ribbons, ancient stone "enzyme gates" with lock-and-key shaped openings, glowing temperature-gauge crystals, soft green light through leaves.` | 🟡 P3 |
| F6 | `ENV_Cytoria_MembraneLake.png` | 3:2 | `A serene lake whose shoreline is a giant glistening bilayer membrane of round bubble beads with tail lines, channel-protein shaped stone gates, water level platforms, reflections, sunset.` | 🟡 P3 |
| F7 | `ENV_Cytoria_MitosisSpire.png` | 2:3 | `A tall ominous spiral tower made of stacked hexagonal cell blocks, at the top the structure splits into two identical spires (cell division), purple crystal growths creeping up the sides, stormy clouds.` | 🟡 P3 |
| F8 | `ENV_World_Map.png` | 3:2 | `Fantasy world map illustration (top-down painted parchment style) of a continent with seven distinct regions around a central World Tree: amber hexagon highlands, icy DNA-crystal snowfields, floating sky islands, giant rainforest, volcano industrial city, canal water city, neon night city. No text, no labels.` | 🟡 P3 |

---

# G. Weapons 🟡 P3
- **File**: `WPN_Sheet_01.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Weapon design sheet, 6 weapons displayed diagonally with soft glow:
1) "Lysozyme Blade" sword – silver blade with an enzyme-pac-man shaped hilt guard;
2) "Axon Blade" sword – long slender violet blade with glowing nodes along it;
3) "Twin Helix" claymore – two ice-crystal blades twisted in a spiral;
4) "Keratin Greatsword" claymore – layered horn-like amber blade;
5) "Crystal Bloodline" polearm – clear glass spear with red liquid flowing inside;
6) "Flagellum Spear" polearm – whip-curved shaft with a corkscrew tip.
Transparent background, no text.
```
- **File**: `WPN_Sheet_02.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Weapon design sheet, 5 weapons:
1) "Cilia Bow" – bow lined with fine hair-like strands;
2) "Living Bamboo Bow" – curved living branch with sprouting leaves;
3) "Spore Bow" – mushroom-cap decorated bow releasing glowing spores;
4) "ATP Lantern" catalyst – capsule mitochondrion-shaped lantern with orange flame inside;
5) "Enzyme Codex" catalyst – floating book with a glowing molecule emblem.
Transparent background, no text.
```

---

# H. Bio-Relics (Artifacts) 🟡 P3
> 1 ภาพต่อ 1 ชุด — แต่ละภาพมี 5 ชิ้น: Membrane (ดอกไม้), Flagellum (ขนนก), Mitochondrion (นาฬิกาทราย), Vacuole (ถ้วย), Nucleus (มงกุฎ)

| ชุด | File | Prompt (+ GLOBAL STYLE) |
|----|------|------------------------|
| Pioneer Prokaryote | `RLC_PioneerProkaryote_Set.png` | `Artifact set of 5 jewel-like collectible items in a row on transparent background, theme "ancient pioneer bacteria", rustic copper and teal: a membrane-ring brooch, a whip-like flagellum feather quill, a small capsule hourglass, a round bubble goblet, a simple ring-shaped circlet. No text.` |
| Complex Eukaryote | `RLC_ComplexEukaryote_Set.png` | `Artifact set of 5 jewel-like items, theme "elegant complex cell", white porcelain and gold with colorful organelle gems: a layered membrane flower, a flagellum feather, a mitochondrion hourglass with cristae, a vacuole crystal goblet, a nucleus crown with a glowing orb center. Transparent background, no text.` |
| Sturdy Plant Cell | `RLC_SturdyPlantCell_Set.png` | `Artifact set of 5 items, theme "sturdy plant cell", green and amber with rectangular cell-wall frames: a wall-shaped flower, a leaf feather, a chloroplast hourglass, a large central-vacuole goblet, a cell-wall crown. Transparent background, no text.` |
| Stem Cell Origin | `RLC_StemCellOrigin_Set.png` | `Artifact set of 5 items, theme "stem cell origin", pearl white and soft rainbow iridescence: a blank glowing pearl flower, a feather of light, an hourglass of shifting colors, a goblet of iridescent liquid, a halo crown. Transparent background, no text.` |

---

# I. Items & Currencies 🟡 P3
- **File**: `ITM_Currency_Sheet.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Game item icon sheet, glossy collectible style, 8 icons in a 4x2 grid:
1) Insight Crystal – a radiant prismatic crystal star shaped like a light bulb of knowledge;
2) Gene Seed – a glowing golden seed with a small DNA helix wrapped around it;
3) Glucose coin – a gold coin with a hexagonal sugar-ring emblem;
4) ATP energy – a glowing battery-like orb with three linked phosphate beads;
5) Creatine Phosphate – a compact glowing energy vial;
6) Allele – a small twin-strand ribbon charm (for constellations);
7) Bio-Orb (Calcite) – a floating amber orb with a hexagon inside;
8) Antibiotic Flask – a round potion bottle with blue-green liquid and a mold-leaf label shape.
Transparent background, no text.
```
- **File**: `ITM_Materials_Sheet.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Game material icon sheet, 12 icons in 4x3 grid: monosaccharide crystal (small),
disaccharide crystal (two linked), polysaccharide crystal (chain cluster) as EXP items;
calcite sliver / fragment / chunk / gemstone (amber, increasing size); bacterial slime goo jar;
phage wing fragment; fungal spore pouch; Carcinoma Golem core; Vaccine Charm amulet.
Transparent background, no text.
```
- **File**: `ITM_Food_Sheet.png` · 3:2 · transparent background
```
[GLOBAL STYLE] Food icon sheet, appetizing anime food style, 6 dishes in a 3x2 grid:
mushroom rice bowl, protein steak with herbs, golden honey bread, lentil soup, rainbow
fruit salad, and a fiery orange "full-power glucose bomb" dessert with flame decoration.
Transparent background, no text.
```

---

# J. UI Mockups 🟡 P3
> ภาพเหล่านี้ใช้เป็น **แนวทางการออกแบบ** เท่านั้น (UI จริงจะทำในเกม) — ไม่ต้องมีตัวอักษรที่อ่านได้ ใช้แถบ/บล็อกแทนข้อความ

| # | File | Prompt (+ GLOBAL STYLE) |
|---|------|------------------------|
| J1 | `UIM_HUD_01.png` (3:2) | `Game HUD mockup over a third-person view of a white-haired traveler in a golden meadow: circular minimap top-left, quest tracker under it, party of four character portrait cards on the right, health bar bottom center, skill buttons bottom right with cooldown rings, a small floating jelly mascot speech bubble bottom-left. UI frames: dark navy translucent panels with rounded membrane-like edges, gold trim, subtle hexagon patterns. Use placeholder bars instead of readable text.` |
| J2 | `UIM_CharacterScreen.png` (3:2) | `Character menu mockup: tabs on the left, a full-body anime character in the center standing on a glowing circular platform, stats panel on the right, navy and gold UI with hexagon patterns, placeholder bars instead of text.` |
| J3 | `UIM_GeneWish.png` (3:2) | `Gacha banner screen mockup: large splash art of a violet-haired swordsman with lightning on the left, a glowing rotating DNA helix emblem, two big summon buttons bottom right, pity counter bar, navy-gold UI, placeholder bars instead of text.` |
| J4 | `UIM_Quiz.png` (3:2) | `Quiz screen mockup in a fantasy game: a parchment-style question panel in the center with an illustration slot, four large answer buttons in a 2x2 grid, a hint button with a cute jelly mascot icon, a progress indicator, blurred game world background, navy-gold UI, placeholder bars instead of text.` |
| J5 | `UIM_BioPedia.png` (3:2) | `Encyclopedia screen mockup: an open magical book interface with a grid of collectible creature and organelle cards on the left (some locked as dark silhouettes), a detailed card view on the right with a large illustration and three-star mastery indicator, navy-gold UI, placeholder bars instead of text.` |
| J6 | `UIM_KnowledgeShield.png` (3:2) | `Boss battle moment frozen in time: a giant crystal golem boss in the background covered by a glowing cracked shield, the screen dimmed and blurred, a dramatic glowing question panel in the center with four answer buttons, navy-gold UI with purple glow, placeholder bars instead of text.` |

---

# K. Skill Icons (ไอคอนสกิล) 🟢 P4
- **Template**: `SKL_[Name]_[E|Q].png` · 1:1 · transparent background
```
[GLOBAL STYLE] Round skill icon, flat-ish glossy emblem style, single symbol centered,
[ELEMENT COLOR] glow on dark circular background: [SKILL SYMBOL]. No text.
```
| File | SKILL SYMBOL |
|------|-------------|
| `SKL_Seeker_E.png` | amber hexagonal crystal wall |
| `SKL_Seeker_Q.png` | ring of amber pillars around a shockwave |
| `SKL_Mitora_E.png` | a ring of eight small flames orbiting in a circle |
| `SKL_Mitora_Q.png` | a capsule mitochondrion bursting with flame |
| `SKL_Alvi_E.png` | inward spiral of wind (inhale) |
| `SKL_Alvi_Q.png` | outward tornado (exhale) |
| `SKL_Chloren_E.png` | sun ray arrow striking a stacked green disc totem |
| `SKL_Chloren_Q.png` | circular cycle of leaves with arrows (Calvin cycle) |
| `SKL_Hema_E.png` | dash trail leaving oxygen bubbles |
| `SKL_Hema_Q.png` | circular flowing blood-water ring |
| `SKL_Neuros_E.png` | three lightning dashes jumping between nodes |
| `SKL_Neuros_Q.png` | huge lightning spike graph (action potential waveform) |
| `SKL_Helix_E.png` | a figure with a mirrored ice clone |
| `SKL_Helix_Q.png` | two intertwined ice tornadoes (double helix) |

---

# L. ดินแดนอื่น (Concept ภาพรวม) 🟢 P4
| File | Prompt (+ GLOBAL STYLE) |
|------|------------------------|
| `ENV_Genovia_Overview.png` | `Snowy kingdom "Genovia" where ice crystals naturally grow as giant DNA double helix spires, a vast library carved inside a glacier, frozen greenhouses with pea plants, aurora sky.` |
| `ENV_Zepheria_Overview.png` | `Floating sky archipelago "Zepheria": dozens of islands each with uniquely evolved wildlife and plants, airships with sails, wind streams visible as mint ribbons, bright sky.` |
| `ENV_Florantis_Overview.png` | `Colossal rainforest "Florantis": skyscraper-tall trees with glowing chlorophyll leaves, xylem-like vertical water channels in trunks, giant flowers, golden sunbeams.` |
| `ENV_Metabolis_Overview.png` | `Volcanic industrial city "Metabolis": huge capsule-shaped furnaces like mitochondria, tunnels resembling a digestive tract, orange lava light, steam, energetic workers.` |
| `ENV_Aquorra_Overview.png` | `Canal city "Aquorra": red and blue waterways like arteries and veins, a heart-shaped central fountain palace, white fortress of guardian knights, waterfalls.` |
| `ENV_Neurion_Overview.png` | `Cyber neon city "Neurion" at night: power cables branching like neurons, a giant brain-shaped central tower glowing violet, lightning arcs between buildings.` |

---

# M. รอบที่ 2 — ภาพที่เกมยังขาด (เพิ่ม 2026-10-16) 🔴 P1

> ภาพรอบแรกนำเข้าเกมครบแล้ว 🎉 รายการนี้คือภาพที่ระบบใหม่ (อาวุธ / Bio-Relic / Gene Wish) ยังใช้ภาพสำรองอยู่
> **สำคัญสำหรับแผ่นรวม:** ใช้พื้นหลังโปร่งใส และ **เว้นช่องว่างระหว่างวัตถุให้ชัด ไม่ซ้อนกัน** (สคริปต์ตัดภาพอัตโนมัติจะแยกชิ้นได้ถูกต้อง)

### M1 — Weapon Sheet 03 (อาวุธที่ยังไม่มีภาพ 4 ชิ้น)
- **File**: `WPN_Sheet_03.png` · 3:2 · transparent background · วางที่ `Assets/_Project/Art/Weapons/`
```
[GLOBAL STYLE] Weapon design sheet, 4 weapons standing upright side by side with clear empty space between
them (no overlapping), soft glow, in this exact left-to-right order:
1) "Academy Training Sword" – simple elegant steel sword, white-and-navy grip, small gold hexagon guard;
2) "Collagen Greatsword" – broad claymore whose blade looks like three twisted pale-pink fibre strands (triple helix);
3) "Academy Training Polearm" – plain light spear with a navy shaft and a blunt rounded rubber-like tip;
4) "Hormone Orb" catalyst – floating glass sphere with a glowing gland-like core and circling signal ribbons.
Transparent background, no text.
```

### M2 — Gear Materials (วัตถุดิบอัปเกรด 3 ชิ้น)
- **File**: `ITM_Gear_Sheet.png` · 3:2 · transparent background · วางที่ `Assets/_Project/Art/Items/`
```
[GLOBAL STYLE] Game material icon sheet, 3 glossy collectible icons in one row with clear space between them,
in this exact order: 1) "Calcium Ore" – chunk of white bone-like mineral with crystalline facets;
2) "Phosphate Ore" – deep-blue crystal cluster with a tiny glowing phosphate (PO4) tetrahedron motif;
3) "Growth Factor" – small glass petri dish with a glowing green cell colony and sparkles.
Transparent background, no text.
```

### M3 — Gene Wish Banners (ภาพแบนเนอร์ตู้สุ่ม · ไม่บังคับ — ตอนนี้ใช้ Splash แทน)
- **Files**: `UI_Banner_Novice.png`, `UI_Banner_Featured.png`, `UI_Banner_Standard.png` · 3:2 · วางที่ `Assets/_Project/Art/UI/Banners/`
- **เว้นพื้นที่ด้านซ้าย 40% ให้ค่อนข้างเรียบ** (เกมจะวางชื่อแบนเนอร์และตัวนับการันตีทับตรงนั้น)
```
Novice:   [GLOBAL STYLE] Gacha banner art. [CHARACTER LOCK (Hema)] standing gracefully on the right side, a circular
          river of blue water with red streaks and oxygen bubbles behind her, warm welcoming academy courtyard. Left 40% calm
          soft-focus sky. No text.
Featured: [GLOBAL STYLE] Gacha banner art. [CHARACTER LOCK (Neuros)] on the right side mid-slash, violet lightning jumping
          between glowing nodes, neon city at night. Left 40% dark and calm. No text.
Standard: [GLOBAL STYLE] Gacha banner art. [CHARACTER LOCK (Hema)] and [CHARACTER LOCK (Helix)] back to back on the right side,
          water and ice spiralling together like a double helix, grand library of crystal. Left 40% calm. No text.
```

### M4 — Talent Books (ตำราทาเลนต์ 9 เล่ม) — เพิ่ม 2026-10-16
- **File**: `ITM_Book_Sheet.png` · 1:1 · transparent background · วางที่ `Assets/_Project/Art/Items/`
- เรียง **3 แถว × 3 คอลัมน์** เว้นช่องว่างระหว่างเล่มให้ชัด
```
[GLOBAL STYLE] Game item icon sheet of 9 magical textbooks in a 3x3 grid with clear empty space between them.
Each ROW is one series, each COLUMN is a tier (left = simple pamphlet, middle = thicker guidebook, right = ornate
grand tome with gems and glow):
Row 1 "Cell Theory" – amber/gold covers with a hexagonal cell emblem;
Row 2 "Observation" – emerald-green covers with an eye + magnifying-glass emblem;
Row 3 "Hypothesis" – sky-blue covers with a flask + question-mark emblem.
Transparent background, no text, no letters on the covers.
```

### M5 — Lab Domain Entrance (ไม่บังคับ — ใช้เป็น concept)
- **File**: `ENV_LabDomain_Entrance.png` · 3:2 · วางที่ `Assets/_Project/Art/Environment/`
```
[GLOBAL STYLE] Concept art of a mysterious "Lab Domain" gate in a golden meadow: two white hexagonal stone pillars
topped with glowing crystals, a shimmering circular portal of light between them, and through the portal a glimpse
of a bright laboratory arena with hexagon floor tiles and giant glowing flasks. No text.
```

> หลังได้ภาพใหม่ ให้รันคำสั่งนี้ในโฟลเดอร์ `game` แล้วรีเฟรชเกม:
> `python tools/import_assets.py`

---

# N. บทที่ 1 — ภาพที่ใช้ในเนื้อเรื่องใหม่ (เพิ่ม 2026-10-16) 🟠 P2

> บทที่ 1 เล่นได้แล้ว (นครเซลลาเรีย + 6 เควส + โกเลมมะเร็ง) — ตอนนี้ไอเทมใหม่ใช้ไอคอนอีโมจิแทนอยู่
> ภาพ NPC (ไรโบ ป้ากอลจี ลุงอีอาร์ ดร.ไคเมร่า ปราชญ์ฮูเคีย) และ concept โกเลม/บลายต์ทรูปเปอร์ **มีครบแล้ว** ไม่ต้องสร้างใหม่

### N1 — Chapter 1 Items (ไอเทมใหม่ 7 ชิ้น)
- **File**: `ITM_Chapter1_Sheet.png` · 2:1 · transparent background · วางที่ `Assets/_Project/Art/Items/`
```
[GLOBAL STYLE] Game item icon sheet, 7 glossy collectible icons arranged in a 4-column x 2-row grid
(top row 4 icons, bottom row 3 icons on the left), clear empty space between icons, in this exact order:
1) "Amino Acid" – small red glowing tetrahedron molecule with a tiny ball-and-stick side chain;
2) "Monosaccharide" – golden hexagon sugar ring molecule (glucose), sparkling;
3) "Fatty Acid" – green zig-zag carbon chain molecule with a round head;
4) "Nucleotide" – blue pentagon sugar with a phosphate bead and a small base plate;
5) "Blight Bandage" – torn grey-violet cloth strip with faint purple glowing cracks;
6) "Syndicate Gear" – dark metal cog with a green half-double-helix emblem;
7) "Carcinoma Core" – calm red crystal core inside a hexagonal golden cage.
Transparent background, no text.
```

### N2 — 3D (ไม่บังคับ) — ใช้ภาพที่มีอยู่แล้วทำ image-to-3D
| โมเดล | ภาพต้นแบบ | วางที่ |
|------|----------|-------|
| `BOS_CarcinomaGolem.glb` | `Art/Enemies/BOS_CarcinomaGolem_Concept.png` | `Models/Enemies/` |
| `ENM_BlightTrooper.glb` | ตัวซ้ายสุดของ `Art/Enemies/ENM_BlightTroopers_Sheet.png` | `Models/Enemies/` |
| `NPC_Ribo.vrm` / `NPC_AuntieGolgi.vrm` / `NPC_UncleER.vrm` / `NPC_DrChimera.vrm` / `NPC_SageHookia.vrm` | ภาพ NPC ใน `Art/Characters/` (ปั้นใน VRoid) | `Models/NPCs/` |

---

# O. บทที่ 2 — เจโนเวีย (เพิ่ม 2026-10-16) 🟠 P2

> บทที่ 2 "รหัสที่ถูกขโมย" เล่นได้แล้ว — ตอนนี้ NPC ใหม่ใช้ภาพสำรอง และบอสใช้โมเดลชั่วคราว
> ภาพฉากเจโนเวีย (`ENV_Genovia_Overview.png`) และภาพ **เฮลิกซ์** มีครบแล้ว

### O1 — NPC Sheets (แผ่นละ 1 ตัว · รูปแบบเดียวกับ NPC เดิม: ตัวเต็มซ้าย + ครึ่งตัวขวา) · วางที่ `Assets/_Project/Art/Characters/NPC/`
| NPC | ไฟล์ | Prompt (ต่อท้าย [GLOBAL STYLE] + NPC sheet layout) |
|-----|------|-------------------------------------------|
| ปราชญ์เมนเดลิออน | `NPC_SageMendelion_Sheet.png` | `Kind elderly monk-gardener with white hair and round glasses, green-and-white winter robe embroidered with pea pods and Punnett-square tiles, straw hat dusted with snow, holding a pea plant with purple and white flowers, gentle smile.` |
| คุณแม่โรซา | `NPC_VillagerRosa_Sheet.png` | `Warm middle-aged village mother with auburn hair in a long braid, red knitted winter dress with A/B/O blood-drop embroidery, worried but kind expression.` |
| เด็กชายเลนซ์ | `NPC_VillagerLens_Sheet.png` | `Curious 9-year-old boy with fluffy blond hair, blue winter coat, colorful yarn scarf, holding a color-test card with dots, cheerful.` |
| ลุงฟอสส์ | `NPC_VillagerFoss_Sheet.png` | `Burly friendly farmer with deep dimples when smiling, brown beard, green work coat, straw hat, carrying a basket of snow peas.` |

### O2 — Chimera Beast (concept สำหรับทำ 3D)
- **File**: `BOS_ChimeraBeast_Concept.png` · 3:2 · วางที่ `Assets/_Project/Art/Enemies/`
```
[GLOBAL STYLE] Boss concept art: "Chimera Beast", a large stitched-together creature in a snowy steel fortress
courtyard: lion body and frost-blue mane, white bird wings, a teal fish tail with fins, glowing seams of
green stitches across its body, red eyes, icy breath; a lab with a PCR machine and a gel-electrophoresis bench
in the background. Dramatic, not gory. No text.
```

### O3 — Chapter 2 Items
- **File**: `ITM_Chapter2_Sheet.png` · 2:1 · transparent · วางที่ `Assets/_Project/Art/Items/`
```
[GLOBAL STYLE] Game item icon sheet, 2 glossy icons in one row with clear space between them:
1) "Ice Helix Crystal" – pale-blue ice crystal naturally twisted into a DNA double helix, sparkling;
2) "Chimera Scale" – a single scale split into three colours (frost blue, flame orange, water teal) with a green stitch.
Transparent background, no text.
```

---

# P. บทที่ 3 — ซีเฟอเรีย (เพิ่ม 2026-10-16) 🟠 P2

> บทที่ 3 "หมู่เกาะที่หายไป" เล่นได้แล้ว — ภาพฉากซีเฟอเรีย, concept พายุไวรัส และสปอร์เมจ **มีแล้ว** ไม่ต้องสร้างใหม่

### P1 — NPC Sheets · วางที่ `Assets/_Project/Art/Characters/NPC/`
| NPC | ไฟล์ | Prompt (ต่อท้าย [GLOBAL STYLE] + NPC sheet layout) |
|-----|------|-------------------------------------------|
| กัปตันดาร์วิน | `NPC_SageDarwyn_Sheet.png` | `Adventurous middle-aged airship captain and naturalist with a neat grey-blond beard, navy explorer coat with brass buttons, a sun hat with a feather, a leather satchel full of specimen jars and a sketchbook of finches, warm curious smile.` |
| ยายเซฟีรา | `NPC_GrannyZephyra_Sheet.png` | `Gentle elderly island grandmother with long white braids, mint-green shawl patterned with wind swirls, holding a basket of pastries, kind smiling eyes (grandmother of Alvi).` |
| เรนเจอร์ไลลา | `NPC_RangerLila_Sheet.png` | `Determined young park ranger woman with a brown ponytail, olive ranger uniform, goggles on her head, binoculars, a small injured bird resting on her shoulder.` |

### P2 — Chapter 3 Items
- **File**: `ITM_Chapter3_Sheet.png` · 2:1 · transparent · วางที่ `Assets/_Project/Art/Items/`
```
[GLOBAL STYLE] Game item icon sheet, 2 glossy icons in one row with clear space between them:
1) "Storm Pearl" – swirling mint-green pearl with a tiny storm cloud trapped inside;
2) "Spore Cap" – a small teal mushroom cap with glowing white spots and floating spores.
Transparent background, no text.
```

### P3 — 3D-READY (ใช้กับ `GPT_3D_ASSETS.md`)
| ไฟล์ | Prompt |
|-----|-------|
| `ENM_SporeMage.glb` | `Small mushroom-mage creature: fuzzy teal mold cap shaped like a wizard hat with white spots, dark face with two glowing yellow-green eyes, white robe, holding a staff topped with a puffball. Standing pose.` |
| `BOS_ViralTempest.glb` | `Giant icosahedral (20-faced) virus crystal: translucent mint-green faceted shell, protein spike stalks with round knobs on every vertex, a glowing golden coiled genetic strand inside. Floating, no base.` |

---

# Q. ปราชญ์ที่ยังไม่มีภาพ (เพิ่ม 2026-10-24) 🔴 P1

> เกมเล่นได้ครบทุกบทแล้ว แต่ปราชญ์ 5 คนนี้ยังใช้ภาพสำรองในบทสนทนา ทำ **NPC Sheet แผ่นละ 1 คน** แล้วเกมจะตัดเป็นไอคอนและภาพพอร์เทรตให้อัตโนมัติ
> - **ขนาด 3:2 (1536×1024)** · **พื้นหลังสีเรียบสีเดียว (สีขาวหรือเทาอ่อน)** ไม่มีฉาก ไม่มีตัวอักษร
> - **ซ้าย ~40%**: ตัวเต็มยืนหันหน้าตรง เห็นทั้งตัวตั้งแต่หัวถึงเท้า · **ขวา ~60%**: ภาพครึ่งตัว (หัวถึงเอว) ขนาดใหญ่ หันหน้าเข้ากล้องเล็กน้อย ใบหน้าอยู่ช่วงบนของภาพ
> - วางไฟล์ที่ `Assets/_Project/Art/Characters/NPC/` แล้วแจ้งผู้พัฒนา (รัน `python game/tools/import_assets.py`)
> - สีผม ตา และชุดด้านล่างตรงกับตัวละครในเกม 3D — ใช้ตามนี้เพื่อให้ภาพกับตัวในเกมตรงกัน

### Q0 — NPC SHEET LAYOUT (ต่อท้ายทุก prompt ในหมวดนี้)
```
NPC character sheet, 3:2 landscape, plain flat light-grey background, no scenery, no text.
LEFT 40%: one full-body front view standing pose, head to feet fully visible.
RIGHT 60%: one large waist-up portrait of the SAME character, three-quarter view, face in the
upper third, friendly readable expression. Both figures identical in design and colours.
```

### Q1 — Sheets ของปราชญ์ · วางที่ `Assets/_Project/Art/Characters/NPC/`
| ปราชญ์ | ไฟล์ | CHARACTER LOCK (ใส่ต่อท้าย [GLOBAL STYLE] + [Q0 LAYOUT]) |
|-----|------|---------------|
| ปราชญ์เมนเดลิออน (Cryo · บทที่ 2) | `NPC_SageMendelion_Sheet.png` | `Kind elderly monk-gardener (inspired by Gregor Mendel), short white hair, round glasses, grey-blue eyes, green winter coat over dark-green robes embroidered with pea pods and small Punnett-square tiles, violet accents, straw hat dusted with snow, holding a potted pea plant with purple and white flowers, gentle grandfatherly smile.` |
| ปราชญ์ลินนาร่า (Dendro · บทที่ 4) | `NPC_SageLinnara_Sheet.png` | `Bright 13-year-old girl naturalist (inspired by Carl Linnaeus), short build, chestnut-brown hair in two braids with small leaf and yellow-flower clips, green eyes, leaf-green explorer dress with a cream apron and golden-yellow trim, a satchel of pressed plants, a magnifying glass and a field notebook, blank cloth tags on twine tied to her belt (no writing), cheerful curious grin.` |
| ปราชญ์เครบิออน (Pyro · บทที่ 5) | `NPC_SageKrebion_Sheet.png` | `Tall burly head forge-master (inspired by Hans Krebs), dark-brown short hair and a thick beard, warm amber-brown eyes, rust-red heavy leather forge coat over a cream work shirt, orange flame accents, leather gloves, an apron embroidered with a circular eight-step cycle wheel, a large hammer whose head looks like a glowing mitochondrion furnace, sleeves rolled up, hearty laugh.` |
| ราชินีฮาร์วีน่า (Hydro · บทที่ 6) | `NPC_QueenHarvena_Sheet.png` | `Graceful queen and scholar (inspired by William Harvey), long flowing silver-lavender hair, clear blue eyes, royal-blue gown with white layers and gold trim, twin ribbons of soft red and deep blue winding around the dress like arteries and veins, a delicate gold crown with a stylised four-chambered heart gem, holding a scepter topped with a swirling water orb, calm dignified smile.` |
| จักรพรรดิคาฮาลิส (Electro · บทที่ 7) | `NPC_SageCajalis_Sheet.png` | `Tall, quiet emperor (inspired by Santiago Ramón y Cajal), long straight dark-indigo hair, glowing violet eyes, dark navy-violet imperial long coat with a pale lilac lining and gold buttons, silver embroidery of branching neurons in the style of ink drawings, a slim crown of branching dendrite-shaped lightning, a cape with faint violet light running along nerve-like lines, serene but stern expression.` |

---

## ✅ Checklist การส่งภาพกลับ (สำหรับผู้พัฒนา)
- [ ] เก็บไฟล์ตามชื่อที่กำหนด → โฟลเดอร์ `Assets/_Project/Art/...` (ดู `docs/09_เทคนิคและสถาปัตยกรรม.md` หัวข้อ 5)
- [ ] ภาพ Character Sheet ที่ "ผ่าน" แล้ว → ใช้เป็นภาพอ้างอิง (แนบกลับให้ GPT) ทุกครั้งที่สั่งภาพอื่นของตัวละครนั้น
- [ ] ตรวจว่าไม่มีส่วนที่คล้ายลิขสิทธิ์เกมอื่น
- [ ] ตรวจความเหมาะสมกับอายุ 12+

## ➕ เทมเพลตเพิ่ม Prompt ตัวละครใหม่
```
### C? — [ชื่อไทย] ([Name]) — [Element] ★[4/5] · [Weapon] · แรงบันดาลใจ: [biology]
CHARACTER LOCK ([Name]):
CHARACTER: "[Name]", a [age]-year-old [personality] [gender], [build]. [Hair color + style +
biology motif]. [Eye color], [expression]. [Outfit colors + patterns + biology motif].
[Accessories]. [Vital Core gem location + color]. Weapon: [weapon description + biology motif].
SPLASH SCENE: [action pose + skill VFX + background location]
ELEMENT COLOR: [color + HEX]
```
