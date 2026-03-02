const BASE_URL = "https://api.mayogu.com/content-service";
const ADMIN_TOKEN =
  "n7QLEXVhdqEqrqaVWinUpAPhIJyJihmT42w_uPGc79lOunanVUOsm8f3TWgjbU0vGNvtA0B3VuZotyY-WLjBBw";

// const BASE_URL = "http://192.168.0.165:3000/content-service";
// const ADMIN_TOKEN =
//   "n7QLEXVhdqEqrqaVWinUpAPhIJyJihmT42w_uPGc79lOunanVUOsm8f3TWgjbU0vGNvtA0B3VuZotyY-WLjBBw";
export const api = {
  async request(
    path,
    method = "GET",
    body = null,
    authToken = null,
    adminToken = null,
  ) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const finalAdminToken = (adminToken || ADMIN_TOKEN).trim();
    if (finalAdminToken) {
      headers["x-admin-token"] = finalAdminToken;
      console.log("Sending x-admin-token:", finalAdminToken);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Something went wrong");
    }
    return data;
  },

  // User APIs
  claimReferral(code, token) {
    return this.request("/gifts/claim/referral", "POST", { code }, token);
  },
  claimTask(campaignId, token) {
    return this.request("/gifts/claim/task", "POST", { campaignId }, token);
  },
  getMyTickets(token) {
    return this.request("/gifts/my-tickets", "GET", null, token);
  },

  // Admin APIs
  createCampaign(data, adminToken) {
    return this.request(
      "/gifts/admin/campaigns",
      "POST",
      data,
      null,
      adminToken,
    );
  },
  importInventory(campaignId, tickets, adminToken) {
    return this.request(
      "/gifts/admin/import",
      "POST",
      { campaignId, tickets },
      null,
      adminToken,
    );
  },
  distributeEmail(campaignId, distributions, adminToken) {
    return this.request(
      "/gifts/admin/distribute-email",
      "POST",
      { campaignId, distributions },
      null,
      adminToken,
    );
  },
};
