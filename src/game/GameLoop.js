import { GAME_CONFIG } from "./config.js";
import { TerrainGenerator } from "./TerrainGenerator.js";
import { Truck } from "./Truck.js";
import { CargoPhysics } from "./CargoPhysics.js";
import { CheckpointManager } from "./CheckpointManager.js";

export class GameLoop {
  constructor({ canvas, assetLoader, saveManager, soundManager, uiManager }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assetLoader = assetLoader;
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.uiManager = uiManager;

    this.state = "MENU"; // INTRO | MENU | PLAYING | PAUSED | VICTORY | GAME_OVER
    this.lastTime = 0;
    this.accumulator = 0;
    this.rafId = null;

    this.route = null;
    this.cargo = null;
    this.terrain = null;
    this.truck = null;
    this.cargoPhysics = null;
    this.checkpointManager = null;

    this.deadlineSec = 0;
    this.totalDeadlineSec = 0;
    this.elapsedSec = 0;

    // Camera state
    this.camX = 0;
    this.camY = 0;
    this.camZoom = GAME_CONFIG.CAMERA.ZOOM_DEFAULT;

    // Hiệu ứng hạt mưa & sóng còi hơi
    this.rainDrops = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      len: 12 + Math.random() * 14,
      speed: 540 + Math.random() * 240,
    }));
    this.hornWaveRadius = 0;
    this.hornWaveAlpha = 0;

    this._handleResize = this._resizeCanvas.bind(this);
    window.addEventListener("resize", this._handleResize);
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.viewW = w;
    this.viewH = h;
    this.dpr = dpr;
  }

  startLoop() {
    if (this.rafId) return;
    this.lastTime = performance.now();
    const tick = (now) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      // Giới hạn MAX_DELTA_TIME = 0.05 để vật lý và nhiên liệu ổn định trên mọi thiết bị
      const dt = Math.min(GAME_CONFIG.MAX_DELTA_TIME, Math.max(0, rawDt));

      this._step(dt);
      this._render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  startTrip(routeId, cargoId) {
    const route = GAME_CONFIG.ROUTES.find((r) => r.id === routeId) || GAME_CONFIG.ROUTES[0];
    const cargo = GAME_CONFIG.CARGO_TYPES.find((c) => c.id === cargoId) || GAME_CONFIG.CARGO_TYPES[0];

    this.route = route;
    this.cargo = cargo;
    this.terrain = new TerrainGenerator(route);
    this.truck = new Truck(this.terrain, cargo, this.saveManager.data.upgrades);
    this.cargoPhysics = new CargoPhysics(cargo, this.saveManager.data.upgrades);
    this.checkpointManager = new CheckpointManager(
      this.terrain,
      route,
      this.saveManager,
      this.soundManager,
      this.uiManager
    );

    this.totalDeadlineSec = Math.round(route.baseDeadlineSec * cargo.deadlineMultiplier);
    this.deadlineSec = this.totalDeadlineSec;
    this.elapsedSec = 0;
    this.accumulator = 0;

    this.camX = this.truck.x + GAME_CONFIG.CAMERA.LOOK_AHEAD_X - this.viewW * 0.35;
    this.camY = this.truck.y - this.viewH * 0.6;
    this.camZoom = GAME_CONFIG.CAMERA.ZOOM_DEFAULT;

    this.uiManager.resetInputs();
    this.uiManager.showPlayingHUD(route, this.checkpointManager.stations);
    this.soundManager.startEngine();
    this.soundManager.startMusic();
    this.state = "PLAYING";
  }

  restartTrip() {
    if (!this.route || !this.cargo) return;
    this.startTrip(this.route.id, this.cargo.id);
  }

  returnToMenu() {
    this.state = "MENU";
    this.soundManager.stopEngine();
    this.soundManager.stopMusic();
    this.uiManager.resetInputs();
    this.uiManager.showMenu();
  }

  togglePause() {
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      this.soundManager.stopEngine();
      this.soundManager.stopMusic();
      this.uiManager.setPaused(true, this.route);
    } else if (this.state === "PAUSED") {
      this.state = "PLAYING";
      this.soundManager.startEngine();
      this.soundManager.startMusic();
      this.uiManager.setPaused(false, this.route);
    }
  }

  triggerHorn() {
    if (this.state !== "PLAYING" || !this.truck) return;
    this.soundManager.playHorn();
    this.hornWaveRadius = 24;
    this.hornWaveAlpha = 0.85;
    this.checkpointManager.triggerHorn(this.truck);
  }

  toggleLights() {
    if (this.state !== "PLAYING" || !this.truck) return;
    this.truck.headlightsOn = !this.truck.headlightsOn;
    this.uiManager.showToast(
      `Đèn pha: ${this.truck.headlightsOn ? "ĐÃ BẬT" : "ĐÃ TẮT"}`,
      "info"
    );
  }

  onHandbrakePressed() {
    if (this.state !== "PLAYING" || !this.truck) return;
    if (this.truck.getSpeedKmh() > 15) {
      this.soundManager.playBrakeHiss();
    }
  }

  onInteractPressed() {
    if (this.state !== "PLAYING" || !this.truck) return;
    // Nhấn E ngay tại vạch Cửa khẩu Quốc tế để xác nhận thông quan tức thì
    if (this.truck.x >= this.terrain.finishX - 110) {
      this._triggerVictory();
    }
  }

  _step(dt) {
    if (this.state !== "PLAYING") return;

    if (this.soundManager.enabled && !this.soundManager.isEngineRunning) {
      this.soundManager.startEngine();
    }

    const fixedDt = GAME_CONFIG.FIXED_DT;
    this.accumulator += dt;
    while (this.accumulator >= fixedDt) {
      this._fixedPhysicsStep(fixedDt);
      if (this.state !== "PLAYING") break;
      this.accumulator -= fixedDt;
    }

    if (this.state === "PLAYING") {
      this._updateCamera(dt);
      this._updateWeather(dt);
      this.uiManager.updateHUD({
        truck: this.truck,
        cargoPhysics: this.cargoPhysics,
        terrain: this.terrain,
        deadlineSec: this.deadlineSec,
      });
    }
  }

  _fixedPhysicsStep(dt) {
    this.elapsedSec += dt;
    this.deadlineSec = Math.max(0, this.deadlineSec - dt);

    this.truck.update(dt, this.uiManager.input, this.soundManager);
    this.cargoPhysics.update(dt, this.truck);
    this.checkpointManager.update(dt, this.truck, this.cargoPhysics, this.uiManager.input);

    // Kiểm tra điều kiện Thua tuyệt đối
    if (this.truck.fuel <= 0) {
      this._triggerGameOver("Xe đã cạn sạch nhiên liệu trước khi tới cửa khẩu.");
      return;
    }
    if (this.truck.hp <= 0) {
      this._triggerGameOver("Xe đầu kéo đã hư hỏng nặng và không thể tiếp tục hành trình.");
      return;
    }
    if (this.truck.rolloverTimer >= GAME_CONFIG.TRUCK_PHYSICS.ROLLOVER_TIMEOUT_SEC) {
      this._triggerGameOver("Xe đầu kéo bị lật nghiêng nghiêm trọng trên đèo.");
      return;
    }
    if (this.cargoPhysics.fallenOff) {
      this._triggerGameOver("Đứt dây chằng! Thùng hàng container đã rơi khỏi rơ-moóc xuống mặt đường.");
      return;
    }
    if (this.cargoPhysics.integrity < GAME_CONFIG.CARGO_PHYSICS.MIN_VICTORY_INTEGRITY) {
      this._triggerGameOver("Độ nguyên vẹn hàng hóa xuống dưới mức 50%, không đủ tiêu chuẩn thông quan.");
      return;
    }
    if (this.deadlineSec <= 0) {
      this._triggerGameOver("Trễ giờ thông quan! Cổng cửa khẩu quốc tế đã đóng luồng.");
      return;
    }

    // Kiểm tra điều kiện Thắng tuyệt đối
    if (
      this.truck.x >= this.terrain.finishX &&
      this.truck.getSpeedKmh() <= GAME_CONFIG.WORLD_RULES.FINISH_STOP_SPEED_KMH
    ) {
      this._triggerVictory();
    }
  }

  _updateCamera(dt) {
    const camCfg = GAME_CONFIG.CAMERA;
    const speedKmh = this.truck.getSpeedKmh();
    const zoomRatio =
      speedKmh <= camCfg.ZOOM_MIN_SPEED
        ? 0
        : Math.min(1, (speedKmh - camCfg.ZOOM_MIN_SPEED) / (GAME_CONFIG.TRUCK_PHYSICS.MAX_SPEED_KMH - camCfg.ZOOM_MIN_SPEED));

    const targetZoom = camCfg.ZOOM_DEFAULT + (camCfg.ZOOM_HIGH_SPEED - camCfg.ZOOM_DEFAULT) * zoomRatio;
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, 4.5 * dt);

    const visibleW = this.viewW / this.camZoom;
    const visibleH = this.viewH / this.camZoom;
    const targetCamX = this.truck.x + camCfg.LOOK_AHEAD_X - visibleW * 0.42;
    const targetCamY = this.truck.y - visibleH * 0.64;

    const alpha = 1 - Math.pow(1 - camCfg.LERP_FACTOR, dt * 60);
    this.camX += (targetCamX - this.camX) * alpha;
    this.camY += (targetCamY - this.camY) * alpha;
  }

  _updateWeather(dt) {
    if (this.hornWaveAlpha > 0) {
      this.hornWaveRadius += 720 * dt;
      this.hornWaveAlpha = Math.max(0, this.hornWaveAlpha - 1.7 * dt);
    }
    if (this.route.weather !== "SUNNY") {
      for (const drop of this.rainDrops) {
        drop.y += (drop.speed / this.viewH) * dt;
        drop.x -= 0.16 * dt;
        if (drop.y > 1) {
          drop.y = -0.05;
          drop.x = Math.random();
        }
        if (drop.x < 0) drop.x += 1;
      }
    }
  }

  _triggerVictory() {
    this.state = "VICTORY";
    this.soundManager.stopEngine();
    this.soundManager.stopMusic();
    this.soundManager.playVictory();
    this.uiManager.resetInputs();

    const rules = GAME_CONFIG.WORLD_RULES;
    const integrity = Math.round(this.cargoPhysics.integrity);
    const remainingSec = Math.round(this.deadlineSec);
    const completionTimeSec = Math.round(this.elapsedSec);

    const basePart = Math.round(this.route.baseRewardVND * this.cargo.rewardMultiplier);
    const cargoBonus = Math.round(integrity * rules.INTEGRITY_BONUS_PER_PCT_VND);
    const speedBonus = Math.round(remainingSec * rules.TIME_BONUS_PER_SEC_VND);
    const totalReward = basePart + cargoBonus + speedBonus;
    const repGain = 20 + Math.floor(integrity / 5) + Math.floor(remainingSec / 5);

    this.saveManager.addMoney(totalReward);
    this.saveManager.adjustReputation(repGain);
    if (this.route.id < 3) {
      this.saveManager.unlockRoute(this.route.id + 1);
    }
    this.saveManager.recordTrip({
      route: this.route,
      cargo: this.cargo,
      completionTimeSec,
      cargoIntegrity: integrity,
      rewardVND: totalReward,
    });

    this.uiManager.showVictory({
      route: this.route,
      cargo: this.cargo,
      completionTimeSec,
      remainingSec,
      cargoIntegrity: integrity,
      basePart,
      cargoBonus,
      speedBonus,
      totalReward,
      repGain,
    });
  }

  _triggerGameOver(reason) {
    this.state = "GAME_OVER";
    this.soundManager.stopEngine();
    this.soundManager.stopMusic();
    this.soundManager.playGameOver();
    this.uiManager.resetInputs();

    this.uiManager.showGameOver(reason, {
      distanceM: Math.round(this.terrain.getDistanceMeters(this.truck.x)),
      totalM: this.route.lengthMeters,
      fuel: Math.round(this.truck.fuel),
      hp: Math.round(this.truck.hp),
      cargo: Math.round(this.cargoPhysics.integrity),
    });
  }

  _render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    if (!this.terrain || !this.truck) {
      // Màn hình nền nhẹ khi đang ở Menu / Intro
      const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      if (this.assetLoader.background) {
        ctx.globalAlpha = 0.22;
        ctx.drawImage(this.assetLoader.background, 0, 0, this.viewW, this.viewH);
      }
      ctx.restore();
      return;
    }

    // 1. Vẽ nền Parallax
    this.terrain.drawBackground(ctx, this.viewW, this.viewH, this.camX, this.assetLoader);

    // 2. Vẽ Thế giới 2D theo Camera Transform
    ctx.save();
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    const visibleW = this.viewW / this.camZoom;
    const visibleH = this.viewH / this.camZoom;
    const startWorldX = this.camX - 180;
    const endWorldX = this.camX + visibleW + 240;

    this.terrain.drawRoad(ctx, startWorldX, endWorldX, this.camY + visibleH, this.assetLoader);
    this.checkpointManager.draw(ctx, startWorldX, endWorldX, this.assetLoader);
    this.truck.draw(ctx, this.assetLoader, this.cargoPhysics);

    // Sóng âm thanh Còi hơi (H)
    if (this.hornWaveAlpha > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${this.hornWaveAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.truck.x + 58, this.truck.y - 24, this.hornWaveRadius, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Chùm sáng đèn pha hình nón 500px
    if (this.truck.headlightsOn) {
      ctx.save();
      const headX = this.truck.x + Math.cos(this.truck.cabAngle) * 76;
      const headY = this.truck.y + this.truck.suspensionOffset + Math.sin(this.truck.cabAngle) * 76 - 2;
      ctx.translate(headX, headY);
      ctx.rotate(this.truck.cabAngle);
      const beamLen = GAME_CONFIG.CAMERA.HEADLIGHT_RANGE_PX;
      const beamGrad = ctx.createLinearGradient(0, 0, beamLen, 0);
      beamGrad.addColorStop(0, "rgba(254, 240, 138, 0.42)");
      beamGrad.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(beamLen, -88);
      ctx.lineTo(beamLen, 72);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // 3. Lớp thời tiết (Mưa, Sương mù, Bóng tối đêm)
    if (this.route.weather !== "SUNNY") {
      // Mưa
      ctx.save();
      ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
      ctx.lineWidth = 1.5;
      for (const drop of this.rainDrops) {
        const dx = drop.x * this.viewW;
        const dy = drop.y * this.viewH;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 5, dy + drop.len);
        ctx.stroke();
      }
      ctx.restore();

      // Lớp phủ sương mù / đêm tối
      const darkness = this.route.nightDarkness;
      const fog = this.route.fogAlpha;
      if (darkness > 0 || fog > 0) {
        ctx.save();
        const truckScreenX = (this.truck.x - this.camX) * this.camZoom;
        const truckScreenY = (this.truck.y - this.camY) * this.camZoom;
        const clearRadius = this.truck.headlightsOn ? 390 : 170;

        const overlayGrad = ctx.createRadialGradient(
          truckScreenX + (this.truck.headlightsOn ? 150 : 0),
          truckScreenY,
          clearRadius * 0.25,
          truckScreenX + (this.truck.headlightsOn ? 150 : 0),
          truckScreenY,
          clearRadius
        );
        overlayGrad.addColorStop(0, "rgba(9, 13, 22, 0.04)");
        overlayGrad.addColorStop(
          1,
          this.route.weather === "STORM_NIGHT"
            ? `rgba(6, 11, 22, ${Math.min(0.84, darkness + fog * 0.25)})`
            : `rgba(148, 163, 184, ${fog * 0.68})`
        );
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
