import { GAME_CONFIG } from "./config.js";

export class CheckpointManager {
  constructor(terrain, route, saveManager, soundManager, uiManager) {
    this.terrain = terrain;
    this.route = route;
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.uiManager = uiManager;

    this.stations = []; // GasStation, RepairStation, WeighStation, TollBooth
    this.hazards = []; // Pothole, Rockslide
    this.pickups = []; // Pickup_Fuel, Pickup_Repair, Pickup_Strap
    this.oncomingVehicles = [];
    this.activePrompt = null;

    this._populateWorld();
  }

  _populateWorld() {
    const startX = this.terrain.startX;
    const lenPx = this.terrain.lengthPx;
    const counts = this.route.counts;

    const usableStart = startX + 220 * GAME_CONFIG.PIXELS_PER_METER;
    const usableEnd = startX + lenPx - 200 * GAME_CONFIG.PIXELS_PER_METER;
    const span = usableEnd - usableStart;

    // 1. Trạm xăng (giữa đường)
    for (let i = 0; i < counts.gasStations; i++) {
      const ratio = (i + 1) / (counts.gasStations + 1);
      const x = usableStart + span * ratio;
      this.stations.push({
        id: `gas_${i}`,
        type: "GasStation",
        x,
        width: 190,
        label: "TRẠM XĂNG DẦU",
        minimapType: "gas",
        resolved: false,
      });
    }

    // 2. Trạm sửa chữa
    for (let i = 0; i < counts.repairStations; i++) {
      const ratio = (i + 0.62) / (counts.repairStations + 0.6);
      const x = usableStart + span * ratio;
      this.stations.push({
        id: `repair_${i}`,
        type: "RepairStation",
        x,
        width: 190,
        label: "TRẠM SỬA CHỮA",
        minimapType: "repair",
        resolved: false,
      });
    }

    // 3. Trạm cân tải trọng (180px, giới hạn 15 km/h)
    for (let i = 0; i < counts.weighStations; i++) {
      const ratio = (i + 0.42) / (counts.weighStations + 0.2);
      const x = usableStart + span * ratio;
      this.stations.push({
        id: `weigh_${i}`,
        type: "WeighStation",
        x,
        width: GAME_CONFIG.WORLD_RULES.WEIGH_ZONE_WIDTH_PX,
        label: "TRẠM CÂN (≤15 km/h)",
        minimapType: "check",
        barrierOpen: false,
        smashed: false,
        resolved: false,
      });
    }

    // 4. Trạm thu phí BOT (giới hạn 25 km/h)
    for (let i = 0; i < counts.tollBooths; i++) {
      const ratio = (i + 0.25) / (counts.tollBooths + 0.2);
      const x = usableStart + span * (ratio * 0.85 + 0.08);
      this.stations.push({
        id: `toll_${i}`,
        type: "TollBooth",
        x,
        width: 150,
        label: "TRẠM BOT (≤25 km/h)",
        minimapType: "check",
        barrierOpen: false,
        smashed: false,
        resolved: false,
      });
    }

    // Sắp xếp và tách nhẹ các trạm nếu quá sát nhau
    this.stations.sort((a, b) => a.x - b.x);
    for (let i = 1; i < this.stations.length; i++) {
      if (this.stations[i].x - this.stations[i - 1].x < 420) {
        this.stations[i].x = this.stations[i - 1].x + 420;
      }
    }

    // 5. Ổ gà & Đá lở (tránh đặt trùng lên vùng trạm)
    const isNearStation = (x) => this.stations.some((s) => Math.abs(s.x - x) < 230);

    for (let i = 0; i < counts.potholes; i++) {
      const ratio = (i + 0.5) / counts.potholes;
      let x = usableStart + span * ratio + Math.sin(i * 4.1) * 140;
      if (isNearStation(x)) x += 260;
      this.hazards.push({
        type: "Pothole",
        x,
        width: 72,
        cooldown: 0,
      });
    }

    for (let i = 0; i < counts.rockslides; i++) {
      const ratio = (i + 0.55) / counts.rockslides;
      let x = usableStart + span * ratio + Math.cos(i * 3.2) * 120;
      if (isNearStation(x)) x -= 260;
      this.hazards.push({
        type: "Rockslide",
        x,
        width: 82,
        cooldown: 0,
      });
    }

    // 6. Vật phẩm nhặt trên đường (Can dầu, Cờ lê, Dây chằng)
    const pickupPool = ["Pickup_Fuel", "Pickup_Repair", "Pickup_Strap"];
    for (let i = 0; i < counts.pickups; i++) {
      const ratio = (i + 0.45) / counts.pickups;
      const x = usableStart + span * ratio;
      this.pickups.push({
        type: pickupPool[i % pickupPool.length],
        x,
        collected: false,
      });
    }

    // 7. Xe đi ngược chiều (kích hoạt xuất hiện phía trước khi người chơi tới gần)
    for (let i = 0; i < counts.oncomingVehicles; i++) {
      const ratio = (i + 0.55) / (counts.oncomingVehicles + 0.4);
      const triggerX = usableStart + span * ratio;
      this.oncomingVehicles.push({
        triggerX,
        spawned: false,
        x: triggerX + 950,
        baseSpeed: 210 + (this.route.id - 1) * 35,
        yielded: false,
        hit: false,
        active: false,
      });
    }
  }

