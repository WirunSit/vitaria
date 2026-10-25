"""Finale (บทสรุป · the Roots of the Tree of Life) content: locations, NPCs, dialogues, questions, quiz sets, codex,
the Entropy Herald, quests. Upserts by id, so it is safe to re-run:  python tools/ch8data.py ."""
import json, math, sys
D = sys.argv[1] + '/public/data/'

def load(n): return json.load(open(D + n + '.json', encoding='utf-8'))
def save(n, v): open(D + n + '.json', 'w', encoding='utf-8').write(json.dumps(v, ensure_ascii=False, indent=2) + '\n')
def upsert(lst, items):
    ids = {x['id']: i for i, x in enumerate(lst)}
    for it in items:
        if it['id'] in ids: lst[ids[it['id']]] = it
        else: lst.append(it)
T = lambda s: {'th': s}
OX, OZ = -1800, -1800  # Roots centre (src/world/Roots.ts ARB)

# ------------------------------------------------------------------ the seven sages gather round the campfire
N0 = {n['id']: n for n in load('npcs')}
SAGES = [  # npc to copy the look from, speaker, idle line
    ('NPC_HOOKIA', 'HOOKIA', 'ทุกชีวิตเริ่มจากเซลล์ — และเซลล์ทุกเซลล์ต่อสู้กับความไร้ระเบียบด้วยพลังงานทุกวินาที'),
    ('NPC_MENDELION', 'MENDELION', 'รหัสพันธุกรรมคือหนังสือที่สิ่งมีชีวิตส่งต่อกันมา... ผู้ประกาศอยากปิดหนังสือเล่มนั้นตลอดไป'),
    ('NPC_DARWYN', 'DARWYN', 'การเปลี่ยนแปลงไม่ใช่ศัตรูของชีวิต มันคือวิธีที่ชีวิตอยู่รอด'),
    ('NPC_LINNARA', 'LINNARA', 'ใบไม้ทุกใบรู้ว่าเมื่อไหร่ควรผลิ เมื่อไหร่ควรร่วง — นั่นก็คือดุลยภาพ'),
    ('NPC_KREBION', 'KREBION', 'ชีวิตต้องเผาพลังงานตลอดเวลาเพื่อรักษาความเป็นระเบียบ หยุดเมื่อไหร่ เอนโทรปีก็ชนะ!'),
    ('NPC_HARVENA', 'HARVENA', 'ร่างกายรักษาอุณหภูมิ น้ำ และน้ำตาลไว้ในช่วงแคบ ๆ ทุกวินาที โดยที่เจ้าไม่ต้องคิดเลย'),
    ('NPC_CAJALIS', 'CAJALIS', 'ระบบประสาทและฮอร์โมนคือผู้ควบคุมดุลยภาพ — รับรู้ ตัดสิน และแก้ไขโดยไม่หยุดพัก'),
]

# ------------------------------------------------------------------ locations (local → world)
locs = [
    ('OBJ_AIRSHIP_ARB', 'ท่าเรือเหาะรากแห่งชีวิต', 4, 126, None),
    ('LOC_ARB_ARRIVE', 'ท่าเรือเหาะรากแห่งชีวิต', 0, 112, None),
    ('WP_ARB_CAMP', 'จุดซินแนปส์: ค่ายแห่งปราชญ์', 10, 88, 'waypoint'),
    ('LOC_ARB_CAMP', 'ค่ายแห่งปราชญ์', 0, 74, None),
    ('LOC_ARB_THERMO', 'ศิลาแห่งความอบอุ่น', -70, 20, None),
    ('OBJ_ARB_THERMOBOARD', 'แผ่นจารึกศิลาแห่งความอบอุ่น', -70, 21, None),
    ('WP_ARB_THERMO', 'จุดซินแนปส์: ศิลาแห่งความอบอุ่น', -86, 30, 'waypoint'),
    ('LOC_ARB_GLUCOSE', 'ศิลาแห่งน้ำตาล', 70, 30, None),
    ('OBJ_ARB_GLUCOSEBOARD', 'แผ่นจารึกศิลาแห่งน้ำตาล', 70, 31, None),
    ('WP_ARB_GLUCOSE', 'จุดซินแนปส์: ศิลาแห่งน้ำตาล', 86, 40, 'waypoint'),
    ('LOC_ARB_WATER', 'ศิลาแห่งสายน้ำ', -66, -50, None),
    ('OBJ_ARB_WATERBOARD', 'แผ่นจารึกศิลาแห่งสายน้ำ', -66, -49, None),
    ('WP_ARB_WATER', 'จุดซินแนปส์: ศิลาแห่งสายน้ำ', -84, -40, 'waypoint'),
    ('LOC_ARB_WORLD', 'ศิลาแห่งโลกที่มีชีวิต', 66, -50, None),
    ('OBJ_ARB_WORLDBOARD', 'แผ่นจารึกศิลาแห่งโลกที่มีชีวิต', 66, -49, None),
    ('WP_ARB_WORLD', 'จุดซินแนปส์: ศิลาแห่งโลกที่มีชีวิต', 84, -40, 'waypoint'),
    ('LOC_ARB_ARENA', 'ลานเมล็ดหัวใจ', 0, -76, None),
    ('LOC_ARB_TWIN', 'ลานเมล็ดหัวใจ', -5, -70, None),
    ('LOC_ARB_HOOKIA_SEED', 'ลานเมล็ดหัวใจ', 6, -70, None),
    ('WP_ARB_ARENA', 'จุดซินแนปส์: ลานเมล็ดหัวใจ', 14, -60, 'waypoint'),
]
for k, (npc, sp, line) in enumerate(SAGES):
    a = math.pi * (0.15 + 0.7 * k / 6)  # an arc on the far side of the fire, facing the dock
    locs.append((f'LOC_ARB_SAGE_{sp}', 'ค่ายแห่งปราชญ์', round(math.cos(a) * 6, 1), round(66 - math.sin(a) * 6, 1), None))
L = load('locations')
upsert(L, [dict({'id': i, 'name': T(n), 'x': OX + x, 'z': OZ + z}, **({'type': t} if t else {})) for i, n, x, z, t in locs])
save('locations', L)

# ------------------------------------------------------------------ npcs
def dlg(i, lines):
    return {'id': i, 'nodes': [{'id': f'n{k+1}', 'speaker': sp, 'text': T(tx), 'next': f'n{k+2}' if k + 1 < len(lines) else 'END'} for k, (sp, tx) in enumerate(lines)]}
