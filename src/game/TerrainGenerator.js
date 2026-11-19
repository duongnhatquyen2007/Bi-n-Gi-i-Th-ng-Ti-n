import { GAME_CONFIG } from "./config.js";

export class TerrainGenerator {
  constructor(route) {
    this.route = route;
    this.ppm = GAME_CONFIG.PIXELS_PER_METER;
    this.startX = 240; // Vạch xuất phát tại Cảng (0m)
    this.lengthPx = route.lengthMeters * this.ppm;
    this.finishX = this.startX + this.lengthPx;
    this.baseGroundY = 460;
    this.stepPx = 24;
    this.samples = [];

    this._generateProfile();
  }

  _generateProfile() {
    const maxSlopeRad = (this.route.maxSlopeDeg * Math.PI) / 180;
    const maxDyPerStep = Math.tan(maxSlopeRad) * this.stepPx;
    const totalSamples = Math.ceil((this.finishX + 1200) / this.stepPx) + 4;

    const portFlatEnd = this.startX + 140 * this.ppm;
    const customsFlatStart = this.finishX - 160 * this.ppm;

    // Sinh dãy độ cao mượt bằng tổ hợp sin đa tần + giới hạn độ dốc tuyệt đối
    let prevY = this.baseGroundY;
    const seed = this.route.id * 1.73;

    for (let i = 0; i <= totalSamples; i++) {
      const x = i * this.stepPx;
      let targetY = this.baseGroundY;

      if (x > portFlatEnd && x < customsFlatStart) {
        const progress = (x - portFlatEnd) / (customsFlatStart - portFlatEnd);
        // Đường bao mịn 0 -> 1 -> 0 ở 2 đầu cảng & cửa khẩu
        const envelope = Math.sin(progress * Math.PI);
        const amp = this.route.id === 1 ? 110 : this.route.id === 2 ? 320 : 520;

        const wave1 = Math.sin(x * 0.00055 + seed) * 0.6;
        const wave2 = Math.sin(x * 0.00145 + seed * 2.1) * 0.3;
        const wave3 = Math.cos(x * 0.0031 + seed * 0.7) * 0.1;

        targetY = this.baseGroundY - envelope * amp * (0.45 + 0.55 * (wave1 + wave2 + wave3));
      } else if (x >= customsFlatStart) {
        targetY = this.baseGroundY - (this.route.id === 1 ? 20 : 60);
      }

      // Kẹp độ dốc mỗi bước theo Max Slope của tuyến đường
      const deltaY = targetY - prevY;
      const clampedDelta = Math.max(-maxDyPerStep, Math.min(maxDyPerStep, deltaY));
      const y = i === 0 ? this.baseGroundY : prevY + clampedDelta;
      prevY = y;
      this.samples.push(y);
    }
  }

  getHeightAt(x) {
    if (x <= 0) return this.samples[0];
    const idxFloat = x / this.stepPx;
    const idx = Math.floor(idxFloat);
    if (idx >= this.samples.length - 1) {
      return this.samples[this.samples.length - 1];
    }
    const t = idxFloat - idx;
    const y0 = this.samples[idx];
    const y1 = this.samples[idx + 1];
    return y0 + (y1 - y0) * t;
  }

  /**
   * Trả về góc tiếp tuyến mặt đường (radian theo hệ tọa độ Canvas:
   * âm = đang lên dốc về bên phải, dương = đang xuống dốc về bên phải)
   */
  getSlopeAngleAt(x) {
    const dx = 18;
    const y1 = this.getHeightAt(x - dx);
    const y2 = this.getHeightAt(x + dx);
    return Math.atan2(y2 - y1, dx * 2);
  }

  getProgressRatio(x) {
    return Math.max(0, Math.min(1, (x - this.startX) / this.lengthPx));
  }

  getDistanceMeters(x) {
    return Math.max(0, Math.min(this.route.lengthMeters, (x - this.startX) / this.ppm));
  }

