import { api } from "./api.js";

// DOM Elements
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");
const toast = document.getElementById("toast");
const userTokenInput = document.getElementById("user-token-input");

// Tab Switching
tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    contents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    document
      .getElementById(`${btn.dataset.tab}-section`)
      .classList.add("active");
  });
});

// Toast Helper
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.style.borderLeftColor = type === "error" ? "#ef4444" : "#6366f1";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// User Actions
document
  .getElementById("claim-referral-btn")
  .addEventListener("click", async () => {
    const code = document.getElementById("referral-code").value;
    const token = userTokenInput.value.trim();
    if (!token) return showToast("Vui lòng nhập Bearer Token trước", "error");
    if (!code) return showToast("Vui lòng nhập mã giới thiệu", "error");

    try {
      const res = await api.claimReferral(code, token);
      showToast(res.message || "Nhận vé thành công!");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

document
  .getElementById("claim-task-btn")
  .addEventListener("click", async () => {
    const campaignId = document.getElementById("task-campaign-id").value;
    const token = userTokenInput.value.trim();
    if (!token) return showToast("Vui lòng nhập Bearer Token trước", "error");
    if (!campaignId) return showToast("Vui lòng nhập ID chiến dịch", "error");

    try {
      const res = await api.claimTask(campaignId, token);
      showToast(res.message || "Nhận vé thành công!");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

document
  .getElementById("refresh-tickets-btn")
  .addEventListener("click", loadTickets);

async function loadTickets() {
  const token = userTokenInput.value.trim();
  if (!token) {
    document.getElementById("ticket-list").innerHTML =
      '<p class="placeholder">Vui lòng nhập Bearer Token để xem vé.</p>';
    return;
  }

  const list = document.getElementById("ticket-list");
  list.innerHTML = '<p class="placeholder">Đang tải...</p>';

  try {
    const tickets = await api.getMyTickets(token);
    list.innerHTML = tickets.length
      ? ""
      : '<p class="placeholder">Bạn chưa có vé nào.</p>';

    tickets.forEach((ticket) => {
      const el = document.createElement("div");
      el.className = "ticket-card";
      el.innerHTML = `
                <img src="${ticket.imageUrl || "https://via.placeholder.com/200x120?text=Vé"}" alt="Vé">
                <h4>${ticket.ticketTypeName}</h4>
                <div class="status-badge status-valid">${ticket.status === "VALID" ? "HỢP LỆ" : ticket.status}</div>
                <p style="margin: 5px 0; font-family: monospace;">${ticket.ticketCode}</p>
            `;
      list.appendChild(el);
    });
  } catch (err) {
    list.innerHTML = `<p class="placeholder error">${err.message}</p>`;
  }
}

// Admin Actions
document
  .getElementById("create-campaign-btn")
  .addEventListener("click", async () => {
    const adminToken = document.getElementById("admin-token").value;
    const data = {
      name: document.getElementById("campaign-name").value,
      type: document.getElementById("campaign-type").value,
      targetEventId: document.getElementById("target-event-id").value,
      ticketTypeId: document.getElementById("ticket-type-id").value,
      referralCode:
        document.getElementById("referral-code-input").value || null,
      startDate: document.getElementById("start-date").value || null,
      endDate: document.getElementById("end-date").value || null,
      totalQuantity: parseInt(document.getElementById("total-quantity").value),
    };

    if (
      !data.name ||
      !data.targetEventId ||
      !data.ticketTypeId ||
      isNaN(data.totalQuantity)
    ) {
      return showToast("Vui lòng điền đầy đủ các thông tin bắt buộc", "error");
    }

    try {
      const res = await api.createCampaign(data, adminToken);
      showToast("Tạo chiến dịch thành công!");
      console.log(res);
      // Clear form
      document.getElementById("campaign-name").value = "";
      document.getElementById("target-event-id").value = "";
      document.getElementById("ticket-type-id").value = "";
      document.getElementById("referral-code-input").value = "";
      document.getElementById("start-date").value = "";
      document.getElementById("end-date").value = "";
      document.getElementById("total-quantity").value = "";
    } catch (err) {
      showToast(err.message, "error");
    }
  });

document
  .getElementById("distribute-email-btn")
  .addEventListener("click", async () => {
    const adminToken = document.getElementById("admin-token").value;
    const campaignId = document.getElementById("dist-campaign-id").value;
    const rawData = document.getElementById("dist-emails").value;
    const distTimeInput = document.getElementById("dist-time").value;
    const comingSoonUrl = document.getElementById("dist-coming-soon-url").value;

    let distributions;
    try {
      // Dọn dẹp dấu phẩy dư ở cuối (nhẹ nhàng hơn để không phá vỡ format)
      const cleanedRaw = rawData.trim().replace(/,\s*([\]}])/g, "$1");
      distributions = JSON.parse(cleanedRaw);

      // Nếu user nhập 1 object đơn lẻ {email: ...}, tự bọc vào mảng
      if (!Array.isArray(distributions)) {
        distributions = [distributions];
      }
    } catch (e) {
      // Fallback: Quét bằng Regex để trích xuất các địa chỉ email có trong văn bản thô
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
      const foundEmails = rawData.match(emailRegex) || [];

      distributions = foundEmails.map((email) => ({
        email: email,
        quantity: 1, // Fallback mặc định mỗi email 1 vé
      }));
    }

    if (!campaignId || !distributions.length) {
      return showToast(
        "Vui lòng nhập ID chiến dịch và danh sách Email",
        "error",
      );
    }

    let distributeAt = null;
    if (distTimeInput) {
      distributeAt = new Date(distTimeInput).toISOString();
    }

    try {
      const res = await api.distributeEmail(
        campaignId,
        distributions,
        adminToken,
        distributeAt,
        comingSoonUrl || null,
      );
      showToast(
        `Đã phát thành công cho ${res.success.length} user, thất bại ${res.failed.length}`,
      );
      console.log(res);
      // Xóa form sau khi public thành công nếu muốn (Tùy chọn)
      document.getElementById("dist-emails").value = "";
      document.getElementById("dist-time").value = "";
      document.getElementById("dist-coming-soon-url").value = "";
    } catch (err) {
      showToast(err.message, "error");
    }
  });

document
  .getElementById("import-inventory-btn")
  .addEventListener("click", async () => {
    const adminToken = document.getElementById("admin-token").value;
    const campaignId = document.getElementById("import-campaign-id").value;
    let tickets;
    try {
      tickets = JSON.parse(document.getElementById("import-data").value);
    } catch (e) {
      return showToast("Định dạng JSON không hợp lệ", "error");
    }

    try {
      await api.importInventory(campaignId, tickets, adminToken);
      showToast("Nhập kho thành công!");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

// Google Sheets Logic
let gsheetData = [];

function parseGoogleSheetUrl(url) {
  try {
    const spreadsheetId = url.match(/\/d\/([^/]+)/)[1];
    let gid = "0";
    const gidMatch = url.match(/[#&]gid=([^&]+)/);
    if (gidMatch) gid = gidMatch[1];
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  } catch (e) {
    throw new Error("Link Google Sheet không hợp lệ");
  }
}

document
  .getElementById("load-gsheet-btn")
  .addEventListener("click", async () => {
    const url = document.getElementById("gsheet-url").value.trim();
    if (!url) return showToast("Vui lòng nhập link Google Sheet", "error");

    try {
      const csvUrl = parseGoogleSheetUrl(url);
      const response = await fetch(csvUrl);
      if (!response.ok)
        throw new Error(
          "Không thể tải dữ liệu. Hãy đảm bảo sheet ở chế độ công khai.",
        );

      const text = await response.text();
      const rows = text.split("\n").map((row) => row.split(","));

      // Parsing logic: Skip first 2 header rows
      // Column B (index 1) = Email, Column F (index 5) or G (index 6) = Quantity, Status follows
      gsheetData = rows
        .slice(2)
        .filter((row) => {
          const email = row[1] ? row[1].trim() : "";
          const status =
            (row[7] ? row[7].trim() : "") || (row[6] ? row[6].trim() : "");
          return email.includes("@") && !status.includes("SENT");
        })
        .map((row) => ({
          email: row[1].trim(),
          quantity: parseInt(row[5]) || parseInt(row[6]) || 1,
        }));

      if (gsheetData.length === 0)
        throw new Error(
          "Không tìm thấy dữ liệu mới cần phát (tất cả đã SENT hoặc trống).",
        );

      // Render Preview
      const tbody = document.getElementById("gsheet-preview-body");
      tbody.innerHTML = "";
      gsheetData.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">${item.email}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">${item.quantity}</td>
      `;
        tbody.appendChild(tr);
      });

      document
        .getElementById("gsheet-preview-container")
        .classList.remove("hidden");
      showToast(`Đã tải ${gsheetData.length} dòng dữ liệu`);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

document
  .getElementById("gsheet-distribute-btn")
  .addEventListener("click", async () => {
    const adminToken = document.getElementById("admin-token").value;
    const campaignId = document.getElementById("gsheet-campaign-id").value;
    const distTimeInput = document.getElementById("gsheet-dist-time").value;
    const comingSoonUrl = document.getElementById(
      "gsheet-coming-soon-url",
    ).value;

    if (!campaignId) return showToast("Vui lòng nhập ID chiến dịch", "error");
    if (gsheetData.length === 0)
      return showToast("Không có dữ liệu để phát", "error");

    const gasUrl = document.getElementById("gsheet-gas-url").value.trim();
    if (gasUrl && !gasUrl.includes("script.google.com")) {
      return showToast(
        "Link Apps Script không chính xác (Phải là link Web App của script.google.com)",
        "error",
      );
    }

    let distributeAt = null;
    if (distTimeInput) {
      distributeAt = new Date(distTimeInput).toISOString();
    }

    try {
      const res = await api.distributeEmail(
        campaignId,
        gsheetData,
        adminToken,
        distributeAt,
        comingSoonUrl || null,
      );
      showToast(
        `Đã phát thành công cho ${res.success.length} user, thất bại ${res.failed.length}`,
      );
      console.log(res);

      // Reset UI after success
      gsheetData = [];
      document.getElementById("gsheet-preview-body").innerHTML = "";
      document.getElementById("gsheet-dist-time").value = "";
      document.getElementById("gsheet-coming-soon-url").value = "";
      document
        .getElementById("gsheet-preview-container")
        .classList.add("hidden");
      document.getElementById("gsheet-campaign-id").value = "";

      // Post to Google Apps Script for Locking & Logging
      const gasUrl = document.getElementById("gsheet-gas-url").value.trim();
      if (gasUrl && res.success.length > 0) {
        showToast("Đang thực hiện khóa ô và lưu vết...", "info");
        try {
          await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" }, // Dùng text/plain để tránh lỗi CORS preflight
            body: JSON.stringify({
              emails: res.success.map((s) => s.email),
            }),
          });
          showToast("Đã gửi lệnh lưu vết và khóa ô!", "success");
        } catch (gasErr) {
          console.error("GAS Error:", gasErr);
          showToast("Lỗi khi gọi Apps Script, nhưng vé đã được phát.", "error");
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

// Initial message
document.getElementById("ticket-list").innerHTML =
  '<p class="placeholder">Vui lòng nhập Bearer Token để xem vé.</p>';
