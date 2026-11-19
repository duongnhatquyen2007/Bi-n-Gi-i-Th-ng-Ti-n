# GAME DESIGN DOCUMENT (GDD): BIÊN GIỚI THẲNG TIẾN

* **Tên dự án:** Biên Giới Thẳng Tiến (Borderline Cargo VN)
* **Chủ đề Game Jam:** Hành trình xuyên biên giới / Kết nối giao thương
* **Thể loại:** Mô phỏng lái xe giao hàng vật lý 2D nhìn ngang (2D Side-scrolling Physics Cargo Simulation)
* **Nền tảng mục tiêu:** Web Browser đa nền tảng (Desktop PC Windows/macOS & Mobile Android/iOS)
* **Thời lượng phát triển mục tiêu:** 48 giờ (Small Scope, High Replayability)

---

## 1. TỔNG QUAN & CỐT TRUYỆN

### 1.1. Bối cảnh & Cốt truyện
Người chơi vào vai bác tài xe đầu kéo container chuyên tuyến vận tải xuyên biên giới tại Việt Nam. Mỗi chuyến hàng bắt đầu tại các cảng biển trọng điểm (**Cảng Cát Lái**, **Cảng Chân Mây**, **Cảng Hải Phòng**) ngay khi tàu hàng vừa cập bến, với nhiệm vụ vận chuyển các lô hàng xuất khẩu khẩn cấp vượt qua quốc lộ, đèo dốc và thời tiết khắc nghiệt để kịp giờ thông quan tại các cửa khẩu quốc tế (**Cửa khẩu Mộc Bài**, **Cửa khẩu Lao Bảo**, **Cửa khẩu Hữu Nghị**).

* **Biến cố khởi đầu:** Lô hàng xuất khẩu vừa hạ tải từ tàu xuống rơ-moóc trong bối cảnh cửa khẩu sắp đóng luồng thông quan và thời tiết/giao thông trên tuyến đang diễn biến xấu.
* **Xung đột trung tâm:** Cân bằng giữa **tốc độ chạy đua với đồng hồ đếm ngược (Deadline)** và **độ ổn định vật lý của thùng hàng** trên cung đường đầy ổ gà, dốc đèo và trạm kiểm soát.

### 1.2. Lời dẫn nhập (Intro Story - 3 Khung cảnh đầu game)
* **Khung cảnh 1 (Bến cảng đêm với ánh đèn cần cẩu nhấp nháy):**
  * **Điều phối viên:** *"Bác tài nghe rõ trả lời! Tàu vừa cập bến, lô hàng xuất khẩu khẩn cấp đã lên rơ-moóc."*
* **Khung cảnh 2 (Cận cảnh cabin xe đầu kéo nổ máy, đèn pha bật sáng):**
  * **Điều phối viên:** *"Cửa khẩu sắp đóng luồng thông quan, phía trước lại đang có cảnh báo thời tiết xấu và ùn tắc."*
  * **Tài xế:** *"Rõ! Giao hàng nguyên vẹn, đúng giờ là nghề của tôi."*
* **Khung cảnh 3 (Toàn cảnh xe đầu kéo lăn bánh rời cổng cảng):**
  * **Điều phối viên:** *"Giữ vững tay lái, đừng để đứt dây chằng—chúc bác tài thượng lộ bình an, biên giới thẳng tiến!"*

### 1.3. Góc nhìn & Hệ thống Camera
* **Góc nhìn:** 2D nhìn ngang (Side-scrolling), xe di chuyển từ trái sang phải (`+X`).
* **Quy tắc bám mục tiêu (Camera Follow):** Camera bám mượt theo tọa độ đầu kéo (`lerpFactor = 0.08`) với độ lệch nhìn trước (`lookAheadX = +220px`) để người chơi quan sát sớm chướng ngại vật phía trước.
* **Thu phóng động theo tốc độ (Dynamic Speed Zoom):**
  * Khi xe đứng yên hoặc chạy chậm (`speed <= 20 km/h`): `zoom = 1.0`.
  * Khi xe tăng tốc đạt vận tốc tối đa (`speed = maxSpeed`): Camera tự động thu nhỏ (zoom out) mượt mà về `zoom = 0.78` theo công thức nội suy tuyến tính:
    $$\text{zoom} = \text{lerp}\left(1.0,\ 0.78,\ \frac{\text{speed}}{\text{maxSpeed}}\right)$$
    giúp mở rộng tầm nhìn phản xạ khi chạy tốc độ cao.