  triggerHorn(truck) {
    const hornRadius = GAME_CONFIG.CAMERA.HORN_RADIUS_PX;
    let warnedAny = false;
    for (const ov of this.oncomingVehicles) {
      if (!ov.active || ov.hit) continue;
      const dist = ov.x - truck.x;
      if (dist > 0 && dist <= hornRadius) {
        if (!ov.yielded) {
          ov.yielded = true;
          warnedAny = true;
        }
      }
    }
    if (warnedAny) {
      this.uiManager.showToast("Xe ngược chiều đã nghe còi và giảm tốc nép lề!", "good");
    }
  }

  update(dt, truck, cargoPhysics, input) {
    const rules = GAME_CONFIG.WORLD_RULES;
    const speedKmh = truck.getSpeedKmh();
    let promptInfo = null;

    // 1. Ổ gà & Đá lở
    for (const h of this.hazards) {
      if (h.cooldown > 0) h.cooldown -= dt;
      if (h.cooldown <= 0 && Math.abs(truck.x - h.x) < h.width * 0.65) {
        h.cooldown = 1.6;
        if (speedKmh > rules.POTHOLE_SAFE_SPEED_KMH) {
          const factor = Math.min(1, (speedKmh - rules.POTHOLE_SAFE_SPEED_KMH) / 50);
          const hpDmg = 3 + factor * 7;
          const cargoDmg = 2 + factor * 10;
          truck.applyHazardJolt(180 + factor * 130, hpDmg);
          cargoPhysics.applyDirectDamage(cargoDmg);
          this.soundManager.playImpact(0.9 + factor * 0.6);
          this.uiManager.showToast(
            `${h.type === "Rockslide" ? "Đá lở" : "Sập ổ gà"} ở ${Math.round(speedKmh)} km/h! (-${Math.round(hpDmg)}% bền xe)`,
            "warn"
          );
        }
      }
    }

    // 2. Vật phẩm nhặt dọc đường
    for (const p of this.pickups) {
      if (p.collected) continue;
      if (Math.abs(truck.x - p.x) < 62) {
        p.collected = true;
        if (p.type === "Pickup_Fuel") {
          this.soundManager.playPickupFuel();
          truck.fuel = Math.min(100, truck.fuel + rules.PICKUP_FUEL_AMOUNT);
          this.uiManager.showToast(`Nhặt Can dầu: +${rules.PICKUP_FUEL_AMOUNT}% nhiên liệu`, "good");
        } else if (p.type === "Pickup_Repair") {
          this.soundManager.playPickupRepair();
          truck.hp = Math.min(100, truck.hp + rules.PICKUP_REPAIR_AMOUNT);
          this.uiManager.showToast(`Nhặt Cờ lê: +${rules.PICKUP_REPAIR_AMOUNT}% độ bền xe`, "good");
        } else if (p.type === "Pickup_Strap") {
          this.soundManager.playPickupStrap();
          cargoPhysics.activateStrapBoost();
          this.uiManager.showToast("Nhặt Dây chằng: +20% hàng & giảm 50% xóc trong 12s", "good");
        }
      }
    }

    // 3. Các Trạm tương tác & Trạm kiểm soát
    for (const s of this.stations) {
      const dist = Math.abs(truck.x - s.x);
      const inZone = dist <= s.width * 0.55;

      if (s.type === "GasStation" && inZone) {
        promptInfo = {
          title: "Trạm Xăng Dầu",
          desc:
            speedKmh < rules.STATION_STOP_SPEED_KMH
              ? "Giữ phím [E] để bơm dầu (+20%/s · 5.000 VNĐ/1%)"
              : "Giảm tốc dưới 5 km/h và giữ [E] để bơm dầu",
          canInteract: speedKmh < rules.STATION_STOP_SPEED_KMH,
        };
        if (input.interact && speedKmh < rules.STATION_STOP_SPEED_KMH && truck.fuel < 99.9) {
          const wanted = Math.min(100 - truck.fuel, rules.GAS_RATE_PER_SEC * dt);
          const maxAffordable = this.saveManager.getMoney() / rules.GAS_COST_PER_PERCENT_VND;
          const actual = Math.min(wanted, maxAffordable);
          if (actual > 0.01) {
            truck.fuel = Math.min(100, truck.fuel + actual);
            this.saveManager.addMoney(-actual * rules.GAS_COST_PER_PERCENT_VND);
            this.soundManager.playRefuelTick();
          } else {
            this.uiManager.showToast("Không đủ tiền bơm thêm dầu!", "warn");
          }
        }
      } else if (s.type === "RepairStation" && inZone) {
        promptInfo = {
          title: "Trạm Sửa Chữa Cơ Khí",
          desc:
            speedKmh < rules.STATION_STOP_SPEED_KMH
              ? "Giữ phím [E] để sửa xe (+15%/s · 10.000 VNĐ/1%)"
              : "Giảm tốc dưới 5 km/h và giữ [E] để sửa xe",
          canInteract: speedKmh < rules.STATION_STOP_SPEED_KMH,
        };
        if (input.interact && speedKmh < rules.STATION_STOP_SPEED_KMH && truck.hp < 99.9) {
          const wanted = Math.min(100 - truck.hp, rules.REPAIR_RATE_PER_SEC * dt);
          const maxAffordable = this.saveManager.getMoney() / rules.REPAIR_COST_PER_PERCENT_VND;
          const actual = Math.min(wanted, maxAffordable);
          if (actual > 0.01) {
            truck.hp = Math.min(100, truck.hp + actual);
            this.saveManager.addMoney(-actual * rules.REPAIR_COST_PER_PERCENT_VND);
            this.soundManager.playRepairTick();
          } else {
            this.uiManager.showToast("Không đủ tiền sửa chữa xe!", "warn");
          }
        }
      } else if (s.type === "WeighStation" && !s.resolved) {
        if (dist < 260 && !inZone) {
          promptInfo = {
            title: "Phía trước: Trạm Cân Tải Trọng",
            desc: `Giảm tốc xuống ≤ ${rules.WEIGH_LIMIT_KMH} km/h để tránh phạt 150.000 VNĐ`,
            canInteract: false,
          };
        }
        if (inZone) {
          s.resolved = true;
          if (speedKmh <= rules.WEIGH_LIMIT_KMH) {
            s.barrierOpen = true;
            this.soundManager.playPickup();
            this.uiManager.showToast("Trạm cân: Đạt chuẩn tốc độ, barie đã mở!", "good");
          } else {
            s.smashed = true;
            this.saveManager.addMoney(-rules.WEIGH_FINE_VND);
            this.saveManager.adjustReputation(-rules.WEIGH_REP_PENALTY);
            cargoPhysics.applyDirectDamage(5);
            this.soundManager.playPenalty();
            this.uiManager.showToast("Vượt ẩu trạm cân! Phạt 150.000 VNĐ, -15 uy tín, -5% hàng", "warn");
          }
        }
      } else if (s.type === "TollBooth" && !s.resolved) {
        if (dist < 260 && !inZone) {
          promptInfo = {
            title: "Phía trước: Trạm Thu Phí BOT",
            desc: `Qua trạm ≤ ${rules.TOLL_LIMIT_KMH} km/h (Phí 35.000 VNĐ)`,
            canInteract: false,
          };
        }
        if (inZone) {
          s.resolved = true;
          if (speedKmh <= rules.TOLL_LIMIT_KMH) {
            s.barrierOpen = true;
            this.saveManager.addMoney(-rules.TOLL_FEE_VND);
            this.soundManager.playPickup();
            this.uiManager.showToast("Trạm BOT: Đã thu phí 35.000 VNĐ, qua trạm an toàn.", "good");
          } else {
            s.smashed = true;
            this.saveManager.addMoney(-rules.TOLL_FINE_VND);
            this.saveManager.adjustReputation(-rules.TOLL_REP_PENALTY);
            cargoPhysics.applyDirectDamage(5);
            this.soundManager.playPenalty();
            this.uiManager.showToast("Thông chốt BOT! Phạt 200.000 VNĐ, -15 uy tín, -5% hàng", "warn");
          }
        }
      }
    }

    // 4. Vùng Cổng Cửa khẩu Quốc tế (Vạch đích)
    if (truck.x >= this.terrain.finishX - 160) {
      promptInfo = {
        title: "Cổng Cửa Khẩu Quốc Tế",
        desc:
          speedKmh <= rules.FINISH_STOP_SPEED_KMH
            ? "Đang làm thủ tục thông quan..."
            : "Giảm tốc ≤ 10 km/h hoặc nhấn [E] tại vạch đích để thông quan!",
        canInteract: true,
      };
    }

    // 5. Xe đi ngược chiều
    for (const ov of this.oncomingVehicles) {
      if (!ov.spawned && truck.x >= ov.triggerX - 750) {
        ov.spawned = true;
        ov.active = true;
        ov.x = truck.x + 860;
      }
      if (!ov.active) continue;

      const curSpeed = ov.yielded ? ov.baseSpeed * rules.ONCOMING_HORN_SLOW_FACTOR : ov.baseSpeed;
      ov.x -= curSpeed * dt;

      // Va chạm trực diện nếu xe ngược chiều không được nhường đường kịp
      if (!ov.hit && !ov.yielded && Math.abs(ov.x - truck.x) < 105) {
        ov.hit = true;
        ov.active = false;
        truck.applyKnockback(-140, rules.ONCOMING_HIT_HP_DMG);
        cargoPhysics.applyDirectDamage(rules.ONCOMING_HIT_CARGO_DMG);
        this.soundManager.playImpact(1.4);
        this.uiManager.showToast(
          `Va chạm xe ngược chiều! (-${rules.ONCOMING_HIT_HP_DMG}% bền xe, -${rules.ONCOMING_HIT_CARGO_DMG}% hàng)`,
          "warn"
        );
      }

      if (ov.x < truck.x - 500) {
        ov.active = false;
      }
    }

    this.activePrompt = promptInfo;
    this.uiManager.setStationPrompt(promptInfo);
  }

