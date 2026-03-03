# Hệ thống trả key tích hợp xác minh Email

Đây là dự án hệ thống trả key tích hợp xác minh Email, mã hóa AES-256 và quản lý thông qua giao diện Admin.

## Tính năng

- Xác minh Email
- Mã hóa AES-256
- Quản lý thông qua giao diện Admin
- Cơ sở dữ liệu JSON lưu trên ổ cứng

## Yêu cầu

- nodemailer
- express
- crypto
- fs
- uuid
- express-rate-limit
- dotenv

### Cài đặt

```bash
git clone https://github.com/freshebred/safeKeyDelivery.git
cd safeKeyDelivery
npm install
```

### Tạo file .env

```
PORT=3000

# Admin password
ADMIN_PASSWORD="password"

# Encryption master key (32 bytes hex = 64 chars)
MASTER_KEY="2f3c9f9b6a432d2a0315546f2b5815a43eccebc4ea627bfd468f9849a1a9b58a"

# Email config (nodemailer)
EMAIL_HOST=example.com
EMAIL_PORT=465
EMAIL_USER=admin@example.com
EMAIL_PASS=emailPassword
```

P.S: Đây là dự án đầu tay của mình mà mình để public, hỗ trợ các dự án khác của mình tại https://portfolio.hgphnm.com =))) <33