  drawBackground(ctx, viewW, viewH, cameraX, assetLoader) {
    const routeProgress = this.getProgressRatio(cameraX + viewW * 0.35);

    // Bầu trời nền theo thời tiết tuyến đường
    const skyGrad = ctx.createLinearGradient(0, 0, 0, viewH);
    if (this.route.weather === "STORM_NIGHT") {
      skyGrad.addColorStop(0, "#060b16");
      skyGrad.addColorStop(0.65, "#111b2e");
      skyGrad.addColorStop(1, "#1e293b");
    } else if (this.route.weather === "RAIN_FOG") {
      skyGrad.addColorStop(0, "#334155");
      skyGrad.addColorStop(0.6, "#64748b");
      skyGrad.addColorStop(1, "#94a3b8");
    } else {
      skyGrad.addColorStop(0, "#38bdf8");
      skyGrad.addColorStop(0.62, "#bae6fd");
      skyGrad.addColorStop(1, "#fde68a");
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewW, viewH);

    // Dùng ảnh bg.png toàn cảnh cuộn mượt từ Cảng -> Đèo -> Cửa khẩu
    if (assetLoader.background) {
      const bg = assetLoader.background;
      const srcRatio = bg.width / bg.height;
      const drawH = viewH * 0.92;
      const drawW = Math.max(viewW * 1.4, drawH * srcRatio);
      const maxPan = Math.max(0, drawW - viewW);
      const panX = -routeProgress * maxPan;
      ctx.save();
      ctx.globalAlpha = this.route.weather === "STORM_NIGHT" ? 0.34 : this.route.weather === "RAIN_FOG" ? 0.68 : 0.9;
      ctx.drawImage(bg, panX, viewH - drawH, drawW, drawH);
      ctx.restore();
    } else {
      // Fallback vector núi đồi parallax
      ctx.save();
      ctx.fillStyle = this.route.weather === "STORM_NIGHT" ? "#0f172a" : "#1e3a2f";
      ctx.beginPath();
      ctx.moveTo(0, viewH);
      for (let sx = 0; sx <= viewW + 40; sx += 40) {
        const wx = sx + cameraX * 0.12;
        const mh = viewH * 0.56 + Math.sin(wx * 0.0028) * 70 + Math.cos(wx * 0.0011) * 45;
        ctx.lineTo(sx, mh);
      }
      ctx.lineTo(viewW, viewH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawRoad(ctx, startWorldX, endWorldX, viewBottomWorldY, assetLoader) {
    const step = this.stepPx;
    const x0 = Math.max(0, Math.floor(startWorldX / step) * step - step);
    const x1 = Math.ceil(endWorldX / step) * step + step;

    // 1. Nền đất đá bên dưới mặt đường
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, viewBottomWorldY + 600);
    for (let x = x0; x <= x1; x += step) {
      ctx.lineTo(x, this.getHeightAt(x));
    }
    ctx.lineTo(x1, viewBottomWorldY + 600);
    ctx.closePath();
    const earthGrad = ctx.createLinearGradient(0, this.baseGroundY - 200, 0, viewBottomWorldY + 400);
    earthGrad.addColorStop(0, "#3f3f46");
    earthGrad.addColorStop(0.18, "#292524");
    earthGrad.addColorStop(1, "#111827");
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // 2. Lớp mặt đường nhựa (Asphalt ribbon)
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      const y = this.getHeightAt(x);
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.route.weather === "SUNNY" ? "#334155" : "#1e293b";
    ctx.stroke();

    // Vạch kẻ đường vàng/trắng
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      const y = this.getHeightAt(x) + 3;
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.setLineDash([28, 22]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#facc15";
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Cọc hộ lan bảo vệ dọc đường
    const postSpacing = 110;
    const firstPost = Math.ceil(x0 / postSpacing) * postSpacing;
    ctx.fillStyle = "#94a3b8";
    for (let px = firstPost; px <= x1; px += postSpacing) {
      const py = this.getHeightAt(px);
      ctx.fillRect(px - 2, py - 18, 4, 18);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(px - 56, py - 15, 112, 4);
      ctx.fillStyle = "#94a3b8";
    }

    // 4. Cột mốc Km mỗi 500m
    const meterStep = 500 * this.ppm;
    for (let m = 0; m <= this.route.lengthMeters; m += 500) {
      const mx = this.startX + m * this.ppm;
      if (mx >= x0 - 120 && mx <= x1 + 120) {
        const my = this.getHeightAt(mx);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(mx - 22, my - 66, 44, 24);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.strokeRect(mx - 22, my - 66, 44, 24);
        ctx.fillRect(mx - 2, my - 42, 4, 42);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "700 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(m === 0 ? "CẢNG" : `${m}m`, mx, my - 50);
      }
    }

    // 5. Cần cẩu cảng biển tại điểm xuất phát (0m)
    if (x0 < this.startX + 400) {
      this._drawPortGantry(ctx, this.startX - 80, this.getHeightAt(this.startX - 80));
    }

    // 6. Cổng Cửa khẩu Quốc tế tại vạch đích
    if (x1 > this.finishX - 400) {
      const gy = this.getHeightAt(this.finishX);
      const gateSprite = assetLoader.getSprite("finishGate");
      if (gateSprite) {
        const gw = 230;
        const gh = 210;
        ctx.drawImage(gateSprite, this.finishX - gw * 0.5, gy - gh + 10, gw, gh);
      } else {
        ctx.save();
        ctx.translate(this.finishX, gy);
        assetLoader.drawVectorProp(ctx, "finishGate", 230, 190);
        ctx.restore();
      }
      // Vạch dừng thông quan
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(this.finishX - 4, gy - 6, 8, 12);
    }

    ctx.restore();
  }

  _drawPortGantry(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-45, 0);
    ctx.lineTo(-30, -170);
    ctx.lineTo(35, -170);
    ctx.lineTo(50, 0);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-75, -182, 175, 16);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-15, -198, 42, 18);
    ctx.restore();
  }
}
