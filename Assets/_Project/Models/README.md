# วางโมเดล 3 มิติที่นี่

หลังวางไฟล์ ให้รันคำสั่งนี้ในโฟลเดอร์ `game` แล้วรีเฟรชเกม — เกมจะเปลี่ยนจากโมเดลชั่วคราวเป็นโมเดลจริงเอง

```
python tools/import_assets.py
```

## Characters/ — ตัวละครเล่นได้ (VRoid Studio → `.vrm`)
| ไฟล์ | ตัวละคร |
|-----|--------|
| `CHR_Sira.vrm` / `CHR_Sion.vrm` | นักเดินทาง (หญิง / ชาย) |
| `CHR_Mitora.vrm` | ไมโทร่า |
| `CHR_Alvi.vrm` | อัลวี |
| `CHR_Chloren.vrm` | คลอเรน |
| `CHR_Hema.vrm` | ฮีม่า |
| `CHR_Neuros.vrm` | นิวรอส |
| `CHR_Helix.vrm` | เฮลิกซ์ |

**ตั้งค่า Export ใน VRoid Studio**: VRM 0.0 หรือ 1.0 ก็ได้ · ลดขนาด Texture เป็น 1024 · ลดจำนวนโพลีกอน (Reduce Polygons) ระดับกลาง → ไฟล์ควรเล็กกว่า 30 MB
> อาวุธไม่ต้องปั้น — เกมจะติดอาวุธให้ที่มือเอง

## NPCs/ — NPC (VRoid → `.vrm`)
| ไฟล์ | NPC |
|-----|-----|
| `NPC_ProfLyso.vrm` | ศาสตราจารย์ไลโซ |
| `NPC_Ribo.vrm` | ไรโบ (ครัวไรโบโซม) |
| `NPC_AuntieGolgi.vrm` | ป้ากอลจี (ไปรษณีย์) |
| `NPC_UncleER.vrm` | ลุงอีอาร์ (โรงตีเหล็ก) |
| `NPC_DrChimera.vrm` | ดร.ไคเมร่า |
| `NPC_SageHookia.vrm` | ปราชญ์ฮูเคีย |

## Weapons/ — อาวุธ (ไม่บังคับ) (AI image-to-3D → `.glb`)
ตอนนี้เกมสร้างอาวุธ 3 มิติจากภาพ GPT ให้อัตโนมัติอยู่แล้ว (ดันภาพให้หนาขึ้น) — ถ้าได้โมเดลจริงมา วางไฟล์ไว้ที่นี่ เกมจะใช้โมเดลจริงแทน
| ไฟล์ | ภาพต้นแบบ (ใส่ทีละชิ้น) |
|-----|----------|
| `WPN_TRAINING_SWORD.glb` (หรือ `TRAINING_SWORD.glb`) | `game/public/assets/weapons/WPN_TRAINING_SWORD.png` |
| ...ชื่อเดียวกับรหัสใน `weapons.json` ทุกชิ้น | |

**เคล็ดลับ**: ให้อาวุธ **ตั้งชี้ปลายขึ้น ด้ามอยู่ล่าง** (แบบที่ AI ส่วนใหญ่สร้างอยู่แล้ว) · เลือก Low poly / ไม่เกิน ~10,000 faces · texture 1K · Hyper3D Rodin ใช้ **Gen-1.5** ดาวน์โหลดได้ฟรี

## Props/ — สิ่งก่อสร้างและพร็อพ (AI image-to-3D → `.glb`)
ชื่อไฟล์และ prompt ทั้งหมดอยู่ใน **`GPT_3D_ASSETS.md`** (เช่น `BLD_NucleusPalace.glb`, `PRP_Waypoint.glb`, `PRP_Chest.glb`) — วางไฟล์ไว้ที่นี่ เกมจะแทนรูปทรงเดิมให้เอง

## Enemies/ — ศัตรู (AI image-to-3D เช่น Tripo3D / Meshy / Hunyuan3D → `.glb`)
| ไฟล์ | ศัตรู | ภาพต้นแบบ |
|-----|------|----------|
| `ENM_CoccusSlime.glb` | ค็อกคัสสไลม์ (ทรงกลม) | ตัดจาก `Art/Enemies/ENM_BacterioSlimes_Sheet.png` แถวบน |
| `ENM_BacillusSlime.glb` | บาซิลลัสสไลม์ (ทรงแท่ง) | แถวกลางของแผ่นเดียวกัน |
| `ENM_PhageDrone.glb` | เฟจโดรน | `Art/Enemies/ENM_PhageDrone_Concept.png` |
| `BOS_BacteriaKing.glb` | ราชาแบคทีเรีย (บอส) | สไลม์ทรงกลมสีเขียวสวมมงกุฎหนามสีทอง |
| `BOS_CarcinomaGolem.glb` | โกเลมมะเร็ง (บอสบทที่ 1) | `Art/Enemies/BOS_CarcinomaGolem_Concept.png` |
| `BOS_ViralTempest.glb` | พายุไวรัส (บอสบทที่ 3) | `Art/Enemies/BOS_ViralTempest_Concept.png` |
| `ENM_SporeMage.glb` | สปอร์เมจ | `Art/Enemies/ENM_SporeMage_Concept.png` |
| `BOS_ChimeraBeast.glb` | ไคเมร่าบีสต์ (บอสบทที่ 2) | `Art/Enemies/BOS_ChimeraBeast_Concept.png` (ขอจาก GPT หมวด O2) |
| `ENM_BlightTrooper.glb` | บลายต์ทรูปเปอร์ | ตัวซ้ายสุดของ `Art/Enemies/ENM_BlightTroopers_Sheet.png` |

**เคล็ดลับ**: ใส่ภาพที่มีวัตถุ **ตัวเดียว** พื้นหลังเรียบ (ตัดจากแผ่นรวมก่อน) · ไม่ต้องใส่สีตามธาตุ — เกมย้อมสีให้เอง (สไลม์ไฟ/น้ำ) · ไม่ต้องทำแอนิเมชัน — เกมขยับให้ (กระโดด ยืดหด)
