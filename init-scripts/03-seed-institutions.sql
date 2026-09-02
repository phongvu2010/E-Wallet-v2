-- ====================================================================
-- SEED INSTITUTIONS (Ngân hàng & Ví điện tử phổ biến tại Việt Nam)
-- ====================================================================
INSERT INTO institutions (code, name, short_name, hotline, website) VALUES
('SHINHAN', 'Ngân hàng TNHH MTV Shinhan Việt Nam', 'Shinhan Bank', '1900 1577', 'https://shinhan.com.vn'),
('HSBC', 'Ngân hàng TNHH một thành viên HSBC (Việt Nam)', 'HSBC', '028 37 247 248', 'https://www.hsbc.com.vn'),
('SACOMBANK', 'Ngân hàng TMCP Sài Gòn Thương Tín', 'Sacombank', '1800 5858 88', 'https://www.sacombank.com.vn'),
('VCB', 'Ngân hàng TMCP Ngoại thương Việt Nam', 'Vietcombank', '1900 5454 13', 'https://www.vietcombank.com.vn'),
('TCB', 'Ngân hàng TMCP Kỹ thương Việt Nam', 'Techcombank', '1800 588 822', 'https://techcombank.com'),
('MB', 'Ngân hàng TMCP Quân đội', 'MBBank', '1900 5454 26', 'https://mbbank.com.vn'),
('VPB', 'Ngân hàng TMCP Việt Nam Thịnh Vượng', 'VPBank', '1900 5454 15', 'https://www.vpbank.com.vn'),
('ACB', 'Ngân hàng TMCP Á Châu', 'ACB', '1900 5454 86', 'https://acb.com.vn'),
('BIDV', 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', 'BIDV', '1900 9247', 'https://bidv.com.vn'),
('TPB', 'Ngân hàng TMCP Tiên Phong', 'TPBank', '1900 5858 85', 'https://tpb.vn'),
('MOMO', 'Ví điện tử MoMo', 'MoMo', '1900 5454 41', 'https://momo.vn'),
('ZALOPAY', 'Ví điện tử ZaloPay', 'ZaloPay', '1900 5454 36', 'https://zalopay.vn')
ON CONFLICT (code) DO NOTHING;