twin = {'skin': '#f1d8c8', 'hair': '#1a1a22', 'eyes': '#7a4ab0', 'outfit': '#2a2236', 'outfit2': '#5a3a7a', 'accent': '#b06cff', 'hairStyle': 'short', 'height': 1.0, 'coat': True}
NPCS, SAGE_DLG = [], []
for npc, sp, line in SAGES:
    src = N0[npc]
    NPCS.append({'id': f'NPC_ARB_{sp}', 'name': src['name'], 'title': src['title'], 'location': f'LOC_ARB_SAGE_{sp}', 'model': 'human',
                 'appearance': src['appearance'], 'art': src.get('art'), 'talkDialogue': f'DLG_ARB_{sp}', 'showFlag': 'roots_unlocked'})
    SAGE_DLG.append(dlg(f'DLG_ARB_{sp}', [(sp, line)]))
hook = N0['NPC_HOOKIA']
NPCS += [
    {'id': 'NPC_HOOKIA_SEED', 'name': hook['name'], 'title': T('ปราชญ์แห่ง Geo'), 'location': 'LOC_ARB_HOOKIA_SEED', 'model': 'human', 'appearance': hook['appearance'],
     'art': hook.get('art'), 'talkDialogue': 'DLG_ARB_HOOKIA', 'showFlag': 'arb_healed'},
    {'id': 'NPC_TWIN', 'name': T('ฝาแฝดของเธอ'), 'title': T('ผู้ที่กลับมาจากเงามืด'), 'location': 'LOC_ARB_TWIN', 'model': 'human', 'appearance': twin,
     'art': 'LostTwin', 'talkDialogue': 'DLG_TWIN_IDLE', 'showFlag': 'arb_healed'},
]
NN = load('npcs')
upsert(NN, NPCS)
save('npcs', NN)

