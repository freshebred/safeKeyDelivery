// DOM Elements
const loginContainer = document.getElementById('login-container');
const adminContainer = document.getElementById('admin-container');
const loginAlert = document.getElementById('login-alert');
const adminAlert = document.getElementById('admin-alert');

const pwInput = document.getElementById('admin-pw');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

const btnCreate = document.getElementById('btn-create');
const btnRefresh = document.getElementById('btn-refresh');
const newGameKey = document.getElementById('new-game-key');
const newMemo = document.getElementById('new-memo');
const tbody = document.getElementById('keys-tbody');

// State
let token = localStorage.getItem('safekey_admin_token');

// Utils
function showLoginAlert(msg, type = 'error') {
    loginAlert.textContent = msg;
    loginAlert.className = `alert ${type}`;
    loginAlert.style.display = 'block';
}

function showAdminAlert(msg, type = 'success') {
    adminAlert.textContent = msg;
    adminAlert.className = `alert ${type}`;
    adminAlert.style.display = 'block';
    setTimeout(() => adminAlert.style.display = 'none', 3000);
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Check auth on load
if (token) {
    showAdminPanel();
}

function showAdminPanel() {
    loginContainer.style.display = 'none';
    adminContainer.style.display = 'block';
    fetchKeys();
}

function showLoginPanel() {
    loginContainer.style.display = 'block';
    adminContainer.style.display = 'none';
    localStorage.removeItem('safekey_admin_token');
    token = null;
    pwInput.value = '';
}

// ─── Auth ────────────────────────────────────────────────────────
btnLogin.addEventListener('click', async () => {
    const password = pwInput.value;
    if (!password) return showLoginAlert('Nhập mật khẩu!');

    setLoading(btnLogin, true);
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        token = data.token;
        localStorage.setItem('safekey_admin_token', token);
        showAdminPanel();

    } catch (err) {
        showLoginAlert(err.message);
    } finally {
        setLoading(btnLogin, false);
    }
});

btnLogout.addEventListener('click', async () => {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'x-admin-token': token }
        });
    } catch (e) { }
    showLoginPanel();
});

// ─── CRUD Keys ───────────────────────────────────────────────────
btnCreate.addEventListener('click', async () => {
    const gameKey = newGameKey.value.trim();
    const memo = newMemo.value.trim();

    if (!gameKey || !memo) {
        return showAdminAlert('Điền đủ game key và ghi chú!', 'error');
    }

    setLoading(btnCreate, true);
    try {
        const res = await fetch('/api/admin/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': token
            },
            body: JSON.stringify({ gameKey, memo })
        });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 401) return showLoginPanel();
            throw new Error(data.error);
        }

        showAdminAlert(`Tạo thành công! PIN: ${data.pin}`);
        newGameKey.value = '';
        newMemo.value = '';
        fetchKeys();

    } catch (err) {
        showAdminAlert(err.message, 'error');
    } finally {
        setLoading(btnCreate, false);
    }
});

btnRefresh.addEventListener('click', fetchKeys);

async function fetchKeys() {
    try {
        const res = await fetch('/api/admin/keys', {
            headers: { 'x-admin-token': token }
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error('unauth');
            throw new Error('Lỗi tải dữ liệu');
        }

        const keys = await res.json();
        renderKeys(keys);

    } catch (err) {
        if (err.message === 'unauth') showLoginPanel();
        else showAdminAlert(err.message, 'error');
    }
}

function renderKeys(keys) {
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Chưa có dữ liệu</td></tr>';
        return;
    }

    // Sort by createdAt desc
    keys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = keys.map(k => `
        <tr>
            <td><span class="mono" style="font-size: 16px;">${k.pin}</span></td>
            <td><span class="mono" style="color: #10b981;">${k.gameKey}</span></td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${k.memo}">${k.memo}</td>
            <td>
                ${k.redeemed
            ? `<span class="status-badge status-redeemed">Đã sử dụng</span>`
            : `<span class="status-badge status-available">Sẵn sàng</span>`
        }
            </td>
            <td>${k.redeemedBy ? k.redeemedBy : '-'}</td>
            <td>
                <button class="btn btn-danger action-btn" onclick="deleteKey('${k.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

// Global func for onclick map
window.deleteKey = async function (id) {
    if (!confirm('Bạn có chắc chắn muốn xóa key này?')) return;

    try {
        const res = await fetch(`/api/admin/keys/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': token }
        });

        if (!res.ok) {
            if (res.status === 401) return showLoginPanel();
            throw new Error('Lỗi xóa key');
        }

        showAdminAlert('Đã xóa thành công');
        fetchKeys();

    } catch (err) {
        showAdminAlert(err.message, 'error');
    }
};