---

## 2. HỆ THỐNG ĐIỀU KHIỂN & CƠ CHẾ DI CHUYỂN

### 2.1. Bảng ánh xạ phím bấm & Cảm ứng (Input Mapping)
Hệ thống tự động hiển thị cụm nút cảm ứng trên màn hình (Virtual Touch Controls) khi phát hiện thiết bị di động hoặc màn hình cảm ứng.

| Hành động (Action) | Phím PC (Keyboard) | Nút Cảm ứng (Mobile Touch) | Trạng thái kích hoạt & Chức năng chi tiết |
| :--- | :--- | :--- | :--- |
| **Tăng tốc / Tiến tới** | `D` hoặc `ArrowRight` | Nút bàn đạp **GA** (Góc dưới phải) | Giữ để cấp mô-men xoắn cho trục bánh chủ động tiến về phía trước. |
| **Phanh / Lùi xe** | `A` hoặc `ArrowLeft` | Nút bàn đạp **PHANH / LÙI** (Góc dưới phải) | Giữ để hãm tốc khi xe đang tiến (`vx > 0`); khi xe dừng hẳn (`vx == 0`), giữ tiếp sau `0.4s` sẽ cài số lùi (`vx < 0`). |
| **Phanh tay khẩn cấp** | `Space` | Nút **P (Phanh tay)** (Trên bàn đạp phanh) | Khóa cứng ngay lập tức tất cả bánh xe, tạo lực hãm tối đa kèm hiệu ứng khói lốp và tiếng xả phanh hơi. |
| **Bấm còi hơi** | `H` | Nút **CÒI HƠI** (Góc dưới trái) | Nhấn để phát sóng âm thanh cảnh báo trong bán kính `450px` phía trước, buộc xe cùng làn nhường đường và xe ngược chiều giảm $60\%$ tốc độ. |
| **Bật / Tắt đèn pha** | `L` | Nút **ĐÈN PHA** (Góc dưới trái) | Nhấn để bật/tắt chùm sáng hình nón (`500px`) phía trước đầu xe, xuyên qua lớp phủ sương mù và trời tối. |
| **Tương tác nhanh** | `E` | Nút **TƯƠNG TÁC (E)** (Hiện nổi khi vào vùng trạm) | Giữ tại **Trạm xăng** (bơm dầu), **Trạm sửa chữa** (sửa xe), hoặc nhấn/giữ tại **Cổng Hải quan** để xác nhận thông quan. |
| **Tạm dừng game** | `ESC` hoặc `P` | Nút **II (Pause)** (Góc trên phải) | Mở/đóng menu tạm dừng (Pause Menu), đóng băng toàn bộ vật lý và đồng hồ đếm ngược. |

### 2.2. Quy tắc vật lý di chuyển (2D Physics Specification)
Cấu trúc xe gồm 3 thực thể vật lý liên kết: **Đầu kéo (Tractor)**, **Rơ-moóc (Trailer)** nối qua khớp xoay giới hạn góc (`RevoluteJoint`, góc xoay $[-12^\circ, +12^\circ]$), và **Khối hàng (Cargo Box)** đặt trên sàn rơ-moóc.

1. **Mô-men xoắn động cơ (Engine Torque):**
   * Lực kéo truyền xuống bánh chủ động tỷ lệ thuận với cấp độ động cơ trong Garage (`baseTorque = 18000 N`, tăng $+15\%$ mỗi cấp nâng cấp).
   * Tốc độ tối đa cơ bản: `maxSpeed = 85 km/h` (đường bằng), tự động giới hạn giảm $20\%$ nếu `truckHP < 30%`.
2. **Quán tính khối lượng (Mass & Inertia):**
   * Tổng khối lượng hệ thống:
     $$\text{TotalMass} = \text{TractorMass } (6000\text{ kg}) + \text{TrailerMass } (3000\text{ kg}) + \text{CargoMass}$$
   * Khối lượng hàng (`CargoMass`) thay đổi theo loại đơn hàng ($2000\text{ kg}$ đến $5000\text{ kg}$), làm tăng quãng đường phanh và độ trễ khi đề-pa.
