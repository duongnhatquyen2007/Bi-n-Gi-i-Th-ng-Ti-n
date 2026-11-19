import { GAME_CONFIG, formatVND, formatClock } from "./config.js";

const INTRO_SCENES = [
  {
    step: "Khung cảnh 1 / 3 · Bến cảng đêm với ánh đèn cần cẩu",
    title: "Tàu vừa cập bến",
    lines: [
      {
        speaker: "Điều phối viên",
        text: "Bác tài nghe rõ trả lời! Tàu vừa cập bến, lô hàng xuất khẩu khẩn cấp đã lên rơ-moóc.",
      },
    ],
  },
  {
    step: "Khung cảnh 2 / 3 · Cabin xe đầu kéo nổ máy",
    title: "Sẵn sàng vượt tuyến",
    lines: [
      {
        speaker: "Điều phối viên",
        text: "Cửa khẩu sắp đóng luồng thông quan, phía trước lại đang có cảnh báo thời tiết xấu và ùn tắc.",
      },
      {
        speaker: "Tài xế",
        text: "Rõ! Giao hàng nguyên vẹn, đúng giờ là nghề của tôi.",
      },
    ],
  },
  {
    step: "Khung cảnh 3 / 3 · Lăn bánh rời cổng cảng",
    title: "Biên Giới Thẳng Tiến",
    lines: [
      {
        speaker: "Điều phối viên",
        text: "Giữ vững tay lái, đừng để đứt dây chằng—chúc bác tài thượng lộ bình an, biên giới thẳng tiến!",
      },
    ],
  },
];

export class UIManager {
  constructor(saveManager, soundManager, callbacks) {
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.callbacks = callbacks;

    this.selectedRouteId = 1;
    this.selectedCargoId = "standard";
    this.introIndex = 0;

    // Trạng thái phím & cảm ứng
    this.input = {
      gas: false,
      brake: false,
      handbrake: false,
      interact: false,
    };

    this._cacheElements();
    this._bindEvents();
    this._detectTouchSupport();
    this.refreshSoundLabels();
  }

