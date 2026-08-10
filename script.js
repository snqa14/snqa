document.addEventListener("DOMContentLoaded", async () => {
  const TARGET = 240000;
<
  const API_ENDPOINT = `${window.location.origin}/api/data`;
  const IMAGE_UPLOAD_API = `${window.location.origin}/api/upload-image`;

  const API_ENDPOINTS = [
    `${window.location.origin}/api.php`,
    `${window.location.origin}/api/data`,
  ];

  const VPS_IMAGE_API = `${window.location.origin}/api.php?action=upload-image`;

  const IMAGE_HOSTING_API = "https://script.google.com/macros/s/AKfycbyxXwGR9G3hk994sEPnzp1gtwvuWLsAi5dA_TUCAWab5DRJh_92dIEWCPPck6YPAoC9/exec";



  let total = 0;
  let images = [];
  let daily = {};
  let activeApiEndpoint = localStorage.getItem("activeApiEndpoint") || API_ENDPOINTS[0];

  async function requestJson(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`API lỗi ${response.status}`);
    }

    return response.json();
  }


  async function requestJson(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`API lỗi ${response.status}`);
    }

    return response.json();
  }

  // Load dữ liệu từ route Python. Nếu server lỗi thì dùng tạm localStorage.
  async function loadData() {
    try {
      const data = await requestJson(API_ENDPOINT);

      total = data.money || 0;
      images = data.images || [];
      daily = data.daily || {};

      updateUI();
    } catch (error) {
      console.error("Không kết nối được API Python, chuyển sang localStorage.", error);
      total = parseInt(localStorage.getItem("money") || 0, 10);
      images = JSON.parse(localStorage.getItem("images") || "[]");
      daily = JSON.parse(localStorage.getItem("daily") || "{}");
      updateUI();

  // Load dữ liệu từ API lưu trên VPS. Nếu VPS chưa cấu hình API thì dùng tạm localStorage.
  async function loadData() {
    const endpoints = [activeApiEndpoint, ...API_ENDPOINTS].filter(
      (endpoint, index, all) => all.indexOf(endpoint) === index
    );

    for (const endpoint of endpoints) {
      try {
        const data = await requestJson(endpoint);
        activeApiEndpoint = endpoint;
        localStorage.setItem("activeApiEndpoint", endpoint);

        total = data.money || 0;
        images = data.images || [];
        daily = data.daily || {};

        updateUI();
        return;
      } catch (error) {
        console.warn(`Không đọc được dữ liệu từ ${endpoint}:`, error);
      }

    }

    console.error("Không kết nối được API VPS, chuyển sang localStorage.");
    total = parseInt(localStorage.getItem("money") || 0, 10);
    images = JSON.parse(localStorage.getItem("images") || "[]");
    daily = JSON.parse(localStorage.getItem("daily") || "{}");
    updateUI();
  }


  // Gửi dữ liệu mới lên route Python. Đồng thời giữ localStorage làm bản dự phòng.

  // Gửi dữ liệu mới lên API lưu trên VPS. Đồng thời giữ localStorage làm bản dự phòng.

  async function syncServer() {
    const payload = {
      money: total,
      images: images,
      daily: daily
    };

    localStorage.setItem("money", String(total));
    localStorage.setItem("images", JSON.stringify(images));
    localStorage.setItem("daily", JSON.stringify(daily));


    try {
      return await requestJson(API_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.warn("Không thể đồng bộ tới API Python:", error);

    const endpoints = [activeApiEndpoint, ...API_ENDPOINTS].filter(
      (endpoint, index, all) => all.indexOf(endpoint) === index
    );

    for (const endpoint of endpoints) {
      try {
        const result = await requestJson(endpoint, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        activeApiEndpoint = endpoint;
        localStorage.setItem("activeApiEndpoint", endpoint);
        return result;
      } catch (error) {
        console.warn(`Không thể đồng bộ tới ${endpoint}:`, error);
      }

    }
  }

  
  function today() {
    return new Date().toLocaleDateString('vi-VN');
  }

  function parseMoney(val) {
    val = val.toLowerCase().trim();
    if (val.includes("k")) return parseFloat(val) * 1000;
    if (val.includes("m")) return parseFloat(val) * 1000000;
    return parseInt(val) || 0;
  }

  function updateUI() {
    // Cập nhật Progress Bar
    let percent = Math.min((total / TARGET) * 100, 100);
    const bar = document.getElementById("bar");
    const percentSpan = document.getElementById("percent");
    const moneyTextSpan = document.getElementById("moneyText");
    const remainSpan = document.getElementById("remainDynamic");

    if (bar) bar.style.width = percent + "%";
    if (percentSpan) percentSpan.innerText = percent.toFixed(1) + "%";
    if (moneyTextSpan) moneyTextSpan.innerHTML = total.toLocaleString() + " / 240,000đ";
    
    if (remainSpan) {
      let remain = Math.max(TARGET - total, 0);
      remainSpan.innerText = remain.toLocaleString() + "đ";
    }

    renderImages();
  }

  function renderImages() {
    let box = document.getElementById("images");
    if (!box) return;
    box.innerHTML = "";

    if (images.length === 0) {
      box.innerHTML = `<div class="empty-gallery">✨ Chưa có ảnh nào. Hãy tải ảnh để lưu kỷ niệm!</div>`;
      return;
    }

    images.forEach(img => {
      let div = document.createElement("div");
      div.className = "img-card";
      div.innerHTML = `
        <div class="date">📅 ${img.date}</div>
        <img src="${img.src}" loading="lazy" alt="saving moment">
        <div class="amount">💰 ${img.amount.toLocaleString()}đ</div>
      `;
      box.appendChild(div);
    });
  }

  // Xử lý khi bấm nút "Lưu tiền"
  async function addMoneyHandler() {
    let inputEl = document.getElementById("moneyInput");
    let val = inputEl ? inputEl.value : "";
    let money = parseMoney(val);
    
    if (money <= 0) return alert("Vui lòng nhập số tiền hợp lệ!");

    total += money;
    let d = today();
    daily[d] = (daily[d] || 0) + money;

    if (inputEl) inputEl.value = "";
    
    updateUI();

    await syncServer(); // Đồng bộ ngay lên server Python

    await syncServer(); // Đồng bộ ngay lên VPS

  }

  // Xử lý khi chọn ảnh
  async function uploadHandler(e) {
    let file = e.target.files[0];
    if (!file) return;

    // Hiển thị trạng thái đang xử lý (optional)
    const label = document.querySelector(".file-label");
    const originalText = label.innerText;
    label.innerText = "⏳ Đang tải ảnh lên...";

    let reader = new FileReader();
    reader.onload = async function(ev) {
      try {

        const uploadResult = await requestJson(IMAGE_UPLOAD_API, {

        const uploadResult = await requestJson(VPS_IMAGE_API, {

          method: "POST",
          body: JSON.stringify({
            image: ev.target.result,
            type: file.type
          })
        });


        // Đồng bộ toàn bộ dữ liệu mới lên VPS

        // 3. Đồng bộ toàn bộ dữ liệu mới lên VPS

        updateUI();
        await syncServer();
        
      } catch (err) {

        alert("Lỗi upload ảnh lên server Python!");

        alert("Lỗi upload ảnh lên VPS!");

        console.error(err);
      } finally {
        label.innerText = originalText;
      }
    };
    reader.readAsDataURL(file);
  }

  // ==========================================
  // 3. ĐĂNG KÝ SỰ KIỆN & KHỞI CHẠY
  // ==========================================
  const saveBtn = document.getElementById("saveMoneyBtn");
  if (saveBtn) saveBtn.addEventListener("click", addMoneyHandler);

  const fileInput = document.getElementById("uploadImageInput");
  if (fileInput) fileInput.addEventListener("change", uploadHandler);


  // Chạy lần đầu để load dữ liệu từ route Python

  // Chạy lần đầu để load dữ liệu từ API VPS

  loadData();
});
