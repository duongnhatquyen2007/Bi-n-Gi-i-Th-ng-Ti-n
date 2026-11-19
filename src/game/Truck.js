import { GAME_CONFIG } from "./config.js";

export class Truck {
  constructor(terrain, cargoType, upgrades) {
    this.terrain = terrain;
    this.cargoType = cargoType;
    this.upgrades = upgrades;

    const cfg = GAME_CONFIG.TRUCK_PHYSICS;

    // Kích thước đầu kéo chuẩn từ đặc tả: 180x80 px
    this.cabWidth = GAME_CONFIG.ASSETS.TRUCK_FRAME_WIDTH;
    this.cabHeight = GAME_CONFIG.ASSETS.TRUCK_FRAME_HEIGHT;
    this.trailerWidth = 225;
    this.trailerHeight = 32;

    // Vị trí & vận tốc (pixel/s, hướng +X sang phải)
    this.x = terrain.startX + 45;
    this.y = terrain.getHeightAt(this.x) - 42;
    this.vx = 0; // px/s
    this.vy = 0; // px/s
    this.cabAngle = terrain.getSlopeAngleAt(this.x);
    this.trailerAngle = this.cabAngle;
    this.wheelRotation = 0;

    // Lò xo giảm chấn (cho 3 cụm trục: trước, cầu sau đầu kéo, trục rơ-moóc)
    this.suspensionOffset = 0;
    this.suspensionVel = 0;

    // Trạng thái điều khiển & tài nguyên
    this.fuel = 100;
    this.hp = 100;
    this.headlightsOn = terrain.route.weather !== "SUNNY";
    this.handbrakeOn = false;
    this.reverseHoldTimer = 0;
    this.isReversing = false;
    this.rolloverTimer = 0;

    // Theo dõi gia tốc dọc/ngang truyền vào thùng hàng
    this.lastVx = 0;
    this.lastSuspensionVel = 0;
    this.longitudinalAccel = 0; // m/s^2
    this.verticalShock = 0; // m/s^2

    // Hạt khói ống xả & khói phanh lốp
    this.particles = [];
    this.exhaustTimer = 0;

    // Tính các hệ số nâng cấp Garage
    this.engineMult = 1 + (upgrades.engine - 1) * cfg.ENGINE_UPGRADE_BONUS;
    this.fuelSavingMult = Math.max(0.4, 1 - (upgrades.fuelTank - 1) * cfg.FUEL_UPGRADE_SAVING_PER_LEVEL);
    this.dampingMult = 1 + (upgrades.suspension - 1) * cfg.SUSPENSION_UPGRADE_DAMPING_BONUS;

    this.totalMassKg = cfg.TRACTOR_MASS_KG + cfg.TRAILER_MASS_KG + cargoType.massKg;
  }

  getSpeedKmh() {
    const metersPerSec = Math.abs(this.vx) / GAME_CONFIG.PIXELS_PER_METER;
    return metersPerSec * 3.6;
  }

  getSignedSpeedKmh() {
    const metersPerSec = this.vx / GAME_CONFIG.PIXELS_PER_METER;
    return metersPerSec * 3.6;
  }

  getTrailerBedWorldPos() {
    // Khớp nối rơ-moóc nằm phía sau cabin đầu kéo
    const hitchX = this.x - Math.cos(this.cabAngle) * 52;
    const hitchY = this.y - Math.sin(this.cabAngle) * 52 + this.suspensionOffset;
    const bedCenterX = hitchX - Math.cos(this.trailerAngle) * 118;
    const bedCenterY = hitchY - Math.sin(this.trailerAngle) * 118 - 10;
    return { x: bedCenterX, y: bedCenterY, angle: this.trailerAngle };
  }

  applyHazardJolt(upwardImpulsePx, hpDamage) {
    this.suspensionVel -= upwardImpulsePx;
    this.hp = Math.max(0, this.hp - hpDamage);
  }

  applyKnockback(vxDelta, hpDamage) {
    this.vx = vxDelta;
    this.suspensionVel -= 140;
    this.hp = Math.max(0, this.hp - hpDamage);
  }

