# -*- coding: utf-8 -*-
"""
saju_calculator.py
만세력(사주 명리학) 계산 모듈

일주(日柱), 오행 비율, 십성(十星), 대운(大運), SVG 좌표 정보를 도출합니다.
"""

from datetime import datetime, date
import math


# ─────────────────────────────────────────────
# 기초 상수 정의
# ─────────────────────────────────────────────

CHEONGAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"]
CHEONGAN_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
CHEONGAN_MAP = dict(zip(CHEONGAN_HANJA, CHEONGAN))

JIJI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"]
JIJI_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
JIJI_MAP = dict(zip(JIJI_HANJA, JIJI))

CHEONGAN_OHANG = {
    "갑": "목", "을": "목",
    "병": "화", "정": "화",
    "무": "토", "기": "토",
    "경": "금", "신": "금",
    "임": "수", "계": "수",
}

JIJI_OHANG = {
    "자": "수", "축": "토", "인": "목", "묘": "목",
    "진": "토", "사": "화", "오": "화", "미": "토",
    "신": "금", "유": "금", "술": "토", "해": "수",
}

JIJI_EUYANG = {
    "자": "양", "축": "음", "인": "양", "묘": "음",
    "진": "양", "사": "음", "오": "양", "미": "음",
    "신": "양", "유": "음", "술": "양", "해": "음",
}

CHEONGAN_EUYANG = {
    "갑": "양", "을": "음", "병": "양", "정": "음",
    "무": "양", "기": "음", "경": "양", "신": "음",
    "임": "양", "계": "음",
}

OHANG_RELATIONS = {
    ("목", "목"): "비겁", ("목", "화"): "식상", ("목", "토"): "재성", ("목", "금"): "관성", ("목", "수"): "인성",
    ("화", "화"): "비겁", ("화", "토"): "식상", ("화", "금"): "재성", ("화", "수"): "관성", ("화", "목"): "인성",
    ("토", "토"): "비겁", ("토", "금"): "식상", ("토", "수"): "재성", ("토", "목"): "관성", ("토", "화"): "인성",
    ("금", "금"): "비겁", ("금", "수"): "식상", ("금", "목"): "재성", ("금", "화"): "관성", ("금", "토"): "인성",
    ("수", "수"): "비겁", ("수", "목"): "식상", ("수", "화"): "재성", ("수", "토"): "관성", ("수", "금"): "인성",
}

SIPSUNG_DETAIL = {
    ("비겁", "same"): "비견", ("비겁", "diff"): "겁재",
    ("식상", "same"): "식신", ("식상", "diff"): "상관",
    ("재성", "same"): "편재", ("재성", "diff"): "정재",
    ("관성", "same"): "편관", ("관성", "diff"): "정관",
    ("인성", "same"): "편인", ("인성", "diff"): "정인",
}

JEOLGI_MONTH = [
    (1,  6,  1), (2,  4,  2), (3,  6,  3), (4,  5,  4),
    (5,  6,  5), (6,  6,  6), (7,  7,  7), (8,  8,  8),
    (9,  8,  9), (10, 8, 10), (11, 7, 11), (12, 7, 12),
]

MONTH_TO_JIJI_IDX = {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7,
    7: 8, 8: 9, 9: 10, 10: 11, 11: 0, 12: 1,
}

# ─────────────────────────────────────────────
# 핵심 계산 함수
# ─────────────────────────────────────────────

def get_year_ganzhi(year: int) -> tuple[str, str]:
    idx = (year - 4) % 60
    return CHEONGAN[idx % 10], JIJI[idx % 12]

def get_month_ganzhi(year: int, month_num: int, cheongan_year: str) -> tuple[str, str]:
    jiji_idx = MONTH_TO_JIJI_IDX[month_num]
    year_gan_idx = CHEONGAN.index(cheongan_year)
    month_gan_start = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}
    start_idx = month_gan_start[year_gan_idx % 10]
    month_offset = (month_num - 1) % 12
    return CHEONGAN[(start_idx + month_offset) % 10], JIJI[jiji_idx]

def get_day_ganzhi(birth_date: date) -> tuple[str, str]:
    base_date = date(1900, 1, 1)
    base_ganzhi_idx = 10
    delta = (birth_date - base_date).days
    ganzhi_idx = (base_ganzhi_idx + delta) % 60
    return CHEONGAN[ganzhi_idx % 10], JIJI[ganzhi_idx % 12]