  _cacheElements() {
    this.el = {
      root: document.getElementById("appRoot"),
      introOverlay: document.getElementById("introOverlay"),
      introSceneStep: document.getElementById("introSceneStep"),
      introSceneTitle: document.getElementById("introSceneTitle"),
      introDialogueBox: document.getElementById("introDialogueBox"),
      btnSkipIntro: document.getElementById("btnSkipIntro"),
      btnNextIntro: document.getElementById("btnNextIntro"),

      menuOverlay: document.getElementById("menuOverlay"),
      menuMoney: document.getElementById("menuMoney"),
      menuReputation: document.getElementById("menuReputation"),
      routeCards: document.getElementById("routeCards"),
      cargoCards: document.getElementById("cargoCards"),
      btnOpenGarage: document.getElementById("btnOpenGarage"),
      btnOpenHistory: document.getElementById("btnOpenHistory"),
      btnExportSaveMenu: document.getElementById("btnExportSaveMenu"),
      btnToggleSoundMenu: document.getElementById("btnToggleSoundMenu"),
      btnStartTrip: document.getElementById("btnStartTrip"),

      hudOverlay: document.getElementById("hudOverlay"),
      hudFuelText: document.getElementById("hudFuelText"),
      hudFuelBar: document.getElementById("hudFuelBar"),
      hudHpText: document.getElementById("hudHpText"),
      hudHpBar: document.getElementById("hudHpBar"),
      hudCargoText: document.getElementById("hudCargoText"),
      hudCargoBar: document.getElementById("hudCargoBar"),
      hudOriginName: document.getElementById("hudOriginName"),
      hudDestName: document.getElementById("hudDestName"),
      hudDistanceText: document.getElementById("hudDistanceText"),
      minimapProgress: document.getElementById("minimapProgress"),
      minimapMarkers: document.getElementById("minimapMarkers"),
      minimapTruck: document.getElementById("minimapTruck"),
      hudDeadlineBox: document.getElementById("hudDeadlineBox"),
      hudDeadlineText: document.getElementById("hudDeadlineText"),
      hudMoney: document.getElementById("hudMoney"),
      hudReputation: document.getElementById("hudReputation"),
      btnToggleSoundHud: document.getElementById("btnToggleSoundHud"),
      btnPauseGame: document.getElementById("btnPauseGame"),
      hudToastContainer: document.getElementById("hudToastContainer"),
      stationPrompt: document.getElementById("stationPrompt"),
      stationPromptTitle: document.getElementById("stationPromptTitle"),
      stationPromptDesc: document.getElementById("stationPromptDesc"),

      hudSpeedValue: document.getElementById("hudSpeedValue"),
      indLights: document.getElementById("indLights"),
      indHandbrake: document.getElementById("indHandbrake"),
      indStrapSep: document.getElementById("indStrapSep"),
      indStrapBoost: document.getElementById("indStrapBoost"),

      btnTouchHorn: document.getElementById("btnTouchHorn"),
      btnTouchLights: document.getElementById("btnTouchLights"),
      btnTouchInteract: document.getElementById("btnTouchInteract"),
      btnTouchHandbrake: document.getElementById("btnTouchHandbrake"),
      btnTouchBrake: document.getElementById("btnTouchBrake"),
      btnTouchGas: document.getElementById("btnTouchGas"),

      pauseModal: document.getElementById("pauseModal"),
      pauseRouteSummary: document.getElementById("pauseRouteSummary"),
      btnResumeGame: document.getElementById("btnResumeGame"),
      btnRestartFromPause: document.getElementById("btnRestartFromPause"),
      btnMenuFromPause: document.getElementById("btnMenuFromPause"),

      garageModal: document.getElementById("garageModal"),
      garageMoney: document.getElementById("garageMoney"),
      garageUpgradeList: document.getElementById("garageUpgradeList"),
      btnCloseGarage: document.getElementById("btnCloseGarage"),

      historyModal: document.getElementById("historyModal"),
      btnCloseHistory: document.getElementById("btnCloseHistory"),
      btnExportSave: document.getElementById("btnExportSave"),
      inputImportSave: document.getElementById("inputImportSave"),
      btnClearHistory: document.getElementById("btnClearHistory"),
      clearHistoryConfirmBox: document.getElementById("clearHistoryConfirmBox"),
      btnConfirmClearHistory: document.getElementById("btnConfirmClearHistory"),
      btnCancelClearHistory: document.getElementById("btnCancelClearHistory"),
      syncFeedback: document.getElementById("syncFeedback"),
      historyTableBody: document.getElementById("historyTableBody"),
      historyEmptyState: document.getElementById("historyEmptyState"),

      victoryModal: document.getElementById("victoryModal"),
      victoryRouteLabel: document.getElementById("victoryRouteLabel"),
      vicCargoType: document.getElementById("vicCargoType"),
      vicTime: document.getElementById("vicTime"),
      vicIntegrity: document.getElementById("vicIntegrity"),
      vicBaseReward: document.getElementById("vicBaseReward"),
      vicCargoBonus: document.getElementById("vicCargoBonus"),
      vicSpeedBonus: document.getElementById("vicSpeedBonus"),
      vicTotalReward: document.getElementById("vicTotalReward"),
      btnVictoryMenu: document.getElementById("btnVictoryMenu"),
      btnVictoryNext: document.getElementById("btnVictoryNext"),

      gameOverModal: document.getElementById("gameOverModal"),
      gameOverReason: document.getElementById("gameOverReason"),
      gameOverStats: document.getElementById("gameOverStats"),
      btnRetryTrip: document.getElementById("btnRetryTrip"),
      btnGameOverGarage: document.getElementById("btnGameOverGarage"),
      btnGameOverMenu: document.getElementById("btnGameOverMenu"),
    };
  }

  _detectTouchSupport() {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 960;
    if (isTouch) {
      this.el.root.classList.add("is-touch-device");
    }
  }

