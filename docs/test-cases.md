# Bộ test case — AI Translator

Tài liệu này là **nguồn chân lý** cho toàn bộ test case của extension. Code Playwright trong `tests/e2e/` map 1:1 với các testId tại đây (script `scripts/check-test-catalog.mjs` kiểm tra tự động qua `npm test`).

## Quy tắc

- **ID là vĩnh viễn**: không đánh số lại, không tái sử dụng ID cũ. Test case bỏ đi thì đổi `Loại` thành `Retired`, giữ nguyên dòng.
- Tên test trong file spec **bắt đầu bằng testId** (vd: `test('TC-POP-001 ...')`). 1 testId = đúng 1 test.
- Map prefix ↔ file spec: `POP` → `popup.spec.js`, `SET` → `settings.spec.js`, `ERR` → `errors.spec.js`, `HIS` → `history.spec.js`, `NOT` → `notifications.spec.js`, `CS` → `content-script.spec.js`. `MAN` chỉ dành cho test thủ công, không có code.
- Assert thông báo lỗi bằng **substring chính** (vd `"API Key không hợp lệ"`) — sửa dấu câu/emoji không làm vỡ test. Đổi nội dung chính của thông báo thì phải cập nhật catalog + spec (cần người dùng xác nhận).
- `Ưu tiên`: **P1** = smoke (tag `@smoke` trong spec, chạy nhanh bằng `npm run test:smoke`), **P2** = đầy đủ.
- `Loại`: `Auto` (đã có code Playwright) / `Manual` (chỉ test tay) / `Deferred` (sẽ tự động hoá sau) / `Retired` (đã bỏ).

## Popup — dịch cơ bản (`tests/e2e/popup.spec.js`)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-POP-001 | Gõ văn bản → tự dịch | Đã seed key groq, delay 300ms, mock SSE trả "Xin chào" | Mở popup, gõ "Hello" vào `#input-text`, chờ | `#output-text` = "Xin chào"; đúng 1 request tới API | P1 | Auto |
| TC-POP-002 | Tôn trọng độ trễ dịch | Seed `translationDelay: 800` | Gõ text, kiểm tra tại ~400ms, rồi chờ tiếp | Tại ~400ms chưa có request nào; sau đó có kết quả dịch | P2 | Auto |
| TC-POP-003 | Đổi ngôn ngữ đích → dịch lại ngay | Đã dịch xong 1 lần | Chọn `#target-lang` = English | Dịch lại ngay (không chờ debounce); prompt request mới chứa "tiếng Anh" | P1 | Auto |
| TC-POP-004 | Đổi tone → dịch lại ngay | Đã dịch xong 1 lần | Chọn `#tone-select` = formal | Dịch lại ngay; prompt chứa chỉ dẫn tone formal | P2 | Auto |
| TC-POP-005 | Xoá input → output rỗng | Đã dịch xong 1 lần | Xoá hết `#input-text` | `#output-text` rỗng ngay (không chờ debounce); không có request mới | P2 | Auto |
| TC-POP-006 | Văn bản quá dài | Seed key hợp lệ | Dán văn bản 8001 ký tự | Output báo "Văn bản quá dài"; 0 request | P2 | Auto |
| TC-POP-007 | Nút copy | Đã có kết quả dịch | Click `#copy-button` | `#copied-label` hiện với class `show` | P2 | Auto |
| TC-POP-008 | Khôi phục phiên làm việc | Đã dịch xong, chờ ~600ms cho persist | Đóng popup, mở lại | Input/output khôi phục đúng như trước | P1 | Auto |
| TC-POP-009 | Ghi nhớ ngôn ngữ + tone | Đã chọn ngôn ngữ en + tone formal | Đóng popup, mở lại | `#target-lang` = en, `#tone-select` = formal | P2 | Auto |
| TC-POP-010 | Nút cài đặt | Popup đang mở | Click `#settings-button` | Trang settings.html được mở | P2 | Auto |
| TC-POP-011 | Nhận văn bản từ in-page translation | Seed `{selectedText, fromInPageTranslation: true}` vào storage.local | Mở popup | Input tự điền selectedText, tự dịch ngay; 2 flags bị xoá khỏi storage | P1 | Auto |
| TC-POP-012 | Dịch qua OpenRouter | Seed provider openrouter + model tuỳ chọn + key | Gõ text, chờ dịch | Request tới endpoint openrouter.ai; `body.model` đúng model đã seed; header Bearer đúng key | P2 | Auto |
| TC-POP-013 | Streaming hiển thị dần | Mock SSE có delay giữa các chunk (cần local SSE server vì `route.fulfill` buffer toàn bộ body) | Gõ text, quan sát output trong lúc stream | Output hiển thị từng phần trước khi hoàn tất | P2 | Deferred |
| TC-POP-014 | Dịch qua Mistral | Seed provider mistral + model tuỳ chọn + key | Gõ text, chờ dịch | Request tới endpoint api.mistral.ai; `body.model` đúng model đã seed; header Bearer đúng key | P2 | Auto |

