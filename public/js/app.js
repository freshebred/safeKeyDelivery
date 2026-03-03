// State
let currentPin = '';
let currentEmail = '';

// DOM Elements
const alertBox = document.getElementById('alert-box');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const step4 = document.getElementById('step-4');

const pinInput = document.getElementById('pin');
const emailInput = document.getElementById('email');
const codeInput = document.getElementById('private-code');

const btnNext1 = document.getElementById('btn-next-1');
const btnNext2 = document.getElementById('btn-next-2');
const btnReveal = document.getElementById('btn-reveal');
const btnBack1 = document.getElementById('btn-back-1');
const btnBack2 = document.getElementById('btn-back-2');

const revealedKey = document.getElementById('revealed-key');
const revealedMemo = document.getElementById('revealed-memo');
const copyKeyBtn = document.getElementById('btn-copy-key');
const copyMemoBtn = document.getElementById('btn-copy-memo');

// Utils
function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    setTimeout(() => {
        alertBox.style.display = 'none';
        alertBox.className = 'alert';
    }, 5000);
}

function clearAlert() {
    alertBox.style.display = 'none';
    alertBox.className = 'alert';
}

function switchStep(from, to) {
    from.classList.remove('active');
    to.classList.add('active');
    clearAlert();
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Format PIN input
pinInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
    if (val.length > 4) {
        val = val.substring(0, 4) + '-' + val.substring(4, 8);
    }
    e.target.value = val;
});

// Step 1: Lookup PIN
btnNext1.addEventListener('click', async () => {
    const pin = pinInput.value.trim();
    if (!pin) return showAlert('Vui lòng nhập mã PIN');

    setLoading(btnNext1, true);
    try {
        const res = await fetch('/api/redeem/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Lỗi hệ thống');

        currentPin = pin;
        switchStep(step1, step2);

    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(btnNext1, false);
    }
});

// Step 2: Send Email
btnNext2.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) return showAlert('Vui lòng nhập email');

    setLoading(btnNext2, true);
    try {
        const res = await fetch('/api/redeem/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin, email })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Lỗi hệ thống');

        currentEmail = email;
        showAlert(data.message, 'success');
        switchStep(step2, step3);

    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(btnNext2, false);
    }
});

// Step 3: Verify and Reveal
btnReveal.addEventListener('click', async () => {
    const privateCode = codeInput.value.trim();
    if (!privateCode) return showAlert('Vui lòng nhập mã xác thực');

    setLoading(btnReveal, true);
    try {
        const res = await fetch('/api/redeem/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin, privateCode })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Lỗi mã xác thực');

        // Show data
        revealedKey.textContent = data.gameKey;
        revealedMemo.textContent = data.memo;
        switchStep(step3, step4);

    } catch (err) {
        showAlert(err.message);
    } finally {
        setLoading(btnReveal, false);
    }
});

// Back buttons
btnBack1.addEventListener('click', () => switchStep(step2, step1));
btnBack2.addEventListener('click', () => switchStep(step3, step2));

// Copy functionalities
copyKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(revealedKey.textContent);
    copyKeyBtn.textContent = 'Đã Copy!';
    setTimeout(() => copyKeyBtn.textContent = 'Copy', 2000);
});

copyMemoBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(revealedMemo.textContent);
    copyMemoBtn.textContent = 'Đã Copy!';
    setTimeout(() => copyMemoBtn.textContent = 'Copy', 2000);
});

// ─── Security: Screen Blur on Visibility / Blur ─────────────────────────
// This activates the .is-hidden class on body, which interacts with CSS
// to show "ĐÃ BỊ CHE KHUẤT" and blur the text

function hideSecrets() {
    if (step4.classList.contains('active')) {
        document.body.classList.add('is-hidden');
    }
}

function showSecrets() {
    document.body.classList.remove('is-hidden');
}

// Tab changed or window minimized
document.addEventListener('visibilitychange', () => {
    if (document.hidden) hideSecrets();
    else showSecrets();
});

// Window lost focus (like ALT+TAB or opening snipping tool)
window.addEventListener('blur', hideSecrets);
window.addEventListener('focus', showSecrets);

// Disable print screen via keyboard intercept if possible,
// but mostly rely on @media print in CSS + blur event.
window.addEventListener('keyup', (e) => {
    if (e.key == 'PrintScreen') {
        navigator.clipboard.writeText(''); // Attempt to clear clipboard
        hideSecrets();
        showAlert('Hành động không cho phép.', 'error');
        setTimeout(showSecrets, 2000);
    }
});

// Prevent right click context menu on step 4
document.addEventListener('contextmenu', (e) => {
    if (step4.classList.contains('active')) {
        e.preventDefault();
    }
});
