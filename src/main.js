import { api } from "./api.js";

// DOM Elements
const toast = document.getElementById("toast");

// Toast Helper
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.style.borderLeftColor = type === "error" ? "#ef4444" : "#6366f1";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// ----- Saved Sheets Management -----
const SAVED_SHEETS_KEY = "mayogu_saved_sheets";

function getSavedSheets() {
  try {
    const data = localStorage.getItem(SAVED_SHEETS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveSheets(sheets) {
  localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(sheets));
}

function renderSavedSheets() {
  const select = document.getElementById("saved-sheets-select");
  const sheets = getSavedSheets();
  select.innerHTML = '<option value="">-- Chọn Sheet đã lưu --</option>';
  sheets.forEach((sheet, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = sheet.name;
    select.appendChild(opt);
  });
}

document
  .getElementById("saved-sheets-select")
  .addEventListener("change", (e) => {
    const index = e.target.value;
    if (index === "") {
      document.getElementById("gsheet-url").value = "";
      document.getElementById("gsheet-gas-url").value = "";
      document.getElementById("save-sheet-name").value = "";
    } else {
      const sheets = getSavedSheets();
      const sheet = sheets[index];
      if (sheet) {
        document.getElementById("gsheet-url").value = sheet.url || "";
        document.getElementById("gsheet-gas-url").value = sheet.gasUrl || "";
        document.getElementById("save-sheet-name").value = sheet.name || "";
      }
    }
  });

document.getElementById("save-sheet-btn").addEventListener("click", () => {
  const name = document.getElementById("save-sheet-name").value.trim();
  const url = document.getElementById("gsheet-url").value.trim();
  const gasUrl = document.getElementById("gsheet-gas-url").value.trim();

  if (!name || !url) {
    return showToast("Vui lòng nhập Tên và Link Google Sheet để lưu", "error");
  }

  const sheets = getSavedSheets();
  const existingIndex = sheets.findIndex((s) => s.name === name);
  const newSheet = { name, url, gasUrl };

  if (existingIndex >= 0) {
    sheets[existingIndex] = newSheet;
  } else {
    sheets.push(newSheet);
  }

  saveSheets(sheets);
  renderSavedSheets();

  // Select the newly saved sheet
  const newIndex = getSavedSheets().findIndex((s) => s.name === name);
  document.getElementById("saved-sheets-select").value = newIndex;

  showToast("Đã lưu Sheet thành công!", "success");
});

document.getElementById("delete-sheet-btn").addEventListener("click", () => {
  const select = document.getElementById("saved-sheets-select");
  const index = select.value;
  if (index === "") return showToast("Vui lòng chọn Sheet để xóa", "error");

  const sheets = getSavedSheets();
  sheets.splice(index, 1);
  saveSheets(sheets);
  renderSavedSheets();

  document.getElementById("gsheet-url").value = "";
  document.getElementById("gsheet-gas-url").value = "";
  document.getElementById("save-sheet-name").value = "";
  showToast("Đã xóa Sheet!", "info");
});

// Initialize saved sheets
renderSavedSheets();

// ----- Email Distribution (Manual) -----
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
      const cleanedRaw = rawData.trim().replace(/,\s*([\]}])/g, "$1");
      distributions = JSON.parse(cleanedRaw);
      if (!Array.isArray(distributions)) {
        distributions = [distributions];
      }
    } catch (e) {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
      const foundEmails = rawData.match(emailRegex) || [];
      distributions = foundEmails.map((email) => ({
        email: email,
        quantity: 1,
      }));
    }

    if (!campaignId || !distributions.length) {
      return showToast(
        "Vui lòng nhập ID chiến dịch và danh sách Email",
        "error",
      );
    }

    let distributeAt = null;
    if (distTimeInput) distributeAt = new Date(distTimeInput).toISOString();

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

      document.getElementById("dist-emails").value = "";
      document.getElementById("dist-time").value = "";
      document.getElementById("dist-coming-soon-url").value = "";
    } catch (err) {
      showToast(err.message, "error");
    }
  });

