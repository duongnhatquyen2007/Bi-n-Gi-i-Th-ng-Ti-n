import { GAME_CONFIG } from "./config.js";

// Tọa độ cắt chính xác trên sprite sheet 2048x2048 đã đo đạc
const TRUCK_SPRITE_REGIONS = {
  cabNormal: { x: 56, y: 40, w: 814, h: 468 },
  cabHeadlight: { x: 936, y: 40, w: 1056, h: 468 },
  trailerLong: { x: 48, y: 608, w: 1216, h: 192 },
  trailerShort: { x: 1320, y: 608, w: 688, h: 192 },
  containerRed: { x: 56, y: 888, w: 640, h: 320 },
  containerBlue: { x: 712, y: 888, w: 640, h: 320 },
  containerGreen: { x: 1360, y: 888, w: 648, h: 320 },
  wheelStatic: { x: 56, y: 1280, w: 328, h: 328 },
  wheelSpin: { x: 400, y: 1280, w: 328, h: 328 },
  spring: { x: 1232, y: 1280, w: 120, h: 328 },
  shock: { x: 1664, y: 1280, w: 312, h: 328 },
  smokeSparks: { x: 80, y: 1664, w: 520, h: 344 },
};

const TOOL_SPRITE_REGIONS = {
  pickupFuel: { x: 160, y: 110, w: 424, h: 560 },
  pickupRepair: { x: 776, y: 110, w: 528, h: 560 },
  pickupStrap: { x: 1416, y: 110, w: 536, h: 560 },
  pothole: { x: 80, y: 840, w: 640, h: 376 },
  rockslide: { x: 760, y: 840, w: 672, h: 376 },
  slopeSign: { x: 1536, y: 710, w: 320, h: 590 },
  tollBooth: { x: 112, y: 1384, w: 664, h: 552 },
  finishGate: { x: 816, y: 1384, w: 576, h: 552 },
  roadBarrier: { x: 1448, y: 1384, w: 520, h: 552 },
};

export class AssetLoader {
  constructor() {
    this.sprites = {};
    this.background = null;
    this.ready = false;
    this.useFallbackOnly = false;
  }

  async loadAll() {
    const [truckImg, toolImg, bgImg] = await Promise.all([
      this._loadImageSafe(GAME_CONFIG.ASSETS.TRUCK_SHEET, "/assets/xe.png"),
      this._loadImageSafe(GAME_CONFIG.ASSETS.TOOL_SHEET, "/assets/tool.png"),
      this._loadImageSafe(GAME_CONFIG.ASSETS.BACKGROUND, "/assets/bg.png"),
    ]);

    if (truckImg) {
      for (const [key, rect] of Object.entries(TRUCK_SPRITE_REGIONS)) {
        this.sprites[key] = this._sliceAndClearWhiteBg(truckImg, rect);
      }
    }
    if (toolImg) {
      for (const [key, rect] of Object.entries(TOOL_SPRITE_REGIONS)) {
        this.sprites[key] = this._sliceAndClearWhiteBg(toolImg, rect);
      }
    }
    if (bgImg) {
      this.background = bgImg;
    }

    this.useFallbackOnly = !truckImg && !toolImg;
    this.ready = true;
    return this;
  }

