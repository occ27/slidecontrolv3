/**
 * SlideControl V3 — Validação e Registro de Token na Nuvem (slidecontrol.com.br)
 * Portado com paridade exata do SlideControl V2.
 */

if (!window.showToast) {
  window.showToast = function (msg, type = "info") {
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
      container.style.cssText = "position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:10px; pointer-events:none;";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgMap = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#00f0ff"
    };
    const iconMap = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ"
    };

    const bg = bgMap[type] || bgMap.info;
    const icon = iconMap[type] || iconMap.info;
    const textColor = type === "info" ? "#000000" : "#ffffff";

    toast.style.cssText = `
      background: ${bg};
      color: ${textColor};
      padding: 12px 20px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      max-width: 420px;
      line-height: 1.4;
    `;

    toast.innerHTML = `<span style="font-size:15px; flex-shrink:0;">${icon}</span><span>${msg}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 4000);
  };
}

const REG_API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8767" : "";

document.addEventListener("DOMContentLoaded", () => {
  checkRegistration();

  function showLoading(message) {
    const msgEl = document.getElementById("loading-message");
    const overlay = document.getElementById("loading-overlay");
    if (msgEl) msgEl.innerText = message;
    if (overlay) overlay.classList.remove("hidden");
  }

  function hideLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  const regForm = document.getElementById("registration-form");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("reg-email")?.value.trim() || "";
      const church_name = document.getElementById("reg-church")?.value.trim() || "";
      const city = document.getElementById("reg-city")?.value.trim() || "";
      const whatsapp = document.getElementById("reg-whatsapp")?.value.trim() || "";

      showLoading("Registrando sistema na nuvem...");

      try {
        const res = await fetch(`${REG_API_BASE}/api/desktop/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, church_name, city, whatsapp })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();

        if (data.status === "ok") {
          document.getElementById("registration-step-1")?.classList.add("hidden");
          document.getElementById("registration-step-2")?.classList.remove("hidden");
        } else {
          window.showToast(data.message || "Erro ao registrar.", "error");
        }
      } catch (err) {
        window.showToast("Erro de conexão: " + err.message, "error");
      } finally {
        hideLoading();
      }
    });
  }

  const verifyForm = document.getElementById("verify-form");
  if (verifyForm) {
    verifyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("reg-code")?.value.trim() || "";
      const email = document.getElementById("reg-email")?.value.trim() || "";

      showLoading("Verificando código de acesso...");

      try {
        const res = await fetch(`${REG_API_BASE}/api/desktop/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();

        if (data.status === "ok") {
          window.showToast("Sistema ativado com sucesso!", "success");
          document.getElementById("registration-overlay")?.classList.add("hidden");
        } else {
          window.showToast(data.message || "Código inválido.", "error");
        }
      } catch (err) {
        window.showToast("Erro de conexão: " + err.message, "error");
      } finally {
        hideLoading();
      }
    });
  }

  const btnResend = document.getElementById("btn-resend-code");
  if (btnResend) {
    btnResend.addEventListener("click", async () => {
      try {
        const res = await fetch(`${REG_API_BASE}/api/desktop/request-token-renewal`, { method: "POST" });
        const data = await res.json();
        window.showToast(data.message || "Código reenviado para seu e-mail.", "info");
      } catch (err) {
        window.showToast("Erro de conexão.", "error");
      }
    });
  }

  // Máscara de telefone WhatsApp
  const zapInput = document.getElementById("reg-whatsapp");
  if (zapInput) {
    zapInput.addEventListener("input", function (e) {
      let x = e.target.value.replace(/\D/g, "").match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
      e.target.value = !x[2] ? x[1] : "(" + x[1] + ") " + x[2] + (x[3] ? "-" + x[3] : "");
    });
  }
});

async function checkRegistration() {
  try {
    const res = await fetch(`${REG_API_BASE}/api/desktop/registration-status`);
    if (!res.ok) return;
    const data = await res.json();

    const overlay = document.getElementById("registration-overlay");
    if (!overlay) return;

    if (!data.is_registered || !data.token_valid) {
      overlay.classList.remove("hidden");

      if (data.email && document.getElementById("reg-email")) document.getElementById("reg-email").value = data.email;
      if (data.church_name && document.getElementById("reg-church")) document.getElementById("reg-church").value = data.church_name;
      if (data.city && document.getElementById("reg-city")) document.getElementById("reg-city").value = data.city;
      if (data.whatsapp && document.getElementById("reg-whatsapp")) document.getElementById("reg-whatsapp").value = data.whatsapp;

      if (data.is_registered && !data.token_valid) {
        document.getElementById("registration-step-1")?.classList.add("hidden");
        document.getElementById("registration-step-2")?.classList.remove("hidden");
        fetch(`${REG_API_BASE}/api/desktop/request-token-renewal`, { method: "POST" }).catch(() => {});
      }
    } else {
      overlay.classList.add("hidden");
    }
  } catch (err) {
    console.error("[Registration] Erro ao checar registro:", err);
  }
}
