let currentSitekeyId = null;
let currentSecretId = null;
let currentToken = null;
let widgetId = null;

const sitekeySelect = document.getElementById("sitekey-select");
const secretSelect = document.getElementById("secret-select");
const sitekeyValue = document.getElementById("sitekey-value");
const secretValue = document.getElementById("secret-value");
const widgetArea = document.getElementById("widget-area");
const tokenBlock = document.getElementById("token-block");
const tokenValue = document.getElementById("token-value");
const verifyBtn = document.getElementById("verify-btn");
const resultArea = document.getElementById("result-area");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const invisibleNotice = document.getElementById("invisible-notice");

function refreshIcons() {
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function setStatus(text, state) {
    statusText.textContent = text;
    statusBar.classList.remove("active", "done", "error");
    if (state) statusBar.classList.add(state);
}

function isInvisible(sitekeyId) {
    return window.SITEKEYS[sitekeyId]?.type === "Invisible";
}

document.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const id = btn.dataset.scenario;
        if (id === "custom") {
            applyConfig(null, null);
            setStatus("Pick a sitekey on the left to start.", "active");
            return;
        }

        const scenario = window.SCENARIOS[id];
        applyConfig(scenario.sitekey, scenario.secret);
        setStatus(`Scenario loaded: "${scenario.title}". Complete the widget to continue.`, "active");
    });
});

function applyConfig(sitekeyId, secretId) {
    sitekeySelect.value = sitekeyId || "";
    secretSelect.value = secretId || "";

    if (sitekeyId) handleSitekeyChange(sitekeyId);
    else clearSitekey();

    if (secretId) handleSecretChange(secretId);
    else clearSecret();
}

sitekeySelect.addEventListener("change", () => {
    handleSitekeyChange(sitekeySelect.value);
});

secretSelect.addEventListener("change", () => {
    handleSecretChange(secretSelect.value);
});

function handleSitekeyChange(id) {
    if (!id || !window.SITEKEYS[id]) {
        clearSitekey();
        return;
    }

    currentSitekeyId = id;
    currentToken = null;

    sitekeyValue.textContent = window.SITEKEYS[id].key;
    sitekeyValue.style.display = "block";

    widgetArea.style.display = "flex";
    tokenBlock.style.display = "none";
    resultArea.style.display = "none";
    verifyBtn.disabled = true;

    renderWidget(window.SITEKEYS[id].key, isInvisible(id));

    setStatus(isInvisible(id)
        ? "Invisible widget will auto-generate a token in a moment."
        : "Complete the widget to generate a token.", "active");
}

function clearSitekey() {
    currentSitekeyId = null;
    currentToken = null;
    sitekeyValue.style.display = "none";
    widgetArea.style.display = "none";
    tokenBlock.style.display = "none";
    resultArea.style.display = "none";
    verifyBtn.disabled = true;
    if (widgetId !== null) {
        try { turnstile.remove(widgetId); } catch (e) {}
        widgetId = null;
    }
}

function handleSecretChange(id) {
    if (!id || !window.SECRETS[id]) {
        clearSecret();
        return;
    }

    currentSecretId = id;
    secretValue.textContent = window.SECRETS[id].key;
    secretValue.style.display = "block";

    updateVerifyButton();
}

function clearSecret() {
    currentSecretId = null;
    secretValue.style.display = "none";
    updateVerifyButton();
}

function updateVerifyButton() {
    verifyBtn.disabled = !(currentToken && currentSecretId);

    if (currentToken && currentSecretId) {
        setStatus("Ready to verify. Click the button on the right.", "active");
    } else if (currentToken && !currentSecretId) {
        setStatus("Token generated. Now pick a secret key on the right.", "active");
    }
}

function renderWidget(siteKey, invisible) {
    const container = document.getElementById("turnstile-container");
    container.innerHTML = "";

    if (typeof turnstile === "undefined") {
        setTimeout(() => renderWidget(siteKey, invisible), 200);
        return;
    }

    if (widgetId !== null) {
        try { turnstile.remove(widgetId); } catch (e) {}
        widgetId = null;
    }

    invisibleNotice.style.display = invisible ? "flex" : "none";

    const options = {
        sitekey: siteKey,
        theme: "light",
        callback: (token) => {
            currentToken = token;
            tokenValue.textContent = token;
            tokenBlock.style.display = "flex";
            updateVerifyButton();
            refreshIcons();
        },
        "error-callback": () => {
            setStatus("Widget hit an error. Try a different sitekey.", "error");
        }
    };

    if (invisible) options.size = "invisible";

    widgetId = turnstile.render(container, options);
    refreshIcons();
}

verifyBtn.addEventListener("click", async () => {
    if (!currentToken || !currentSecretId) return;

    verifyBtn.disabled = true;
    verifyBtn.querySelector("span").textContent = "Verifying...";
    setStatus("Calling Cloudflare /siteverify...", "active");

    try {
        const res = await fetch("/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: currentToken,
                secret_id: currentSecretId
            })
        });
        const result = await res.json();
        showResult(result);
    } catch (e) {
        setStatus("Network error reaching the server.", "error");
    } finally {
        verifyBtn.disabled = !(currentToken && currentSecretId);
        verifyBtn.querySelector("span").textContent = "Verify with Cloudflare";
    }
});

function showResult(result) {
    const status = document.getElementById("result-status");
    const summary = document.getElementById("result-summary");
    const json = document.getElementById("result-json");

    resultArea.style.display = "flex";

    if (result.success) {
        status.className = "success";
        status.innerHTML = `<i data-lucide="check-circle-2"></i><span>Token accepted</span>`;
        summary.innerHTML = buildSuccessSummary();
        setStatus("Verification complete — token is valid.", "done");
    } else {
        status.className = "fail";
        status.innerHTML = `<i data-lucide="x-circle"></i><span>Token rejected</span>`;
        summary.innerHTML = buildFailSummary(result.raw_response);
        setStatus("Verification complete — token rejected.", "error");
    }

    json.textContent = JSON.stringify(result.raw_response, null, 2);
    refreshIcons();
}

function buildSuccessSummary() {
    return `<strong>What just happened:</strong> The dummy token <code>XXXX.DUMMY.TOKEN.XXXX</code> was sent to Cloudflare along with the secret key. The secret is configured to always pass, so Cloudflare returned <code>success: true</code>.`;
}

function buildFailSummary(raw) {
    const codes = raw?.["error-codes"] || [];
    if (codes.length === 0) {
        return `<strong>What just happened:</strong> Cloudflare rejected the token but did not return any error codes.`;
    }

    const explanations = codes.map(c => {
        const desc = window.ERROR_CODES[c] || "Unknown error code.";
        return `<div style="margin-top:0.4rem;"><code>${c}</code> — ${desc}</div>`;
    }).join("");

    let context = "";
    if (codes.includes("timeout-or-duplicate")) {
        context = "The secret you picked simulates a token that has already been redeemed. Cloudflare rejects duplicate submissions to prevent replay attacks.";
    } else if (codes.includes("invalid-input-response")) {
        context = "The secret you picked does not match the sitekey used to generate the token, so Cloudflare considers it invalid.";
    } else {
        context = "Cloudflare returned the following error codes for this combination:";
    }

    return `<strong>What just happened:</strong> ${context}${explanations}`;
}

setStatus("Pick a scenario to begin.", null);