# ------------------------------------------------------------------ dialogues
DL = SAGE_DLG + [
    dlg('DLG_TWIN_IDLE', [('TWIN_FREE', 'ข้าเคยคิดว่าโลกที่ไม่เปลี่ยนแปลงจะไม่มีความเจ็บปวด... แต่โลกแบบนั้นก็ไม่มีเธอ ไม่มีเสียงหัวเราะ ไม่มีชีวิต')]),
    dlg('DLG_R1_LYSO', [
        ('LYSO', '{player} ... ดูนี่สิ ใบไม้ของต้นไม้แห่งชีวิตร่วงลงมาทั่วนครเซลลาเรีย ทั้งที่ไม่ใช่ฤดูของมัน'),
        ('LYSO', 'เส้นเลือดพลังชีวิตทั้งเจ็ดกำลังอ่อนแรง ผู้ประกาศเอนโทรปีไปถึง **รากของต้นไม้แห่งชีวิต** แล้ว'),
        ('AMOEBY', 'นั่นคือที่ที่ผู้ประกาศบอกให้เราไป... และน้องของ {player} ก็อยู่ที่นั่นด้วย'),
        ('LYSO', 'ปราชญ์ทั้งเจ็ดออกเดินทางไปรอแล้ว นี่จะเป็นการเดินทางที่สำคัญที่สุด — เรือเหาะพร้อมแล้ว'),
    ]),
    dlg('DLG_R1_FLIGHT', [
        ('NARRATOR', 'เรือเหาะร่อนลงสู่หุบเขาลึก รากไม้ขนาดเท่าภูเขาโผล่ขึ้นจากพื้นดิน เส้นแสงเจ็ดสีไหลเลื้อยไปตามพื้นสู่ทิศเหนือ'),
        ('NARRATOR', 'แต่คราบสีม่วงหม่นแผ่กระจายไปทั่ว แสงของเส้นเลือดริบหรี่ราวกับชีพจรของคนป่วย'),
    ]),
    dlg('DLG_R1_HOOKIA', [
        ('HOOKIA', 'เจ้ามาถึงแล้ว นักเดินทาง — ปราชญ์ทั้งเจ็ดอยู่ที่นี่ครบ เป็นครั้งแรกในรอบพันปี'),
        ('HOOKIA', 'ความรู้ที่เจ้าสะสมมาตลอดทาง ตั้งแต่เซลล์ไปจนถึงระบบประสาท ล้วนชี้ไปที่คำเดียวกัน — **ดุลยภาพ (Homeostasis)**'),
        ('KREBION', 'สิ่งมีชีวิตใช้พลังงานเพื่อรักษาความเป็นระเบียบไว้ตลอดเวลา ผู้ประกาศอยากให้มันหยุด แล้วปล่อยให้ทุกอย่างกลายเป็นความว่างเปล่า'),
        ('HOOKIA', 'ก่อนจะไปต่อ ข้าขอดูว่าเจ้ายังจำบทเรียนแรก ๆ ได้ไหม ตอบให้ถูก 2 จาก 3 ข้อ'),
    ]),
    dlg('DLG_R1_DONE', [
        ('HOOKIA', 'ดี — ระหว่างค่ายกับเมล็ดหัวใจมี **ศิลาแห่งดุลยภาพ** สี่ก้อน บลายต์ของผู้ประกาศกัดกินมันอยู่ ฟื้นฟูทั้งสี่ เส้นเลือดจึงจะมีแรงพอ'),
        ('HARVENA', 'เริ่มจาก **ศิลาแห่งความอบอุ่น** ทางตะวันตก ร่างกายที่ร้อนหรือเย็นเกินไปอยู่ไม่ได้แม้แต่วันเดียว'),
    ]),
    dlg('DLG_R2_THERMO', [
        ('NARRATOR', 'รอบศิลาแห่งความอบอุ่น อากาศร้อนจัดสลับหนาวเหน็บทุกไม่กี่วินาที'),
        ('AMOEBY', 'ทหารบลายต์อยู่ที่นี่ด้วย! ไล่พวกมันก่อน!'),
    ]),
    dlg('DLG_R2_SCANNED', [('HARVENA', 'ไฮโพทาลามัสคือเทอร์โมสตัตของร่างกาย — เมื่อร้อนก็ระบาย เมื่อหนาวก็เก็บ นั่นคือ **การป้อนกลับเชิงลบ** ฟื้นฟูศิลาที่แผ่นจารึกเถิด')]),
    dlg('DLG_R2_DONE', [
        ('NARRATOR', 'เส้นเลือดสีส้มสว่างขึ้น ไอร้อนและความหนาวสงบลงเป็นอากาศอบอุ่นพอดี'),
        ('KREBION', 'ศิลาที่สองอยู่ทางตะวันออก — **ศิลาแห่งน้ำตาล** เชื้อเพลิงของทุกเซลล์!'),
    ]),
    dlg('DLG_R3_GLUCOSE', [('KREBION', 'พลังงานของรากพุ่งขึ้นแล้วดิ่งลงไม่หยุด เหมือนน้ำตาลในเลือดที่ไม่มีใครคุม สแกนศิลาก่อน')]),
    dlg('DLG_R3_SCANNED', [('CAJALIS', 'อินซูลินและกลูคากอนจากตับอ่อนทำงานตรงข้ามกันเหมือนตาชั่ง — ไปปรับตาชั่งที่แผ่นจารึก')]),
    dlg('DLG_R3_DONE', [
        ('NARRATOR', 'เส้นเลือดสีทองสว่างขึ้น ชีพจรของรากเต้นสม่ำเสมอ'),
        ('HARVENA', 'ต่อไปคือ **ศิลาแห่งสายน้ำ** ทางตะวันตกเฉียงเหนือ — แต่ระวัง ข้าเห็นเงาของคณะเอนโทรปีมุ่งไปทางนั้น'),
    ]),
    dlg('DLG_R4_WATER', [('AMOEBY', 'ทหารบลายต์กับเฟจเต็มไปหมด! พวกมันรู้ว่าเรากำลังฟื้นฟูศิลา!')]),
    dlg('DLG_R4_SCANNED', [('HARVENA', 'ไตกับ ADH คุมน้ำ ลมหายใจคุมกรด-เบส ทุกระบบช่วยกันรักษาดุลยภาพ — ไปที่แผ่นจารึก')]),
    dlg('DLG_R4_DONE', [
        ('NARRATOR', 'เส้นเลือดสีฟ้าสว่างขึ้น ดินรอบศิลาชุ่มชื้นพอดี'),
        ('DARWYN', 'เหลือศิลาสุดท้าย — **ศิลาแห่งโลกที่มีชีวิต** ทางตะวันออกเฉียงเหนือ ดุลยภาพไม่ได้อยู่แค่ในร่างกาย แต่อยู่ในโลกทั้งใบ'),
    ]),
    dlg('DLG_R5_WORLD', [
        ('NARRATOR', 'ที่ศิลาแห่งโลกที่มีชีวิต ร่างหนึ่งยืนรออยู่ — ผมดำ ดวงตาสีม่วง ใบหน้าเหมือน {player} ราวกับส่องกระจก'),
        ('TWIN', '......เธอมาไกลขนาดนี้เลยเหรอ'),
        ('PLAYER', ''),
        ('TWIN', 'ผู้ประกาศบอกว่า ถ้าทุกอย่างหยุดเปลี่ยนแปลง ก็จะไม่มีใครต้องสูญเสียอีก... แต่ตลอดทางที่ข้าตามดูเธอ ข้าเห็นแต่ชีวิตที่ฟื้นคืน เพราะมันเปลี่ยนแปลงได้'),
        ('TWIN', 'สแกนศิลานี้ดูสิ แล้วบอกข้าว่าโลกที่มีชีวิตรักษาสมดุลได้อย่างไร'),
    ]),
    dlg('DLG_R5_SCANNED', [('DARWYN', 'ผู้ผลิต ผู้บริโภค ผู้ย่อยสลาย — พลังงานไหลผ่าน สารหมุนเวียนกลับ นั่นคือดุลยภาพของโลก')]),
    dlg('DLG_R5_DONE', [
        ('NARRATOR', 'เส้นเลือดสีเขียวสว่างขึ้น เส้นแสงทั้งเจ็ดไหลรวมกันไปยังเมล็ดหัวใจทางเหนือ'),
        ('TWIN', '......ข้าต้องไปถามเขาให้รู้เรื่อง'),
        ('NARRATOR', 'ฝาแฝดหันหลังเดินหายไปในเงาของรากยักษ์ มุ่งหน้าสู่เมล็ดหัวใจ'),
        ('AMOEBY', 'รอก่อน! {player} ตามไปเร็ว!'),
    ]),
    dlg('DLG_R6_ARENA', [
        ('NARRATOR', 'ลานหน้าเมล็ดหัวใจถูกคราบสีม่วงปกคลุม เมล็ดแห่งชีวิตเรืองแสงริบหรี่ใต้ซุ้มรากยักษ์'),
        ('AMOEBY', 'สแกนเมล็ดหัวใจก่อน! ต้องรู้ว่ามันยังแข็งแรงพอไหม!'),
    ]),
    dlg('DLG_R6_BOSS', [
        ('HERALD', 'เจ้ามาจนได้ ผู้แสวงหา... ดูสิ เด็กคนนั้นกล้าตั้งคำถามกับข้า เพราะเจ้าคนเดียว'),
        ('HERALD', 'ชีวิตคือการดิ้นรนที่ไร้ความหมาย ทุกเซลล์ ทุกหัวใจ สุดท้ายก็คืนสู่ความไร้ระเบียบ ข้าแค่ทำให้มันจบเร็วขึ้น'),
        ('PLAYER', ''),
        ('HOOKIA', 'ใช่ — ไม่มีสิ่งใดหนีเอนโทรปีได้ตลอดไป แต่ชีวิตเลือกที่จะใช้พลังงานสร้างความเป็นระเบียบขึ้นใหม่ทุกวินาที นั่นคือความหมายของการมีชีวิต!'),
        ('HERALD', 'งั้นมาพิสูจน์กัน ด้วยพลังของธาตุทั้งเจ็ดที่ข้าขโมยมา!'),
    ]),
    dlg('DLG_R6_AFTER', [
        ('NARRATOR', 'หน้ากากกระเบื้องของผู้ประกาศแตกร้าว ร่างในชุดคลุมดำสลายเป็นฝุ่นละอองที่ค่อย ๆ จางหาย'),
        ('HERALD', '...เจ้าชนะได้แค่วันนี้ ความไร้ระเบียบจะกลับมาเสมอ'),
        ('HOOKIA', 'แล้วชีวิตก็จะลุกขึ้นต่อสู้กับมันเสมอเช่นกัน'),
        ('NARRATOR', 'คราบสีม่วงจางหายจากผืนดิน เส้นเลือดทั้งเจ็ดส่องแสงจ้า เมล็ดหัวใจเต้นเป็นจังหวะ — และใบอ่อนใบแรกผลิออกบนรากยักษ์'),
        ('TWIN_FREE', '{player}...'),
        ('PLAYER', ''),
        ('TWIN_FREE', 'ขอโทษนะ ที่ทำให้ต้องตามหามาไกลขนาดนี้ ...กลับบ้านด้วยกันได้ไหม'),
        ('AMOEBY', 'ได้สิ! ได้แน่นอน! ฮือ... อะมีบี้ร้องไห้แล้วนะ!'),
        ('HOOKIA', 'ไปพักให้เต็มที่ แล้วมาหาข้าที่หน้าเมล็ดหัวใจ — ข้ามีบททดสอบสุดท้าย ที่รวบรวมทุกสิ่งที่เจ้าเรียนรู้มา'),
    ]),
    dlg('DLG_R6_EXAM', [('HOOKIA', 'บททดสอบสุดท้ายแห่งวิทาเรีย — ตั้งแต่เซลล์แรก จนถึงดุลยภาพของทั้งโลก ข้าเชื่อในตัวเจ้า')]),
    dlg('DLG_R6_PASS', [
        ('HOOKIA', 'ยินดีด้วย ผู้แสวงหา... ไม่สิ — **ผู้พิทักษ์แห่งชีวิต** แกนชีวิตที่ข้อมือของเจ้าสว่างครบทั้งเจ็ดสีแล้ว'),
        ('CAJALIS', 'ทุกความคิด ทุกการเคลื่อนไหวของเจ้าตลอดการเดินทาง ก็คือชีวิตที่รักษาดุลยภาพของตัวเองอยู่ทุกวินาที'),
        ('TWIN_FREE', 'ต่อจากนี้ ข้าจะเดินทางไปกับเธอนะ {player} ...ครั้งนี้ด้วยความเต็มใจ'),
        ('AMOEBY', 'แล้วก็ยังมีอีกหลายที่ที่เรายังไม่ได้ไปกินของอร่อยเลยนะ! ไปกันต่อเลย!'),
        ('NARRATOR', 'ต้นไม้แห่งชีวิตผลิใบเต็มกิ่งอีกครั้ง — การเดินทางครั้งนี้จบลง แต่การเรียนรู้ไม่มีวันจบ'),
    ]),
]
DG = load('dialogues')
upsert(DG, DL)
save('dialogues', DG)

