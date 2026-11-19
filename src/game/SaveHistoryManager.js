import { GAME_CONFIG } from "./config.js";

const GAME_ID = "bien_gioi_thang_tien_vn";
const SCHEMA_VERSION_STR = "1.0.0";

export class SaveHistoryManager {
  constructor() {
    this.data = this.load();
  }

  _createDefaultData() {
    return {
      game_id: GAME_ID,
      schema_version: SCHEMA_VERSION_STR,
      lastUpdated: new Date().toISOString(),
      money: GAME_CONFIG.STORAGE.INITIAL_MONEY,
      maxReputation: GAME_CONFIG.STORAGE.INITIAL_REPUTATION,
      upgrades: {
        engine: 1,
        fuelTank: 1,
        suspension: 1,
      },
      unlockedRoutes: [1],
      tripHistory: [],
    };
  }

  /**
   * Thuật toán băm DJB2 tạo mã kiểm tra toàn vẹn dữ liệu hồ sơ tài xế
   */
  computeDJB2Checksum(payload) {
    const canonical = JSON.stringify({
      game_id: GAME_ID,
      schema_version: SCHEMA_VERSION_STR,
      lastUpdated: payload.lastUpdated,
      money: payload.money,
      maxReputation: payload.maxReputation,
      upgrades: {
        engine: payload.upgrades.engine,
        fuelTank: payload.upgrades.fuelTank,
        suspension: payload.upgrades.suspension,
      },
      unlockedRoutes: payload.unlockedRoutes,
      tripHistory: payload.tripHistory,
    });

    let hash = 5381;
    for (let i = 0; i < canonical.length; i++) {
      hash = ((hash << 5) + hash + canonical.charCodeAt(i)) >>> 0;
    }
    return `djb2_${hash.toString(16).padStart(8, "0")}`;
  }

  detectPlatform() {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "Mobile (Android)";
    if (/iPad|iPhone|iPod/i.test(ua)) return "Mobile (iOS)";
    if (/Macintosh|Mac OS X/i.test(ua)) return "PC (macOS)";
    if (/Windows/i.test(ua)) return "PC (Windows)";
    return "PC (Web)";
  }

