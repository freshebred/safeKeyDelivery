require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

//****************************************************
//*                 Viết bởi Freshebred              *
//*        GitHub: https://github.com/freshebred     *
//*        website: https://portfolio.hgphnm.com     *
//*                                                  *
//****************************************************

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate Limiting ──────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Limit each IP to 5 login requests per 15 minutes
    message: { error: 'Thử mật khẩu sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

const redeemLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Limit each IP to 10 redeem related requests per 15 minutes
    message: { error: 'Thao tác quá nhanh. Vui lòng thử lại sau 15 phút.' },
});

// Apply global rate limiting to all routes
app.use(globalLimiter);

// ─── Constants ───────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'keys.json');
const MASTER_KEY = process.env.MASTER_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ALGORITHM = 'aes-256-cbc';

// In-memory admin sessions
const adminSessions = new Map();
const SESSION_TTL = 3600000; // 1 hour

// Rate limiting for email sends (PIN -> { email, timestamp, attempts })
const emailRateLimit = new Map();

// ─── Encryption Helpers ──────────────────────────────────────
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(MASTER_KEY, 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(ciphertext) {
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.from(MASTER_KEY, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ─── PIN & Private Code Generators ──────────────────────────
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generatePin() {
    // format: xxxx-xxxx (case-sensitive, alphanumeric)
    let part1 = '', part2 = '';
    for (let i = 0; i < 4; i++) {
        part1 += CHARSET[crypto.randomInt(CHARSET.length)];
        part2 += CHARSET[crypto.randomInt(CHARSET.length)];
    }
    return part1 + '-' + part2;
}

function generatePrivateCode() {
    // format: xxxx (case-sensitive, alphanumeric)
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += CHARSET[crypto.randomInt(CHARSET.length)];
    }
    return code;
}

// ─── Data Persistence ────────────────────────────────────────
function loadKeys() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function saveKeys(keys) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2), 'utf8');
}

// ─── Email Transporter ──────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: true, // port 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendPrivateCodeEmail(toEmail, privateCode, pin) {
    const sanitizedPin = pin.slice(0, -4) + '****';
    const mailOptions = {
        from: `"nom safekey" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Mã xác thực SafeKey của bạn',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a2e; padding: 30px; border-radius: 12px; color: #e0e0e0;">
                <h2 style="text-align: center; color: #00d4ff; margin-bottom: 5px;">🔐 nom safekey</h2>
                <p style="text-align: center; color: #888; font-size: 12px; margin-top: 0;">delivery system</p>
                <hr style="border: 1px solid #333; margin: 20px 0;">
                <p>Xin chào,</p>
                <p>Bạn đã yêu cầu mở khóa một mã key với PIN: <strong style="color: #00d4ff;">${sanitizedPin}</strong></p>
                <p>Đây là mã xác thực riêng tư của bạn:</p>
                <div style="text-align: center; margin: 25px 0;">
                    <span style="display: inline-block; background: linear-gradient(135deg, #0f3460, #16213e); padding: 15px 35px; border-radius: 8px; font-size: 28px; letter-spacing: 8px; font-weight: bold; color: #00d4ff; border: 1px solid #00d4ff44;">${privateCode}</span>
                </div>
                <p style="color: #ff6b6b; font-size: 13px;">⚠️ Không chia sẻ mã này với bất kỳ ai. Mã có phân biệt chữ hoa/thường.</p>
                <hr style="border: 1px solid #333; margin: 20px 0;">
                <p style="color: #666; font-size: 11px; text-align: center;">Email này được gửi tự động từ hệ thống nom safekey. Vui lòng không trả lời.</p>
            </div>
        `,
    };
    return transporter.sendMail(mailOptions);
}

// ─── Admin Auth Middleware ───────────────────────────────────
function adminAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || !adminSessions.has(token)) {
        return res.status(401).json({ error: 'Không có quyền truy cập' });
    }
    const session = adminSessions.get(token);
    if (Date.now() - session.createdAt > SESSION_TTL) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Phiên đã hết hạn' });
    }
    next();
}

// ─── API Routes: Admin ──────────────────────────────────────

// Admin login
app.post('/api/admin/login', authLimiter, (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Sai mật khẩu' });
    }
    const token = uuidv4();
    adminSessions.set(token, { createdAt: Date.now() });
    res.json({ token });
});

// Admin logout
app.post('/api/admin/logout', adminAuth, (req, res) => {
    const token = req.headers['x-admin-token'];
    adminSessions.delete(token);
    res.json({ success: true });
});

// List all keys (admin view with decryption)
app.get('/api/admin/keys', adminAuth, (req, res) => {
    const keys = loadKeys();
    const decryptedKeys = keys.map(k => {
        try {
            return {
                id: k.id,
                pin: k.pin.slice(0, -4) + '****',
                gameKey: decrypt(k.encryptedGameKey),
                memo: decrypt(k.encryptedMemo),
                redeemed: k.redeemed,
                redeemedBy: k.redeemedBy || null,
                redeemedAt: k.redeemedAt || null,
                createdAt: k.createdAt,
            };
        } catch {
            return {
                id: k.id,
                pin: k.pin.slice(0, -4) + '****',
                gameKey: '[Lỗi giải mã]',
                memo: '[Lỗi giải mã]',
                redeemed: k.redeemed,
                createdAt: k.createdAt,
            };
        }
    });
    res.json(decryptedKeys);
});