  _bindEvents() {
    // Intro
    this.el.btnSkipIntro.addEventListener("click", () => this.callbacks.onFinishIntro());
    this.el.btnNextIntro.addEventListener("click", () => {
      if (this.introIndex < INTRO_SCENES.length - 1) {
        this.introIndex += 1;
        this.renderIntroScene();
      } else {
        this.callbacks.onFinishIntro();
      }
    });

    // Menu Actions
    this.el.btnStartTrip.addEventListener("click", () => {
      this.callbacks.onStartTrip(this.selectedRouteId, this.selectedCargoId);
    });
    this.el.btnOpenGarage.addEventListener("click", () => this.openGarageModal());
    this.el.btnOpenHistory.addEventListener("click", () => this.openHistoryModal());
    this.el.btnExportSaveMenu.addEventListener("click", () => {
      const filename = this.saveManager.exportSaveFile();
      this.openHistoryModal();
      this.el.syncFeedback.classList.remove("is-error");
      this.el.syncFeedback.textContent = `Đã tải xuống hồ sơ: ${filename}`;
    });
    this.el.btnToggleSoundMenu.addEventListener("click", () => {
      this.soundManager.toggle();
      this.refreshSoundLabels();
    });
    this.el.btnToggleSoundHud.addEventListener("click", () => {
      this.soundManager.toggle();
      this.refreshSoundLabels();
    });

    // Garage
    this.el.btnCloseGarage.addEventListener("click", () => {
      this.el.garageModal.classList.add("hidden");
      this.renderMenu();
    });

    // History & Sync
    this.el.btnCloseHistory.addEventListener("click", () => {
      this.el.clearHistoryConfirmBox.classList.add("hidden");
      this.el.historyModal.classList.add("hidden");
    });
    this.el.btnExportSave.addEventListener("click", () => {
      const filename = this.saveManager.exportSaveFile();
      this.el.syncFeedback.classList.remove("is-error");
      this.el.syncFeedback.textContent = `Đã tải xuống hồ sơ: ${filename}`;
    });
    this.el.inputImportSave.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = this.saveManager.importAndMerge(String(reader.result || ""));
        this.el.syncFeedback.classList.toggle("is-error", !res.ok);
        this.el.syncFeedback.textContent = res.message;
        if (res.ok) {
          this.renderHistoryTable();
          this.renderMenu();
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });
    this.el.btnClearHistory.addEventListener("click", () => {
      if ((this.saveManager.data.tripHistory || []).length === 0) {
        this.el.syncFeedback.classList.remove("is-error");
        this.el.syncFeedback.textContent = "Nhật ký chuyến hàng hiện đang trống.";
        return;
      }
      this.el.clearHistoryConfirmBox.classList.remove("hidden");
    });
    this.el.btnCancelClearHistory.addEventListener("click", () => {
      this.el.clearHistoryConfirmBox.classList.add("hidden");
    });
    this.el.btnConfirmClearHistory.addEventListener("click", () => {
      this.saveManager.clearHistory();
      this.el.clearHistoryConfirmBox.classList.add("hidden");
      this.el.syncFeedback.classList.remove("is-error");
      this.el.syncFeedback.textContent = "Đã xóa toàn bộ lịch sử chuyến hàng.";
      this.renderHistoryTable();
    });

    // Pause
    this.el.btnPauseGame.addEventListener("click", () => this.callbacks.onTogglePause());
    this.el.btnResumeGame.addEventListener("click", () => this.callbacks.onTogglePause());
    this.el.btnRestartFromPause.addEventListener("click", () => this.callbacks.onRestartTrip());
    this.el.btnMenuFromPause.addEventListener("click", () => this.callbacks.onReturnToMenu());

    // Victory & Game Over
    this.el.btnVictoryMenu.addEventListener("click", () => this.callbacks.onReturnToMenu());
    this.el.btnVictoryNext.addEventListener("click", () => {
      const nextId = Math.min(3, this.selectedRouteId + 1);
      this.selectedRouteId = nextId;
      this.callbacks.onStartTrip(nextId, this.selectedCargoId);
    });