  load() {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.STORAGE.KEY);
      if (!raw) return this._createDefaultData();
      const parsed = JSON.parse(raw);
      return this._normalize(parsed);
    } catch {
      return this._createDefaultData();
    }
  }

  _normalize(raw) {
    const def = this._createDefaultData();
    if (!raw || typeof raw !== "object") return def;

    const clampLvl = (v) =>
      Math.min(GAME_CONFIG.UPGRADES.MAX_LEVEL, Math.max(1, Math.floor(Number(v) || 1)));

    const unlocked = Array.isArray(raw.unlockedRoutes)
      ? Array.from(new Set(raw.unlockedRoutes.map((n) => Number(n)).filter((n) => n >= 1 && n <= 3)))
      : [1];
    if (!unlocked.includes(1)) unlocked.unshift(1);
    unlocked.sort((a, b) => a - b);

    const history = Array.isArray(raw.tripHistory)
      ? raw.tripHistory
          .filter((item) => item && typeof item === "object")
          .slice(0, GAME_CONFIG.STORAGE.MAX_TRIP_HISTORY)
      : [];

    return {
      game_id: GAME_ID,
      schema_version: SCHEMA_VERSION_STR,
      lastUpdated: typeof raw.lastUpdated === "string" ? raw.lastUpdated : new Date().toISOString(),
      money: Math.max(0, Math.round(Number(raw.money) || 0)),
      maxReputation: Math.max(0, Math.round(Number(raw.maxReputation) || GAME_CONFIG.STORAGE.INITIAL_REPUTATION)),
      upgrades: {
        engine: clampLvl(raw.upgrades?.engine),
        fuelTank: clampLvl(raw.upgrades?.fuelTank),
        suspension: clampLvl(raw.upgrades?.suspension),
      },
      unlockedRoutes: unlocked,
      tripHistory: history,
    };
  }

  save() {
    this.data.game_id = GAME_ID;
    this.data.schema_version = SCHEMA_VERSION_STR;
    this.data.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(GAME_CONFIG.STORAGE.KEY, JSON.stringify(this.data));
    } catch {
      // Bỏ qua nếu trình duyệt giới hạn dung lượng
    }
  }

  getMoney() {
    return this.data.money;
  }

  addMoney(delta) {
    this.data.money = Math.max(0, Math.round(this.data.money + delta));
    this.save();
  }

  adjustReputation(delta) {
    this.data.maxReputation = Math.max(0, Math.round(this.data.maxReputation + delta));
    this.save();
  }

  getUpgradeLevel(key) {
    return this.data.upgrades[key] || 1;
  }

  purchaseUpgrade(key) {
    const cfg = GAME_CONFIG.UPGRADES.ITEMS[key];
    if (!cfg) return { ok: false, reason: "Bộ phận không hợp lệ." };
    const current = this.getUpgradeLevel(key);
    if (current >= GAME_CONFIG.UPGRADES.MAX_LEVEL) {
      return { ok: false, reason: "Đã đạt cấp tối đa." };
    }
    const cost = cfg.costs[current - 1];
    if (this.data.money < cost) {
      return { ok: false, reason: "Không đủ tiền cước." };
    }
    this.data.money -= cost;
    this.data.upgrades[key] = current + 1;
    this.save();
    return { ok: true, newLevel: current + 1 };
  }

  unlockRoute(routeId) {
    if (!this.data.unlockedRoutes.includes(routeId) && routeId >= 1 && routeId <= 3) {
      this.data.unlockedRoutes.push(routeId);
      this.data.unlockedRoutes.sort((a, b) => a - b);
      this.save();
    }
  }

  recordTrip({ route, cargo, completionTimeSec, cargoIntegrity, rewardVND }) {
    const entry = {
      tripId: `trip_${Date.now()}_r${route.id}_${cargo.id}`,
      timestamp: new Date().toISOString(),
      routeId: route.id,
      routeName: route.name,
      cargoType: cargo.name,
      completionTimeSec: Math.round(completionTimeSec),
      cargoIntegrity: Math.round(cargoIntegrity),
      rewardVND: Math.round(rewardVND),
      platform: this.detectPlatform(),
    };

    this.data.tripHistory.unshift(entry);
    this.data.tripHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.data.tripHistory = this.data.tripHistory.slice(0, GAME_CONFIG.STORAGE.MAX_TRIP_HISTORY);
    this.save();
    return entry;
  }

  clearHistory() {
    this.data.tripHistory = [];
    this.save();
  }

  /**
   * Đóng gói & kích hoạt tải xuống file: hoso_taixe_vn_YYYYMMDD_HHMMSS.json
   * Hoạt động ổn định trên PC, Android Chrome và iOS Safari.
   */
  exportSaveFile() {
    this.save();
    const payload = {
      game_id: GAME_ID,
      schema_version: SCHEMA_VERSION_STR,
      lastUpdated: this.data.lastUpdated,
      money: this.data.money,
      maxReputation: this.data.maxReputation,
      upgrades: {
        engine: this.data.upgrades.engine,
        fuelTank: this.data.upgrades.fuelTank,
        suspension: this.data.upgrades.suspension,
      },
      unlockedRoutes: [...this.data.unlockedRoutes],
      tripHistory: [...this.data.tripHistory],
    };

    const exportBundle = {
      ...payload,
      checksum: this.computeDJB2Checksum(payload),
    };

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `hoso_taixe_vn_${stamp}.json`;

    const jsonStr = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);

    return filename;
  }

  /**
   * Kiểm tra hợp lệ game_id, schema_version, mã DJB2 checksum và gộp thông minh (MERGE)
   */
  importAndMerge(jsonText) {
    let importedRaw;
    try {
      importedRaw = JSON.parse(jsonText);
    } catch {
      return { ok: false, message: "Tệp không phải định dạng JSON hợp lệ. Đã giữ nguyên dữ liệu hiện tại." };
    }

    if (!importedRaw || typeof importedRaw !== "object") {
      return { ok: false, message: "Cấu trúc tệp hồ sơ không hợp lệ." };
    }

    if (importedRaw.game_id !== GAME_ID) {
      return {
        ok: false,
        message: "Tệp hồ sơ không thuộc game Biên Giới Thẳng Tiến (sai game_id). Đã từ chối nạp.",
      };
    }

    if (importedRaw.schema_version !== SCHEMA_VERSION_STR) {
      return {
        ok: false,
        message: "Phiên bản cấu trúc hồ sơ không tương thích. Đã giữ nguyên dữ liệu hiện tại.",
      };
    }

    const requiredFields = [
      "lastUpdated",
      "money",
      "maxReputation",
      "upgrades",
      "unlockedRoutes",
      "tripHistory",
      "checksum",
    ];
    const missing = requiredFields.filter((f) => !(f in importedRaw));
    if (
      missing.length > 0 ||
      typeof importedRaw.upgrades !== "object" ||
      !Array.isArray(importedRaw.unlockedRoutes) ||
      !Array.isArray(importedRaw.tripHistory)
    ) {
      return { ok: false, message: "Tệp hồ sơ bị thiếu trường dữ liệu bắt buộc. Đã từ chối nạp." };
    }

    // Kiểm tra toàn vẹn DJB2 checksum chống sửa tiền / hỏng file
    const expectedChecksum = this.computeDJB2Checksum(importedRaw);
    if (importedRaw.checksum !== expectedChecksum) {
      return {
        ok: false,
        message: "Cảnh báo: Tệp hồ sơ bị hỏng hoặc đã bị chỉnh sửa tiền cước (sai checksum DJB2)! Đã giữ nguyên dữ liệu hiện tại.",
      };
    }

    const localData = this.data;
    const imported = this._normalize(importedRaw);

    const mergedUpgrades = {
      engine: Math.max(localData.upgrades.engine, imported.upgrades.engine),
      fuelTank: Math.max(localData.upgrades.fuelTank, imported.upgrades.fuelTank),
      suspension: Math.max(localData.upgrades.suspension, imported.upgrades.suspension),
    };

    const mergedRoutes = Array.from(
      new Set([...localData.unlockedRoutes, ...imported.unlockedRoutes])
    ).sort((a, b) => a - b);

    const seenKeys = new Set();
    const combinedTrips = [];
    for (const item of [...localData.tripHistory, ...imported.tripHistory]) {
      const key = item.tripId || `${item.timestamp}_${item.routeId}_${item.rewardVND}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combinedTrips.push(item);
      }
    }

    combinedTrips.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.data = {
      game_id: GAME_ID,
      schema_version: SCHEMA_VERSION_STR,
      lastUpdated: new Date().toISOString(),
      money: Math.max(localData.money, imported.money),
      maxReputation: Math.max(localData.maxReputation, imported.maxReputation),
      upgrades: mergedUpgrades,
      unlockedRoutes: mergedRoutes,
      tripHistory: combinedTrips.slice(0, GAME_CONFIG.STORAGE.MAX_TRIP_HISTORY),
    };

    this.save();
    return {
      ok: true,
      message: `Gộp hồ sơ thành công! Đã đồng bộ ${this.data.tripHistory.length} chuyến hàng và mở khóa ${this.data.unlockedRoutes.length} tuyến đường.`,
    };
  }
}