3. **Lực cản khi leo dốc & Lực đẩy đổ dốc:**
   * Thành phần trọng lực dọc theo mặt dốc góc $\theta$:
     $$F_{\text{slope}} = \text{TotalMass} \cdot g \cdot \sin(\theta) \quad (\text{với } g = 9.81\text{ m/s}^2)$$
   * Khi leo dốc ($\theta > 0$), xe tiêu hao nhiên liệu gấp $1.5\times$ lần đường bằng. Khi đổ dốc ($\theta < 0$), xe tự trôi nhanh kể cả khi nhả ga, yêu cầu người chơi rà phím `A` để kiểm soát tốc độ.
4. **Hệ thống treo (Suspension):**
   * Mỗi trục bánh xe sử dụng khớp lò xo giảm chấn (`WheelJoint` / `SpringDamper`) với hai tham số `stiffness` (độ cứng) và `damping` (độ triệt tiêu dao động).
   * Nâng cấp giảm xóc giúp tăng `damping`, giảm biên độ nảy của khung xe khi qua ổ gà.
5. **Cơ chế trượt & rơi thùng hàng trên rơ-moóc:**
   * Thùng hàng nằm trên sàn rơ-moóc chịu lực ma sát tĩnh/trượt (`friction = 0.65`) và được giữ bởi hệ thống **Dây chằng ảo (Cargo Straps)** có ngưỡng chịu xung lực `maxStrapImpulse`.
   * Khi xe phanh gấp (`Space`), đâm va, hoặc sập ổ gà ở tốc độ cao tạo ra gia tốc đột ngột vượt ngưỡng `shockThreshold`:
     * Thùng hàng bị trượt dọc trên sàn rơ-moóc và nảy lên theo trục `Y`.
     * Va đập mạnh giữa thùng hàng với sàn/thành rơ-moóc làm trừ trực tiếp `cargoIntegrity`.
     * Nếu thùng hàng văng hẳn ra khỏi vùng giới hạn của rơ-moóc (`cargo.y > trailerBed.y + 80px` hoặc rơi chạm mặt đường), `cargoIntegrity` lập tức về $0\%$ (Thua ngay lập tức).

---

## 3. LUẬT CHƠI, THỂ LỆ & HỆ THỐNG TƯƠNG TÁC

### 3.1. Tài nguyên & Chỉ số người chơi
| Tên chỉ số (Biến hệ thống) | Khoảng giá trị | Giá trị khởi đầu màn | Quy tắc biến thiên |
| :--- | :--- | :--- | :--- |
| **Nhiên liệu (`fuel`)** | $0\% - 100\%$ | $100\%$ | Giảm liên tục theo thời gian nổ máy và tỷ lệ thuận với lực ga nhấn giữ. Về $0\%$ sẽ thua. |
| **Độ bền xe (`truckHP`)** | $0\% - 100\%$ | $100\%$ | Giảm khi va chạm xe ngược chiều, sập ổ gà tốc độ cao hoặc lật nghiêng. Về $0\%$ sẽ thua. |
| **Độ nguyên vẹn hàng (`cargoIntegrity`)** | $0\% - 100\%$ | $100\%$ | Giảm khi thùng hàng nảy/va đập mạnh hoặc xe phanh gấp quá mức. Dưới $50\%$ sẽ thua. |
| **Tiền cước (`money`)** | $\ge 0\text{ VNĐ}$ | Lưu bền vững (Mới chơi: `500.000 VNĐ`) | Cộng khi hoàn thành giao hàng; trừ khi đổ xăng, sửa xe hoặc bị phạt tại trạm kiểm soát. |
| **Điểm uy tín (`reputation`)** | $\ge 0\text{ điểm}$ | Lưu bền vững (Mới chơi: `100 điểm`) | Cộng thêm khi giao hàng nguyên vẹn/đúng giờ; trừ khi vượt ẩu trạm thu phí/trạm cân hoặc hỏng hàng. |
| **Đồng hồ cửa khẩu (`deadline`)** | $\ge 0\text{ giây}$ | Tùy theo màn chơi (`150s` – `260s`) | Đếm ngược từng giây từ lúc xuất phát. Về `0s` trước khi chạm vạch đích sẽ thua. |

