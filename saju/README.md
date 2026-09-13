# 워드프레스 연예인 사주 자동 포스팅 시스템

워드프레스 REST API와 DeepSeek V4 API를 활용하여, '지시' 카테고리에 등록된 연예인 생년월일 정보를 자동으로 읽어 사주 명리학 분석 글을 생성하고 '연예인' 카테고리에 발행하는 Python 자동화 스크립트입니다.

---

## 전체 처리 흐름

```
[워드프레스 '지시' 카테고리]
        ↓ (1) REST API로 미처리 글 조회
[생년월일 파싱]
        ↓ (2) 만세력 계산
[사주 원국 · 오행 · 십성 · 대운 도출]
        ↓ (3) DeepSeek API 호출 (피크타임이면 스킵)
[SEO 최적화 HTML 콘텐츠 생성]
        ↓ (4) REST API로 발행
[워드프레스 '연예인' 카테고리]
        ↓ (5) 원본 글 처리
[원본 글에 '처리완료' 태그 추가 / 삭제]
```

---

## 파일 구조

```
saju/
├── main.py                 # 메인 실행 스크립트
├── config.py               # .env 기반 설정 로더
├── .env                    # 실제 키/URL (서버에 필수 업로드)
├── .env.example            # 환경 변수 예시
├── saju_calculator.py      # 만세력 계산
├── wordpress_client.py     # 워드프레스 REST API
├── deepseek_generator.py   # DeepSeek V4 콘텐츠 생성
├── saju_prompt.py          # DeepSeek에 넘기는 HTML 프롬프트
├── peak_scheduler.py       # DeepSeek 피크타임 회피
├── requirements.txt
├── passenger_wsgi.py
├── public/                 # (선택) 호스팅용
├── tmp/                    # (선택) Passenger restart
└── README.md
```

---

## 설치 방법

### 1. 라이브러리 설치

```bash
pip install -r requirements.txt
```

케미클라우드(Python 환경)에서는:

```bash
pip install -r requirements.txt --user
```

### 2. 설정 파일 구성

`.env`에 아래 값을 넣습니다. (`config.py`는 환경변수만 읽습니다.)

| 변수명 | 설명 | 예시 |
|---|---|---|
| `WP_SITE_URL` | 워드프레스 사이트 URL | `https://example.com` |
| `WP_USERNAME` | 워드프레스 관리자 아이디 | `admin` |
| `WP_APP_PASSWORD` | 워드프레스 앱 비밀번호 | `xxxx xxxx xxxx xxxx` |
| `DEEPSEEK_API_KEY` | DeepSeek API 키 | `sk-...` |
| `DEEPSEEK_MODEL` | 기본 `deepseek-v4-pro` | `deepseek-v4-pro` |

또는 `.env.example`을 `.env`로 복사하여 환경 변수로 관리할 수 있습니다.

```bash
cp .env.example .env
# .env 파일을 편집기로 열어 값 입력
```

### 3. 워드프레스 앱 비밀번호 생성

1. 워드프레스 관리자 → **사용자** → **프로필**
2. 하단 **애플리케이션 비밀번호** 섹션으로 이동
3. 새 애플리케이션 이름 입력 (예: `사주봇`) 후 **새 애플리케이션 비밀번호 추가** 클릭
4. 생성된 비밀번호를 `WP_APP_PASSWORD`에 입력 (공백 포함 그대로 사용 가능)

---

## '지시' 카테고리 글 작성 형식

자동 처리를 위해 '지시' 카테고리 글은 아래 형식을 따라야 합니다.

**제목 예시:**
```
아이유 사주 분석 요청
```

**본문 예시:**
```
이름: 아이유
생년월일: 1993년 5월 16일
성별: 여
출생시각: 08시
```

> 출생시각을 모를 경우 생략하면 기본값(12시)으로 처리됩니다.

---

## 실행 방법

### 기본 실행

```bash
python main.py
```

### 주요 옵션

```bash
# 테스트 실행 (실제 발행 없이 로그만 확인)
python main.py --dry-run

# 최대 3개 글만 처리
python main.py --max-posts 3

# 임시 저장으로 발행 (검토 후 수동 공개)
python main.py --status draft

# 원본 글을 휴지통으로 이동
python main.py --action trash

# 원본 글을 영구 삭제
python main.py --action delete

# 빠른 모델 사용 (비용 절감)
python main.py --model deepseek-v4-flash

# 디버그 로그 출력
python main.py --log-level DEBUG
```

---

## 케미클라우드 cron 설정 예시

매 1시간마다 자동 실행:

```
0 * * * * cd /path/to/saju_auto_post && python main.py >> cron.log 2>&1
```

매일 오전 9시 실행:

```
0 9 * * * cd /path/to/saju_auto_post && python main.py >> cron.log 2>&1
```

---

## 사주 계산 모듈 상세

`saju_calculator.py`는 외부 라이브러리 없이 순수 Python으로 구현된 만세력 계산 엔진입니다.

| 기능 | 설명 |
|---|---|
| 연주(年柱) | 60갑자 기준 연간·연지 계산 |
| 월주(月柱) | 절기 기준 월간·월지 계산 (오호둔년법) |
| 일주(日柱) | 기준일(1900.1.1 갑술일) 기반 일간·일지 계산 |
| 시주(時柱) | 출생 시각 기반 시간·시지 계산 (오자둔일법) |
| 오행 비율 | 8글자(천간 4 + 지지 4) 기반 오행 분포 |
| 십성(十星) | 일간 기준 비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인 |
| 대운(大運) | 순행/역행 결정 후 8개 대운 도출 |
| 신강/신약 | 인성·비겁 개수 기반 일주 강약 판단 |

> **주의:** 정밀한 만세력 계산을 위해서는 절기 시각(분·초 단위)까지 고려해야 합니다. 본 모듈은 날짜 기준 근사 계산을 사용하므로 절기 경계일(±1~2일)에서 월주가 다를 수 있습니다.

---

## 보안 주의사항

- `config.py` 또는 `.env` 파일을 **절대 GitHub 등 공개 저장소에 업로드하지 마세요.**
- `.gitignore`에 `config.py`와 `.env`를 반드시 추가하세요.
- 워드프레스 앱 비밀번호는 계정 비밀번호와 별개로 생성되며, 언제든지 삭제·재발급이 가능합니다.

---

## 라이선스

본 코드는 개인 및 상업적 용도로 자유롭게 사용 가능합니다.