## Settings (`tests/e2e/settings.spec.js`)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-SET-001 | Trạng thái mặc định fresh install | Storage trống | Mở settings | Radio groq checked + card groq active; `#groq-settings` hiện, `#mistral-settings` và `#openrouter-settings` ẩn; 1 key row rỗng; badge "1/5"; delay 500; in-page translation bật | P1 | Auto |
| TC-SET-002 | Chuyển provider | Settings đang mở (groq) | Click card OpenRouter | `#groq-settings` ẩn, `#openrouter-settings` hiện; card active đổi sang openrouter | P1 | Auto |
| TC-SET-003 | Giới hạn 5 key | Settings đang mở | Bấm "Thêm API Key" tới khi đủ 5 row | Nút add ẩn khi đủ 5; badge "5/5" | P2 | Auto |
| TC-SET-004 | Xoá key row | Có 3 key rows | Xoá row giữa; sau đó xoá hết | Đánh số lại liên tục #1, #2; xoá hết thì còn lại 1 row rỗng | P2 | Auto |
| TC-SET-005 | Toggle hiện/ẩn key | Có key row với giá trị | Click nút 👁️ rồi click lại | Input đổi type password↔text; icon đổi 👁️↔🙈 | P2 | Auto |
| TC-SET-006 | Slider độ trễ | Settings đang mở | Kéo slider tới 700 | `#delay-value` hiển thị "700" | P2 | Auto |
| TC-SET-007 | Lưu cài đặt | Đã nhập key groq | Click "Lưu cài đặt" | `#success-message` hiện class `show`; `chrome.storage.sync` chứa đúng toàn bộ giá trị | P1 | Auto |
| TC-SET-008 | Phím tắt Ctrl+S | Đã nhập key | Nhấn Ctrl+S | Lưu như click nút Save (success message + storage đúng) | P2 | Auto |
| TC-SET-009 | Chuẩn hoá dữ liệu khi lưu | Key có space thừa, 1 row rỗng, chọn "Tự nhập model" và để trống | Lưu | Key được trim; row rỗng bị loại; model trống → dùng model mặc định khi load lại | P2 | Auto |
| TC-SET-010 | Migration cấu hình cũ | Seed `{provider: 'gemini', openRouterApiKey: 'k'}` (format pre-3.2) | Mở settings | Provider chuyển thành groq; `openRouterApiKeys` = ['k']; các key legacy bị xoá khỏi storage.sync | P2 | Auto |
| TC-SET-011 | Chuyển provider sang Mistral | Settings đang mở (groq) | Click card Mistral | `#mistral-settings` hiện, `#groq-settings` và `#openrouter-settings` ẩn; card active đổi sang mistral | P2 | Auto |
| TC-SET-012 | Badge "Đang dùng" chỉ theo provider đã lưu | Settings đang mở (groq đã lưu) | Click card Mistral (chưa bấm Lưu) | Card Groq vẫn còn badge "Đang dùng", card Mistral chưa có; sau khi click "Lưu cài đặt" badge chuyển sang card Mistral | P2 | Auto |
| TC-SET-013 | Chọn model từ dropdown | Settings đang mở (groq, model mặc định) | Mở model select, chọn model khác, Lưu | Trigger hiển thị tên + mô tả model đã chọn; input tự nhập vẫn ẩn; `groqModel` trong storage đúng model đã chọn | P2 | Auto |
| TC-SET-014 | Tự nhập model | Settings đang mở (groq) | Mở model select, chọn "Tự nhập model", gõ model tuỳ ý, Lưu, mở lại settings | Input hiện khi chọn "Tự nhập model"; storage lưu đúng model; mở lại hiển thị chế độ tự nhập với đúng giá trị | P2 | Auto |

