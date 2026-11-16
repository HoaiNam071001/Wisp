// Chất lượng vẽ Flash – logic thuần (không require electron).
// Mặc định (null) = giữ nguyên theo game; chỉ ghi đè khi người dùng chọn.
const QUALITIES = [
  { value: 'low', label: 'Thấp (nhẹ nhất)' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
];

// config.json có thể bị sửa tay → giá trị lạ coi như không đặt
function normalizeQuality(v) {
  return QUALITIES.some(q => q.value === v) ? v : null;
}

module.exports = { QUALITIES, normalizeQuality };
