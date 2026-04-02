# Solana Internet CLI — TODO

---

## 1. 테스트

아래 항목들을 직접 실행하면서 검증한다.

### 기능 테스트
- [ ] 메인 메뉴 진입 → 1/2/3/0 각각 정상 동작하는지
- [ ] SolChat: 친구 목록 조회, 연결 요청, DM 송수신, 방 생성/입장/채팅
- [ ] IQChan: 보드 목록 로딩, 스레드 목록 로딩, 스레드 열기, 답글 달기
- [ ] IQChan: 글 작성 (createThread 2-tx 흐름), 글 수정, 글 삭제
- [ ] My Menu: RPC 설정 변경 후 다른 메뉴에서 반영되는지
- [ ] My Menu: 프로필 조회, 인벤토리 PDA 조회, DM 인박스
- [ ] keypair 없을 때 에러 메시지가 명확한지

### UI/UX 테스트
- [ ] SolChat 메뉴 — 숫자 선택 흐름이 직관적인지
- [ ] IQChan 보드 선택 — 화살표 키 네비게이션 잘 되는지
- [ ] IQChan 스레드 목록 — L자 트리 (├─ └─) 렌더링이 깨지지 않는지
- [ ] IQChan 스레드 뷰 — OP/reply 구분, 페이지네이션 동작
- [ ] 긴 텍스트 (100자 이상 comment) 표시가 터미널에서 깨지지 않는지
- [ ] non-TTY 환경 (pipe 등) 에서 fallback 동작하는지

### RPC 온보딩
- [ ] 첫 실행 시 기본 RPC(devnet)로 동작하는지
- [ ] My Menu > RPC Settings 에서 URL 변경 → 즉시 반영되는지
- [ ] 잘못된 URL 입력 시 에러 핸들링
- [ ] .env의 `SOLANA_RPC_ENDPOINT` 설정이 우선 적용되는지
- [ ] RPC 변경 후 IQChan(mainnet)과 SolChat(devnet) 전환이 자연스러운지

### RPC 스팸 방지
- [ ] `fetchFeedThreads` — N+1 호출 수 확인 (board당 1 + thread당 1)
- [ ] `listBoards` — 알 수 없는 board마다 getAccountInfo 호출되는 수 확인
- [ ] `readThread` — feed + thread + instruction table = 최대 3 호출인지
- [ ] 불필요한 반복 호출이 없는지 (같은 PDA를 여러 번 읽지 않는지)

### 에러 핸들링
- [ ] 네트워크 끊긴 상태에서 graceful한 에러 메시지 표시
- [ ] 잔액 부족 시 명확한 에러 ("Insufficient SOL balance")
- [ ] 존재하지 않는 board/thread 접근 시 crash 없이 처리
- [ ] Ctrl+C 시 readline 정리가 제대로 되는지

### 데이터 정합성
- [ ] IQChan에서 작성한 글이 iqchan 웹(blockchan.io)에서도 보이는지
- [ ] 웹에서 작성한 글이 CLI에서도 보이는지
- [ ] edit/delete instruction이 정상 반영되는지

---

## 2. UI 개선

- [ ] 메인 메뉴 ASCII 아트 로고 추가
- [ ] 색상 적용 (ANSI escape codes) — 제목, 에러, 성공 메시지 구분
- [ ] IQChan 스레드 목록 — 선택된 항목 하이라이트
- [ ] 로딩 스피너 또는 프로그레스 표시 (RPC 대기 중)
- [ ] 터미널 너비에 맞는 반응형 레이아웃 (process.stdout.columns)

---

## 3. 추가 앱 검토

- [ ] IQ GitHub (iqgithub) — 소스 있는지, CLI 포팅 가능한지 조사
- [ ] IQ Drive / IQ Storage — 파일 업로드/다운로드 CLI 가능성
- [ ] 기타 IQ Labs 프로덕트 중 CLI로 의미 있는 것 찾기
- [ ] 앱 추가 시 현재 모듈 구조 (apps/ + ui/menus/) 그대로 확장 가능한지 확인

---

## 4. 배포 — 원커맨드 실행

누구나 `git clone` 후 바로 실행할 수 있게 만든다.

- [ ] README.md 작성 — 설치/실행 가이드
- [ ] `npm start` 또는 `npx tsx src/app.ts` 한 줄로 실행 가능하게
- [ ] keypair 없을 때 자동 생성 또는 안내 메시지
- [ ] `.env.example` 파일 제공 (RPC_ENDPOINT, KEYPAIR_PATH)
- [ ] Node.js 최소 버전 명시 (package.json engines)
- [ ] npx로 직접 실행 가능한 bin 설정 검토

---

## 5. 영상 제작용 ASCII 아트

- [ ] 메인 메뉴 로고 ASCII 아트 디자인
- [ ] IQChan 진입 시 배너 아트
- [ ] 터미널 녹화 시나리오 작성 (데모 흐름)
- [ ] asciinema 또는 VHS로 터미널 녹화
- [ ] 영상 편집 및 업로드

---

## 참고

- **IQ Gateway**: 현재 CLI는 모든 읽기를 RPC로 처리하지만, IQ Gateway를 enable/disable 가능하도록 수정 예정. Gateway 활성화 시 읽기 속도가 대폭 향상됨.
- **RPC 엔드포인트**: SolChat은 devnet, IQChan은 mainnet 사용. 앱 전환 시 RPC도 자동 전환되는 구조가 필요할 수 있음.