## Lỗi & providers (`tests/e2e/errors.spec.js` — chạy qua popup với mock API)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-ERR-001 | Chưa có API key | Seed settings với danh sách key rỗng | Gõ text | Output chứa "Chưa cài đặt API Key"; 0 request | P1 | Auto |
| TC-ERR-002 | Key không hợp lệ (401) | 1 key; mock 401 | Gõ text | Output chứa "API Key không hợp lệ" và "Key số 1" | P1 | Auto |
| TC-ERR-003 | Rate limit theo phút (429) | 1 key; mock 429 + header `retry-after: 30` | Gõ text | Output chứa "Quá giới hạn theo phút" và "30 giây"; `#check-quota-link` hiện, href = trang limits của Groq | P1 | Auto |
| TC-ERR-004 | Hết hạn mức trong ngày | 1 key; mock 429 + `retry-after` lớn (>1h, vd 86400) | Gõ text | Output chứa "Đã hết hạn mức trong ngày" (lưu ý: scope 'day' xác định theo thời gian chờ >1h, không theo message) | P2 | Auto |
| TC-ERR-005 | OpenRouter hết credits (402) | Provider openrouter; mock 402 | Gõ text | Output chứa "hết credits" | P2 | Auto |
| TC-ERR-006 | Model không hợp lệ (404) | Mock 404 | Gõ text | Output chứa "Model không hợp lệ" | P2 | Auto |
| TC-ERR-007 | Tự retry khi server lỗi | Mock [500, 500, thành công] | Gõ text, chờ (retry cách nhau 1s) | Kết quả cuối là bản dịch; đúng 3 requests | P2 | Auto |
| TC-ERR-008 | Hết lượt retry | Mock [500, 500, 500] | Gõ text, chờ | Output chứa "Vui lòng thử lại sau"; đúng 3 requests | P2 | Auto |
| TC-ERR-009 | Tự chuyển key khi 429 | 2 keys; mock [429 retry-after 60, thành công] | Gõ text | Dịch thành công bằng key 2 trong cùng lần dịch; request 1 dùng key 1, request 2 dùng key 2; `keyRotation.groq.disabledUntil["0"]` được set trong tương lai | P1 | Auto |
| TC-ERR-010 | Tất cả key bị giới hạn | 2 keys; mock cả 2 lần đều 429 | Gõ text | Output chứa "Tất cả API Key" kèm thời gian chờ | P2 | Auto |
| TC-ERR-011 | Round-robin key | 2 keys; mock 2 lần dịch thành công | Dịch 2 lần (2 nội dung khác nhau) | Lần 1 dùng key 1, lần 2 dùng key 2 (nextIndex xoay sau mỗi lần thành công) | P2 | Auto |

## Lịch sử dịch (`tests/e2e/history.spec.js`)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-HIS-001 | Lưu lịch sử sau khi dịch | Dịch thành công 1 lần, chờ ~600ms | Đọc `translationHistory` từ storage.local | Bản ghi [0] có đúng {source, translated, timestamp} | P1 | Auto |
| TC-HIS-002 | Hiển thị popover lịch sử | Seed 2 bản ghi lịch sử | Click `#history-button` | Liệt kê mới nhất trước; khi lịch sử rỗng hiện "Chưa có lịch sử dịch" | P2 | Auto |
| TC-HIS-003 | Khôi phục từ lịch sử | Seed 1 bản ghi | Mở popover, click item | Input/output khôi phục đúng cặp; KHÔNG gọi API dịch lại | P1 | Auto |
| TC-HIS-004 | Xoá lịch sử 2 bước | Có lịch sử | Click "Xóa hết" → nút đổi "Xác nhận?" → click lần 2; thử lại nhưng không click lần 2 | Click lần 2 thì xoá sạch; không click thì nút tự reset sau ~3s | P2 | Auto |
| TC-HIS-005 | Giới hạn 5 bản ghi | Seed 5 bản ghi | Dịch thêm 1 nội dung mới | Còn đúng 5 bản ghi, bản cũ nhất bị loại | P2 | Auto |
| TC-HIS-006 | Dedup khi gõ tiếp | Dịch "Hel" xong | Gõ tiếp thành "Hello", dịch xong | Chỉ 1 bản ghi (bản mới thay bản cũ vì cùng prefix) | P2 | Auto |
| TC-HIS-007 | Dịch lại nội dung cũ | Seed 2 bản ghi A, B (B mới nhất) | Dịch lại đúng nội dung A | A lên đầu danh sách, không có bản ghi trùng | P2 | Auto |