# ------------------------------------------------------------------ questions (homeostasis + sustainability)
def mcq(i, topic, bloom, diff, stem, choices, ans, expl, cdx):
    return {'id': i, 'topic': topic, 'bloom': bloom, 'difficulty': diff, 'type': 'MCQ', 'stem': T(stem),
            'choices': [{'id': k, 'th': c} for k, c in zip('abcd', choices)], 'answer': [ans], 'explanation': T(expl), 'relatedCodex': cdx}
def tf(i, topic, bloom, diff, stem, ans, expl, cdx):
    return {'id': i, 'topic': topic, 'bloom': bloom, 'difficulty': diff, 'type': 'TF', 'stem': T(stem), 'answer': [ans], 'explanation': T(expl), 'relatedCodex': cdx}
HM, SU = 'bio.homeostasis', 'bio.ecology.sustainability'
Q = [
    mcq('Q_HM_101', HM, 'REMEMBER', 1, 'ดุลยภาพ (Homeostasis) หมายถึงข้อใด?', ['การรักษาสภาวะภายในร่างกายให้คงที่อยู่ในช่วงที่เหมาะสม', 'การที่ร่างกายไม่มีการเปลี่ยนแปลงใด ๆ เลย', 'การเจริญเติบโตของร่างกาย', 'การสืบพันธุ์'], 'a',
        'ดุลยภาพคือการรักษาสภาวะภายใน เช่น อุณหภูมิ น้ำ น้ำตาล pH ให้อยู่ในช่วงแคบ ๆ ที่เหมาะสม โดยร่างกายต้องปรับตัวตลอดเวลา ไม่ใช่การหยุดนิ่ง', ['CDX_HOMEOSTASIS']),
    mcq('Q_HM_102', HM, 'UNDERSTAND', 2, 'ข้อใดเป็นตัวอย่างของการป้อนกลับเชิงลบ (negative feedback)?', ['อุณหภูมิร่างกายสูงขึ้น → เหงื่อออก → อุณหภูมิลดลง', 'การบีบตัวของมดลูกระหว่างคลอดที่แรงขึ้นเรื่อย ๆ', 'การเกิดลิ่มเลือดที่ขยายตัวเร็วขึ้น', 'การเจริญเติบโตของกระดูก'], 'a',
        'การป้อนกลับเชิงลบคือการตอบสนองที่ "ตรงข้าม" กับการเปลี่ยนแปลง เพื่อดึงกลับสู่ค่าปกติ ส่วนการคลอดและการแข็งตัวของเลือดเป็นการป้อนกลับเชิงบวกซึ่งเสริมการเปลี่ยนแปลง', ['CDX_HOMEOSTASIS']),
    mcq('Q_HM_103', HM, 'APPLY', 2, 'เมื่ออยู่กลางแดดร้อนจัด ร่างกายรักษาอุณหภูมิอย่างไร?', ['หลอดเลือดที่ผิวหนังขยาย และหลั่งเหงื่อมากขึ้น', 'หลอดเลือดที่ผิวหนังหดตัว และหนาวสั่น', 'หยุดหายใจชั่วคราว', 'หลั่งอินซูลินมากขึ้น'], 'a',
        'เลือดไหลมาที่ผิวหนังมากขึ้นเพื่อระบายความร้อน และการระเหยของเหงื่อพาความร้อนออกไป ซึ่งสั่งการโดยไฮโพทาลามัส', ['CDX_THERMOREG']),
    mcq('Q_HM_104', HM, 'APPLY', 2, 'ขณะวิ่งมาราธอนนาน ๆ จนน้ำตาลในเลือดลดลง ร่างกายจะตอบสนองอย่างไร?', ['หลั่งกลูคากอน ให้ตับสลายไกลโคเจนเป็นกลูโคส', 'หลั่งอินซูลิน ให้ตับเก็บกลูโคส', 'หยุดใช้กลูโคสทันที', 'หลั่ง ADH มากขึ้น'], 'a',
        'เมื่อน้ำตาลในเลือดต่ำ แอลฟาเซลล์ของตับอ่อนหลั่งกลูคากอน กระตุ้นตับให้สลายไกลโคเจนเป็นกลูโคสปล่อยเข้าสู่เลือด', ['CDX_GLUCOSE_REG']),
    mcq('Q_HM_105', HM, 'ANALYZE', 3, 'ผู้ป่วยเบาหวานชนิดที่ 2 มักพบน้ำตาลในเลือดสูง เพราะเหตุใด?', ['เซลล์ของร่างกายตอบสนองต่ออินซูลินลดลง', 'ตับอ่อนไม่มีเซลล์สร้างอินซูลินเลย', 'กินโปรตีนมากเกินไป', 'ไตสร้างกลูโคสเพิ่มขึ้น'], 'a',
        'เบาหวานชนิดที่ 2 มักเกี่ยวกับภาวะดื้ออินซูลิน (insulin resistance) ซึ่งสัมพันธ์กับน้ำหนักเกินและการขาดการออกกำลังกาย ส่วนชนิดที่ 1 ร่างกายสร้างอินซูลินไม่ได้', ['CDX_GLUCOSE_REG']),
    mcq('Q_HM_106', HM, 'APPLY', 2, 'หลังเหงื่อออกมากโดยไม่ได้ดื่มน้ำ ร่างกายรักษาสมดุลน้ำอย่างไร?', ['หลั่ง ADH มากขึ้น ไตดูดน้ำกลับมาก ปัสสาวะน้อยและเข้มข้น', 'หลั่ง ADH น้อยลง ปัสสาวะมากขึ้น', 'หยุดสร้างเหงื่อตลอดไป', 'หลั่งอินซูลินมากขึ้น'], 'a',
        'เมื่อเลือดเข้มข้นขึ้น ไฮโพทาลามัสรับรู้ กระตุ้นการหลั่ง ADH จากต่อมใต้สมองส่วนหลังและทำให้กระหายน้ำ ท่อรวมของไตดูดน้ำกลับมากขึ้น', ['CDX_OSMOREG']),
    mcq('Q_HM_107', HM, 'UNDERSTAND', 2, 'เมื่อออกกำลังกาย CO₂ ในเลือดเพิ่มขึ้น ร่างกายรักษาดุลยภาพอย่างไร?', ['เมดัลลาออบลองกาตากระตุ้นให้หายใจเร็วและลึกขึ้น', 'หายใจช้าลงเพื่อเก็บ CO₂', 'หัวใจเต้นช้าลง', 'หลั่งเหงื่อน้อยลง'], 'a',
        'CO₂ ทำให้เลือดเป็นกรดมากขึ้น ตัวรับรู้ส่งสัญญาณไปยังเมดัลลาออบลองกาตา เพิ่มอัตราการหายใจเพื่อกำจัด CO₂ และรักษา pH ของเลือดให้อยู่ราว 7.4', ['CDX_OSMOREG']),
    mcq('Q_HM_108', HM, 'EVALUATE', 3, 'เพราะเหตุใดสิ่งมีชีวิตจึงต้องใช้พลังงานอยู่ตลอดเวลาเพื่อรักษาดุลยภาพ?', ['ความเป็นระเบียบของระบบมีแนวโน้มเสื่อมลงเสมอ ต้องใช้พลังงานสร้างและซ่อมแซมใหม่', 'พลังงานถูกเก็บไว้ได้ตลอดไปโดยไม่สูญเสีย', 'ดุลยภาพเกิดขึ้นเองโดยไม่ต้องทำอะไร', 'เพราะสิ่งมีชีวิตไม่ต้องการพลังงาน'], 'a',
        'ตามกฎข้อที่สองของอุณหพลศาสตร์ ความไร้ระเบียบ (เอนโทรปี) ของระบบเพิ่มขึ้นเสมอ สิ่งมีชีวิตจึงต้องได้รับพลังงานจากอาหาร/แสง แล้วนำมา (ผ่าน ATP) สร้างและซ่อมแซมเพื่อคงความเป็นระเบียบไว้', ['CDX_HOMEOSTASIS']),
    tf('Q_HM_109', HM, 'UNDERSTAND', 2, 'ระบบประสาทและระบบต่อมไร้ท่อทำงานร่วมกันในการรักษาดุลยภาพ โดยมีไฮโพทาลามัสเป็นจุดเชื่อมสำคัญ', 'T',
       'ถูก! ไฮโพทาลามัสรับข้อมูลจากระบบประสาท (เช่น อุณหภูมิ ความเข้มข้นของเลือด) แล้วสั่งการทั้งผ่านเส้นประสาทและผ่านฮอร์โมนของต่อมใต้สมอง', ['CDX_HOMEOSTASIS']),
    mcq('Q_SU_101', SU, 'UNDERSTAND', 1, 'ในระบบนิเวศ พลังงานถ่ายทอดจากลำดับขั้นหนึ่งไปอีกลำดับขั้นหนึ่งได้ประมาณเท่าใด?', ['ราว 10%', 'ราว 50%', 'ราว 90%', '100%'], 'a',
        'พลังงานส่วนใหญ่ถูกใช้ในการดำรงชีวิตและสูญเสียเป็นความร้อน ถ่ายทอดต่อได้ราว 10% พีระมิดพลังงานจึงไม่มีทางกลับหัว และห่วงโซ่อาหารมักไม่ยาวเกิน 4–5 ลำดับขั้น', ['CDX_ECO_BALANCE']),
    mcq('Q_SU_102', SU, 'ANALYZE', 2, 'ถ้าผู้ย่อยสลายหายไปจากระบบนิเวศ จะเกิดผลอย่างไร?', ['ซากสิ่งมีชีวิตสะสม แร่ธาตุไม่หมุนเวียนกลับสู่ดิน ผู้ผลิตขาดธาตุอาหาร', 'พลังงานในระบบเพิ่มขึ้น', 'ผู้ผลิตเจริญเติบโตดีขึ้น', 'ไม่มีผลใด ๆ'], 'a',
        'ผู้ย่อยสลาย (แบคทีเรีย รา) ย่อยซากเป็นสารอนินทรีย์คืนสู่ดินและอากาศ เป็นส่วนสำคัญของวัฏจักรสาร เช่น วัฏจักรคาร์บอนและไนโตรเจน', ['CDX_ECO_BALANCE']),
    mcq('Q_SU_103', SU, 'EVALUATE', 2, 'ข้อใดเป็นการใช้ทรัพยากรอย่างยั่งยืนมากที่สุด?', ['ปลูกป่าทดแทนและใช้ไม้เท่าที่ป่าฟื้นตัวทัน', 'ตัดไม้ทั้งป่าในครั้งเดียว', 'จับปลาวัยอ่อนให้ได้มากที่สุด', 'ทิ้งขยะพลาสติกลงทะเล'], 'a',
        'การพัฒนาที่ยั่งยืนคือการใช้ทรัพยากรโดยไม่เกินกำลังการฟื้นตัวของธรรมชาติ เพื่อให้คนรุ่นหลังยังมีทรัพยากรใช้', ['CDX_ECO_BALANCE']),
]
QS = load('questions')
upsert(QS, Q)
save('questions', QS)
ALL = [q['id'] for q in QS]
by = lambda *prefixes: [q['id'] for q in QS if any(q['topic'].startswith(p) for p in prefixes)]