### 3.2. Bảng quy tắc va chạm & Tương tác môi trường
| Thực thể / Sự kiện | Điều kiện kích hoạt | Hiệu ứng & Quy tắc xử lý chính xác |
| :--- | :--- | :--- |
| **Ổ gà / Đá lở (`Pothole` / `Rockslide`)** | Bánh xe lăn qua vùng va chạm với vận tốc `speed > 35 km/h` | Tạo xung lực hất trục bánh xe lên trên; trừ $3\% - 10\%$ `truckHP` (tùy tốc độ) và truyền chấn động làm giảm $2\% - 12\%$ `cargoIntegrity`. Nếu `speed <= 35 km/h`, xe lăn qua êm ái và không mất máu. |
| **Xe đi ngược chiều (`OncomingVehicle`)** | Xuất hiện từ phía trước trên các đoạn đường hẹp/đèo | Nếu người chơi nhấn `H` (Còi hơi) trong khoảng cách `450px`, xe đối diện giảm tốc và nép sát lề an toàn. Nếu va chạm trực diện: xe bật lùi, trừ $25\%$ `truckHP` và trừ $15\%$ `cargoIntegrity`. |
| **Trạm xăng (`GasStation`)** | Xe dừng (`speed < 5 km/h`) trong vùng trạm và người chơi giữ phím `E` | Bơm thêm $+20\%$ `fuel` mỗi giây, đồng thời trừ `5.000 VNĐ` cho mỗi $1\%$ nhiên liệu nạp vào (dừng bơm nếu đầy $100\%$ hoặc hết tiền). |
| **Trạm sửa chữa (`RepairStation`)** | Xe dừng (`speed < 5 km/h`) trong vùng trạm và người chơi giữ phím `E` | Hồi phục $+15\%$ `truckHP` mỗi giây, đồng thời trừ `10.000 VNĐ` cho mỗi $1\%$ độ bền hồi phục. |
| **Trạm cân tải trọng (`WeighStation`)** | Xe đi vào vùng cảm biến bàn cân (`width = 180px`) | Tốc độ cho phép tối đa là `15 km/h`. Nếu đi qua với `speed <= 15 km/h`, đèn xanh bật sáng và barie mở mượt. Nếu vượt quá `15 km/h`: phạt trực tiếp `150.000 VNĐ`, trừ `15 điểm uy tín` và barie bung vỡ gây chấn động nhẹ ($-5\%$ `cargoIntegrity`). |
| **Trạm thu phí BOT (`TollBooth`)** | Xe đi vào vùng cảm biến barie thu phí | Tốc độ cho phép tối đa là `25 km/h`. Nếu đi qua với `speed <= 25 km/h`, tự động trừ phí đường bộ chuẩn (`35.000 VNĐ`) và mở barie. Nếu vượt quá `25 km/h`: phạt `200.000 VNĐ`, trừ `15 điểm uy tín` và làm xóc hàng ($-5\%$ `cargoIntegrity`). |
| **Vật phẩm: Can dầu (`Pickup_Fuel`)** | Đầu kéo chạm vào vật phẩm trên đường | Hồi phục ngay lập tức $+25\%$ `fuel` (tối đa $100\%$) và phát âm thanh tiếp nhiên liệu. |
| **Vật phẩm: Cờ lê (`Pickup_Repair`)** | Đầu kéo chạm vào vật phẩm trên đường | Hồi phục ngay lập tức $+25\%$ `truckHP` (tối đa $100\%$) và phát âm thanh sửa cơ khí. |
| **Vật phẩm: Dây chằng (`Pickup_Strap`)** | Đầu kéo chạm vào vật phẩm trên đường | Hồi phục $+20\%$ `cargoIntegrity` (tối đa $100\%$) và kích hoạt trạng thái **Gia cố tạm thời** (giảm $50\%$ sát thương xóc hàng trong `12 giây`). |

### 3.3. Hệ thống hàng hóa (3 loại đơn hàng)
Trước khi bắt đầu mỗi màn chơi, người chơi chọn 1 trong 3 loại đơn hàng với các thông số cân bằng rủi ro – phần thưởng như sau:

| Loại hàng hóa | Khối lượng (`CargoMass`) | Hệ số tiêu hao nhiên liệu | Hệ số thời gian (`Deadline`) | Hệ số sát thương khi xóc (`ShockMultiplier`) | Hệ số tiền cước thưởng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Hàng phổ thông** *(Nông sản khô, vật liệu đóng kiện)* | $4000\text{ kg}$ | $1.0\times$ (Chuẩn) | $1.0\times$ (Chuẩn) | $1.0\times$ (Ổn định, chịu xóc tốt) | $1.0\times$ |
| **2. Hàng dễ vỡ** *(Linh kiện điện tử, thiết bị y tế)* | $2500\text{ kg}$ | $1.0\times$ (Chuẩn) | $1.0\times$ (Chuẩn) | $1.8\times$ (Rất nhạy cảm với phanh gấp & ổ gà) | $1.5\times$ |
| **3. Hàng đông lạnh** *(Thủy hải sản tươi, vắc-xin lạnh)* | $5000\text{ kg}$ | $1.35\times$ (Tốn dầu chạy máy lạnh) | $0.85\times$ (Thời gian giao ngắn hơn $15\%$) | $1.2\times$ (Nhạy cảm trung bình) | $1.4\times$ |

---

## 4. CẤU TRÚC MÀN CHƠI & QUY LUẬT TĂNG ĐỘ KHÓ

Game gồm **3 màn chơi cố định** đại diện cho 3 tuyến vận tải xuyên biên giới tiêu biểu của Việt Nam (từ Nam ra Bắc). Màn 1 mở khóa sẵn; hoàn thành màn trước sẽ mở khóa màn kế tiếp.

### 4.1. Bảng thông số 3 tuyến đường
| Thuộc tính màn chơi | Màn 1 (Dễ) | Màn 2 (Trung bình) | Màn 3 (Khó) |
| :--- | :--- | :--- | :--- |
| **Tuyến đường** | **Cảng Cát Lái $\rightarrow$ Cửa khẩu Mộc Bài** | **Cảng Chân Mây $\rightarrow$ Cửa khẩu Lao Bảo** | **Cảng Hải Phòng $\rightarrow$ Cửa khẩu Hữu Nghị** |
| **Bối cảnh địa hình** | Đường nhựa đồng bằng Nam Bộ, nhiều trạm thu phí và giao lộ. | Đường đèo dốc miền Trung (Quốc lộ 9 – Đakrông), quanh co. | Đường núi đá Đông Bắc hiểm trở, dốc đứng liên hoàn. |
| **Chiều dài quãng đường** | $3000\text{ mét}$ | $4500\text{ mét}$ | $6000\text{ mét}$ |
| **Độ dốc tối đa (`Max Slope`)** | $10^\circ$ (Cầu vượt nhẹ) | $22^\circ$ (Đèo cao kéo dài) | $32^\circ$ (Dốc núi cực gắt) |
| **Thời tiết & Tầm nhìn** | Ban ngày nắng nhẹ, tầm nhìn $100\%$. | Mưa lớn trơn trượt (giảm $25\%$ độ bám đường) + Sương mù (cần bật đèn `L`). | Bão đêm + Sương mù dày đặc (giảm $30\%$ độ bám đường, bắt buộc dùng đèn `L` và còi `H`). |
| **Mật độ chướng ngại vật** | Thấp: Ổ gà thưa, `2` trạm thu phí, `1` trạm cân, `1` trạm xăng. | Trung bình: Ổ gà dày, đá lở nhẹ, xe ngược chiều ở cua đèo, `2` trạm xăng, `1` trạm sửa chữa. | Cao: Ổ gà liên hoàn, nhiều điểm sạt lở, xe ngược chiều mật độ cao, `2` trạm xăng, `2` trạm sửa chữa. |
| **Thời gian cơ bản (`Base Deadline`)** | `150 giây` | `210 giây` | `260 giây` |
| **Tiền cước cơ bản (`Base Reward`)** | `1.000.000 VNĐ` | `1.800.000 VNĐ` | `3.000.000 VNĐ` |

### 4.2. Quy luật tăng độ khó lũy tiến
1. **Mở rộng chiều dài & Áp lực nhiên liệu:** Quãng đường tăng thêm $+1500\text{m}$ mỗi màn, buộc người chơi phải tận dụng trạm xăng dọc đường hoặc nâng cấp bình xăng trong Garage.
2. **Gia tăng góc nghiêng địa hình:** Độ dốc tăng từ $10^\circ$ lên $32^\circ$, đòi hỏi tính toán đà lấy trớn trước khi leo dốc và kiểm soát phanh động cơ khi đổ dốc để không mất kiểm soát.
3. **Suy giảm điều kiện môi trường:** Chuyển từ đường khô ban ngày (Màn 1) sang mưa trơn giảm ma sát (Màn 2) và bão đêm sương mù che khuất tầm nhìn (Màn 3), ép người chơi phối hợp thuần thục tổ hợp phím lái + Còi hơi (`H`) + Đèn pha (`L`).

