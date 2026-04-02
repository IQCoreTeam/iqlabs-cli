# Solana Internet CLI — TODO

---

## 1. Testing

Run through each item manually and verify.

### Functional Tests
- [ ] Main menu — options 1/2/3/0 all route correctly
- [ ] SolChat: friend list, connection request, DM send/receive, room create/join/chat
- [ ] IQChan: board list loads, thread list loads, open thread, post reply
- [ ] IQChan: create thread (2-tx flow), edit post, delete post
- [ ] My Menu: RPC change via paste is saved to .env and takes effect immediately
- [ ] My Menu: profile view, inventory PDA view, DM inbox
- [ ] Missing keypair shows a clear error message with instructions

### UI/UX Tests
- [ ] SolChat menu — number-based selection feels intuitive
- [ ] IQChan board select — arrow key navigation works smoothly
- [ ] IQChan thread list — tree rendering (├─ └─) does not break or misalign
- [ ] IQChan thread view — OP/reply distinction, pagination works
- [ ] Long text (100+ char comments) displays without terminal overflow
- [ ] Non-TTY fallback (piped input) works gracefully

### RPC Onboarding
- [ ] First launch works with default RPC (mainnet) out of the box
- [ ] My Menu > RPC Settings — paste URL, saved to .env, takes effect immediately
- [ ] Invalid URL input is handled with a clear error (not a crash)
- [ ] Saved RPC persists across restarts (read from .env on next launch)

### RPC Spam Prevention
- [ ] `fetchFeedThreads` — verify call count: 1 per board + 1 per thread (N+1)
- [ ] `listBoards` — verify getAccountInfo is only called for unknown boards
- [ ] `readThread` — max 3 calls (feed + thread table + instruction table)
- [ ] No redundant calls to the same PDA within a single operation

### Error Handling
- [ ] Network disconnected — shows graceful error, does not crash
- [ ] Insufficient SOL — clear message ("Insufficient SOL balance")
- [ ] Non-existent board/thread — handled without crash
- [ ] Ctrl+C — readline cleanup works properly, terminal not left in raw mode

### Data Integrity
- [ ] Posts created in CLI are visible on iqchan web (blockchan.io)
- [ ] Posts created on web are visible in CLI
- [ ] Edit/delete instructions are correctly applied in both directions

---

## 2. UI Polish

- [ ] Add ASCII art logo to main menu
- [ ] Apply ANSI colors — titles, errors, success messages, highlights
- [ ] IQChan thread list — highlight selected item with color
- [ ] Loading spinner or progress indicator while waiting for RPC
- [ ] Responsive layout adapting to terminal width (`process.stdout.columns`)

---

## 3. Explore Additional Apps

- [ ] IQ GitHub (iqgithub) — check if source exists, evaluate CLI port feasibility
- [ ] IQ Drive / IQ Storage — file upload/download CLI potential
- [ ] Survey other IQ Labs products for CLI-worthy features
- [ ] Verify current module structure (`apps/` + `ui/menus/`) can extend cleanly

---

## 4. Distribution — One-Command Setup

Anyone should be able to `git clone` and run immediately.

- [ ] Ensure `npm install && npm run dev` is all that's needed
- [ ] Handle missing keypair — auto-generate or show setup instructions
- [ ] Specify minimum Node.js version in `package.json` engines field
- [ ] Consider `bin` field for global `npx` execution

---

## 5. ASCII Art & Video Production

- [ ] Design main menu ASCII art logo
- [ ] Design IQChan entry banner art
- [ ] Write terminal recording scenario (demo flow script)
- [ ] Record with asciinema or VHS
- [ ] Edit and publish video

---

## Notes

- **IQ Gateway**: The CLI currently reads all data via RPC. IQ Gateway enable/disable support is planned — when enabled, read performance will improve significantly by using the indexed gateway API instead of raw RPC calls.