QZ = load('quizsets')
upsert(QZ, [
    {'id': 'QZ_CH8_INTRO', 'title': T('บทเรียนแรกของฮูเคีย'), 'questionPool': by('bio.cell', 'bio.chem')[:40], 'drawCount': 3, 'passScore': 2, 'asker': 'HOOKIA'},
    {'id': 'QZ_CH8_THERMO', 'title': T('ศิลาแห่งความอบอุ่น'), 'questionPool': ['Q_HM_101', 'Q_HM_102', 'Q_HM_103', 'Q_HM_109', 'Q_NS_105'], 'drawCount': 3, 'passScore': 2, 'asker': 'HARVENA'},
    {'id': 'QZ_CH8_GLUCOSE', 'title': T('ศิลาแห่งน้ำตาล'), 'questionPool': ['Q_HM_104', 'Q_HM_105', 'Q_EN_101', 'Q_HM_108', 'Q_CR_101'], 'drawCount': 3, 'passScore': 2, 'asker': 'KREBION'},
    {'id': 'QZ_CH8_WATER', 'title': T('ศิลาแห่งสายน้ำ'), 'questionPool': ['Q_HM_106', 'Q_HM_107', 'Q_EX_104', 'Q_EX_102', 'Q_BR_106'], 'drawCount': 3, 'passScore': 2, 'asker': 'HARVENA'},
    {'id': 'QZ_CH8_WORLD', 'title': T('ศิลาแห่งโลกที่มีชีวิต'), 'questionPool': ['Q_SU_101', 'Q_SU_102', 'Q_SU_103'] + by('bio.ecology')[:6], 'drawCount': 3, 'passScore': 2, 'asker': 'DARWYN'},
    {'id': 'QZ_FINAL_EXAM', 'title': T('บททดสอบสุดท้ายแห่งวิทาเรีย'), 'questionPool': ALL, 'drawCount': 15, 'passScore': 9, 'asker': 'HOOKIA'},
    {'id': 'QZ_HERALD_1', 'title': T('โล่ความรู้: เซลล์และพันธุกรรม'), 'questionPool': by('bio.cell', 'bio.genetics')[:60], 'drawCount': 1, 'passScore': 1, 'asker': 'AMOEBY'},
    {'id': 'QZ_HERALD_2', 'title': T('โล่ความรู้: วิวัฒนาการ พืช และระบบนิเวศ'), 'questionPool': by('bio.evolution', 'bio.biodiversity', 'bio.plant', 'bio.ecology')[:60], 'drawCount': 1, 'passScore': 1, 'asker': 'AMOEBY'},
    {'id': 'QZ_HERALD_3', 'title': T('โล่ความรู้: ร่างกายและดุลยภาพ'), 'questionPool': by('bio.animal', 'bio.homeostasis')[:80], 'drawCount': 1, 'passScore': 1, 'asker': 'AMOEBY'},
])
save('quizsets', QZ)