---

## 5. ĐIỀU KIỆN THẮNG (WIN) & ĐIỀU KIỆN THUA (LOSE)

### 5.1. Điều kiện Thắng tuyệt đối (Victory)
Người chơi giành chiến thắng màn chơi khi thỏa mãn đồng thời tất cả các điều kiện sau:
1. Đầu kéo chạm vạch **Cổng Cửa khẩu quốc tế** (`truck.x >= finishGateX`) và giảm tốc dừng lại trong vùng thông quan (`speed <= 10 km/h`, có thể nhấn phím `E` để đóng dấu thông quan ngay lập tức).
2. Đồng hồ đếm ngược chưa cạn (`deadline > 0`).
3. Hàng hóa còn đủ tiêu chuẩn thông quan (`cargoIntegrity >= 50%`).
4. Xe đầu kéo chưa bị phá hủy (`truckHP > 0`).

**Công thức tính thưởng khi Thắng:**
* $\text{TotalReward} = (\text{BaseReward} \times \text{CargoRewardMultiplier}) + (\text{CargoIntegrity} \times 3000\text{ VNĐ}) + (\text{RemainingSeconds} \times 5000\text{ VNĐ})$
* $\text{ReputationGain} = 20 + \lfloor \text{CargoIntegrity} / 5 \rfloor + \lfloor \text{RemainingSeconds} / 5 \rfloor$

### 5.2. Điều kiện Thua tuyệt đối (Game Over)
Màn chơi lập tức kết thúc với trạng thái Thất bại và hiển thị đúng nguyên nhân nếu xảy ra **bất kỳ một trong bốn** điều kiện sau:
1. **Cạn nhiên liệu:** `fuel <= 0` khi xe chưa chạm vạch Cổng Cửa khẩu.
2. **Hỏng xe / Lật xe:** `truckHP <= 0` hoặc góc nghiêng thân đầu kéo bị lật ngửa ($|\text{truck.angle}| \ge 85^\circ$ duy trì quá `1.5 giây`).
3. **Hư hỏng hàng hóa:** `cargoIntegrity < 50%` (hoặc thùng hàng rơi khỏi rơ-moóc chạm đất).
4. **Trễ giờ thông quan:** `deadline <= 0` khi xe chưa hoàn tất thủ tục tại Cổng Cửa khẩu.

---

## 6. SƠ ĐỒ MÀN HÌNH GIAO DIỆN (UI FLOW)

### 6.1. Luồng chuyển đổi màn hình (State Machine)
```text
[MAIN MENU]
 ├──> [CHỌN TUYẾN ĐƯỜNG & LOẠI HÀNG (Pre-Trip Setup)] ──> [GAMEPLAY (HUD)]
 │                                                             ├──> [PAUSE MENU] ──> (Tiếp tục / Chơi lại / Về Menu)
 │                                                             ├──> [BIÊN BẢN THÔNG QUAN (Victory)] ──> (Màn tiếp theo / Về Menu)
 │                                                             └──> [SỰ CỐ GIAO HÀNG (Game Over)] ──> (Chơi lại / Về Garage / Về Menu)
 ├──> [GARAGE NÂNG CẤP (Upgrade Shop)]
 └──> [LỊCH SỬ CHUYẾN HÀNG & ĐỒNG BỘ DỮ LIỆU (Career Log & Sync)]
```

### 6.2. Chi tiết các thành phần giao diện
1. **Main Menu:**
   * Hiển thị tiêu đề game **BIÊN GIỚI THẲNG TIẾN**, tổng số tiền cước hiện có (`VNĐ`) và điểm uy tín (`Reputation`).
   * **Khu vực chuẩn bị chuyến đi:**
     * Chọn tuyến đường (Hiển thị trạng thái Mở khóa / Khóa cho 3 tuyến).
     * Chọn loại hàng hóa (3 thẻ bài trực quan: Phổ thông / Dễ vỡ / Đông lạnh kèm thông số hệ số thưởng).
     * Nút **XUẤT PHÁT** cỡ lớn.
   * **Thanh điều hướng phụ:** Nút mở **Garage Nâng Cấp**, nút mở **Lịch Sử & Chuyển Dữ Liệu (.JSON)**.