// ----- Google Sheets Logic -----
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
    if (distTimeInput) distributeAt = new Date(distTimeInput).toISOString();

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

      gsheetData = [];
      document.getElementById("gsheet-preview-body").innerHTML = "";
      document.getElementById("gsheet-dist-time").value = "";
      document.getElementById("gsheet-coming-soon-url").value = "";
      document
        .getElementById("gsheet-preview-container")
        .classList.add("hidden");
      document.getElementById("gsheet-campaign-id").value = "";

      if (gasUrl && res.success.length > 0) {
        showToast("Đang thực hiện khóa ô và lưu vết...", "info");
        try {
          await fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ emails: res.success.map((s) => s.email) }),
          });
          showToast("Đã gửi lệnh lưu vết và khóa ô!", "success");
        } catch (gasErr) {
          showToast("Lỗi khi gọi Apps Script, nhưng vé đã được phát.", "error");
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

// ----- Sync Logic -----
document.getElementById("sync-btn").addEventListener("click", async () => {
  const sourceUrlsRaw = document
    .getElementById("sync-source-sheets")
    .value.trim();
  const gasUrl = document.getElementById("sync-gas-url").value.trim();

  if (!sourceUrlsRaw)
    return showToast("Vui lòng nhập Link các Sheet đã phát", "error");
  if (!gasUrl || !gasUrl.includes("script.google.com")) {
    return showToast(
      "Vui lòng nhập Link Google Apps Script hợp lệ của Sheet Gốc",
      "error",
    );
  }

  const urls = sourceUrlsRaw
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u);
  const sentEmailsMap = {};

  try {
    showToast("Đang tải và phân tích dữ liệu từ các sheet...", "info");
    document.getElementById("sync-btn").disabled = true;

    for (const url of urls) {
      const csvUrl = parseGoogleSheetUrl(url);
      const response = await fetch(csvUrl);
      if (!response.ok) {
        showToast(`Lỗi tải sheet: ${url.substring(0, 30)}... Bỏ qua.`, "error");
        continue;
      }
      const text = await response.text();
      const rawLines = text.split("\n");

      rawLines.slice(2).forEach((line) => {
        // Tách dòng bằng phẩy
        const rowData = line.split(",");
        const email = rowData[1] ? rowData[1].trim().toLowerCase() : "";
        if (!email) return;

        let status = "";

        // 1. Quét thẳng vào cột H (Index 7 của mảng)
        if (rowData[7] && rowData[7].toUpperCase().includes("SENT")) {
          status = rowData[7].trim();
        }
        // 2. Nếu không thấy ở cột H, quét toàn bộ dòng từ Cột C (Index 2) trở về sau để bắt chữ SENT
        else {
          for (let k = 2; k < rowData.length; k++) {
            if (rowData[k] && rowData[k].toUpperCase().includes("SENT")) {
              status = rowData[k].trim();
              break;
            }
          }
        }

        // 3. Dự phòng: Nếu mảng bị đứt đoạn không lặp tới được cột chứa dữ liệu, quét bằng Regex
        if (!status) {
          const sentMatch = line.match(/(SENT[^,]*)/i);
          if (sentMatch && sentMatch[1]) {
            status = sentMatch[1].trim();
          }
        }

        if (status) {
          // Xóa dấu nháy kép thừa nếu có
          sentEmailsMap[email] = status.replace(/"/g, "");
        }
      });
    }

    const emailCount = Object.keys(sentEmailsMap).length;
    if (emailCount === 0) {
      document.getElementById("sync-btn").disabled = false;
      return showToast("Không tìm thấy email nào có trạng thái SENT", "error");
    }

    showToast(
      `Tìm thấy ${emailCount} email gửi thành công. Đang gửi sang Sheet Gốc...`,
      "info",
    );

    // GỌI GAS
    await fetch(gasUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "sync", syncData: sentEmailsMap }), // action sync
    });

    showToast("Đã gửi lệnh đồng bộ sang Sheet Gốc thành công!", "success");
    document.getElementById("sync-source-sheets").value = "";
  } catch (e) {
    showToast("Lỗi đồng bộ: " + e.message, "error");
  } finally {
    document.getElementById("sync-btn").disabled = false;
  }
});