# ------------------------------------------------------------------ codex
def cdx(i, cat, th, en, glyph, topic, body): return {'id': i, 'category': cat, 'name': {'th': th, 'en': en}, 'glyph': glyph, 'topic': topic, 'body': T(body)}
C = [
    cdx('CDX_HOMEOSTASIS', 'CONCEPT', 'ดุลยภาพ (Homeostasis)', 'Homeostasis', '⚖️', HM, 'การรักษาสภาวะภายในร่างกายให้คงที่ในช่วงที่เหมาะสม ทั้งอุณหภูมิ น้ำ น้ำตาล pH และแก๊ส · กลไกหลักคือ **การป้อนกลับเชิงลบ**: ตัวรับรู้ → ศูนย์ควบคุม (มักเป็นไฮโพทาลามัส) → หน่วยตอบสนอง ปรับกลับสู่ค่าปกติ · สิ่งมีชีวิตต้องใช้พลังงานตลอดเวลาเพื่อต้านความไร้ระเบียบ (เอนโทรปี)'),
    cdx('CDX_THERMOREG', 'CONCEPT', 'การควบคุมอุณหภูมิร่างกาย', 'Thermoregulation', '🌡️', HM, 'ไฮโพทาลามัสรักษาอุณหภูมิราว 37 °C · **ร้อน**: หลอดเลือดที่ผิวหนังขยาย หลั่งเหงื่อ · **หนาว**: หลอดเลือดที่ผิวหนังหดตัว หนาวสั่น ขนลุก และเพิ่มเมแทบอลิซึม (ไทรอกซิน) · สัตว์เลือดอุ่นคุมอุณหภูมิได้เอง สัตว์เลือดเย็นอาศัยพฤติกรรม เช่น ผึ่งแดด'),
    cdx('CDX_GLUCOSE_REG', 'CONCEPT', 'การควบคุมน้ำตาลในเลือด', 'Blood Glucose', '🍬', HM, 'น้ำตาลสูง (หลังอาหาร) → **อินซูลิน** → เซลล์นำกลูโคสไปใช้ ตับและกล้ามเนื้อเก็บเป็น **ไกลโคเจน** · น้ำตาลต่ำ (อดอาหาร ออกกำลัง) → **กลูคากอน** → ตับสลายไกลโคเจนเป็นกลูโคส · เบาหวานชนิดที่ 1 ขาดอินซูลิน ชนิดที่ 2 ดื้ออินซูลิน'),
    cdx('CDX_OSMOREG', 'CONCEPT', 'การควบคุมน้ำและกรด-เบส', 'Water & pH Balance', '💧', HM, 'เลือดเข้มข้น → ไฮโพทาลามัส → **ADH** จากต่อมใต้สมองส่วนหลัง → ท่อรวมดูดน้ำกลับ ปัสสาวะน้อย และรู้สึกกระหาย · pH ของเลือด ~7.4 คุมด้วย **บัฟเฟอร์ไบคาร์บอเนต** **การหายใจ** (กำจัด CO₂) และ **ไต** (ขับ H⁺)'),
    cdx('CDX_ECO_BALANCE', 'CONCEPT', 'ดุลยภาพของระบบนิเวศ', 'Ecosystem Balance', '🌍', SU, '**พลังงาน** ไหลทางเดียว: ผู้ผลิต → ผู้บริโภค (ถ่ายทอดได้ ~10% ต่อลำดับขั้น) · **สาร** หมุนเวียนเป็นวัฏจักร (คาร์บอน ไนโตรเจน น้ำ) โดยมีผู้ย่อยสลายคืนแร่ธาตุ · มนุษย์ส่งผลต่อดุลยภาพ เช่น ภาวะโลกร้อน การสูญพันธุ์ · **การพัฒนาที่ยั่งยืน** คือใช้ทรัพยากรโดยไม่ทำลายโอกาสของคนรุ่นหลัง'),
    cdx('CDX_ARBOR_VITAE', 'CONCEPT', 'ต้นไม้แห่งชีวิต', 'Arbor Vitae', '🌳', HM, 'ต้นไม้ยักษ์ใจกลางวิทาเรีย รากของมันส่งพลัง 7 ธาตุไปหล่อเลี้ยง 7 ดินแดน — เปรียบได้กับดุลยภาพของสิ่งมีชีวิต ที่ทุกระบบในร่างกาย (และทุกชีวิตในระบบนิเวศ) ต้องทำงานร่วมกัน ถ้าระบบใดล้มเหลว ความไร้ระเบียบจะเข้าครอบงำ'),
    cdx('CDX_ENTROPY_HERALD', 'ENEMY', 'ผู้ประกาศเอนโทรปี', 'Entropy Herald', '🎭', HM, 'ผู้นำคณะเอนโทรปี สวมหน้ากากกระเบื้องร้าว ชุดคลุมสลายเป็นฝุ่นตลอดเวลา ขโมยพลังธาตุไปจากเส้นเลือดพลังชีวิต ต้องการให้ทุกชีวิต "หยุดเปลี่ยนแปลง" — เป็นตัวแทนของ **เอนโทรปี** ความไร้ระเบียบที่เพิ่มขึ้นเสมอในธรรมชาติ ซึ่งสิ่งมีชีวิตต้านไว้ได้ด้วยการใช้พลังงานรักษาดุลยภาพ'),
    cdx('CDX_CLAUDE_BERNARD', 'SCIENTIST', 'โคลด แบร์นาร์ และวอลเตอร์ แคนนอน', 'Claude Bernard & Walter Cannon', '🧑‍🔬', HM, 'โคลด แบร์นาร์ (ค.ศ. 1813–1878) นักสรีรวิทยาชาวฝรั่งเศส เสนอแนวคิด **"สภาพแวดล้อมภายใน" (milieu intérieur)** ที่ร่างกายรักษาให้คงที่ · วอลเตอร์ แคนนอน (ค.ศ. 1871–1945) ตั้งชื่อปรากฏการณ์นี้ว่า **Homeostasis** ในปี ค.ศ. 1926 และอธิบายการตอบสนองแบบ "สู้หรือหนี"'),
]
CX = load('codex')
upsert(CX, C)
save('codex', CX)