2. **Garage Nâng Cấp (Upgrade Shop):**
   Cho phép nâng cấp 3 bộ phận từ **Cấp 1 đến Cấp 5** bằng tiền cước (`VNĐ`):
   * **Động cơ (`engine`):** Tăng lực kéo leo dốc và tốc độ tối đa ($+15\%$ mỗi cấp). Chi phí: `400k / 800k / 1.500k / 2.500k VNĐ`.
   * **Bình xăng (`fuelTank`):** Giảm mức tiêu hao nhiên liệu ($-12\%$ mỗi cấp). Chi phí: `350k / 700k / 1.300k / 2.200k VNĐ`.
   * **Hệ thống giảm xóc (`suspension`):** Tăng độ êm ái và độ bền dây chằng, giảm sát thương xóc hàng ($-15\%$ sát thương va đập mỗi cấp). Chi phí: `400k / 850k / 1.600k / 2.600k VNĐ`.
3. **Màn hình chơi chính (Gameplay HUD):**
   * **Góc trên trái:** 3 thanh trạng thái trực quan có màu cảnh báo khi dưới $30\%$:
     * Thanh **Nhiên liệu (`Fuel`)** (Màu vàng cam).
     * Thanh **Độ bền xe (`Truck HP`)** (Màu xanh dương / đỏ).
     * Thanh **Độ nguyên vẹn hàng (`Cargo Integrity`)** (Màu xanh lá, có vạch mốc đỏ tại $50\%$).
   * **Góc trên giữa:** **Bản đồ mini tiến độ tuyến đường (Route Progress Bar)** hiển thị biểu tượng xe tải di chuyển từ icon Cảng biển đến icon Cửa khẩu, đánh dấu vị trí Trạm xăng và Trạm kiểm soát; bên dưới là **Đồng hồ đếm ngược (`Deadline`)**.
   * **Góc trên phải:** Số tiền cước hiện tại (`VNĐ`), Điểm uy tín và nút **Pause (`II`)**.
   * **Góc dưới phải (Desktop & Mobile):** Đồng hồ tốc độ điện tử (`km/h`) kèm chỉ báo trạng thái đèn pha / phanh tay; trên Mobile hiển thị thêm 2 bàn đạp **PHANH/LÙI** và **GA**.
   * **Góc dưới trái (Mobile):** Các nút cảm ứng **CÒI HƠI (`H`)**, **ĐÈN PHA (`L`)** và nút **TƯƠNG TÁC (`E`)** tự động sáng lên khi xe dừng trong vùng trạm.
4. **Pause Menu:**
   * Nút **Tiếp tục lái**, nút **Khởi hành lại tuyến này**, nút **Về Menu chính**.
5. **Màn hình Biên bản Thông quan (Victory Screen):**
   * Tiêu đề **"THÔNG QUAN THÀNH CÔNG"**, con dấu đỏ **"ĐÃ THÔNG QUAN"** đóng lên biên bản.
   * Bảng kê chi tiết: Tuyến đường, Loại hàng, Thời gian hoàn thành, Độ nguyên vẹn hàng ($\%$), Tiền cước cơ bản, Tiền thưởng bảo quản & tốc độ, Tổng tiền nhận được (`VNĐ`).
   * Nút **Tuyến tiếp theo** và nút **Về Menu chính**.
6. **Màn hình Sự cố Giao hàng (Game Over Screen):**
   * Tiêu đề **"SỰ CỐ GIAO HÀNG"** kèm lý do thất bại cụ thể (Cạn nhiên liệu / Xe hư hỏng nặng / Hàng hóa hư hại dưới $50\%$ / Trễ giờ đóng cửa khẩu).
   * Nút **Chạy lại ngay**, nút **Vào Garage nâng cấp**, nút **Về Menu chính**.

---

## 7. HỆ THỐNG LỊCH SỬ CHƠI & CHUYỂN DỮ LIỆU ĐA NỀN TẢNG

### 7.1. Cấu trúc dữ liệu lưu trữ bền vững (`localStorage`)
Toàn bộ tiến trình người chơi được tự động lưu vào `localStorage` dưới khóa `bien_gioi_thang_tien_save_v1` mỗi khi hoàn thành màn chơi, nâng cấp xe hoặc phát sinh giao dịch.

