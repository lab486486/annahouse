# 사주언니 안나의 집

유명인 사주 검색 + 만세력/궁합 + 로또 번호. Cloudflare Pages로 올립니다.

## 메뉴

- 메인 `/` — 검색, 인물 마키
- 소개 `/about/`
- 사주 `/saju/` — 유명인 글, 만세력, 애정궁합, 스타 궁합, 혈액형 궁합
- 로또 `/lotto/` — 지난 회차와 통계 추천 번호
- 관리자 `/admin/` — 사주 만들기. 공개 메뉴에는 없습니다.

## 로컬

```bash
cd /Users/myhome/Projects/anna
npm install
npm run dev
```

http://localhost:4321/

사주 글 대기 파일은 `/admin/`에서 넣습니다. `DEEPSEEK_API_KEY`는 GitHub Secrets에만 둡니다.

## GitHub / Cloudflare

저장소 `lab486486/annahouse`, Pages 프로젝트 `annahouse`.

Secrets: `DEEPSEEK_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
