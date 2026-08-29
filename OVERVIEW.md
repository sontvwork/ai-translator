# AI Translator — Tổng quan dự án

## Đây là gì?

Một tiện ích mở rộng (extension) cho trình duyệt Chrome, giúp người dùng **dịch văn bản bằng AI ngay lập tức**, ở bất cứ đâu trên trình duyệt — không cần mở tab mới, không cần copy-paste sang Google Translate.

Đã có mặt trên Chrome Web Store, cho phép người dùng bất kỳ cài đặt và sử dụng.

## Vấn đề nó giải quyết

Khi đọc tài liệu, email, bài báo hay chat bằng tiếng nước ngoài, người dùng thường phải:
1. Bôi đen đoạn văn bản
2. Copy
3. Mở tab Google Translate / ChatGPT
4. Dán vào
5. Đọc kết quả, quay lại tab cũ

AI Translator rút gọn quy trình này xuống **1 cú click**, ngay tại chỗ.

## Hai cách sử dụng chính

### 1. Dịch trên trang web (in-page translation)
- Người dùng bôi đen (highlight) bất kỳ đoạn văn bản nào trên bất kỳ trang web nào.
- Một icon dịch nhỏ hiện ra ngay cạnh vùng bôi đen.
- Click vào icon → bản dịch hiện ra tại chỗ.
- Tính năng này có thể được bật/tắt trong phần cài đặt.

### 2. Ô dịch nhanh (popup)
- Click vào icon extension trên thanh công cụ trình duyệt → mở ra một cửa sổ nhỏ (popup) giống một ô dịch mini.
- Gõ hoặc dán văn bản vào ô nhập → extension tự động dịch sau một khoảng chờ ngắn (không cần bấm nút "Dịch").
- Có nút sao chép kết quả nhanh.
- Có **lịch sử dịch gần đây**, để xem lại các bản dịch trước đó mà không cần dịch lại.

## Tuỳ chọn dịch thuật

- **Ngôn ngữ đích**: Tiếng Việt, English, 日本語, 中文, 한국어.
- **Văn phong (tone) bản dịch**:
  - ✨ Giữ nguyên tone gốc của văn bản
  - 💼 Trang trọng (công văn, văn phòng)
  - 😊 Thân mật (chat, mạng xã hội)
  - ⚙️ Kỹ thuật (giữ nguyên thuật ngữ chuyên ngành)

## Cách hoạt động phía "hậu trường"

- Extension **không tự có trí tuệ dịch thuật** — nó gửi văn bản tới một **nhà cung cấp AI bên ngoài** (Groq hoặc OpenRouter) để lấy bản dịch, giống như việc gọi API tới ChatGPT.
- Người dùng cần tự đăng ký tài khoản ở Groq hoặc OpenRouter, lấy "API Key" (giống như một mã truy cập cá nhân), rồi nhập vào trang Cài đặt của extension. Cả hai nơi đều có gói dùng miễn phí.
- Người dùng có thể nhập tối đa 5 API Key cho một nhà cung cấp. Extension tự động xoay vòng lần lượt từng key mỗi lượt dịch (round-robin). Nếu một key bị giới hạn, nó sẽ tạm thời bị bỏ qua, extension tự chuyển sang key khả dụng tiếp theo.
- Người dùng cũng có thể chọn model AI cụ thể muốn dùng (mỗi nhà cung cấp có sẵn vài lựa chọn gợi ý).

## Trang Cài đặt (Settings)

Người dùng có thể tuỳ chỉnh:
- Chọn nhà cung cấp AI (Groq hoặc OpenRouter) — chỉ dùng một nhà cung cấp tại một thời điểm.
- Quản lý danh sách API Key (thêm/xoá, tối đa 5 key).
- Chọn model AI.
- Độ trễ trước khi tự động dịch trong popup (300ms–1000ms) — càng thấp thì dịch càng nhanh sau khi ngừng gõ, càng cao thì càng đỡ gọi dịch thừa khi đang gõ dở.
- Bật/tắt tính năng dịch trên trang web.

## Đối tượng người dùng

Bất kỳ ai thường xuyên phải đọc/viết nội dung đa ngôn ngữ trên trình duyệt: người đọc tài liệu kỹ thuật nước ngoài, dân văn phòng làm việc với đối tác quốc tế, người học ngoại ngữ, v.v. — miễn là sẵn sàng tự lấy một API Key miễn phí để dùng.

## Trạng thái dự án

- Phiên bản hiện tại: **4.1**
- Mã nguồn mở (open-source), khuyến khích cộng đồng đóng góp.
- Đã publish chính thức trên Chrome Web Store.