    this.el.btnRetryTrip.addEventListener("click", () => this.callbacks.onRestartTrip());
    this.el.btnGameOverGarage.addEventListener("click", () => {
      this.callbacks.onReturnToMenu();
      this.openGarageModal();
    });
    this.el.btnGameOverMenu.addEventListener("click", () => this.callbacks.onReturnToMenu());

    // Keyboard Controls
    window.addEventListener("keydown", (e) => this._handleKey(e, true));
    window.addEventListener("keyup", (e) => this._handleKey(e, false));

    // Touch / Pointer Hold Controls
    const bindHold = (btn, field) => {
      const set = (val, ev) => {
        if (ev) ev.preventDefault();
        this.input[field] = val;
        btn.classList.toggle("is-active", val);
      };
      btn.addEventListener("pointerdown", (e) => set(true, e));
      btn.addEventListener("pointerup", (e) => set(false, e));
      btn.addEventListener("pointercancel", (e) => set(false, e));
      btn.addEventListener("pointerleave", (e) => set(false, e));
    };

    bindHold(this.el.btnTouchGas, "gas");
    bindHold(this.el.btnTouchBrake, "brake");
    bindHold(this.el.btnTouchHandbrake, "handbrake");
    bindHold(this.el.btnTouchInteract, "interact");