// Upload a new key
app.post('/api/admin/keys', adminAuth, (req, res) => {
    const { gameKey, memo } = req.body;
    if (!gameKey || !memo) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ game key và ghi chú' });
    }

    const pin = generatePin();
    const privateCode = generatePrivateCode();

    const entry = {
        id: uuidv4(),
        pin: pin,
        encryptedPrivateCode: encrypt(privateCode),
        encryptedGameKey: encrypt(gameKey),
        encryptedMemo: encrypt(memo),
        redeemed: false,
        redeemedBy: null,
        redeemedAt: null,
        createdAt: new Date().toISOString(),
    };

    const keys = loadKeys();
    keys.push(entry);
    saveKeys(keys);

    res.json({
        id: entry.id,
        pin: pin,
        message: 'Đã tạo thành công. Chia sẻ mã PIN cho người nhận.',
    });
});

// Delete a key
app.delete('/api/admin/keys/:id', adminAuth, (req, res) => {
    let keys = loadKeys();
    const idx = keys.findIndex(k => k.id === req.params.id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Không tìm thấy' });
    }
    keys.splice(idx, 1);
    saveKeys(keys);
    res.json({ success: true });
});

// ─── API Routes: User Redeem ────────────────────────────────

// Step 1: Lookup by PIN
app.post('/api/redeem/lookup', redeemLimiter, (req, res) => {
    const { pin } = req.body;
    if (!pin) {
        return res.status(400).json({ error: 'Vui lòng nhập mã PIN' });
    }

    const keys = loadKeys();
    const entry = keys.find(k => k.pin === pin);
    if (!entry) {
        return res.status(404).json({ error: 'Mã PIN không hợp lệ' });
    }
    if (entry.redeemed) {
        return res.status(400).json({ error: 'Mã key này đã được sử dụng' });
    }

    res.json({
        found: true,
        message: 'Đã tìm thấy mã key. Vui lòng nhập email để nhận mã xác thực.',
    });
});

// Step 2: Send private code to email
app.post('/api/redeem/send-code', redeemLimiter, async (req, res) => {
    const { pin, email } = req.body;
    if (!pin || !email) {
        return res.status(400).json({ error: 'Vui lòng nhập mã PIN và email' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const keys = loadKeys();
    const entry = keys.find(k => k.pin === pin);
    if (!entry) {
        return res.status(404).json({ error: 'Mã PIN không hợp lệ' });
    }
    if (entry.redeemed) {
        return res.status(400).json({ error: 'Mã key này đã được sử dụng' });
    }

    // Rate limit: max 3 email sends per PIN per 10 minutes
    const rateLimitKey = pin;
    const now = Date.now();
    if (emailRateLimit.has(rateLimitKey)) {
        const rl = emailRateLimit.get(rateLimitKey);
        if (now - rl.timestamp < 600000 && rl.attempts >= 3) {
            return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.' });
        }
        if (now - rl.timestamp >= 600000) {
            emailRateLimit.set(rateLimitKey, { email, timestamp: now, attempts: 1 });
        } else {
            rl.attempts++;
            rl.email = email;
        }
    } else {
        emailRateLimit.set(rateLimitKey, { email, timestamp: now, attempts: 1 });
    }

    try {
        const privateCode = decrypt(entry.encryptedPrivateCode);
        await sendPrivateCodeEmail(email, privateCode, pin);
        res.json({ success: true, message: 'Mã xác thực đã được gửi đến email của bạn.' });
    } catch (err) {
        console.error('Email send error:', err);
        res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại sau.' });
    }
});

// Step 3: Verify PIN + private code → reveal key
app.post('/api/redeem/verify', redeemLimiter, (req, res) => {
    const { pin, privateCode } = req.body;
    if (!pin || !privateCode) {
        return res.status(400).json({ error: 'Vui lòng nhập mã PIN và mã xác thực' });
    }

    const keys = loadKeys();
    const entry = keys.find(k => k.pin === pin);
    if (!entry) {
        return res.status(404).json({ error: 'Mã PIN không hợp lệ' });
    }
    if (entry.redeemed) {
        return res.status(400).json({ error: 'Mã key này đã được sử dụng' });
    }

    // Verify private code
    const storedCode = decrypt(entry.encryptedPrivateCode);
    if (privateCode !== storedCode) {
        return res.status(401).json({ error: 'Mã xác thực không đúng' });
    }

    // Mark as redeemed
    entry.redeemed = true;
    entry.redeemedAt = new Date().toISOString();

    // Save the email from rate limit cache if available
    const rl = emailRateLimit.get(pin);
    if (rl) {
        entry.redeemedBy = rl.email;
    }

    saveKeys(keys);

    // Return decrypted game key and memo
    try {
        res.json({
            gameKey: decrypt(entry.encryptedGameKey),
            memo: decrypt(entry.encryptedMemo),
        });
    } catch {
        res.status(500).json({ error: 'Lỗi giải mã dữ liệu' });
    }
});

// ─── SPA Fallback ────────────────────────────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🔐 nom safekey server running on http://localhost:${PORT}`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin.html`);
});
