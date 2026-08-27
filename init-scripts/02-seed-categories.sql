-- ====================================================================
-- SEED CATEGORIES
-- ====================================================================

-- 1. Parent Categories (Cấp 1)
INSERT INTO categories (id, name, category_type, icon, is_system) VALUES
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Chi tiêu', 'EXPENSE', 'shopping-bag', TRUE),
('2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Thanh toán', 'TRANSFER', 'credit-card', TRUE),
('f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Thu nhập', 'INCOME', 'arrow-down-left', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí & Lãi', 'FEE_INTEREST', 'percent', TRUE),
('2ed891ea-a098-4c6a-b5a6-438b798d64a6', 'Điều chỉnh / Hủy', 'ADJUSTMENT', 'refresh-cw', TRUE),
('bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Hoàn tiền', 'INCOME', 'gift', TRUE);

-- 2. Sub-categories (Cấp 2)
INSERT INTO categories (parent_id, name, category_type, icon, is_system) VALUES
-- Chi tiêu
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Nhà hàng & F&B', 'EXPENSE', 'coffee', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Cửa hàng tiện lợi', 'EXPENSE', 'store', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Siêu thị & Tiện lợi', 'EXPENSE', 'shopping-cart', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Thương mại điện tử', 'EXPENSE', 'globe', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Cửa hàng công nghệ', 'EXPENSE', 'laptop', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Thời trang & Trang phục', 'EXPENSE', 'tag', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Dịch vụ số & Ứng dụng', 'EXPENSE', 'cloud', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Y tế & Sức khỏe', 'EXPENSE', 'activity', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Chăm sóc cá nhân', 'EXPENSE', 'smile', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Du lịch', 'EXPENSE', 'map-pin', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Di chuyển & Vận tải', 'EXPENSE', 'truck', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Trả góp', 'EXPENSE', 'clock', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Tất toán trả góp', 'EXPENSE', 'check-circle-2', TRUE),
('0666944e-3e4a-4be6-9333-18ebaf270e2e', 'Chi tiêu khác', 'EXPENSE', 'more-horizontal', TRUE),

-- Thanh toán
('2d3f92eb-a9f7-490e-b2bb-4498942642bd', 'Thanh toán dư nợ', 'TRANSFER', 'check-circle', TRUE),

-- Thu nhập
('f1cfacf7-b6ca-4eeb-9075-fd62700a13ef', 'Nạp tiền', 'INCOME', 'plus-circle', TRUE),

-- Phí & Lãi
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí SMS', 'FEE_INTEREST', 'message-square', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí thường niên', 'FEE_INTEREST', 'calendar', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Phí chuyển đổi trả góp', 'FEE_INTEREST', 'repeat', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Lãi suất', 'FEE_INTEREST', 'alert-circle', TRUE),
('c3d556ad-a77b-47c2-84eb-fbef5610c343', 'Hoàn phí thường niên', 'FEE_INTEREST', 'corner-down-left', TRUE),

-- Điều chỉnh / Hủy
('2ed891ea-a098-4c6a-b5a6-438b798d64a6', 'Chuyển đổi sang trả góp', 'ADJUSTMENT', 'arrow-right-circle', TRUE),
('2ed891ea-a098-4c6a-b5a6-438b798d64a6', 'Hủy giao dịch', 'ADJUSTMENT', 'x-circle', TRUE),

-- Hoàn tiền
('bae76e5c-9e98-4a66-9d02-0edf997bc8d6', 'Hoàn tiền Cashback', 'INCOME', 'dollar-sign', TRUE);