```json
{
  "schemaVersion": 1,
  "lastUpdated": "2026-11-20T12:00:00.000Z",
  "money": 1850000,
  "maxReputation": 165,
  "upgrades": {
    "engine": 2,
    "fuelTank": 2,
    "suspension": 1
  },
  "unlockedRoutes": [1, 2],
  "tripHistory": [
    {
      "tripId": "trip_1763614800000_r1_fragile",
      "timestamp": "2026-11-20T11:40:00.000Z",
      "routeId": 1,
      "routeName": "Cát Lái - Mộc Bài",
      "cargoType": "Hàng dễ vỡ",
      "completionTimeSec": 112,
      "cargoIntegrity": 94,
      "rewardVND": 1942000,
      "platform": "PC (Windows)"
    }
  ]
}
```
* **Giới hạn nhật ký:** Mảng `tripHistory` lưu trữ tối đa **50 chuyến hàng gần nhất** (sắp xếp giảm dần theo `timestamp`, tự động cắt bỏ các bản ghi cũ hơn vị trí thứ 50).
* **Nhận diện nền tảng (`platform`):** Tự động xác định qua `navigator.userAgent` để ghi nhãn chuẩn (`PC (Windows)`, `PC (macOS)`, `Mobile (Android)`, `Mobile (iOS)`).

### 7.2. Cơ chế Xuất (Export) & Nhập (Import) file `.json`
* **Xuất dữ liệu (Export Save):**
  * Người chơi nhấn nút **"Tải xuống hồ sơ (.JSON)"** trong mục Lịch sử / Cài đặt.
  * Trình duyệt tạo Blob từ đối tượng JSON hiện tại và kích hoạt tải xuống file có định dạng tên: `BienGioiThangTien_Save_YYYYMMDD.json`.
* **Nhập dữ liệu (Import Save):**
  * Người chơi nhấn nút **"Nạp hồ sơ từ thiết bị (.JSON)"** (`<input type="file" accept=".json">`).
  * Hệ thống kiểm tra tính hợp lệ của file (phải parse được JSON, có đủ các trường `schemaVersion`, `money`, `upgrades`, `unlockedRoutes`, `tripHistory`). Nếu file sai định dạng, hiển thị thông báo lỗi rõ ràng mà không làm hỏng dữ liệu hiện tại.

### 7.3. Quy tắc xử lý xung đột & Gộp dữ liệu (Smart Merge Algorithm)
Khi người chơi nạp file `.json` từ thiết bị khác (ví dụ chuyển từ trình duyệt PC sang điện thoại hoặc ngược lại), hệ thống **không ghi đè mù quáng** mà thực hiện thuật toán **Gộp thông minh (Merge)** theo 4 quy tắc bắt buộc sau:

1. **Tiền cước & Điểm uy tín (Giữ mức cao nhất):**
   * `merged.money = Math.max(localData.money, importedData.money)`
   * `merged.maxReputation = Math.max(localData.maxReputation, importedData.maxReputation)`
2. **Cấp độ nâng cấp xe (Giữ cấp cao nhất của từng bộ phận):**
   * `merged.upgrades.engine = Math.max(localData.upgrades.engine, importedData.upgrades.engine)`
   * `merged.upgrades.fuelTank = Math.max(localData.upgrades.fuelTank, importedData.upgrades.fuelTank)`
   * `merged.upgrades.suspension = Math.max(localData.upgrades.suspension, importedData.upgrades.suspension)`
3. **Tuyến đường đã mở khóa (Hợp nhất toàn bộ):**
   * `merged.unlockedRoutes = Array.from(new Set([...localData.unlockedRoutes, ...importedData.unlockedRoutes])).sort()`
4. **Lịch sử 50 chuyến hàng (Gộp không trùng lặp & Cắt ngưỡng 50):**
   * Gộp hai mảng `localData.tripHistory` và `importedData.tripHistory`.
   * Loại bỏ các bản ghi trùng lặp dựa trên khóa duy nhất `tripId` (nếu thiếu `tripId`, đối chiếu cặp `timestamp + routeId + rewardVND`).
   * Sắp xếp danh sách đã gộp theo `timestamp` giảm dần (mới nhất lên đầu) và giữ lại tối đa `50` phần tử đầu tiên (`slice(0, 50)`).
   * Lưu ngay đối tượng `merged` vào `localStorage` và cập nhật lại giao diện.