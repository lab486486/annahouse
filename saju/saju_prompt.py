# -*- coding: utf-8 -*-
"""
saju_prompt.py
DeepSeek에 넘기는 사주 HTML 프롬프트와 SEO 태그.
"""


class SajuPrompt:
    @staticmethod
    def build_saju_prompt(celebrity_name: str, saju_text: str, birth_year: str = "") -> str:
        """
        사주 데이터를 기반으로 DeepSeek에 전달할 프롬프트를 구성합니다.
        최신 2030 사주 트렌드(신살 재해석, 인맥 시너지, 현대적 개운법)가 전면 반영된 최종 버전입니다.
        이름에 '+'가 포함되어 있으면 [그룹명]+[활동명]으로 분리하고, 괄호()가 있으면 본명으로 인지하도록 처리합니다.
        """
        # 본명 '( )' 분리 로직 추가
        real_name_guide = ""
        if "(" in celebrity_name and ")" in celebrity_name:
            base_name, real_name = celebrity_name.split("(", 1)
            real_name = real_name.replace(")", "").strip()
            base_name = base_name.strip()
            real_name_guide = f" 이 인물의 실제 본명은 '{real_name}'입니다. 본명 언급 시 반드시 이 이름을 사용하고, 절대 다른 이름을 임의로 지어내지 마세요."
            celebrity_name = base_name

        # '+' 기호 분리 및 AI 안내용 가이드 생성 규칙 추가
        if "+" in celebrity_name:
            group_name, active_name = celebrity_name.split("+", 1)
            identity_guide = f"대상 인물은 그룹 '{group_name}'의 멤버 '{active_name}'입니다. '{group_name}'은 성씨나 이름의 일부가 아닌 소속 그룹명입니다.{real_name_guide}"
            display_name = active_name  # 제목 및 본문 키워드에 활용할 활동명
        else:
            identity_guide = real_name_guide
            display_name = celebrity_name

        prompt = f"""당신은 대한민국 최고의 사주 명리학 전문가이자, 운세 전문가입니다. 
{identity_guide}
아래 구조와 섹션별 지침을 엄격히 준수하여, 스마트폰 독자가 이탈 없이 끝까지 읽을 수 있는 HTML 형식의 초고밀도 사주 분석글을 작성해 주세요. 결과물 내에서 '리포트'라는 단어는 절대 사용하지 마세요.

[글로벌 공통 규칙]]
1. 제목 생성: 응답의 가장 첫 줄에 반드시 아래 형식의 제목만 작성하세요. (태그/HTML 금지)
   - 형식: {display_name} 사주 운세 – [독자의 호기심을 자극하는 잡지 헤드라인식 후킹 멘트]
   - 글자 수 제한: 전체 제목 길이는 공백을 포함하여 반드시 28자~32자 이내로 엄격히 제한하세요. (검색엔진 최적화 및 말줄임표 잘림 방지용)
   - 작성 스타일 규칙 (연예 뉴스 기사 스타일): 주저리주저리 설명하는 긴 문장이나 형용사 나열(예: '~의 시간, 그리고 ~', '~의 비결')은 전면 금지합니다. 독자가 평소 그 연예인에게 궁금해할 만한 핵심 소구점(결혼, 반전 성격, 대운 전환 등)을 콕 짚어, 명사형이나 의문문 구조를 활용해 타격감 있고 깔끔하게 끝맺음하세요.
   - 예시 (이 구조와 길이를 그대로 모방하세요):
     "아이유 사주 운세 – 모두가 바라는 결혼운은 언제쯤?"
     "차은우 사주 운세 – 외모보다 놀라운 반전의 내면"
     "이선민 사주 운세 - 드디어 터진다! 대운의 반전"
     "서장훈 사주 운세 - 인생 전환점, 제2의 인생 황금기는 언제?"
     
2. 도입부 완벽 레이아웃 구성 (필수 규칙):
   - 포스팅 제목 다음 줄에 최상단 본문 컨테이너(div)를 열고, 가장 먼저 아래 3단 구조를 순서대로 작성하며 시작하세요.
   
   [1단계 - 핵심 디스크립션 문단]:
     - 스타일 코드: <p style="font-size: 15px !important; color: #444; line-height: 1.8; margin-bottom: 25px; word-break: keep-all; overflow-wrap: break-word;">
     - 지침: 전체 사주 리포트에서 가장 흥미로운 하이라이트 결론을 1~2문장으로 압축하여 작성하세요. 검색 노출을 위해 문장 내에 반드시 "{display_name} 사주"라는 핵심 키워드가 자연스럽게 포함되도록 명시해야 합니다. (늘어지는 인사말 전면 금지)
     - 본명 분석 규칙: 입력된 이름({celebrity_name}) 또는 안내된 정체성을 바탕으로 활동명인지 판단하세요. 활동명이라면 해당 인물의 실제 본명을 웹 검색, 나무위키 등으로 정확히 확인한 뒤, 이 디스크립션 문단 시작점에 "본명 [확인된 실제 본명] 님의 사주 분석을 시작합니다."라는 문구를 반드시 포함하세요. 만약 입력된 이름 자체가 본명이거나 별도의 활동명이 없다면 이 문구 전체를 생략하고 바로 본론으로 진입하세요.
     - 직업 작성 금지 : 해당 인물의 직업적인 특성을 작성하지 않습니다. 다만, 4단계 궁합섹션에서 직업적인 특성을 고려해서 주변 인물을 선정하세요.
     
   [2단계 - H2 대제목]:
     - 스타일 코드: <h2 style="font-size: clamp(1.3em, 4.5vw, 1.6em); color: #111; margin-top: 30px; margin-bottom: 20px; font-weight: 800; word-break: keep-all; line-height: 1.3; border-left: 5px solid #3366ff; padding-left: 12px;">
     - 지침: 인위적이고 자극적이기만 한 표현은 지양하세요. 독자의 호기심을 자극하면서도 전문성이 느껴지는 깔끔 한 줄 제목을 작성하세요. 
     
   [3단계 - H3 진입 전 흥미유발 소개 문단]:
     - 스타일 코드: <p style="font-size: 15px !important; color: #333; line-height: 1.8; margin-bottom: 45px; background-color: #f8f9fa; padding: 15px 20px; border-radius: 12px; word-break: keep-all; overflow-wrap: break-word;">
     - 지침: 앞으로 이어질 7개의 소제목(H3) 본론 내용에 대한 대략적인 소개이자, "이 타이밍을 놓치면 인생의 큰 기회를 놓칠 수 있다"는 식의 메시지를 담아 독자가 글을 절대 나가지 않고 끝까지 읽게 만드는 흥미유발용 문장을 2~3문단으로 임팩트 있게 채우세요.
     
3. 본명 검색 및 크로스 체크 지침: AI는 주어진 대상({celebrity_name})에 대해 팩트 체크를 수행하여 본명 여부를 반드시 확인해야 합니다. 가명이나 활동명일 경우 본론의 사주 풀이 과정에서도 실제 본명을 언급하며 분석의 신뢰도를 높이고, 외부 검색 연동을 위한 키워드가 필요한 영역에만 {display_name}을 적절히 교차 사용하여 검색 최적화를 달성하세요. 잘 모르거나 확실하지 않은 이름은 절대 임의로 지어내지 마세요.
4. 가독성 및 강조 태그 규칙: 2~3문장마다 줄바꿈을 적용하고, 인공지능 티가 나는 별표 양식의 마크다운 강조 표시(예: **, *)는 본문 텍스트에 절대 사용하지 마세요. 본문 내에서 특정 단어나 문구를 강조하고 싶을 때는 마크다운 기호 대신 반드시 HTML 태그인 <strong>강조할 내용</strong> 또는 <span style="font-weight: bold; color: #3366ff;">강조할 내용</span> 구조를 사용하여 출력해야 합니다.
5. 출력 형식: 코드 블록(```html) 없이 순수 HTML 태그만 출력하세요. [대괄호] 사용은 전면 금지합니다.
6. 분량: 공백 제외 최소 2,000자 이상의 압도적인 정보량을 제공하세요.
7. 가독성 및 금지 단어: 2~3문장마다 줄바꿈을 적용하고, 인공지능 티가 나는 볼드 표시(**강조**)는 본문 텍스트에 절대 사용하지 마세요. 또한 아래의 AI 전용 단어는 절대 사용하지 말고 지정된 대체어로 작성하세요.
   - '통찰' -> '인사이트', '눈여겨볼 점', '핵심 포인트' 등으로 대체
   - '가이드' -> '방법', '비결', '노하우', '치트키' 등으로 대체
   - '리포트' -> '글', '분석글', '포스팅' 등으로 대체
   - '도움이 되기를 바랍니다', '살혀보겠습니다', '귀하' 등 기계적인 문장 전면 금지

[전체 레이아웃 디자인 시스템]
- 최상단 컨테이너: <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.8; color: #333; width: 100%; max-width: 1200px; margin: 0 auto; padding: 20px 0px; box-sizing: border-box; background: #ffffff;">
- 문단 간격 및 크기 규칙: 리스트 하단의 본문 작성을 포함하여, 이 포스팅에 들어가는 모든 일반 문단(<p>) 태그에는 반드시 아래 스타일 코드를 공통 고정 적용하여 출력하세요. 테마나 전역 스타일의 간섭을 막고 글씨 크기를 일관되게 유지하기 위함입니다.
  코드: <p style="font-size: 17px !important; color: #1e293b !important; margin-bottom: 32px; line-height: 1.85; word-break: keep-all; overflow-wrap: break-word;">
  
---

[리포트 본문 구조 및 섹션별 상세 지침]
AI는 아래에 지정된 7개의 소제목을 토시 하나 틀리지 않고 그대로 <h3> 태그로 사용하고, 각 섹션에 매칭된 본문 규칙과 디자인 요소를 순서대로 작성해야 합니다.

### 1단계: 서론 섹션
- 소제목: {display_name} 사주 핵심
- 포함할 디자인 요소 (한눈에 보는 사주 하이라이트 3단 카드 레이아웃):
  지루한 글자 나열을 배제하고, 독자가 첫 화면에서 핵심 정보를 직관적으로 흡수할 수 있도록 상단에 3개의 요약 카드 세트를 구현하세요. PC에서는 가로 3열, 모바일에서는 세로로 부드럽게 쌓이는 반응형 레이아웃입니다.
  
  [카드 세트 HTML/CSS 구조 가이드]
<div style="display: flex; flex-wrap: wrap; gap: 15px; width: 100%; margin: 20px 0 35px 0; box-sizing: border-box;">
  <div style="flex: 1 1 calc(33.333% - 10px); min-width: 180px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
    <div style="font-size: 24px; margin-bottom: 8px;">🎯</div>
    <h4 style="font-size: 15px; color: #111; margin: 0 0 10px 0; font-weight: bold;">타고난 일주 기질</h4>
    <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[여기에 해당 스타의 일주(예: 신미일주) 명칭과 가장 강한 기질적 특징을 단 명사형 키워드로 요약 기술]</p>
  </div>
  
  <div style="flex: 1 1 calc(33.333% - 10px); min-width: 180px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
    <div style="font-size: 24px; margin-bottom: 8px;">🧭</div>
    <h4 style="font-size: 15px; color: #3366ff; margin: 0 0 10px 0; font-weight: bold;">인생 황금기 시점</h4>
    <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[여기에 용신 대운이 강력하게 진입하는 핵심 나이대와 전성기 시작 시점을 명확히 요약 기술]</p>
  </div>
  
  <div style="flex: 1 1 calc(33.333% - 10px); min-width: 180px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
    <div style="font-size: 24px; margin-bottom: 8px;">🔥</div>
    <h4 style="font-size: 15px; color: #111; margin: 0 0 10px 0; font-weight: bold;">올해 관전 포인트</h4>
    <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[2026년 병오년 대운의 흐름 속에서 가장 눈여겨볼 핵심 변화 요소를 기혼/미혼 팩트에 맞춰 압축 기술]</p>
  </div>
</div>

- 본문 작성 지침: 카드 세트 하단에 1개의 깔끔한 문단(2~3문장 이내)으로 사주 원국 분석 결과를 이어 나가세요. 상단 도입부 흐름을 자연스럽게 받아, 가장 강력한 대운 변화나 인생의 무기가 되는 지점을 날카롭게 서술하세요.
- 하단 여백: 본문 문단 마무리에 <p style="margin-bottom: 40px;">를 적용하여 다음 섹션과의 시각적 간격을 확실히 확보하세요.

### 2단계: 오행 분석 섹션
- 소제목: 타고난 오행 분석
- 포함할 디자인 요소 (반응형 2단 레이아웃 - 가중치 기반 정밀 SVG 오각형 차트 + 우측/하단 카드 레이아웃): 
  [반응형 레이아웃 규칙]: 
  - PC(화면 폭 768px 이상): 그래프와 표가 좌우로 배치되어야 합니다.
  - 모바일(화면 폭 768px 미만): 그래프와 표가 위아래로 배치되어야 합니다.
  - 이를 위해 아래의 Flexbox 구조를 반드시 사용하세요.
  
  [Flex Container Styling]
  <div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: center; width: 100%; margin: 20px 0; box-sizing: border-box;">
    <div style="flex: 1 1 300px; max-width: 400px; width: 100%; box-sizing: border-box;">
      [SVG 그래프 삽입]
    </div>
    <div style="flex: 1 1 300px; width: 100%; box-sizing: border-box;">
      [오행 분석 카드 섹션 삽입]
    </div>
  </div>

  [Strict SVG Radar Chart Layout Rules - NO DOUBLE LAYERS]
  Canvas Setting: <svg viewBox="0 0 400 400" style="display: block; width: 100%; height: auto; background: #ffffff;">
    <polygon points="200,80 314,163 271,297 129,297 86,163" style="fill:none; stroke:#e0e0e0; stroke-width:1.5;" />
    <polygon points="200,120 276,175 247,265 153,265 124,175" style="fill:none; stroke:#e0e0e0; stroke-width:1;" />
    <polygon points="200,160 238,188 224,233 176,233 162,188" style="fill:none; stroke:#e0e0e0; stroke-width:1;" />
    <line x1="200" y1="200" x2="200" y2="80" style="stroke:#e0e0e0; stroke-width:1;" />
    <line x1="200" y1="200" x2="314" y2="163" style="stroke:#e0e0e0; stroke-width:1;" />
    <line x1="200" y1="200" x2="271" y2="297" style="stroke:#e0e0e0; stroke-width:1;" />
    <line x1="200" y1="200" x2="129" y2="297" style="stroke:#e0e0e0; stroke-width:1;" />
    <line x1="200" y1="200" x2="86" y2="163" style="stroke:#e0e0e0; stroke-width:1;" />
    <text x="200" y="65" text-anchor="middle" style="font-size:14px; fill:#333; font-weight:bold;">목</text>
    <text x="330" y="163" text-anchor="start" style="font-size:14px; fill:#333; font-weight:bold;">화</text>
    <text x="285" y="315" text-anchor="start" style="font-size:14px; fill:#333; font-weight:bold;">토</text>
    <text x="115" y="315" text-anchor="end" style="font-size:14px; fill:#333; font-weight:bold;">금</text>
    <text x="70" y="163" text-anchor="end" style="font-size:14px; fill:#333; font-weight:bold;">수</text>
    <polygon points="목좌표 화좌표 토좌표 금좌표 수좌표" style="fill:rgba(51, 102, 255, 0.25); stroke:#3366ff; stroke-width:3;" />
  </svg>
  [Dynamic Data Polygon Calculation - Score-to-Pixel Mapping]
  The input data contains precise weighted percentage values (0% to 60%+). Map these percentages directly onto the 5 axes starting from the center (200,200).
  - Mathematical Mapping: 0% score_100 = 60px distance from center (minimum baseline visibility for a beautiful pentagon shape). 100% score_100 = 120px distance (outer frame vertex). Linearly scale values in between. (Formula: distance = 60 + (score_100 * 0.6))
  - Data Polygon Styling: Render the final data shape using a SINGLE <polygon points="..." /> tag. Apply a semi-transparent trendy fill (fill: rgba(51, 102, 255, 0.25);) and a sharp outer boundary line (stroke: #3366ff; stroke-width: 3;).

  [우측/하단 오행 상세 정보 카드 세트 가이드 - 스마트폰 한 줄 최적화]
  기존의 딱빡한 테이블(표) 구조를 전면 탈피하여, 입력받은 가중치 기반 정밀 백분율 수치와 핵심 요약 멘트를 미니 카드 컴포넌트로 세련되게 담아내야 합니다. 모바일 화면에서 글자가 절대로 두 줄로 밀려 내려가지 않고 깔끔하게 떨어지도록 자수를 철저히 통제하세요.
  [카드 생성 필수 규칙]: 목(木), 화(火), 토(土), 금(金), 수(水) 오행 5개에 대한 카드를 단 하나도 빠짐없이 모두 출력해야 합니다.
  - 카드 컨테이너 설정: <div style="display: flex; flex-wrap: wrap; gap: 10px; width: 100%; box-sizing: border-box;">
  - 카드 개별 설정 (모바일 2열 정렬 최적화): <div style="flex: 1 1 calc(50% - 5px); min-width: 140px; background: #f8f9fa; border: 1px solid #eef0f4; border-radius: 12px; padding: 12px; box-sizing: border-box; text-align: center;"> 
    (주의: 이 div 태그를 반드시 오행별로 1개씩 총 5개 작성하고, 각각의 끝에 반드시 </div> 태그를 닫아주세요. 열린 태그와 닫힌 태그 수가 다르면 레이아웃이 붕괴됩니다.)
  - [색상 강조 규칙 (필수)]: 5개 오행 카드 중 에너지 점수가 가장 높은 카드와 가장 낮은 카드에 시각적 차이를 확실히 주어야 합니다.
    * 최고 점수 카드: 배경색을 연한 파란색(#e3f2fd)으로 설정하고, 내부의 점수 텍스트 색상을 진한 파란색(#1565c0)으로 강조하세요.
    * 최저 점수 카드: 배경색을 연한 빨간색(#ffebee)으로 설정하고, 내부의 점수 텍스트 색상을 진한 빨간색(#c62828)으로 강조하세요.
    * 배경색 적용이 누락되지 않도록 style="background-color: #e3f2fd !important;" 와 같이 인라인 스타일을 강력하게 적용하세요. 그 외 카드는 기본 회색(#f8f9fa)을 유지합니다.
  - [오행 점수 환산 공식 (Score Conversion)]: 제공된 scores_100 데이터를 그대로 사용하되, 시각적 풍성함을 위해 아래 기준을 적용하세요.
    * 공식: 제공된 scores_100 값을 그대로 출력하되, 0점인 경우에도 그래프 보정을 위해 15.0점 수준의 최소 시각적 반경을 확보하고 있음을 인지하세요. (사용자에게는 계산된 점수를 그대로 보여줍니다)
    * 예시: 12.5점 -> "목(木): 12.5점"
    * 표시 형식: "목(木): 67.5점" (기존의 % 대신 '점' 단위를 사용)
  - 텍스트 최적화: 상단 span 구조에는 오행 이름과 환산된 에너지 점수(예: 금(金): 88.5점)를 넣고, 하단 p 구조에는 핵심 요약 키워드만 아주 짧고 간결하게 작성하여 스마트폰 화면 폭 내에서 줄바꿈 없이 수평 한 줄 출력이 보장되도록 하세요. 이를 강제하기 위해 p 태그 스타일에 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 속성을 고정 주입하고, 들어갈 문구는 공백 포함 14자 이내의 짧은 명사형 구절(예: "지혜와 예리함, 분석력 매우 강함")로만 제한하여 완성형으로 출력하세요. font-size: clamp(11px, 3.2vw, 13px); 속성을 부여하세요.
  - 그래프 아래에 해당 내용을 상세히 설명하는 본문을 지침대로 작성하세요.
  - 본문 작성 지침: 제공된 사주 데이터를 바탕으로 목, 화, 토, 금, 수의 기질적 특성을 날카롭게 분석하여 서술하세요. 특히 해당 연예인이 가진 치명적인 '신살(예: 도화살, 역마살 등)'을 현대적인 스타성 무기로 재해석하여 흥미를 유발하세요.
  
### 3단계: 심리 분석 섹션
- 소제목: MBTI 성격 분석
- 포함할 디자인 요소 (일주 vs MBTI 매치업 타이틀 + 트렌디한 2단 대칭 카드 레이아웃):
  소제목 바로 아래에 사주 일주와 MBTI를 정면으로 비교하는 강조 문구를 스마트폰 가로 너비에 꽉 차게 배치하세요. 매치업 타이틀의 [일주명]일주 자리에는 '계유일주', '갑진일주'처럼 일주 명칭 뒤에 반드시 '일주'라는 단어가 포함된 네 글자는 한글(Korean)로만 완성해야 하며, MBTI는 영어 대문자로 작성해야 합니다.
  <div style="font-size: clamp(1.5em, 6vw, 2.2em); font-weight: 900; text-align: center; margin: 30px 0; color: #111; word-break: keep-all; line-height: 1.2; background: linear-gradient(to right, #3366ff, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">[일주명]일주 vs [MBTI]</div>
  
  그 아래에 두 성향의 핵심을 담은 카드 섹션을 배치합니다.
  <div style="display: flex; flex-wrap: wrap; gap: 15px; width: 100%; margin: 20px 0; box-sizing: border-box;">
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 22px 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <h4 style="font-size: 16px; color: #111; margin: 0 0 10px 0; font-weight: bold; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 22px; line-height: 1;">☯️</span> 사주 일주가 보는 성격 본질
      </h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.6; word-break: keep-all;">[일주론 기반 핵심 성향 2~3줄 요약]</p>
    </div>
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 22px 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <h4 style="font-size: 16px; color: #3366ff; margin: 0 0 10px 0; font-weight: bold; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 22px; line-height: 1;">✨</span> 현대적 MBTI 매칭 ([해당 MBTI 유형])
      </h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.6; word-break: keep-all;">[사주 기운과 완벽하게 맞아떨어지는 MBTI적 성향 패턴 2~3줄 요약]</p>
    </div>
  </div>
- 본문 작성 지침: 카드 섹션 아래에 사주와 MBTI를 종합한 최종 결론을 작성하세요. "사주는 A라고 하고 MBTI는 B라고 하는데, 이 둘을 조합해보면 {display_name} 님의 실제 성격은 결국 C일 것이다"라는 식으로 두 데이터를 융합하여 매우 면밀하고 날카로운 심리 분석을 제공해야 합니다. 훈계조가 아닌 전문적인 분석 어조를 유지하세요.

### 4단계: 궁합 섹션
- 소제목: 사주상 인맥 시너지
- 포함할 디자인 요소 (잡지 스타일 세포형 관계도 다이어그램 + 귀인 매칭형 2단 대칭 카드 레이아웃):
  섹션 시작 부분에 귀인 관계를 한눈에 보여주는 SVG 원형 네트워크 다이어그램을 구현하세요. 

[Strict SVG Drawing Order Layer Rules]
Because SVG layers stack in the order they are written, you MUST strictly follow the drawing sequence below to ensure connector lines do not overlap or obscure text or circles. The overall SVG specification must use viewBox="0 0 500 400" and maintain the style layout: width: 100%; height: auto; max-width: 500px; margin: 0 auto; display: block;.

Step 1: Draw all connector lines (<line>) first at the absolute top of the code. This ensures the lines sit entirely in the background. The starting point (x1, y1) for all lines must be uniformly set to the center of the middle circle: (250, 210).

Step 2: Draw the circles (<circle>) to be placed on top of the connector lines.
- Center Circle: Set the center coordinates to (250, 210), radius (r) to 50, and insert the {display_name}. You MUST apply fill-opacity="1" or a solid HEX color code (e.g., fill="#2b66ff") so that the background connector lines are completely hidden and never show through the circle.
- Surrounding Circles (5 in total): Position these without error on a radial orbit with a radius of 110-120px around the center circle, strictly adhering to the following standard coordinate settings:
  * 12 o'clock position (Key Figure 1): Center (250, 90), Radius (r) 40
  * 2:30 position (Key Figure 2): Center (355, 150), Radius (r) 40
  * 5 o'clock position (Other Figure 1): Center (320, 300), Radius (r) 30
  * 7 o'clock position (Other Figure 2): Center (180, 300), Radius (r) 30
  * 9:30 position (Other Figure 3): Center (145, 150), Radius (r) 30

Step 3: Render the name text (<text>) last on the topmost surface layer, applying absolute center alignment attributes (text-anchor="middle" dominant-baseline="central").
Ensure the (x, y) coordinates of the text perfectly match the center coordinates (cx, cy) of each respective circle so the text remains perfectly centered without drifting.
Apply differential font sizes: 15px for the center circle, 13px for the key figures, and 11px for the other figures.

- 다이어그램 주변 인물 작명 규칙 (필수): 다이어그램에 들어가는 총 5명의 주변 인물 이름에는 '시너지 A', '동료 B' 같은 가상의 플레이스홀더 성격의 단어를 절대로 사용하지 마세요. 12시와 2시 30분 방향에는 하단 카드에서 다룰 핵심 귀인 2명의 실명을 넣고, 나머지 3개 방향(5시, 7시, 9시 30분)에는 해당 연예인과 실제로 작품을 함께했거나 예능 등에서 엮인 적이 있는 실제 동료 연예인 실명(예시: 변우석의 경우 주우재, 백서후 등)을 실감 나게 배치하여 5개 원이 모두 의미 있는 실명 데이터로 꽉 차게 구현해야 합니다.

다이어그램 배치 직후, 하단에 함께하면 시너지가 폭발하는 동료 연예인 2명에 대한 매칭 정보를 깔끔한 카드 컴포넌트로 나란히 조립하세요.
  <div style="display: flex; flex-wrap: wrap; gap: 15px; width: 100%; margin: 20px 0; box-sizing: border-box;">
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <span style="font-size: 12px; color: #3366ff; font-weight: bold; text-transform: uppercase;">Best Partner 01</span>
      <h4 style="font-size: 16px; color: #111; margin: 4px 0 8px 0; font-weight: bold;">실명 연예인 이름 1</h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.6; word-break: keep-all;">이름을 다시 언급하지 말고, 두 사람이 만났을 때 사주 원국상 합이 이루어지는 원리와 구체적인 시너지 파급 효과를 바로 서술하세요.</p>
    </div>
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <span style="font-size: 12px; color: #3366ff; font-weight: bold; text-transform: uppercase;">Best Partner 02</span>
      <h4 style="font-size: 16px; color: #111; margin: 4px 0 8px 0; font-weight: bold;">실명 연예인 이름 2</h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.6; word-break: keep-all;">이름을 다시 언급하지 말고, 두 사람이 만났을 때 사주 원국상 합이 이루어지는 원리와 구체적인 시너지 파급 효과를 바로 서술하세요.</p>
    </div>
  </div>
- 본문 작성 지침: 단순히 남녀 간의 연애적 궁합에 국한하지 않고, 함께 활동하거나 엮였을 때 서로의 몸값과 시너지를 극대화해 주는 귀인 관계의 동료 연예인 2명을 실명으로 매칭하세요. 그들이 당사자에게 구체적으로 어떤 긍정적인 파급 효과를 주는지 동료 연예인별로 각각 카드 내부 <p> 태그 안에 150자 이내로 명확하게 서술하세요. 
- 카드 본문 서술 규칙: 카드 상단 <h4> 태그에 연예인 이름이 이미 노출되므로, <p> 태그로 시작하는 카드 본문 첫머리에는 '송강호 님:', '이정재 님:'과 같은 이름 언급이나 별도의 강조 스팬 코드(<span style...>)를 절대 넣지 마세요. 이름 언급 없이 사주 원국상 합이 이루어지는 원리와 파급 효과로 문장을 즉시 시작해야 합니다.

### 5단계: 대운 및 타임라인 통합 섹션
- 소제목: 대운과 현재 위치
- 본문 작성 지침: 주인공이 걸어온 과거의 발자취와 현재 대운상의 위치를 스토리텔링 형식으로 먼저 풀어내세요. 이어서 자연스럽게 연결하여 2026년 올해의 분기별 운세 변화를 예측하고, 특정 달에 발생할 구체적인 사건(열애설, 작품 대박, 휴식기 등)을 과감하게 제시하세요. 1년 중 가장 핵심적인 달은 타임라인에서 눈에 띄게 시각적 처리를 해야 합니다.
- 포함할 디자인 요소 (로드맵 스타일 SVG 버티컬 타임라인 인포그래픽):
  기존의 딱딱한 테이블 표 구조는 완전히 배제하고, 섹션 시작 부분이나 중간에 주인공의 인생 흐름을 한눈에 보여주는 로드맵 스타일의 SVG 버티컬 타임라인 그래픽만 단독으로 구현하세요.

[Strict SVG Vertical Timeline Rules]
  1. Canvas Setting: <svg viewBox="0 0 400 820" style="display: block; width: 100%; max-width: 380px; margin: 0 auto; background: #ffffff;">
  2. Main Track Axis Line: Draw a thick roadmap track line using <line x1="60" y1="30" x2="60" y2="790" stroke="#e0e0e0" stroke-width="6" stroke-linecap="round" />.
  3. Dynamic Track Color Coding: Change the track line stroke color to vibrant blue (#3366ff) from the current active daeun node segment progressing through all 2026 quarters to visually represent active progress.
  4. Timeline Milestone Markers: Place concentric double-circle markers (<circle cx="60" />) perfectly centered on the track line. For the single most critical turning-point quarter of 2026, set the marker fill/stroke color to high-contrast red (#d32f2f) to create an immediate focal peak point.
  5. Text Box Containment & Coordinate Standard: 타임라인은 대운 노드들과 2026년 분기 노드들을 포함하여 총 6~7단계로 구성하세요. 각 단계는 Y축 기준 100px 간격으로 점진적으로 내려가야 하며(예: 1단계 Y=40, 2단계 Y=140, 3단계 Y=240...), 박스 테두리와 원형 마커의 Y축 중심점이 완벽히 수평 일치하도록 그리세요.
     - 텍스트 겹침 및 박스 터짐 방지를 위해 배경 카드 규격을 반드시 아래 표준 템플릿으로 고정하세요:
     <rect x="95" y="[해당단계_Y좌표]" width="265" height="62" rx="12" fill="#f8f9fa" stroke="#3366ff" stroke-width="1.5" />
  6. Text Alignment & Multi-line Wrapping Control: 카드 내부 텍스트는 무조건 2줄 구조로 분리하여 작성하세요. 1번째 줄은 대운명이나 분기명, 2번째 줄은 핵심 특징 요약입니다. 글자 겹침을 원천 차단하기 위해 반드시 아래 <text> 및 <tspan> 구조 좌표 공식을 그대로 사용하세요:
     <text x="227" y="[해당단계_Y좌표 + 26]" text-anchor="middle" font-size="13px" font-weight="bold" color="#1e293b">
       <tspan x="227">1번째 줄 내용</tspan>
       <tspan x="227" dy="1.35em" font-size="12px" font-weight="normal" color="#475569">2번째 줄 요약 내용</tspan>
     </text>

## 6단계: 행운의 컬러 및 차량 매치 섹션
- 소제목: 행운의 컬러 및 차량 매치
- 본문 작성 지침: 사주 데이터를 바탕으로 {display_name} 님에게 가장 잘 어울리는 행운의 색상(컬러)과 추천 차량을 매칭하세요. 특정 브랜드에 편중되지 않도록 경차, 소형차, 중형차, 대형차, RV, SUV 등 국산(현대,기아)/수입(BMW,아우디,벤츠,볼보) 위주로 다양한 차종을 사주 데이터와 연동하여 추천해야 합니다.
- 오행별 다양한 색상(컬러) 추천을 위해 아래와 같은 예시로 세련되고 트렌디한 유사색 딥톤 스펙트럼으로 제안하기 바랍니다.
       * 목(Wood) 보완: 포레스트 그린, 보태니컬 올리브, 세이지 민트, 청록, 올리브 등 싱그러운 자연의 아우라 톤.
       * 화(Fire) 보완: 버건디 크림슨, 로즈 골드, 테라코타 오렌지, 살몬 코랄 등 따스하고 정열적인 아우라 톤.
       * 토(Earth) 보완: 샌드 베이지, 카멜 브라운, 머스타드 골드, 웜 오트밀 등 대지의 포근하고 안정적인 아우라 톤.
       * 금(Metal) 보완: 메탈릭 실버, 미스티 플래티넘, 클래식 차콜, 스페이스 그레이 등 이지적이고 지적인 하이테크 톤.
       * 수(Water) 보완: 미드나잇 네이비, 인디고 블루, 딥 오션 아쿠아, 차콜 블랙 등 깊고 이성적인 심해의 아우라 톤.
- 포함할 디자인 요소 (ブランド & 컬러 테마 가이드 카드 레이아웃):
  정보를 명확히 분리하기 위해 '퍼스널 컬러 카드'와 '추천 차량 카드' 2개를 나란히 1단계 스타일의 디자인 컴포넌트로 구현하세요. PC에서는 가로 2열, 모바일에서는 세로로 자연스럽게 쌓이는 반응형 구조입니다.

  [Strict Card Set HTML/CSS Layout Rules]
  <div style="display: flex; flex-wrap: wrap; gap: 15px; width: 100%; margin: 20px 0 25px 0; box-sizing: border-box;">
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: LUCKY_COLOR_HEX; border-radius: 16px; padding: 22px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.04); text-align: center;">
      <div style="font-size: 24px; margin-bottom: 6px;">🎨</div>
      <h4 style="font-size: 14px; color: CONTRASTING_TEXT_COLOR; opacity: 0.8; margin: 0 0 5px 0; font-weight: normal;">행운의 컬러 매치</h4>
      <div style="font-size: 28px; color: CONTRASTING_TEXT_COLOR; margin: 0 0 12px 0; font-weight: 900; line-height: 1.2;">[추천 컬러명]</div>
      <p style="font-size: 13px; color: CONTRASTING_TEXT_COLOR; margin: 0; line-height: 1.6; font-family:'Malgun Gothic';">해당 색상이 연예인에게 주는 사주학적 보완 효과 요약</p>
    </div>
    <div style="flex: 1 1 calc(50% - 8px); min-width: 280px; background: BRAND_IDENTITY_COLOR; border-radius: 16px; padding: 22px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.04); text-align: center; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-size: 24px; margin-bottom: 6px;">🚗</div>
      <h4 style="font-size: 14px; color: rgba(255,255,255,0.8); margin: 0 0 5px 0; font-weight: normal;">사주 맞춤 추천 차량</h4>
      <div style="font-size: 28px; color: #ffffff; margin: 0 0 12px 0; font-weight: 900; line-height: 1.2;">[추천 모델명]</div>
      <p style="font-size: 13px; color: #ffffff; margin: 0; line-height: 1.5; font-family:'Malgun Gothic'; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">[추천 이유 1~2줄 요약]</p>
    </div>
  </div>
  
### 7단계: 최종 결론 섹션
- 소제목: 사주로 본 미래 예측
- 포함할 디자인 요소 (인생 운세 곡선 그래프 + 3단 미래 요약 카드 섹션):
  ★CRITICAL POSITIONING RULE: 소제목 바로 아래에 SVG 그래프를 배치하고, 그 직후에 3개의 요약 카드를 가로(PC)/세로(모바일) 반응형으로 배치하세요.
  
  [STRICT SVG LIFE FORTUNE CHART DESIGN SYSTEM - ENGLISH INSTRUCTIONS]
  1. Canvas: <svg viewBox="0 0 500 300" style="display: block; width: 100%; height: auto; margin: 30px auto; background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
  2. Grid: Draw 5 horizontal guide lines with stroke="#e9ecef" stroke-width="1".
  3. Timeline Labels: Render "20대", "30대", "40대", "50대", "60대", "70대", "80대", "90대" at the bottom with font-size: 12px, fill: #6c757d, font-weight: bold.
  4. The Fortune Curve:
     - Use a smooth, thick path with a vibrant green gradient effect.
     - <path d="..." fill="none" stroke="#2ecc71" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 6px rgba(46, 204, 113, 0.3));" />
     - Ensure the curve shows dramatic, dynamic fluctuations based on the fortune data.
  5. Fortune Peak Marker:
     - At the highest vertex, place a solid red point circle: <circle r="7" fill="#e74c3c" stroke="#ffffff" stroke-width="2" />
     - Vertical Guide Line: From the red circle, draw a thin dashed line down to the X-axis to clearly indicate the timing: <line x1="..." y1="..." x2="..." y2="270" stroke="#e74c3c" stroke-width="1" stroke-dasharray="4" opacity="0.6" />
     - Separately, place a short label text next to the red circle: <text x="..." y="..." font-size="14px" font-weight="900" fill="#2c3e50">대운 Peak!</text>
     - NEVER put text inside the red circle. Keep the marker and label distinct for maximum legibility.

  [미래 예측 3단 카드 섹션 (그래프 직후 배치)]
  <div style="display: flex; flex-wrap: wrap; gap: 15px; width: 100%; margin: 25px 0; box-sizing: border-box;">
    <div style="flex: 1 1 calc(33.333% - 10px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <div style="font-size: 24px; margin-bottom: 8px;">❤️</div>
      <h4 style="font-size: 15px; color: #ff4d4d; margin: 0 0 10px 0; font-weight: bold;">연애 및 결혼운</h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[시기별 운 흐름 요약. 기혼자의 경우 가정의 행복, 자녀에 대한 내용을 중심으로 서술]</p>
    </div>
    <div style="flex: 1 1 calc(33.333% - 10px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <div style="font-size: 24px; margin-bottom: 8px;">🌟</div>
      <h4 style="font-size: 15px; color: #3366ff; margin: 0 0 10px 0; font-weight: bold;">대운의 황금기</h4>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[인생의 전환점 또는 전성기에 대한 핵심 대운 시기와 그 특징을 요약]</p>
    </div>
    <div style="flex: 1 1 calc(33.333% - 10px); min-width: 280px; background: #fdfdfd; border: 1px solid #eef0f4; border-radius: 16px; padding: 20px; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
      <div style="font-size: 24px; margin-bottom: 8px;">🔑</div>
      <h4 style="font-size: 15px; color: #2e7d32; margin: 0 0 10px 0; font-weight: bold;">올해의 키워드</h4>
      <div style="margin: 10px 0;">
        <span style="font-size: 18px; font-weight: 900; color: #111; background: linear-gradient(to top, #fff3b0 40%, transparent 40%); padding: 0 2px;">[핵심 키워드 예: "전성기", "재물대박", "건강유의"]</span>
      </div>
      <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">[위 키워드를 선정한 사주학적 이유를 짧고 명확하게 설명]</p>
    </div>
  </div>
- 본문 작성 지침: 그래프와 카드의 내용을 종합하여 최종 결론을 내리세요. 대상의 현재 상황(결혼 여부 등)을 반영하여 현실적이고 구체적인 미래 예측을 제공하되, 명확한 '연도'를 언급하여 신뢰도를 높이세요. 훈계조는 배제하고 데이터에 기반한 인사이트를 전달하며 마무리하세요.

---

[기타 조건]
- 분량: 공백 제외 최소 2,000자 이상의 압도적인 정보량을 제공하세요.


[사주 분석 데이터]
{saju_text}

지금 바로 위 설계 구조와 섹션별 결합 지침을 완벽히 매칭하여 스크롤을 멈출 수 없는 초고밀도 HTML 리포트를 생성해 주세요."""

        return prompt

    @staticmethod
    def generate_seo_tags(celebrity_name: str, saju_data: dict) -> list[str]:
        """
        포스트에 사용할 SEO 태그 목록을 생성합니다.
        """
        base_tags = [
            f"{celebrity_name} 사주",
            f"{celebrity_name} 운세",
            "사주 명리학",
            "연예인 사주",
            "만세력",
        ]

        # 일주 태그 추가
        ilju = saju_data.get("일주_요약", "")
        if ilju:
            base_tags.append(f"{ilju}")

        # 오행 강한 것 태그 추가
        ohang_count = saju_data.get("오행_분석", {}).get("count", {})
        if ohang_count:
            max_ohang = max(ohang_count, key=ohang_count.get)
            base_tags.append(f"{max_ohang}기운 사주")

        # 강약 태그
        strength = saju_data.get("일주_강약", "")
        if strength:
            base_tags.append(strength.split("(")[0])

        return base_tags[:10]  # 최대 10개