  update(dt, input, soundManager) {
    const cfg = GAME_CONFIG.TRUCK_PHYSICS;
    const ppm = GAME_CONFIG.PIXELS_PER_METER;
    const grip = this.terrain.route.roadGrip;

    const speedMps = this.vx / ppm;
    const speedKmh = Math.abs(speedMps) * 3.6;

    // 1. Tính mô-men xoắn động cơ, phanh & số lùi (giữ A 0.4s khi xe đứng yên)
    let driveForceN = 0;
    let isThrottling = false;
    this.handbrakeOn = Boolean(input.handbrake);

    if (this.handbrakeOn) {
      if (Math.abs(this.vx) > 2) {
        driveForceN = -Math.sign(this.vx) * cfg.HANDBRAKE_FORCE_N * grip;
        if (Math.random() < 0.55) {
          this._spawnBrakeSmoke();
        }
      } else {
        this.vx = 0;
      }
      this.reverseHoldTimer = 0;
      this.isReversing = false;
    } else if (input.gas && this.fuel > 0) {
      isThrottling = true;
      this.reverseHoldTimer = 0;
      this.isReversing = false;
      const hpPenalty = this.hp < cfg.LOW_HP_THRESHOLD ? cfg.LOW_HP_SPEED_FACTOR : 1.0;
      const maxSpeedMps = ((cfg.MAX_SPEED_KMH * hpPenalty) / 3.6) * (0.95 + 0.05 * this.engineMult);
      if (speedMps < maxSpeedMps) {
        driveForceN = cfg.BASE_TORQUE_N * this.engineMult * grip;
      }
    } else if (input.brake) {
      if (this.vx > 8) {
        // Đang chạy tới -> đạp phanh hãm tốc
        driveForceN = -cfg.BRAKE_FORCE_N * grip;
        this.reverseHoldTimer = 0;
        this.isReversing = false;
      } else {
        // Xe gần như dừng hẳn -> đếm 0.4s cài số lùi
        this.reverseHoldTimer += dt;
        if (this.reverseHoldTimer >= cfg.REVERSE_HOLD_DELAY_SEC && this.fuel > 0) {
          this.isReversing = true;
          isThrottling = true;
          const maxRevMps = cfg.REVERSE_MAX_SPEED_KMH / 3.6;
          if (-speedMps < maxRevMps) {
            driveForceN = -cfg.BASE_TORQUE_N * 0.55 * grip;
          }
        } else {
          this.vx *= Math.max(0, 1 - 12 * dt);
        }
      }
    } else {
      this.reverseHoldTimer = 0;
      this.isReversing = false;
    }

    // 2. Trọng lực dọc dốc & lực cản lăn + lực cản gió
    const slopeAngle = this.terrain.getSlopeAngleAt(this.x);
    // slopeAngle < 0: lên dốc; > 0: đổ dốc
    const slopeGravityN = this.totalMassKg * GAME_CONFIG.GRAVITY * Math.sin(slopeAngle);
    const normalForceN = this.totalMassKg * GAME_CONFIG.GRAVITY * Math.cos(slopeAngle);
    const rollingDragN = Math.sign(speedMps) * normalForceN * cfg.ROLLING_RESISTANCE_COEFF;
    const airDragN = Math.sign(speedMps) * speedMps * speedMps * cfg.AIR_DRAG_COEFF;

    let netForceN = driveForceN + slopeGravityN - rollingDragN - airDragN;

    // Phanh đứng dốc khi giữ phanh tay hoặc phanh ở tốc độ cực thấp
    if (this.handbrakeOn && Math.abs(this.vx) < 12) {
      netForceN = 0;
      this.vx = 0;
    }

    const accelMps2 = netForceN / this.totalMassKg;
    const prevVx = this.vx;
    this.vx += accelMps2 * ppm * dt;

    // Ngăn trôi ngược ngoài ý muốn khi giữ phanh lúc đứng yên
    if (input.brake && !this.isReversing && prevVx >= 0 && this.vx < 0) {
      this.vx = 0;
    }

    // Chặn biên trái (không lùi quá sâu sau cảng)
    this.x += this.vx * dt;
    if (this.x < 180) {
      this.x = 180;
      this.vx = Math.max(0, this.vx);
    }

    // 3. Hệ thống treo lò xo - giảm chấn (Spring-Damper)
    const groundY = this.terrain.getHeightAt(this.x);
    const targetBodyY = groundY - 36;
    const prevAngle = this.cabAngle;
    this.cabAngle += (slopeAngle - this.cabAngle) * Math.min(1, 10 * dt);

    // Kẹp góc khớp nối rơ-moóc trong [-12°, +12°]
    const rearGroundY = this.terrain.getHeightAt(this.x - 165);
    const rawTrailerSlope = Math.atan2(groundY - rearGroundY, 165);
    const maxHitchRad = (cfg.HITCH_MAX_ANGLE_DEG * Math.PI) / 180;
    const clampedTrailerTarget = Math.max(
      this.cabAngle - maxHitchRad,
      Math.min(this.cabAngle + maxHitchRad, rawTrailerSlope)
    );
    this.trailerAngle += (clampedTrailerTarget - this.trailerAngle) * Math.min(1, 9 * dt);

    // Kích thích dao động phuộc khi thay đổi độ dốc nhanh
    const angleDelta = Math.abs(this.cabAngle - prevAngle);
    this.suspensionVel += angleDelta * Math.abs(speedMps) * 14;

    const springForce = -cfg.SUSPENSION_STIFFNESS * this.suspensionOffset;
    const damperForce = -(cfg.SUSPENSION_DAMPING * this.dampingMult) * this.suspensionVel;
    this.suspensionVel += (springForce + damperForce) * dt;
    this.suspensionOffset += this.suspensionVel * dt;
    this.suspensionOffset = Math.max(-22, Math.min(22, this.suspensionOffset));

    this.y = targetBodyY;
    this.wheelRotation += (this.vx * dt) / 19;

    // 4. Tính gia tốc thực tế truyền lên thùng hàng (m/s^2)
    this.longitudinalAccel = ((this.vx - this.lastVx) / dt) / ppm;
    this.verticalShock = Math.abs((this.suspensionVel - this.lastSuspensionVel) / dt) / ppm;
    this.lastVx = this.vx;
    this.lastSuspensionVel = this.suspensionVel;

    // 5. Tiêu hao nhiên liệu (leo dốc 1.5x, hệ số hàng hóa, tiết kiệm từ bình xăng)
    const isUphill = slopeAngle < -0.04;
    const slopeBurnMult = isUphill ? cfg.FUEL_SLOPE_UPHILL_MULT : 1.0;
    const burnBase = isThrottling ? cfg.FUEL_BURN_THROTTLE_PER_SEC : cfg.FUEL_BURN_IDLE_PER_SEC;
    const fuelDelta = burnBase * slopeBurnMult * this.cargoType.fuelMultiplier * this.fuelSavingMult * dt;
    this.fuel = Math.max(0, this.fuel - fuelDelta);

    // 6. Kiểm tra lật xe (|angle| >= 85° trong > 1.5s)
    const absDeg = Math.abs((this.cabAngle * 180) / Math.PI);
    if (absDeg >= cfg.ROLLOVER_ANGLE_DEG) {
      this.rolloverTimer += dt;
    } else {
      this.rolloverTimer = 0;
    }

    // 7. Khói ống xả & cập nhật âm thanh động cơ
    this.exhaustTimer += dt;
    if (this.exhaustTimer > (isThrottling ? 0.08 : 0.25)) {
      this.exhaustTimer = 0;
      this._spawnExhaustSmoke();
    }
    this._updateParticles(dt);

    if (soundManager) {
      soundManager.updateEngine(speedKmh, isThrottling);
    }
  }