## Thông báo (`tests/e2e/notifications.spec.js` — dữ liệu tại `notifications.js`, test assert động theo file nên release thêm thông báo không làm vỡ test)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-NOT-001 | Badge số chưa đọc + danh sách thông báo | Storage trống (tất cả chưa đọc) | Mở popup, click `#notifications-button` | Badge hiện đúng số thông báo trong `notifications.js`; popover liệt kê đủ thông báo (title + preview nội dung), mới nhất (id lớn nhất) trước | P1 | Auto |
| TC-NOT-002 | Xem chi tiết → tự đánh dấu đã đọc + quay lại | Storage trống | Mở popover, click thông báo đầu, click `←` | Detail hiện đúng title + content (giữ xuống dòng); `readNotificationIds` chứa id đó; badge giảm 1; `←` quay về danh sách | P1 | Auto |
| TC-NOT-003 | Đánh dấu tất cả đã đọc | Storage trống | Mở popover, click "Đánh dấu đã đọc" | Badge ẩn; `readNotificationIds` = toàn bộ id | P2 | Auto |
| TC-NOT-004 | Trạng thái đã đọc bền vững | Seed `readNotificationIds` = toàn bộ id | Mở popup | Badge ẩn ngay từ đầu | P2 | Auto |
| TC-NOT-005 | Hai popover loại trừ nhau | Seed 1 bản ghi lịch sử | Mở popover lịch sử, click chuông; rồi ngược lại | Mở cái này thì cái kia đóng | P2 | Auto |

## Content script — dịch trên trang (`tests/e2e/content-script.spec.js` — trang web mock tại `https://e2e.test/`)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-CS-001 | Icon hiện khi bôi đen | Tính năng in-page bật (mặc định) | Bôi đen đoạn text trên trang | `.ai-translator-icon` xuất hiện với class `show` (sau debounce 200ms) | P1 | Auto |
| TC-CS-002 | Click icon → gửi text sang popup | Đã bôi đen text, icon đang hiện | Click icon | storage.local có `selectedText` đúng text + `fromInPageTranslation: true`; icon ẩn. (Content script set storage trước khi gọi openPopup nên assert được kể cả khi `chrome.action.openPopup()` không mở được popup trong môi trường automation) | P1 | Auto |
| TC-CS-003 | Không hiện icon khi text quá dài | Trang có đoạn text >8000 ký tự | Bôi đen toàn bộ | Icon không xuất hiện | P2 | Auto |
| TC-CS-004 | Tắt tính năng in-page | Seed `inPageTranslationEnabled: false` | Bôi đen text; sau đó bật lại rồi tắt live khi icon đang hiện | Không hiện icon khi tắt; đổi setting live thì icon đang hiện ẩn ngay | P2 | Auto |
| TC-CS-005 | Bỏ chọn → icon ẩn | Icon đang hiện | Click chỗ khác trên trang (bỏ selection) | Icon mất class `show` | P2 | Auto |

## Test thủ công (không có code)

| ID | Tên test | Điều kiện đầu | Các bước | Kết quả mong đợi | Ưu tiên | Loại |
|---|---|---|---|---|---|---|
| TC-MAN-001 | Dịch thật với API key thật | Có key Groq/Mistral/OpenRouter thật | Dịch 1 đoạn văn bản thật | Kết quả dịch đúng nghĩa, stream mượt | P2 | Manual |
| TC-MAN-002 | openPopup mở popup thật | Load extension trong Chrome thật | Bôi đen text trên trang, click icon | Popup mở lên, tự điền + tự dịch (chrome.action.openPopup cần user gesture — không kiểm được trong automation) | P2 | Manual |
| TC-MAN-003 | Thẩm mỹ giao diện | — | Quan sát rainbow-loading, layout popup/settings | Hiệu ứng và style hiển thị đúng thiết kế | P2 | Manual |

> **Ghi chú:** Thay đổi thuần hình thức (màu sắc, spacing, style) mặc định KHÔNG có test tự động — sửa tự do, chỉ nhóm TC-MAN-003 cover bằng mắt.