  _loadImageSafe(primaryUrl, secondaryUrl) {
    return new Promise((resolve) => {
      const tryLoad = (url, isLast) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
          if (!isLast && secondaryUrl && secondaryUrl !== primaryUrl) {
            tryLoad(secondaryUrl, true);
          } else {
            resolve(null);
          }
        };
        img.src = url;
      };
      tryLoad(primaryUrl, false);
    });
  }

  /**
   * Cắt vùng sprite ra canvas tạm và xóa nền trắng bằng BFS flood-fill từ 4 cạnh,
   * giúp giữ nguyên chi tiết màu trắng bên trong thùng hàng/biển báo.
   */
  _sliceAndClearWhiteBg(img, rect) {
    const scale = 0.5; // Giảm 50% để tối ưu VRAM & tốc độ render Canvas 2D
    const w = Math.max(1, Math.round(rect.w * scale));
    const h = Math.max(1, Math.round(rect.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const isNearWhite = (idx) => {
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return r > 232 && g > 232 && b > 232 && max - min < 22;
    };

    const enqueue = (x, y) => {
      const idx = y * w + x;
      if (!visited[idx] && isNearWhite(idx)) {
        visited[idx] = 1;
        queue[tail++] = idx;
      }
    };

    for (let x = 0; x < w; x++) {
      enqueue(x, 0);
      enqueue(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      enqueue(0, y);
      enqueue(w - 1, y);
    }

    while (head < tail) {
      const idx = queue[head++];
      data[idx * 4 + 3] = 0;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0) enqueue(x - 1, y);
      if (x < w - 1) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y < h - 1) enqueue(x, y + 1);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  getSprite(key) {
    return this.sprites[key] || null;
  }

  // ==================== FALLBACK VECTOR RENDERERS ====================

  drawVectorCab(ctx, w, h, headlightsOn) {
    ctx.save();
    // Khung gầm đỏ
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(-w * 0.48, h * 0.12, w * 0.92, h * 0.24);
    // Thân cabin vàng đặc trưng xe đầu kéo VN
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, h * 0.12);
    ctx.lineTo(-w * 0.16, -h * 0.56);
    ctx.lineTo(w * 0.14, -h * 0.56);
    ctx.lineTo(w * 0.28, -h * 0.18);
    ctx.lineTo(w * 0.46, -h * 0.08);
    ctx.lineTo(w * 0.46, h * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1e293b";
    ctx.stroke();

    // Kính chắn gió
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(w * 0.02, -h * 0.44);
    ctx.lineTo(w * 0.13, -h * 0.44);
    ctx.lineTo(w * 0.25, -h * 0.18);
    ctx.lineTo(w * 0.02, -h * 0.18);
    ctx.closePath();
    ctx.fill();

    // Cờ đỏ sao vàng trên cửa cabin
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-w * 0.11, -h * 0.36, 18, 12);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(-w * 0.11 + 9, -h * 0.36 + 6, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Ống xả đứng
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-w * 0.22, -h * 0.62, 7, h * 0.72);

    // Đèn pha
    ctx.fillStyle = headlightsOn ? "#fef08a" : "#cbd5e1";
    ctx.fillRect(w * 0.42, -h * 0.02, 8, 10);
    ctx.restore();
  }

  drawVectorTrailer(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-w * 0.5, -h * 0.28, w, h * 0.34);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w * 0.5, -h * 0.28, w, h * 0.34);

    // Thanh cản hông phản quang vàng-đỏ
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#ef4444" : "#facc15";
      ctx.fillRect(-w * 0.32 + i * (w * 0.08), h * 0.08, w * 0.075, 7);
    }
    ctx.restore();
  }

  drawVectorContainer(ctx, w, h, cargoType) {
    ctx.save();
    ctx.fillStyle = cargoType.colorHex || "#b91c1c";
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h, w, h);

    // Gân sóng container
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    for (let x = -w / 2 + 12; x < w / 2 - 8; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, -h + 4);
      ctx.lineTo(x, -4);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cargoType.name.toUpperCase(), 0, -h * 0.46);
    ctx.restore();
  }

  drawVectorWheel(ctx, radius, angle) {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius * 0.48, Math.sin(a) * radius * 0.48);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVectorProp(ctx, type, w, h, label) {
    ctx.save();
    if (type === "pothole") {
      ctx.fillStyle = "#292524";
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.45, h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0c0a09";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (type === "rockslide") {
      ctx.fillStyle = "#57534e";
      ctx.beginPath();
      ctx.moveTo(-w * 0.45, 0);
      ctx.lineTo(-w * 0.2, -h * 0.85);
      ctx.lineTo(w * 0.15, -h * 0.95);
      ctx.lineTo(w * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (type === "pickupFuel") {
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DẦU", 0, -h * 0.42);
    } else if (type === "pickupRepair") {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#090d16";
      ctx.font = "700 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SỬA", 0, -h * 0.42);
    } else if (type === "pickupStrap") {
      ctx.fillStyle = "#f97316";
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = "#090d16";
      ctx.font = "700 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CHẰNG", 0, -h * 0.42);
    } else if (type === "tollBooth" || type === "weighStation") {
      ctx.fillStyle = type === "weighStation" ? "#0369a1" : "#1d4ed8";
      ctx.fillRect(-w * 0.35, -h, w * 0.7, h);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label || "TRẠM", 0, -h * 0.72);
    } else if (type === "finishGate") {
      ctx.fillStyle = "#b91c1c";
      ctx.fillRect(-w * 0.5, -h, w, h * 0.42);
      ctx.fillStyle = "#475569";
      ctx.fillRect(-w * 0.45, -h * 0.58, 12, h * 0.58);
      ctx.fillRect(w * 0.45 - 12, -h * 0.58, 12, h * 0.58);
      ctx.fillStyle = "#facc15";
      ctx.font = "700 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CỬA KHẨU QUỐC TẾ", 0, -h * 0.74);
    } else if (type === "gasStation" || type === "repairStation") {
      ctx.fillStyle = type === "gasStation" ? "#d97706" : "#0284c7";
      ctx.fillRect(-w * 0.45, -h, w * 0.9, h * 0.25);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-w * 0.38, -h * 0.75, 10, h * 0.75);
      ctx.fillRect(w * 0.38 - 10, -h * 0.75, 10, h * 0.75);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label || "TRẠM DỊCH VỤ", 0, -h * 0.84);
    }
    ctx.restore();
  }
}