  _spawnExhaustSmoke() {
    const stackX = this.x - Math.cos(this.cabAngle) * 32 + Math.sin(this.cabAngle) * 58;
    const stackY = this.y + this.suspensionOffset - Math.sin(this.cabAngle) * 32 - Math.cos(this.cabAngle) * 58;
    this.particles.push({
      x: stackX,
      y: stackY,
      vx: -25 - Math.random() * 20,
      vy: -32 - Math.random() * 22,
      r: 5 + Math.random() * 5,
      alpha: 0.45,
      color: "rgba(203, 213, 225,",
    });
  }

  _spawnBrakeSmoke() {
    this.particles.push({
      x: this.x - 40 + Math.random() * 45,
      y: this.y + 32,
      vx: -this.vx * 0.2 - Math.random() * 30,
      vy: -14 - Math.random() * 22,
      r: 6 + Math.random() * 6,
      alpha: 0.5,
      color: "rgba(226, 232, 240,",
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += 9 * dt;
      p.alpha -= 0.7 * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, assetLoader, cargoPhysics) {
    // Vẽ hạt khói trước
    for (const p of this.particles) {
      ctx.fillStyle = `${p.color} ${Math.max(0, p.alpha)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const bed = this.getTrailerBedWorldPos();
    const speedKmh = this.getSpeedKmh();
    const wheelSprite = assetLoader.getSprite(speedKmh > 25 ? "wheelSpin" : "wheelStatic");

    // 1. Vẽ Rơ-moóc (Trailer)
    ctx.save();
    ctx.translate(bed.x, bed.y + 12);
    ctx.rotate(this.trailerAngle);
    const trailerSprite = assetLoader.getSprite("trailerLong");
    if (trailerSprite) {
      ctx.drawImage(trailerSprite, -120, -14, 240, 40);
    } else {
      assetLoader.drawVectorTrailer(ctx, 225, 32);
    }
    // Lò xo giảm xóc trục rơ-moóc
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-85, 8, 8, 12);
    ctx.fillRect(-52, 8, 8, 12);
    ctx.restore();

    // 2. Vẽ Thùng hàng Container (từ CargoPhysics)
    cargoPhysics.draw(ctx, assetLoader, bed);

    // 3. Vẽ Đầu kéo (Tractor Cab 180x80)
    ctx.save();
    ctx.translate(this.x, this.y + this.suspensionOffset);
    ctx.rotate(this.cabAngle);

    const cabSprite = assetLoader.getSprite("cabNormal");
    if (cabSprite) {
      ctx.drawImage(cabSprite, -this.cabWidth * 0.5, -this.cabHeight * 0.72, this.cabWidth, this.cabHeight);
    } else {
      assetLoader.drawVectorCab(ctx, this.cabWidth, this.cabHeight, this.headlightsOn);
    }

    // Đèn phanh đỏ phía sau khi đạp phanh / phanh tay
    if (this.handbrakeOn) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
      ctx.beginPath();
      ctx.arc(-this.cabWidth * 0.48, 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Vẽ 4 Bánh xe thực tế bám mặt đường
    const wheelOffsets = [
      { x: this.x + Math.cos(this.cabAngle) * 56, y: this.y + Math.sin(this.cabAngle) * 56 + 21, r: 17 },
      { x: this.x - Math.cos(this.cabAngle) * 44, y: this.y - Math.sin(this.cabAngle) * 44 + 21, r: 17 },
      { x: bed.x - Math.cos(this.trailerAngle) * 76, y: bed.y - Math.sin(this.trailerAngle) * 76 + 23, r: 16 },
      { x: bed.x - Math.cos(this.trailerAngle) * 44, y: bed.y - Math.sin(this.trailerAngle) * 44 + 23, r: 16 },
    ];

    for (const w of wheelOffsets) {
      ctx.save();
      ctx.translate(w.x, w.y);
      if (wheelSprite) {
        ctx.rotate(this.wheelRotation);
        ctx.drawImage(wheelSprite, -w.r, -w.r, w.r * 2, w.r * 2);
      } else {
        assetLoader.drawVectorWheel(ctx, w.r, this.wheelRotation);
      }
      ctx.restore();
    }
  }
}
