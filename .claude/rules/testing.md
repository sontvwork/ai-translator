---
trigger: always_on
---

Testing workflow (Playwright E2E — catalog tại docs/test-cases.md, spec tại tests/e2e/):

Thời điểm chạy test:
- Toàn bộ suite chạy theo checkpoint khi người dùng gọi `/test` — KHÔNG bắt buộc chạy sau mỗi edit.
- Đang dev một tính năng, có thể tự kiểm nhanh bằng 1 spec liên quan (vd `npx playwright test tests/e2e/popup.spec.js`) hoặc `npm run test:smoke`.
- Không viết script Playwright ad-hoc để verify — tái sử dụng fixtures trong `tests/helpers/`.

Heuristic viết test — quyết định theo HÀNH VI QUAN SÁT ĐƯỢC, không theo thay đổi code:
- Hành vi mới (tính năng, thông báo, luồng mới) → BẮT BUỘC thêm test mới tại checkpoint `/test` (ID kế tiếp trong nhóm, thêm dòng catalog + test cùng lúc).
- Đổi hành vi cũ có chủ đích → test cũ fail chính là tín hiệu đúng; muốn sửa test/catalog phải được người dùng xác nhận trước.
- Thay đổi thuần hình thức (màu, style, spacing) → KHÔNG cần test, sửa tự do.
- Code thử nghiệm/chưa chốt → KHÔNG viết test cho đến khi quyết định giữ lại.

Bất biến map 1:1 (script scripts/check-test-catalog.mjs enforce qua pretest):
- Tên test trong spec bắt đầu bằng testId (vd `test('TC-POP-001 ...')`); 1 testId = đúng 1 test.
- ID là vĩnh viễn: không đánh số lại, không tái sử dụng; test case bỏ đi thì đổi Loại thành `Retired` trong catalog, giữ nguyên dòng.
- Assert thông báo lỗi bằng substring chính, không assert nguyên câu.

TUYỆT ĐỐI KHÔNG sửa `tests/` hoặc `docs/test-cases.md` chỉ để làm test xanh khi chưa được người dùng xác nhận. Ngoại lệ duy nhất: thêm test MỚI cho tính năng mới. Test fail sau khi sửa code nghĩa là hoặc code mới có bug (sửa code), hoặc requirement đổi (chờ xác nhận) — không có lựa chọn thứ ba.
