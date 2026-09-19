// Thông báo tích hợp sẵn — thêm phần tử MỚI NHẤT lên ĐẦU mảng, id không tái sử dụng.
// Hai trường tuỳ chọn:
//   enabled: false      → ẩn hẳn (bỏ qua = hiện)
//   expiresAt: "2025-09-25" → ẩn sau khi hết ngày đó (bỏ qua = không hết hạn)
export const ALL_NOTIFICATIONS = [
  {
    id: 3,
    title: "🏆 Top 1 model dịch tốt nhất",
    content: "Qwen 3.8 27B (Groq) được đội ngũ phát triển khuyên dùng.\n\nĐã kiểm chứng trên bộ dữ liệu lớn:\n・Tốc độ nhanh nhất\n・Chất lượng dịch tốt nhất\n・Miễn phí\n\nThử ngay trong phần cài đặt!"
  }
];

// "YYYY-MM-DD" theo giờ máy — so sánh chuỗi ISO trực tiếp, không parse, không lệch timezone.
const today = new Date().toLocaleDateString("sv-SE");

export const NOTIFICATIONS = ALL_NOTIFICATIONS.filter(
  (n) => n.enabled !== false && (!n.expiresAt || n.expiresAt >= today)
);
