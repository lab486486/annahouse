# 사주언니 안나의 집

유명인 사주 검색 + 만세력/궁합 + 로또 번호. Cloudflare Pages로 올립니다.

## 메뉴

- 메인 `/` — 검색, 인물 마키
- 소개 `/about/`
- 사주 `/saju/` — 유명인 글, 만세력, 애정궁합, 스타 궁합, 혈액형 궁합
- 로또 `/lotto/` — 지난 회차와 통계 추천 번호
- 관리자 `/admin/` — Decap CMS. GitHub 로그인이 있는 사람만 사주를 넣습니다.

## 로컬

```bash
cd /Users/myhome/Projects/anna
npm install
npm run dev
```

http://localhost:4321/

사주 글은 라이브 `/admin/`에서 GitHub 로그인 후 왼쪽 **작성 대기**에 넣습니다. 저장소 쓰기 권한이 있는 계정만 들어갑니다.
`DEEPSEEK_API_KEY`는 GitHub Secrets에만 두고, 브라우저나 공개 페이지에는 넣지 않습니다.

## GitHub / Cloudflare

저장소 `lab486486/annahouse`, Pages 프로젝트 `annahouse`.

Secrets: `DEEPSEEK_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

휴대폰 Decap 로그인은 GitHub OAuth + Cloudflare Pages 환경 변수를 씁니다.

- GitHub OAuth callback: `https://annahouse.co.kr/api/oauth/callback`
- Pages Production secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