  draw(ctx, startWorldX, endWorldX, assetLoader) {
    // 1. Vẽ Trạm
    for (const s of this.stations) {
      if (s.x < startWorldX - 240 || s.x > endWorldX + 240) continue;
      const y = this.terrain.getHeightAt(s.x);
      const slope = this.terrain.getSlopeAngleAt(s.x);
      ctx.save();
      ctx.translate(s.x, y);
      ctx.rotate(slope * 0.4);

      if (s.type === "TollBooth" || s.type === "WeighStation") {
        const sprite = assetLoader.getSprite("tollBooth");
        if (sprite && s.type === "TollBooth") {
          ctx.drawImage(sprite, -72, -118, 144, 120);
        } else {
          assetLoader.drawVectorProp(ctx, s.type === "WeighStation" ? "weighStation" : "tollBooth", 130, 112, s.label);
        }
        // Trạng thái đèn xanh/đỏ & thanh barie
        ctx.fillStyle = s.barrierOpen ? "#10b981" : s.smashed ? "#ef4444" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(0, -126, 7, 0, Math.PI * 2);
        ctx.fill();

        if (!s.barrierOpen && !s.smashed) {
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(-50, -34, 96, 6);
        }
      } else {
        assetLoader.drawVectorProp(
          ctx,
          s.type === "GasStation" ? "gasStation" : "repairStation",
          160,
          122,
          s.label
        );
      }
      ctx.restore();
    }

    // 2. Vẽ Ổ gà & Đá lở
    for (const h of this.hazards) {
      if (h.x < startWorldX - 120 || h.x > endWorldX + 120) continue;
      const y = this.terrain.getHeightAt(h.x);
      const slope = this.terrain.getSlopeAngleAt(h.x);
      ctx.save();
      ctx.translate(h.x, y);
      ctx.rotate(slope);

      if (h.type === "Pothole") {
        const sp = assetLoader.getSprite("pothole");
        if (sp) ctx.drawImage(sp, -38, -14, 76, 36);
        else assetLoader.drawVectorProp(ctx, "pothole", 76, 34);
      } else {
        const sp = assetLoader.getSprite("rockslide");
        if (sp) ctx.drawImage(sp, -44, -46, 88, 52);
        else assetLoader.drawVectorProp(ctx, "rockslide", 88, 50);
      }
      ctx.restore();
    }

    // 3. Vẽ Vật phẩm nhặt
    for (const p of this.pickups) {
      if (p.collected || p.x < startWorldX - 80 || p.x > endWorldX + 80) continue;
      const y = this.terrain.getHeightAt(p.x) - 10;
      const bob = Math.sin(performance.now() * 0.005 + p.x) * 4;
      ctx.save();
      ctx.translate(p.x, y + bob);
      const key =
        p.type === "Pickup_Fuel" ? "pickupFuel" : p.type === "Pickup_Repair" ? "pickupRepair" : "pickupStrap";
      const sp = assetLoader.getSprite(key);
      if (sp) {
        ctx.drawImage(sp, -20, -44, 40, 44);
      } else {
        assetLoader.drawVectorProp(ctx, key.charAt(0).toLowerCase() + key.slice(1), 36, 40);
      }
      ctx.restore();
    }

    // 4. Vẽ Xe đi ngược chiều
    for (const ov of this.oncomingVehicles) {
      if (!ov.active || ov.x < startWorldX - 180 || ov.x > endWorldX + 180) continue;
      const y = this.terrain.getHeightAt(ov.x) - 24;
      const slope = this.terrain.getSlopeAngleAt(ov.x);
      ctx.save();
      ctx.translate(ov.x, y + (ov.yielded ? -8 : 0));
      ctx.rotate(slope);
      ctx.globalAlpha = ov.yielded ? 0.72 : 1.0;

      // Vẽ xe tải ngược chiều hướng sang trái
      ctx.fillStyle = ov.yielded ? "#64748b" : "#dc2626";
      ctx.fillRect(-52, -28, 104, 34);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(-48, -22, 22, 16);
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(-56, -4, 6, 8);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-30, 12, 11, 0, Math.PI * 2);
      ctx.arc(32, 12, 11, 0, Math.PI * 2);
      ctx.fill();

      if (!ov.yielded) {
        ctx.fillStyle = "#fef08a";
        ctx.font = "700 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bấm [H] còi!", 0, -38);
      }
      ctx.restore();
    }
  }
}
