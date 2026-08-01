---
name: test
description: Checkpoint hoàn tất chức năng — đối chiếu diff với catalog test case, bổ sung test cho hành vi mới, chạy toàn bộ regression suite và báo cáo. Người dùng chủ động gọi khi kết thúc một chức năng, KHÔNG tự chạy sau mỗi edit.
---

# Checkpoint test — quy trình

Chạy khi người dùng gọi `/test` để chốt một chức năng vừa hoàn tất.

## 1. Xác định phạm vi thay đổi

Diff từ checkpoint trước:
- Nếu người dùng chỉ định base (commit/branch), dùng base đó.
- Mặc định: `git diff $(git merge-base HEAD main)` cộng với thay đổi chưa commit. Nếu đã chạy checkpoint trước đó trong cùng nhánh, chỉ xét phần thay đổi từ lần checkpoint gần nhất.

## 2. Đối chiếu diff với `docs/test-cases.md`

Phân loại từng thay đổi hành vi trong diff:

- **(a) Hành vi mới chưa có test** → thêm dòng mới vào catalog (ID kế tiếp trong nhóm, không đánh số lại) + viết test tương ứng trong `tests/e2e/`. Đây là bước **bắt buộc, không cần hỏi**.
- **(b) Hành vi cũ bị thay đổi có chủ đích** (test cũ sẽ fail) → liệt kê các testId bị ảnh hưởng, đề xuất nội dung sửa catalog + spec, rồi **DỪNG CHỜ NGƯỜI DÙNG XÁC NHẬN** trước khi sửa bất kỳ test nào.
- **(c) Thay đổi thuần hình thức** (màu, spacing, style, copy nhỏ không nằm trong assert) → bỏ qua, không cần test.

## 3. Chạy suite

```bash
npm test
```

(`pretest` tự kiểm tra map 1:1 catalog ↔ spec — nếu fail ở bước này thì sửa map trước.)

Nếu có test fail, phân loại từng test:
- **(A) Bug ở code mới** → sửa code nguồn cho đến khi test xanh. KHÔNG đụng vào `tests/` hay catalog.
- **(B) Requirement đã đổi** → quay lại bước 2b (chờ xác nhận rồi mới sửa test).
- **Không chắc thuộc loại nào** → hỏi người dùng, kèm output test fail.

## 4. Báo cáo

Tổng kết ngắn gọn:
- Số test pass/fail (kèm thời gian chạy).
- Test mới đã thêm (testId + mô tả 1 dòng).
- Danh sách test đang chờ người dùng xác nhận sửa (nếu có ở bước 2b/3B).

## Kỹ thuật

- Fixtures/mock có sẵn trong `tests/helpers/` (xem comment đầu `extension-fixtures.js`). Không viết script launch ad-hoc.
- Chạy nhanh 1 nhóm: `npx playwright test tests/e2e/popup.spec.js`; smoke: `npm run test:smoke`.
- Môi trường không có DISPLAY vẫn chạy được (headless mới hỗ trợ extension); `HEADED=1` nếu cần quan sát.