    this.el.btnTouchHorn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.callbacks.onHorn();
    });
    this.el.btnTouchLights.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.callbacks.onToggleLights();
    });
  }

  _handleKey(e, isDown) {
    const code = e.code;
    if (code === "KeyD" || code === "ArrowRight") {
      this.input.gas = isDown;
    } else if (code === "KeyA" || code === "ArrowLeft") {
      this.input.brake = isDown;
    } else if (code === "Space") {
      if (isDown && !e.repeat) this.callbacks.onHandbrakePressed();
      this.input.handbrake = isDown;
    } else if (code === "KeyE") {
      this.input.interact = isDown;
      if (isDown && !e.repeat) this.callbacks.onInteractPressed();
    } else if (isDown && !e.repeat) {
      if (code === "KeyH") this.callbacks.onHorn();
      else if (code === "KeyL") this.callbacks.onToggleLights();
      else if (code === "Escape" || code === "KeyP") this.callbacks.onTogglePause();
    }
  }

  resetInputs() {
    this.input.gas = false;
    this.input.brake = false;
    this.input.handbrake = false;
    this.input.interact = false;
  }

  refreshSoundLabels() {
    const on = this.soundManager.enabled;
    this.el.btnToggleSoundMenu.textContent = `Âm thanh: ${on ? "Bật" : "Tắt"}`;
    this.el.btnToggleSoundHud.textContent = on ? "Loa" : "Tắt";
  }

  hideAllScreens() {
    this.el.introOverlay.classList.add("hidden");
    this.el.menuOverlay.classList.add("hidden");
    this.el.hudOverlay.classList.add("hidden");
    this.el.pauseModal.classList.add("hidden");
    this.el.garageModal.classList.add("hidden");
    this.el.historyModal.classList.add("hidden");
    this.el.victoryModal.classList.add("hidden");
    this.el.gameOverModal.classList.add("hidden");
  }

  showIntro() {
    this.hideAllScreens();
    this.introIndex = 0;
    this.renderIntroScene();
    this.el.introOverlay.classList.remove("hidden");
  }

  renderIntroScene() {
    const scene = INTRO_SCENES[this.introIndex];
    this.el.introSceneStep.textContent = scene.step;
    this.el.introSceneTitle.textContent = scene.title;
    this.el.introDialogueBox.innerHTML = "";
    for (const line of scene.lines) {
      const div = document.createElement("div");
      div.className = "dialogue-line";
      div.innerHTML = `<span class="dialogue-speaker">${line.speaker}</span><span>"${line.text}"</span>`;
      this.el.introDialogueBox.appendChild(div);
    }
    this.el.btnNextIntro.textContent =
      this.introIndex === INTRO_SCENES.length - 1 ? "Vào Bảng Điều Phối" : "Tiếp tục";
  }

  showMenu() {
    this.hideAllScreens();
    this.renderMenu();
    this.el.menuOverlay.classList.remove("hidden");
  }

  renderMenu() {
    this.el.menuMoney.textContent = formatVND(this.saveManager.getMoney());
    this.el.menuReputation.textContent = `${this.saveManager.data.maxReputation} điểm`;

    // Render 3 Route Cards
    this.el.routeCards.innerHTML = "";
    for (const r of GAME_CONFIG.ROUTES) {
      const unlocked = this.saveManager.data.unlockedRoutes.includes(r.id);
      if (!unlocked && this.selectedRouteId === r.id) {
        this.selectedRouteId = 1;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.disabled = !unlocked;
      btn.className = `select-card ${this.selectedRouteId === r.id ? "is-selected" : ""} ${!unlocked ? "is-locked" : ""}`;
      btn.innerHTML = `
        <div class="card-top-row">
          <span class="card-title">Tuyến ${r.id}: ${r.name}</span>
          <span class="card-meta-strong tabular-nums">${unlocked ? formatVND(r.baseRewardVND) : "Đang khóa"}</span>
        </div>
        <div class="card-meta-text">${r.terrainDesc}</div>
        <div class="card-meta-text tabular-nums">
          Độ khó: ${r.difficultyLabel} · ${r.lengthMeters}m · Dốc tối đa ${r.maxSlopeDeg}° · Hạn ${r.baseDeadlineSec}s · ${r.weatherLabel}
        </div>
      `;
      btn.addEventListener("click", () => {
        if (!unlocked) return;
        this.selectedRouteId = r.id;
        this.renderMenu();
      });
      this.el.routeCards.appendChild(btn);
    }

    // Render 3 Cargo Cards
    this.el.cargoCards.innerHTML = "";
    for (const c of GAME_CONFIG.CARGO_TYPES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `select-card ${this.selectedCargoId === c.id ? "is-selected" : ""}`;
      btn.innerHTML = `
        <div class="card-top-row">
          <span class="card-title">${c.name}</span>
          <span class="card-meta-strong tabular-nums">Thưởng ${c.rewardMultiplier}×</span>
        </div>
        <div class="card-meta-text">${c.subtitle}</div>
        <div class="card-meta-text tabular-nums">
          Khối lượng ${c.massKg}kg · Xăng ${c.fuelMultiplier}× · Thời gian ${c.deadlineMultiplier}× · Độ xóc ${c.shockMultiplier}×
        </div>
      `;
      btn.addEventListener("click", () => {
        this.selectedCargoId = c.id;
        this.renderMenu();
      });
      this.el.cargoCards.appendChild(btn);
    }
  }

  openGarageModal() {
    this.renderGarage();
    this.el.garageModal.classList.remove("hidden");
  }

  renderGarage() {
    this.el.garageMoney.textContent = formatVND(this.saveManager.getMoney());
    this.el.garageUpgradeList.innerHTML = "";

    for (const item of Object.values(GAME_CONFIG.UPGRADES.ITEMS)) {
      const level = this.saveManager.getUpgradeLevel(item.key);
      const isMax = level >= GAME_CONFIG.UPGRADES.MAX_LEVEL;
      const nextCost = isMax ? 0 : item.costs[level - 1];
      const canAfford = !isMax && this.saveManager.getMoney() >= nextCost;

      const card = document.createElement("div");
      card.className = "upgrade-card";

      const pips = Array.from({ length: GAME_CONFIG.UPGRADES.MAX_LEVEL }, (_, idx) => {
        return `<div class="level-pip ${idx < level ? "is-filled" : ""}"></div>`;
      }).join("");

      card.innerHTML = `
        <div>
          <div class="card-top-row">
            <h3>${item.name}</h3>
            <span class="card-meta-strong tabular-nums">Cấp ${level}/5</span>
          </div>
          <p class="upgrade-desc">${item.desc}</p>
          <div class="level-pips">${pips}</div>
        </div>
        <button type="button" class="${canAfford ? "btn-primary" : "btn-secondary"}" ${isMax || !canAfford ? "disabled" : ""}>
          ${isMax ? "Đã đạt tối đa" : `Nâng cấp · ${formatVND(nextCost)}`}
        </button>
      `;

      const upgradeBtn = card.querySelector("button");
      upgradeBtn.addEventListener("click", () => {
        const res = this.saveManager.purchaseUpgrade(item.key);
        if (res.ok) {
          this.soundManager.playPickup();
          this.renderGarage();
          this.renderMenu();
        }
      });

      this.el.garageUpgradeList.appendChild(card);
    }
  }

  openHistoryModal() {
    this.el.syncFeedback.textContent = "";
    this.el.clearHistoryConfirmBox.classList.add("hidden");
    this.renderHistoryTable();
    this.el.historyModal.classList.remove("hidden");
  }

  renderHistoryTable() {
    const trips = this.saveManager.data.tripHistory || [];
    this.el.historyTableBody.innerHTML = "";
    this.el.historyEmptyState.classList.toggle("hidden", trips.length > 0);

    for (const t of trips) {
      const tr = document.createElement("tr");
      const dateStr = new Date(t.timestamp).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      tr.innerHTML = `
        <td class="tabular-nums">${dateStr}</td>
        <td>${t.routeName}</td>
        <td>${t.cargoType}</td>
        <td class="tabular-nums">${t.cargoIntegrity}%</td>
        <td class="tabular-nums text-amber">${formatVND(t.rewardVND)}</td>
        <td>${t.platform || "Web"}</td>
      `;
      this.el.historyTableBody.appendChild(tr);
    }
  }

  showPlayingHUD(route, stations) {
    this.hideAllScreens();
    this.el.hudOverlay.classList.remove("hidden");
    this.el.hudOriginName.textContent = route.origin;
    this.el.hudDestName.textContent = route.destination;
    this.el.hudToastContainer.innerHTML = "";
    this.setStationPrompt(null);

    // Đánh dấu các trạm trên minimap
    this.el.minimapMarkers.innerHTML = "";
    const totalLen = route.lengthMeters * GAME_CONFIG.PIXELS_PER_METER;
    for (const s of stations) {
      const pct = Math.max(2, Math.min(98, ((s.x - 240) / totalLen) * 100));
      const dot = document.createElement("div");
      dot.className = `mm-dot mm-${s.minimapType}`;
      dot.style.left = `${pct}%`;
      dot.title = s.label;
      this.el.minimapMarkers.appendChild(dot);
    }
  }

  updateHUD({ truck, cargoPhysics, terrain, deadlineSec }) {
    const fuel = Math.round(truck.fuel);
    const hp = Math.round(truck.hp);
    const cargo = Math.round(cargoPhysics.integrity);

    this.el.hudFuelText.textContent = `${fuel}%`;
    this.el.hudFuelBar.style.width = `${fuel}%`;
    this.el.hudFuelBar.classList.toggle("bar-critical", fuel < 30);

    this.el.hudHpText.textContent = `${hp}%`;
    this.el.hudHpBar.style.width = `${hp}%`;
    this.el.hudHpBar.classList.toggle("bar-critical", hp < 30);

    this.el.hudCargoText.textContent = `${cargo}%`;
    this.el.hudCargoBar.style.width = `${cargo}%`;
    this.el.hudCargoBar.classList.toggle("bar-critical", cargo < 55);

    const distM = Math.round(terrain.getDistanceMeters(truck.x));
    const pct = Math.round(terrain.getProgressRatio(truck.x) * 100);
    this.el.hudDistanceText.textContent = `${distM} / ${terrain.route.lengthMeters}m`;
    this.el.minimapProgress.style.width = `${pct}%`;
    this.el.minimapTruck.style.left = `${pct}%`;

    this.el.hudDeadlineText.textContent = formatClock(deadlineSec);
    this.el.hudDeadlineBox.classList.toggle("is-urgent", deadlineSec <= 25);

    this.el.hudMoney.textContent = formatVND(this.saveManager.getMoney());
    this.el.hudReputation.textContent = `Uy tín: ${this.saveManager.data.maxReputation}`;

    this.el.hudSpeedValue.textContent = String(Math.round(truck.getSpeedKmh()));
    this.el.indLights.textContent = `Đèn: ${truck.headlightsOn ? "Bật" : "Tắt"}`;
    this.el.indLights.classList.toggle("is-on", truck.headlightsOn);
    this.el.indHandbrake.classList.toggle("is-on", truck.handbrakeOn);

    const strapActive = cargoPhysics.strapBoostTimer > 0;
    this.el.indStrapSep.classList.toggle("hidden", !strapActive);
    this.el.indStrapBoost.classList.toggle("hidden", !strapActive);
    if (strapActive) {
      this.el.indStrapBoost.textContent = `Gia cố: ${Math.ceil(cargoPhysics.strapBoostTimer)}s`;
    }
  }

  setStationPrompt(promptInfo) {
    if (!promptInfo) {
      this.el.stationPrompt.classList.add("hidden");
      this.el.btnTouchInteract.classList.add("hidden");
      return;
    }
    this.el.stationPrompt.classList.remove("hidden");
    this.el.stationPromptTitle.textContent = promptInfo.title;
    this.el.stationPromptDesc.textContent = promptInfo.desc;
    this.el.btnTouchInteract.classList.toggle("hidden", !promptInfo.canInteract);
  }

  showToast(message, variant = "info") {
    const div = document.createElement("div");
    div.className = `hud-toast ${variant === "warn" ? "toast-warn" : variant === "good" ? "toast-good" : ""}`;
    div.textContent = message;
    this.el.hudToastContainer.appendChild(div);
    if (this.el.hudToastContainer.children.length > 3) {
      this.el.hudToastContainer.firstElementChild.remove();
    }
    setTimeout(() => {
      if (div.parentNode) div.remove();
    }, 3200);
  }

  setPaused(isPaused, route) {
    if (route) {
      this.el.pauseRouteSummary.textContent = `Tuyến ${route.id}: ${route.name}`;
    }
    this.el.pauseModal.classList.toggle("hidden", !isPaused);
  }

  showVictory(summary) {
    this.el.victoryRouteLabel.textContent = summary.route.name;
    this.el.vicCargoType.textContent = summary.cargo.name;
    this.el.vicTime.textContent = `${summary.completionTimeSec} giây (dư ${summary.remainingSec}s)`;
    this.el.vicIntegrity.textContent = `${summary.cargoIntegrity}%`;
    this.el.vicBaseReward.textContent = formatVND(summary.basePart);
    this.el.vicCargoBonus.textContent = `+${formatVND(summary.cargoBonus)}`;
    this.el.vicSpeedBonus.textContent = `+${formatVND(summary.speedBonus)}`;
    this.el.vicTotalReward.textContent = `${formatVND(summary.totalReward)} (+${summary.repGain} uy tín)`;
    this.el.btnVictoryNext.classList.toggle("hidden", summary.route.id >= 3);
    this.el.victoryModal.classList.remove("hidden");
  }

  showGameOver(reason, stats) {
    this.el.gameOverReason.textContent = reason;
    this.el.gameOverStats.innerHTML = `
      <span>Quãng đường đã đi: <strong class="tabular-nums">${stats.distanceM} / ${stats.totalM}m</strong></span>
      <span>Nhiên liệu còn: <strong class="tabular-nums">${stats.fuel}%</strong> · Độ bền xe: <strong class="tabular-nums">${stats.hp}%</strong> · Hàng: <strong class="tabular-nums">${stats.cargo}%</strong></span>
    `;
    this.el.gameOverModal.classList.remove("hidden");
  }
}