# ------------------------------------------------------------------ the Entropy Herald (three knowledge shields: the whole curriculum)
E = load('enemies')
upsert(E, [{'id': 'EN_BOSS_HERALD', 'name': {'th': 'ผู้ประกาศเอนโทรปี', 'en': 'Entropy Herald'}, 'family': 'BLIGHT', 'tags': ['blight', 'boss'], 'kind': 'boss_herald',
            'base': {'hp': 3600, 'atk': 200, 'def': 505}, 'speed': 2.4, 'codexId': 'CDX_ENTROPY_HERALD',
            'boss': {'title': T('ผู้นำคณะเอนโทรปี'), 'shields': [0.75, 0.5, 0.25], 'quizSetId': 'QZ_HERALD_1', 'quizSetIds': ['QZ_HERALD_1', 'QZ_HERALD_2', 'QZ_HERALD_3']}, 'model': 'BOS_EntropyHerald'}])
save('enemies', E)

# ------------------------------------------------------------------ quests
def step(i, log, objs, on_start=None, on_complete=None):
    s = {'log': T(log), 'objectives': objs}
    if on_start: s['onStart'] = on_start
    if on_complete: s['onComplete'] = on_complete
    s['id'] = i
    return s
PD = lambda d: {'action': 'PLAY_DIALOGUE', 'dialogueId': d}
def rewards(extra): return [{'itemId': 'INSIGHT_CRYSTAL', 'count': 70}, {'itemId': 'GLUCOSE', 'count': 26000}, {'itemId': 'EXP_DI', 'count': 3}, {'itemId': 'RR_EXP', 'count': 800}] + extra
def quest(i, title, desc, topics, prev, steps, rw, nxt, auto=False):
    q = {'id': i, 'type': 'MAIN', 'chapter': 'CH8', 'title': T(title), 'description': T(desc), 'bioTopics': topics,
         'prerequisites': [{'type': 'QUEST_COMPLETED', 'value': prev}], 'steps': steps, 'rewards': rw, 'nextQuest': nxt}
    if auto: q['autoStart'] = True
    return q
def trial(qid, title, desc, topics, prev, nxt, site, board, puzzle, quiz, scan_id, tag, d_goto, d_scanned, d_done, fight=None, extra=None):
    steps = [step('S1', f'ไป{title}', [{'type': 'GOTO', 'locationId': site, 'radius': 18}], None, [PD(d_goto)])]
    objs = [{'type': 'SCAN', 'targetId': scan_id, 'locationId': site, 'label': T(f'สแกน{title} (กด T)')}]
    if fight:
        enemy, count, tagname, el = fight
        objs.insert(0, {'type': 'DEFEAT', 'enemyId': enemy, 'count': count, 'label': T('ขับไล่คณะเอนโทรปี')})
        steps.append(step('S2', 'ขับไล่ศัตรูและสำรวจศิลา', objs,
                          [{'action': 'SPAWN_ENEMY', 'enemyId': enemy, 'count': count, 'locationId': site, 'level': 38, 'tag': tagname, 'aggro': True, **({'element': el} if el else {})}],
                          [{'action': 'CLEAR_ENEMIES', 'tag': tagname}, PD(d_scanned)]))
    else:
        steps.append(step('S2', 'สำรวจศิลา', objs, None, [PD(d_scanned)]))
    steps.append(step('S3', 'ฟื้นฟูศิลา', [{'type': 'PUZZLE', 'objectId': board, 'puzzleId': puzzle, 'label': T('ฟื้นฟูศิลาที่แผ่นจารึก (กด F)')}]))
    steps.append(step('S4', 'ทบทวนดุลยภาพ', [{'type': 'QUIZ', 'quizSetId': quiz, 'label': T('ตอบคำถามของปราชญ์')}], None, [PD(d_done)]))
    return quest(qid, title, desc, topics, prev, steps, rewards(extra or []), nxt)

