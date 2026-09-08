-- ====================================================================
-- SEED CATEGORIES (CHUẨN HÓA 2 CẤP NGỮ NGHĨA THỰC TẾ)
-- ====================================================================

-- 1. Nhóm Danh Mục Cha (Cấp 1)
INSERT INTO categories (id, name, category_type, icon, color, is_system) VALUES
-- Chi tiêu (EXPENSE)
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Ăn uống & F&B', 'EXPENSE', 'Utensils', '#f59e0b', TRUE),
('22222222-3e4a-4be6-9333-18ebaf270e2e', 'Mua sắm & Tiêu dùng', 'EXPENSE', 'ShoppingBag', '#ec4899', TRUE),
('33333333-3e4a-4be6-9333-18ebaf270e2e', 'Di chuyển & Đi lại', 'EXPENSE', 'Car', '#06b6d4', TRUE),
('44444444-3e4a-4be6-9333-18ebaf270e2e', 'Hóa đơn & Tiện ích', 'EXPENSE', 'Zap', '#8b5cf6', TRUE),
('55555555-3e4a-4be6-9333-18ebaf270e2e', 'Sức khỏe & Làm đẹp', 'EXPENSE', 'Activity', '#10b981', TRUE),
('66666666-3e4a-4be6-9333-18ebaf270e2e', 'Giải trí & Du lịch', 'EXPENSE', 'MapPin', '#3b82f6', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí & Lãi ngân hàng', 'EXPENSE', 'Percent', '#f43f5e', TRUE),
('88888888-3e4a-4be6-9333-18ebaf270e2e', 'Chi tiêu khác', 'EXPENSE', 'MoreHorizontal', '#64748b', TRUE),

-- Thu nhập (INCOME)
('f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Lương & Thu nhập', 'INCOME', 'Briefcase', '#10b981', TRUE),
('bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Thu nhập khác', 'INCOME', 'Gift', '#14b8a6', TRUE),

-- Chuyển tiền & Trả nợ (TRANSFER)
('2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Chuyển tiền & Trả nợ', 'TRANSFER', 'Repeat', '#0284c7', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category_type = EXCLUDED.category_type,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    is_system = EXCLUDED.is_system;


-- 2. Danh Mục Con (Cấp 2)
INSERT INTO categories (id, parent_id, name, category_type, icon, color, is_system) VALUES
-- Ăn uống & F&B
('11111111-3e4a-4be6-9333-18ebaf270001', '0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Nhà hàng & Quán ăn', 'EXPENSE', 'Utensils', '#f59e0b', TRUE),
('11111111-3e4a-4be6-9333-18ebaf270002', '0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Cà phê', 'EXPENSE', 'Coffee', '#f59e0b', TRUE),
('11111111-3e4a-4be6-9333-18ebaf270003', '0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Siêu thị & Đi chợ', 'EXPENSE', 'ShoppingCart', '#f59e0b', TRUE),

-- Mua sắm & Tiêu dùng
('22222222-3e4a-4be6-9333-18ebaf270001', '22222222-3e4a-4be6-9333-18ebaf270e2e', 'Mua sắm Online / TMĐT', 'EXPENSE', 'Globe', '#ec4899', TRUE),
('22222222-3e4a-4be6-9333-18ebaf270002', '22222222-3e4a-4be6-9333-18ebaf270e2e', 'Thời trang & Phụ kiện', 'EXPENSE', 'Tag', '#ec4899', TRUE),
('22222222-3e4a-4be6-9333-18ebaf270003', '22222222-3e4a-4be6-9333-18ebaf270e2e', 'Đồ công nghệ & Thiết bị', 'EXPENSE', 'Laptop', '#ec4899', TRUE),
('22222222-3e4a-4be6-9333-18ebaf270004', '22222222-3e4a-4be6-9333-18ebaf270e2e', 'Đồ gia dụng & Tiện ích', 'EXPENSE', 'Home', '#ec4899', TRUE),

-- Di chuyển & Đi lại
('33333333-3e4a-4be6-9333-18ebaf270001', '33333333-3e4a-4be6-9333-18ebaf270e2e', 'Xăng xe & Nhiên liệu', 'EXPENSE', 'Fuel', '#06b6d4', TRUE),
('33333333-3e4a-4be6-9333-18ebaf270002', '33333333-3e4a-4be6-9333-18ebaf270e2e', 'Taxi / Grab / Be', 'EXPENSE', 'Car', '#06b6d4', TRUE),
('33333333-3e4a-4be6-9333-18ebaf270003', '33333333-3e4a-4be6-9333-18ebaf270e2e', 'Vé máy bay, Tàu xe & Gửi xe', 'EXPENSE', 'Plane', '#06b6d4', TRUE),

-- Hóa đơn & Tiện ích
('44444444-3e4a-4be6-9333-18ebaf270001', '44444444-3e4a-4be6-9333-18ebaf270e2e', 'Điện, Nước & Rác', 'EXPENSE', 'Zap', '#8b5cf6', TRUE),
('44444444-3e4a-4be6-9333-18ebaf270002', '44444444-3e4a-4be6-9333-18ebaf270e2e', 'Internet & Cước 4G/5G', 'EXPENSE', 'Wifi', '#8b5cf6', TRUE),
('44444444-3e4a-4be6-9333-18ebaf270003', '44444444-3e4a-4be6-9333-18ebaf270e2e', 'Dịch vụ số & App (Netflix, Spotify...)', 'EXPENSE', 'Cloud', '#8b5cf6', TRUE),

-- Sức khỏe & Làm đẹp
('55555555-3e4a-4be6-9333-18ebaf270001', '55555555-3e4a-4be6-9333-18ebaf270e2e', 'Thuốc men & Khám bệnh', 'EXPENSE', 'Activity', '#10b981', TRUE),
('55555555-3e4a-4be6-9333-18ebaf270002', '55555555-3e4a-4be6-9333-18ebaf270e2e', 'Gym & Thể thao', 'EXPENSE', 'Dumbbell', '#10b981', TRUE),
('55555555-3e4a-4be6-9333-18ebaf270003', '55555555-3e4a-4be6-9333-18ebaf270e2e', 'Mỹ phẩm & Chăm sóc cá nhân', 'EXPENSE', 'Smile', '#10b981', TRUE),

-- Giải trí & Du lịch
('66666666-3e4a-4be6-9333-18ebaf270001', '66666666-3e4a-4be6-9333-18ebaf270e2e', 'Du lịch & Khách sạn', 'EXPENSE', 'MapPin', '#3b82f6', TRUE),
('66666666-3e4a-4be6-9333-18ebaf270002', '66666666-3e4a-4be6-9333-18ebaf270e2e', 'Xem phim & Sự kiện', 'EXPENSE', 'Film', '#3b82f6', TRUE),

-- Phí & Lãi ngân hàng
('77777777-3e4a-4be6-9333-18ebaf270001', 'c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí thường niên thẻ', 'EXPENSE', 'Calendar', '#f43f5e', TRUE),
('77777777-3e4a-4be6-9333-18ebaf270002', 'c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí SMS & Dịch vụ tài khoản', 'EXPENSE', 'MessageSquare', '#f43f5e', TRUE),
('77777777-3e4a-4be6-9333-18ebaf270003', 'c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Lãi suất thẻ tín dụng', 'EXPENSE', 'AlertCircle', '#f43f5e', TRUE),

-- Chi tiêu khác
('88888888-3e4a-4be6-9333-18ebaf270001', '88888888-3e4a-4be6-9333-18ebaf270e2e', 'Trả góp định kỳ thẻ', 'EXPENSE', 'Clock', '#64748b', TRUE),
('88888888-3e4a-4be6-9333-18ebaf270002', '88888888-3e4a-4be6-9333-18ebaf270e2e', 'Chi tiêu khác', 'EXPENSE', 'MoreHorizontal', '#64748b', TRUE),

-- Lương & Thu nhập
('99999999-3e4a-4be6-9333-18ebaf270001', 'f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Tiền lương hàng tháng', 'INCOME', 'DollarSign', '#10b981', TRUE),
('99999999-3e4a-4be6-9333-18ebaf270002', 'f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Tiền thưởng & Hoa hồng', 'INCOME', 'Award', '#10b981', TRUE),
('99999999-3e4a-4be6-9333-18ebaf270003', 'f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Thu nhập Freelance / Làm thêm', 'INCOME', 'Briefcase', '#10b981', TRUE),

-- Thu nhập khác
('aaaaaaaa-3e4a-4be6-9333-18ebaf270001', 'bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Lãi gửi tiết kiệm & Đầu tư', 'INCOME', 'TrendingUp', '#14b8a6', TRUE),
('aaaaaaaa-3e4a-4be6-9333-18ebaf270002', 'bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Tiền quà tặng / Biếu', 'INCOME', 'Gift', '#14b8a6', TRUE),
('aaaaaaaa-3e4a-4be6-9333-18ebaf270003', 'bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Hoàn tiền Cashback & Điểm thưởng', 'INCOME', 'Coins', '#14b8a6', TRUE),

-- Chuyển tiền & Trả nợ
('bbbbbbbb-3e4a-4be6-9333-18ebaf270001', '2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Chuyển khoản nội bộ', 'TRANSFER', 'Repeat', '#0284c7', TRUE),
('bbbbbbbb-3e4a-4be6-9333-18ebaf270002', '2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Thanh toán dư nợ thẻ tín dụng', 'TRANSFER', 'CheckCircle2', '#0284c7', TRUE),
('bbbbbbbb-3e4a-4be6-9333-18ebaf270003', '2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Rút tiền ATM / Nạp ví', 'TRANSFER', 'ArrowDownCircle', '#0284c7', TRUE)
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    category_type = EXCLUDED.category_type,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    is_system = EXCLUDED.is_system;
