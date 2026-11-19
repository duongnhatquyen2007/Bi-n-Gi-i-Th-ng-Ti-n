import { GAME_CONFIG } from "./config.js";

export class CargoPhysics {
  constructor(cargoType, upgrades) {
    this.cargoType = cargoType;
    this.upgrades = upgrades;
    this.integrity = 100;

    // Tọa độ cục bộ trên sàn rơ-moóc
    this.width = 172;
    this.height = 76;
    this.localX = -10; // Lệch ngang trên sàn
    this.localY = 0; // Độ nảy lên trên sàn (âm = bay lên, dương = lún/rơi)
    this.velX = 0;
    this.velY = 0;
    this.tiltAngle = 0;

    this.strapBoostTimer = 0; // Gia cố tạm thời 12s từ vật phẩm Dây chằng
    this.fallenOff = false;

    const susBonus = (upgrades.suspension - 1) * GAME_CONFIG.TRUCK_PHYSICS.SUSPENSION_UPGRADE_SHOCK_REDUCTION;
    this.suspensionProtection = Math.max(0.35, 1 - susBonus);
  }

  activateStrapBoost() {
    this.strapBoostTimer = GAME_CONFIG.CARGO_PHYSICS.STRAP_BOOST_DURATION_SEC;
    this.integrity = Math.min(100, this.integrity + GAME_CONFIG.WORLD_RULES.PICKUP_STRAP_INTEGRITY);
    // Kéo hàng ngay ngắn lại vào giữa sàn
    this.localX *= 0.35;
    this.localY = 0;
    this.velX = 0;
    this.velY = 0;
  }

  applyDirectDamage(baseAmount) {
    const boostMult = this.strapBoostTimer > 0 ? GAME_CONFIG.CARGO_PHYSICS.STRAP_BOOST_DAMAGE_MULT : 1.0;
    const dmg = baseAmount * this.cargoType.shockMultiplier * this.suspensionProtection * boostMult;
    this.integrity = Math.max(0, this.integrity - dmg);
    this.velY -= 45;
  }

  update(dt, truck) {
    const cfg = GAME_CONFIG.CARGO_PHYSICS;
    if (this.strapBoostTimer > 0) {
      this.strapBoostTimer = Math.max(0, this.strapBoostTimer - dt);
    }

    // 1. Quán tính dọc khi phanh gấp hoặc tăng tốc đột ngột
    const slopeGravityLocal = GAME_CONFIG.GRAVITY * Math.sin(truck.trailerAngle);
    const inertialAccel = -truck.longitudinalAccel + slopeGravityLocal;

    // Ma sát tĩnh + Dây chằng ảo giữ thùng hàng
    const maxResistance = cfg.BED_FRICTION * GAME_CONFIG.GRAVITY + cfg.MAX_STRAP_IMPULSE * (this.strapBoostTimer > 0 ? 1.6 : 1.0);
    if (Math.abs(inertialAccel) > maxResistance) {
      const excess = Math.sign(inertialAccel) * (Math.abs(inertialAccel) - maxResistance);
      this.velX += excess * GAME_CONFIG.PIXELS_PER_METER * 0.45 * dt;
    } else {
      // Lực đàn hồi dây chằng kéo hàng về tâm sàn
      this.velX += (-this.localX * 4.5 - this.velX * 7.5) * dt;
    }

    this.localX += this.velX * dt;

    // 2. Xung lực nảy dọc từ ổ gà / va đập
    if (truck.verticalShock > cfg.SHOCK_THRESHOLD) {
      const shockExcess = truck.verticalShock - cfg.SHOCK_THRESHOLD;
      this.velY -= Math.min(180, shockExcess * 8);
      this.applyDirectDamage(shockExcess * 0.32);
    }

    // Trọng lực kéo thùng hàng trở lại mặt sàn (localY = 0)
    if (this.localY < 0 || this.velY < 0) {
      this.velY += 480 * dt;
      this.localY += this.velY * dt;
      if (this.localY >= 0 && Math.abs(this.localX) < 58) {
        // Chạm sàn rơ-moóc -> nếu rơi mạnh gây trừ integrity
        if (this.velY > 85) {
          this.applyDirectDamage((this.velY - 85) * 0.08);
        }
        this.localY = 0;
        this.velY = 0;
      }
    }

    // 3. Kiểm tra văng khỏi rơ-moóc
    if (Math.abs(this.localX) > 62) {
      this.velY += 540 * dt;
      this.localY += this.velY * dt;
      this.tiltAngle += Math.sign(this.localX) * 1.8 * dt;
      if (this.localY > cfg.FALL_OFF_Y_OFFSET_PX) {
        this.fallenOff = true;
        this.integrity = 0;
      }
    } else {
      this.localX = Math.max(-56, Math.min(56, this.localX));
      this.tiltAngle = -this.velX * 0.0008;
    }
  }

  draw(ctx, assetLoader, bed) {
    ctx.save();
    ctx.translate(bed.x, bed.y);
    ctx.rotate(bed.angle);

    // Vẽ 2 dây chằng cam buộc container (sáng đậm hơn nếu đang Gia cố tạm thời)
    ctx.strokeStyle = this.strapBoostTimer > 0 ? "#10b981" : "#f97316";
    ctx.lineWidth = this.strapBoostTimer > 0 ? 3.5 : 2.5;

    ctx.save();
    ctx.translate(this.localX, this.localY - 2);
    ctx.rotate(this.tiltAngle);

    const sprite = assetLoader.getSprite(this.cargoType.spriteKey);
    if (sprite) {
      ctx.drawImage(sprite, -this.width / 2, -this.height, this.width, this.height);
    } else {
      assetLoader.drawVectorContainer(ctx, this.width, this.height, this.cargoType);
    }
    ctx.restore();

    // Đường dây chằng chéo giữ thùng hàng
    if (!this.fallenOff) {
      ctx.beginPath();
      ctx.moveTo(-64, 2);
      ctx.lineTo(this.localX - 50, this.localY - this.height + 6);
      ctx.lineTo(this.localX + 50, this.localY - this.height + 6);
      ctx.lineTo(64, 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