QU = [
    quest('MQ_8_01', 'เสียงเรียกจากราก', 'ใบของต้นไม้แห่งชีวิตร่วงทั่วนครเซลลาเรีย ผู้ประกาศเอนโทรปีไปถึงรากของต้นไม้แล้ว', [HM], 'MQ_7_06', [
        step('S1', 'พบศาสตราจารย์ไลโซที่สถาบัน', [{'type': 'TALK', 'npcId': 'NPC_LYSO_ACAD', 'dialogueId': 'DLG_R1_LYSO'}],
             [{'action': 'CHAPTER_CARD', 'top': 'บทสรุป', 'title': 'รากแห่งชีวิต'}, {'action': 'AMOEBY', 'text': 'ใบไม้ร่วงลงมาทั่วเมืองเลย... ไปหาศาสตราจารย์ไลโซกันเถอะ'}]),
        step('S2', 'ขึ้นเรือเหาะที่ลานหลังสถาบัน', [{'type': 'INTERACT', 'objectId': 'OBJ_AIRSHIP_CITY', 'label': T('ขึ้นเรือเหาะไปรากต้นไม้แห่งชีวิต (กด F)')}], None,
             [{'action': 'SET_FLAG', 'flag': 'roots_unlocked'}, PD('DLG_R1_FLIGHT'), {'action': 'TELEPORT', 'locationId': 'LOC_ARB_ARRIVE'}]),
        step('S3', 'พบปราชญ์ทั้งเจ็ดที่ค่าย', [{'type': 'QUIZ', 'npcId': 'NPC_ARB_HOOKIA', 'quizSetId': 'QZ_CH8_INTRO', 'dialogueId': 'DLG_R1_HOOKIA', 'label': T('คุยกับปราชญ์ฮูเคีย (กด F)')}], None, [PD('DLG_R1_DONE')]),
    ], rewards([]), 'MQ_8_02', True),
    trial('MQ_8_02', 'ศิลาแห่งความอบอุ่น', 'บลายต์ทำให้ความร้อนรอบศิลาแปรปรวน — ร่างกายต้องรักษาอุณหภูมิให้คงที่', [HM], 'MQ_8_01', 'MQ_8_03',
          'LOC_ARB_THERMO', 'OBJ_ARB_THERMOBOARD', 'PZ_THERMO', 'QZ_CH8_THERMO', 'OBJ_ARB_THERMO', 'thermo', 'DLG_R2_THERMO', 'DLG_R2_SCANNED', 'DLG_R2_DONE',
          fight=('EN_BT_CLUB', 3, 'R2', 'PYRO'), extra=[{'itemId': 'GROWTH_FACTOR', 'count': 2}]),
    trial('MQ_8_03', 'ศิลาแห่งน้ำตาล', 'พลังงานของรากขึ้นลงไม่หยุด เหมือนน้ำตาลในเลือดที่ไม่มีใครคุม', [HM], 'MQ_8_02', 'MQ_8_04',
          'LOC_ARB_GLUCOSE', 'OBJ_ARB_GLUCOSEBOARD', 'PZ_GLUCOSE', 'QZ_CH8_GLUCOSE', 'OBJ_ARB_GLUCOSE', 'glucose', 'DLG_R3_GLUCOSE', 'DLG_R3_SCANNED', 'DLG_R3_DONE',
          extra=[{'itemId': 'MAT_STORM_PEARL', 'count': 1}]),
    trial('MQ_8_04', 'ศิลาแห่งสายน้ำ', 'รากขาดน้ำสลับกับน้ำท่วม และคณะเอนโทรปีกำลังมุ่งไปขัดขวาง', [HM], 'MQ_8_03', 'MQ_8_05',
          'LOC_ARB_WATER', 'OBJ_ARB_WATERBOARD', 'PZ_WATER', 'QZ_CH8_WATER', 'OBJ_ARB_WATER', 'water', 'DLG_R4_WATER', 'DLG_R4_SCANNED', 'DLG_R4_DONE',
          fight=('EN_BT_CLUB', 3, 'R4', 'HYDRO'), extra=[{'itemId': 'GROWTH_FACTOR', 'count': 2}]),
    trial('MQ_8_05', 'ศิลาแห่งโลกที่มีชีวิต', 'ดุลยภาพไม่ได้อยู่แค่ในร่างกาย แต่อยู่ในโลกทั้งใบ — และมีใครบางคนรออยู่ที่ศิลา', [SU, HM], 'MQ_8_04', 'MQ_8_06',
          'LOC_ARB_WORLD', 'OBJ_ARB_WORLDBOARD', 'PZ_ECO', 'QZ_CH8_WORLD', 'OBJ_ARB_WORLD', 'world', 'DLG_R5_WORLD', 'DLG_R5_SCANNED', 'DLG_R5_DONE',
          extra=[{'itemId': 'MAT_SYN_GEAR', 'count': 3}]),
    quest('MQ_8_06', 'ผู้ประกาศเอนโทรปี', 'เผชิญหน้ากับผู้ประกาศเอนโทรปีที่เมล็ดหัวใจของต้นไม้แห่งชีวิต และพาฝาแฝดกลับบ้าน', [HM, SU], 'MQ_8_05', [
        step('S1', 'ไปลานเมล็ดหัวใจ (เหนือ)', [{'type': 'GOTO', 'locationId': 'LOC_ARB_ARENA', 'radius': 22}], None, [PD('DLG_R6_ARENA')]),
        step('S2', 'สำรวจเมล็ดหัวใจ', [{'type': 'SCAN', 'targetId': 'OBJ_ARB_SEED', 'locationId': 'LOC_ARB_ARENA', 'label': T('สแกนเมล็ดหัวใจแห่งต้นไม้แห่งชีวิต (กด T)')}]),
        step('S3', 'ปราบผู้ประกาศเอนโทรปี', [{'type': 'DEFEAT', 'enemyId': 'EN_BOSS_HERALD', 'label': T('ปราบผู้ประกาศเอนโทรปี (ธาตุของเขาเปลี่ยนทุกครั้งที่โล่แตก!)')}],
             [PD('DLG_R6_BOSS'), {'action': 'SPAWN_ENEMY', 'enemyId': 'EN_BOSS_HERALD', 'count': 1, 'locationId': 'LOC_ARB_ARENA', 'level': 40, 'tag': 'R6', 'aggro': True}],
             [{'action': 'WAIT', 'ms': 1000}, {'action': 'CLEAR_ENEMIES', 'tag': 'R6'}, {'action': 'SET_FLAG', 'flag': 'arb_healed'}, PD('DLG_R6_AFTER')]),
        step('S4', 'บททดสอบสุดท้ายแห่งวิทาเรีย', [{'type': 'QUIZ', 'npcId': 'NPC_HOOKIA_SEED', 'quizSetId': 'QZ_FINAL_EXAM', 'dialogueId': 'DLG_R6_EXAM', 'label': T('รับบททดสอบสุดท้ายจากปราชญ์ฮูเคีย (กด F)')}], None,
             [PD('DLG_R6_PASS'), {'action': 'SET_FLAG', 'flag': 'game_complete'}, {'action': 'CHAPTER_CARD', 'top': 'บทสรุป · จบ', 'title': 'ตำนานธาตุแห่งชีวิต'}]),
    ], [{'itemId': 'INSIGHT_CRYSTAL', 'count': 160}, {'itemId': 'GLUCOSE', 'count': 50000}, {'itemId': 'EXP_DI', 'count': 6}, {'itemId': 'GROWTH_FACTOR', 'count': 5}, {'itemId': 'MAT_GOLEM_CORE', 'count': 2}, {'itemId': 'RR_EXP', 'count': 1500}], None),
]
QQ = load('quests')
upsert(QQ, QU)
for q in QQ:
    if q['id'] == 'MQ_7_06': q['nextQuest'] = 'MQ_8_01'
save('quests', QQ)
items = {i['id'] for i in load('items')}
need = {r['itemId'] for q in QU for r in q['rewards']}
print('missing items:', need - items)
print('ok', len(Q), 'questions ·', len(ALL), 'in the final exam pool')