def get_hour_ganzhi(hour: int, day_cheongan: str) -> tuple[str, str]:
    hour_jiji_idx = ((hour + 1) // 2) % 12
    day_gan_idx = CHEONGAN.index(day_cheongan)
    hour_gan_start = {0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8}
    start_idx = hour_gan_start[day_gan_idx % 10]
    return CHEONGAN[(start_idx + hour_jiji_idx) % 10], JIJI[hour_jiji_idx]

def get_jeolgi_month_num(birth_date: date) -> int:
    year, month, day = birth_date.year, birth_date.month, birth_date.day
    for m, d, num in JEOLGI_MONTH:
        if m == month:
            jeolgi_day, jeolgi_num = d, num
            break
    else:
        jeolgi_num, jeolgi_day = month, 6

    if day < jeolgi_day:
        jeolgi_num = (jeolgi_num - 2) % 12 + 1
    return jeolgi_num

def calculate_ohang_ratio(pillars: list[tuple[str, str]]) -> dict:
    ohang_scores = {"목": 0.0, "화": 0.0, "토": 0.0, "금": 0.0, "수": 0.0}
    year_gan, year_ji = pillars[0]
    month_gan, month_ji = pillars[1]
    day_gan, day_ji = pillars[2]
    hour_gan, hour_ji = pillars[3]
    
    if year_gan in CHEONGAN_OHANG:   ohang_scores[CHEONGAN_OHANG[year_gan]] += 12.0
    if month_gan in CHEONGAN_OHANG:  ohang_scores[CHEONGAN_OHANG[month_gan]] += 12.0
    if day_gan in CHEONGAN_OHANG:    ohang_scores[CHEONGAN_OHANG[day_gan]] += 12.0
    if hour_gan in CHEONGAN_OHANG:   ohang_scores[CHEONGAN_OHANG[hour_gan]] += 12.0
    
    if year_ji in JIJI_OHANG:   ohang_scores[JIJI_OHANG[year_ji]] += 10.6
    if month_ji in JIJI_OHANG:  ohang_scores[JIJI_OHANG[month_ji]] += 20.0
    if day_ji in JIJI_OHANG:    ohang_scores[JIJI_OHANG[day_ji]] += 10.6
    if hour_ji in JIJI_OHANG:   ohang_scores[JIJI_OHANG[hour_ji]] += 10.8
    
    ratio = {k: round(v, 1) for k, v in ohang_scores.items()}
    scores_100 = {k: min(100.0, round(v * 2.2, 1)) for k, v in ohang_scores.items()}
    
    ohang_count = {"목": 0, "화": 0, "토": 0, "금": 0, "수": 0}
    for gan, ji in pillars:
        if gan in CHEONGAN_OHANG: ohang_count[CHEONGAN_OHANG[gan]] += 1
        if ji in JIJI_OHANG: ohang_count[JIJI_OHANG[ji]] += 1
        
    return {"count": ohang_count, "ratio": ratio, "scores_100": scores_100}

def calculate_svg_polygon_points(scores_100: dict) -> str:
    # 파이썬에서 직접 SVG 좌표를 계산하여 AI의 수학적 오류 원천 차단
    elements = ["목", "화", "토", "금", "수"]
    angles_rad = [
        -math.pi / 2,                          # 목: 12시 방향 (0도)
        -math.pi / 2 + (2 * math.pi / 5),      # 화: 72도
        -math.pi / 2 + (4 * math.pi / 5),      # 토: 144도
        -math.pi / 2 + (6 * math.pi / 5),      # 금: 216도
        -math.pi / 2 + (8 * math.pi / 5)       # 수: 288도
    ]
    
    points = []
    for i, el in enumerate(elements):
        score = scores_100.get(el, 0)
        # 0점이어도 기본 반경 60px 유지, 최대 100점일때 120px 반경
        dist = 60 + (score * 0.6)
        x = 200 + dist * math.cos(angles_rad[i])
        y = 200 + dist * math.sin(angles_rad[i])
        points.append(f"{x:.1f},{y:.1f}")
        
    return " ".join(points)

def calculate_sipsung(ilgan: str, target: str) -> str:
    ilgan_ohang = CHEONGAN_OHANG.get(ilgan)
    target_ohang = CHEONGAN_OHANG.get(target)
    if not ilgan_ohang or not target_ohang: return "비겁"
    base_relation = OHANG_RELATIONS.get((ilgan_ohang, target_ohang), "비겁")
    same_or_diff = "same" if CHEONGAN_EUYANG.get(ilgan) == CHEONGAN_EUYANG.get(target) else "diff"
    return SIPSUNG_DETAIL.get((base_relation, same_or_diff), base_relation)

def calculate_daewoon(birth_date: date, gender: str, year_cheongan: str, month_pillar: tuple[str, str]) -> list[dict]:
    year_euyang = CHEONGAN_EUYANG[year_cheongan]
    forward = True if (gender == "남" and year_euyang == "양") or (gender == "여" and year_euyang == "음") else False
    
    birth_month, birth_day = birth_date.month, birth_date.day
    jeolgi_day_this = 6
    for m, d, _ in JEOLGI_MONTH:
        if m == birth_month:
            jeolgi_day_this = d
            break

    if forward:
        if birth_day < jeolgi_day_this: days_to_jeolgi = jeolgi_day_this - birth_day
        else:
            next_month = birth_month % 12 + 1
            next_jeolgi_day = 6
            for m, d, _ in JEOLGI_MONTH:
                if m == next_month:
                    next_jeolgi_day = d
                    break
            import calendar
            days_in_month = calendar.monthrange(birth_date.year, birth_month)[1]
            days_to_jeolgi = (days_in_month - birth_day) + next_jeolgi_day
    else:
        if birth_day >= jeolgi_day_this: days_to_jeolgi = birth_day - jeolgi_day_this
        else:
            prev_month = (birth_month - 2) % 12 + 1
            prev_jeolgi_day = 6
            for m, d, _ in JEOLGI_MONTH:
                if m == prev_month:
                    prev_jeolgi_day = d
                    break
            import calendar
            days_in_prev = calendar.monthrange(birth_date.year, prev_month)[1]
            days_to_jeolgi = (days_in_prev - prev_jeolgi_day) + birth_day

    daewoon_start_age = max(1, round(days_to_jeolgi / 3))
    month_gan_idx = CHEONGAN.index(month_pillar[0])
    month_ji_idx = JIJI.index(month_pillar[1])

    daewoon_list = []
    for i in range(1, 9):
        if forward:
            gan_idx, ji_idx = (month_gan_idx + i) % 10, (month_ji_idx + i) % 12
        else:
            gan_idx, ji_idx = (month_gan_idx - i) % 10, (month_ji_idx - i) % 12
        age = daewoon_start_age + (i - 1) * 10
        daewoon_list.append({
            "순서": i, "나이": age, "천간": CHEONGAN[gan_idx], "지지": JIJI[ji_idx],
            "천간_오행": CHEONGAN_OHANG[CHEONGAN[gan_idx]], "지지_오행": JIJI_OHANG[JIJI[ji_idx]],
        })
    return daewoon_list

def calculate_saju(birth_year: int, birth_month: int, birth_day: int, birth_hour: int = 12, gender: str = "남") -> dict:
    birth_date = date(birth_year, birth_month, birth_day)
    year_gan, year_ji = get_year_ganzhi(birth_year)
    jeolgi_month_num = get_jeolgi_month_num(birth_date)
    month_gan, month_ji = get_month_ganzhi(birth_year, jeolgi_month_num, year_gan)
    day_gan, day_ji = get_day_ganzhi(birth_date)
    hour_gan, hour_ji = get_hour_ganzhi(birth_hour, day_gan)

    pillars = [(year_gan, year_ji), (month_gan, month_ji), (day_gan, day_ji), (hour_gan, hour_ji)]
    ohang_data = calculate_ohang_ratio(pillars)
    
    # SVG 폴리곤 좌표 계산 추가
    svg_points = calculate_svg_polygon_points(ohang_data["scores_100"])

    sipsung_list = []
    targets = [
        ("연간", year_gan, "천간"), ("연지", year_ji, "지지"),
        ("월간", month_gan, "천간"), ("월지", month_ji, "지지"),
        ("일지", day_ji, "지지"), ("시간", hour_gan, "천간"), ("시지", hour_ji, "지지")
    ]
    for label, target, kind in targets:
        if kind == "천간":
            ss, ohang = calculate_sipsung(day_gan, target), CHEONGAN_OHANG[target]
        else:
            ji_ohang = JIJI_OHANG[target]
            ss, ohang = OHANG_RELATIONS.get((CHEONGAN_OHANG[day_gan], ji_ohang), "비겁"), ji_ohang
        sipsung_list.append({"위치": label, "글자": target, "오행": ohang, "십성": ss})

    daewoon = calculate_daewoon(birth_date, gender, year_gan, (month_gan, month_ji))
    strong_count = sum(1 for item in sipsung_list if item["십성"] in ["비겁", "비견", "겁재", "인성", "정인", "편인"])
    ilju_strength = "신강(身强)" if strong_count >= len(sipsung_list) / 2 else "신약(身弱)"
    yongsin = f"{min(ohang_data['count'], key=ohang_data['count'].get)}(보완 필요)"

    return {
        "생년월일시": f"{birth_year}년 {birth_month}월 {birth_day}일 {birth_hour}시",
        "성별": gender,
        "사주_기둥": {
            "연주": {"천간": year_gan, "지지": year_ji, "천간_오행": CHEONGAN_OHANG[year_gan], "지지_오행": JIJI_OHANG[year_ji]},
            "월주": {"천간": month_gan, "지지": month_ji, "천간_오행": CHEONGAN_OHANG[month_gan], "지지_오행": JIJI_OHANG[month_ji]},
            "일주": {"천간": day_gan, "지지": day_ji, "천간_오행": CHEONGAN_OHANG[day_gan], "지지_오행": JIJI_OHANG[day_ji]},
            "시주": {"천간": hour_gan, "지지": hour_ji, "천간_오행": CHEONGAN_OHANG[hour_gan], "지지_오행": JIJI_OHANG[hour_ji]},
        },
        "일간": day_gan, "일주_요약": f"{day_gan}{day_ji}일주",
        "일주_강약": ilju_strength, "용신": yongsin,
        "오행_분석": ohang_data,
        "오행_SVG_좌표": svg_points, # 프롬프트로 전달할 데이터 추가
        "십성_분석": sipsung_list, "대운": daewoon,
    }

def format_saju_for_prompt(saju_data: dict, celebrity_name: str) -> str:
    d = saju_data
    pillars = d["사주_기둥"]
    to_hanja_korean = lambda gan, ji: f"{gan}({CHEONGAN_MAP.get(gan, gan)}){ji}({JIJI_MAP.get(ji, ji)})"

    lines = [
        f"[{celebrity_name} 사주 명리학 분석 데이터]",
        f"생년월일시: {d['생년월일시']} / 성별: {d['성별']}",
        "", "■ 사주 원국(四柱原局)",
        f"  연주(年柱): {to_hanja_korean(pillars['연주']['천간'], pillars['연주']['지지'])} ({pillars['연주']['천간_오행']}/{pillars['연주']['지지_오행']})",
        f"  월주(月柱): {to_hanja_korean(pillars['월주']['천간'], pillars['월주']['지지'])} ({pillars['월주']['천간_오행']}/{pillars['월주']['지지_오행']})",
        f"  일주(日柱): {to_hanja_korean(pillars['일주']['천간'], pillars['일주']['지지'])} ({pillars['일주']['천간_오행']}/{pillars['일주']['지지_오행']})",
        f"  시주(時柱): {to_hanja_korean(pillars['시주']['천간'], pillars['시주']['지지'])} ({pillars['시주']['천간_오행']}/{pillars['시주']['지지_오행']})",
        "",
        f"■ 일주: {to_hanja_korean(d['일간'], d['일주_요약'][1:2]) if len(d['일주_요약']) >= 2 else d['일주_요약']} | 강약: {d['일주_강약']} | 용신: {d['용신']}",
        "", "■ 오행 비율",
    ]
    for ohang, ratio in d["오행_분석"]["ratio"].items():
        score = d["오행_분석"].get("scores_100", {}).get(ohang, ratio)
        lines.append(f"  {ohang}: {d['오행_분석']['count'][ohang]}개 ({ratio}%) -> 에너지 점수: {score}점")

    # SVG 생성용 필수 좌표 데이터 주입
    lines += ["", f"■ SVG 레이더 차트 전용 폴리곤 좌표 (그대로 복사해서 사용할 것): {d['오행_SVG_좌표']}"]

    lines += ["", "■ 십성 분석"]
    for item in d["십성_분석"]:
        char = item['글자']
        k_char = CHEONGAN_MAP.get(char, JIJI_MAP.get(char, char))
        display_char = f"{char}({k_char})" if char != k_char else char
        lines.append(f"  {item['위치']}({display_char}) - {item['오행']} - {item['십성']}")

    lines += ["", "■ 대운(大運) 흐름"]
    for dw in d["대운"]:
        lines.append(f"  {dw['나이']}세~: {to_hanja_korean(dw['천간'], dw['지지'])} ({dw['천간_오행']}/{dw['지지_오행']})")

    return "\n".join(lines)