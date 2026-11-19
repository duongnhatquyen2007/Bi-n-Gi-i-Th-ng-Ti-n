// ============================================================================
// GAME_CONFIG: Toàn bộ hằng số vật lý, tuyến đường, hàng hóa, nâng cấp & lưu trữ
// ============================================================================

export const GAME_CONFIG = {
  // Tỷ lệ quy đổi thế giới 2D
  PIXELS_PER_METER: 18,
  GRAVITY: 9.81,
  MAX_DELTA_TIME: 0.05,
  FIXED_DT: 1 / 60,

  // Tài nguyên hình ảnh (ưu tiên ảnh đã nạp trong public/assets/aistudio)
  ASSETS: {
    TRUCK_SHEET: "/assets/aistudio/xe_64dfe34f.png",
    TOOL_SHEET: "/assets/aistudio/tool_b60fb3dc.png",
    BACKGROUND: "/assets/aistudio/bg_a6451ef7.png",
    TRUCK_FRAME_WIDTH: 180,
    TRUCK_FRAME_HEIGHT: 80,
  },

  // Tham số Camera
  CAMERA: {
    LERP_FACTOR: 0.08,
    LOOK_AHEAD_X: 220,
    ZOOM_MIN_SPEED: 20, // km/h
    ZOOM_DEFAULT: 1.0,
    ZOOM_HIGH_SPEED: 0.78,
    HORN_RADIUS_PX: 450,
    HEADLIGHT_RANGE_PX: 500,
  },

  // Thông số vật lý Xe đầu kéo & Hệ thống treo
  TRUCK_PHYSICS: {
    TRACTOR_MASS_KG: 6000,
    TRAILER_MASS_KG: 3000,
    BASE_TORQUE_N: 18000, // Tăng +15% mỗi cấp nâng cấp Động cơ
    ENGINE_UPGRADE_BONUS: 0.15,
    MAX_SPEED_KMH: 85,
    LOW_HP_THRESHOLD: 30, // Dưới 30% HP giảm 20% tốc độ tối đa
    LOW_HP_SPEED_FACTOR: 0.8,
    BRAKE_FORCE_N: 26000,
    HANDBRAKE_FORCE_N: 48000,
    REVERSE_HOLD_DELAY_SEC: 0.4,
    REVERSE_MAX_SPEED_KMH: 24,
    AIR_DRAG_COEFF: 2.8,
    ROLLING_RESISTANCE_COEFF: 0.018,
    HITCH_MIN_ANGLE_DEG: -12,
    HITCH_MAX_ANGLE_DEG: 12,
    SUSPENSION_STIFFNESS: 210,
    SUSPENSION_DAMPING: 18,
    SUSPENSION_UPGRADE_DAMPING_BONUS: 0.18,
    SUSPENSION_UPGRADE_SHOCK_REDUCTION: 0.15,
    FUEL_BURN_IDLE_PER_SEC: 0.09,
    FUEL_BURN_THROTTLE_PER_SEC: 0.42,
    FUEL_SLOPE_UPHILL_MULT: 1.5,
    FUEL_UPGRADE_SAVING_PER_LEVEL: 0.12,
    ROLLOVER_ANGLE_DEG: 85,
    ROLLOVER_TIMEOUT_SEC: 1.5,
  },

  // Vật lý thùng hàng & Dây chằng
  CARGO_PHYSICS: {
    BED_FRICTION: 0.65,
    MAX_STRAP_IMPULSE: 14.5, // Ngưỡng xung lực giữ dây chằng
    SHOCK_THRESHOLD: 6.2, // Ngưỡng gia tốc gây nảy/xóc hàng
    FALL_OFF_Y_OFFSET_PX: 80,
    STRAP_BOOST_DURATION_SEC: 12,
    STRAP_BOOST_DAMAGE_MULT: 0.5,
    MIN_VICTORY_INTEGRITY: 50,
  },

  // Quy tắc trạm, chướng ngại & phần thưởng
  WORLD_RULES: {
    POTHOLE_SAFE_SPEED_KMH: 35,
    WEIGH_ZONE_WIDTH_PX: 180,
    WEIGH_LIMIT_KMH: 15,
    WEIGH_FINE_VND: 150000,
    WEIGH_REP_PENALTY: 15,
    TOLL_LIMIT_KMH: 25,
    TOLL_FEE_VND: 35000,
    TOLL_FINE_VND: 200000,
    TOLL_REP_PENALTY: 15,
    STATION_STOP_SPEED_KMH: 5,
    GAS_RATE_PER_SEC: 20,
    GAS_COST_PER_PERCENT_VND: 5000,
    REPAIR_RATE_PER_SEC: 15,
    REPAIR_COST_PER_PERCENT_VND: 10000,
    FINISH_STOP_SPEED_KMH: 10,
    ONCOMING_HORN_SLOW_FACTOR: 0.4, // Giảm 60% tốc độ => còn 40%
    ONCOMING_HIT_HP_DMG: 25,
    ONCOMING_HIT_CARGO_DMG: 15,
    PICKUP_FUEL_AMOUNT: 25,
    PICKUP_REPAIR_AMOUNT: 25,
    PICKUP_STRAP_INTEGRITY: 20,
    INTEGRITY_BONUS_PER_PCT_VND: 3000,
    TIME_BONUS_PER_SEC_VND: 5000,
  },

  // 3 Tuyến đường Việt Nam cố định
  ROUTES: [
    {
      id: 1,
      name: "Cảng Cát Lái → Cửa khẩu Mộc Bài",
      shortName: "Cát Lái - Mộc Bài",
      origin: "Cảng Cát Lái",
      destination: "Cửa khẩu Mộc Bài",
      terrainDesc: "Đường nhựa đồng bằng Nam Bộ, cầu vượt nhẹ, nhiều trạm BOT",
      difficultyLabel: "Dễ",
      lengthMeters: 3000,
      maxSlopeDeg: 10,
      weather: "SUNNY",
      weatherLabel: "Nắng nhẹ · Tầm nhìn 100%",
      roadGrip: 1.0,
      fogAlpha: 0.0,
      nightDarkness: 0.0,
      baseDeadlineSec: 150,
      baseRewardVND: 1000000,
      counts: {
        potholes: 7,
        rockslides: 0,
        tollBooths: 2,
        weighStations: 1,
        gasStations: 1,
        repairStations: 0,
        oncomingVehicles: 3,
        pickups: 4,
      },
    },
    {
      id: 2,
      name: "Cảng Chân Mây → Cửa khẩu Lao Bảo",
      shortName: "Chân Mây - Lao Bảo",
      origin: "Cảng Chân Mây",
      destination: "Cửa khẩu Lao Bảo",
      terrainDesc: "Đường đèo dốc miền Trung (QL9 - Đakrông), mưa lớn & sương mù",
      difficultyLabel: "Trung bình",
      lengthMeters: 4500,
      maxSlopeDeg: 22,
      weather: "RAIN_FOG",
      weatherLabel: "Mưa lớn (-25% bám) · Sương mù",
      roadGrip: 0.75,
      fogAlpha: 0.42,
      nightDarkness: 0.28,
      baseDeadlineSec: 210,
      baseRewardVND: 1800000,
      counts: {
        potholes: 14,
        rockslides: 4,
        tollBooths: 2,
        weighStations: 1,
        gasStations: 2,
        repairStations: 1,
        oncomingVehicles: 6,
        pickups: 6,
      },
    },
    {
      id: 3,
      name: "Cảng Hải Phòng → Cửa khẩu Hữu Nghị",
      shortName: "Hải Phòng - Hữu Nghị",
      origin: "Cảng Hải Phòng",
      destination: "Cửa khẩu Hữu Nghị",
      terrainDesc: "Đèo núi Đông Bắc hiểm trở, dốc đứng liên hoàn, bão đêm sương dày",
      difficultyLabel: "Khó",
      lengthMeters: 6000,
      maxSlopeDeg: 32,
      weather: "STORM_NIGHT",
      weatherLabel: "Bão đêm (-30% bám) · Sương mù dày",
      roadGrip: 0.7,
      fogAlpha: 0.65,
      nightDarkness: 0.72,
      baseDeadlineSec: 260,
      baseRewardVND: 3000000,
      counts: {
        potholes: 20,
        rockslides: 8,
        tollBooths: 2,
        weighStations: 2,
        gasStations: 2,
        repairStations: 2,
        oncomingVehicles: 10,
        pickups: 8,
      },
    },
  ],

  // 3 Loại hàng hóa xuất khẩu
  CARGO_TYPES: [
    {
      id: "standard",
      name: "Hàng phổ thông",
      subtitle: "Nông sản khô, vật liệu đóng kiện",
      massKg: 4000,
      fuelMultiplier: 1.0,
      deadlineMultiplier: 1.0,
      shockMultiplier: 1.0,
      rewardMultiplier: 1.0,
      spriteKey: "containerRed",
      colorHex: "#b91c1c",
    },
    {
      id: "fragile",
      name: "Hàng dễ vỡ",
      subtitle: "Linh kiện điện tử, thiết bị y tế",
      massKg: 2500,
      fuelMultiplier: 1.0,
      deadlineMultiplier: 1.0,
      shockMultiplier: 1.8,
      rewardMultiplier: 1.5,
      spriteKey: "containerBlue",
      colorHex: "#1d4ed8",
    },
    {
      id: "frozen",
      name: "Hàng đông lạnh",
      subtitle: "Thủy hải sản tươi, vắc-xin lạnh",
      massKg: 5000,
      fuelMultiplier: 1.35,
      deadlineMultiplier: 0.85,
      shockMultiplier: 1.2,
      rewardMultiplier: 1.4,
      spriteKey: "containerGreen",
      colorHex: "#15803d",
    },
  ],

  // Nâng cấp Garage (Cấp 1 -> 5)
  UPGRADES: {
    MAX_LEVEL: 5,
    ITEMS: {
      engine: {
        key: "engine",
        name: "Động cơ Diesel",
        desc: "Tăng lực kéo leo đèo và tốc độ tối đa (+15% mỗi cấp).",
        costs: [400000, 800000, 1500000, 2500000],
      },
      fuelTank: {
        key: "fuelTank",
        name: "Bình xăng & Kim phun",
        desc: "Giảm mức tiêu hao nhiên liệu trên đường dài (-12% mỗi cấp).",
        costs: [350000, 700000, 1300000, 2200000],
      },
      suspension: {
        key: "suspension",
        name: "Giảm xóc & Dây chằng",
        desc: "Triệt tiêu dao động và giảm sát thương xóc hàng (-15% mỗi cấp).",
        costs: [400000, 850000, 1600000, 2600000],
      },
    },
  },

  // Cấu hình lưu trữ bền vững
  STORAGE: {
    KEY: "bien_gioi_thang_tien_save_v1",
    SCHEMA_VERSION: 1,
    INITIAL_MONEY: 500000,
    INITIAL_REPUTATION: 100,
    MAX_TRIP_HISTORY: 50,
    INTRO_SEEN_KEY: "bien_gioi_thang_tien_intro_seen_v1",
  },
};

export function formatVND(amount) {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return safe.toLocaleString("vi-VN") + " VNĐ";
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
