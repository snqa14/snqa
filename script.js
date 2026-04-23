document.addEventListener("DOMContentLoaded", async () => {
  const TARGET = 240000;
  // This is a local server
  const PYTHON_API = "http://192.168.2.226:5000/api/data"; 
  const IMAGE_HOSTING_API = "https://script.google.com/macros/s/AKfycbyxXwGR9G3hk994sEPnzp1gtwvuWLsAi5dA_TUCAWab5DRJh_92dIEWCPPck6YPAoC9/exec";

  let total = 0;
  let images = [];
  let daily = {};

  // Load data
  async function loadData() {
    try {
      const response = await fetch(PYTHON_API);
      if (!response.ok) throw new Error("Server Python chưa chạy?");
      const data = await response.json();
      
      total = data.money || 0;
      images = data.images || [];
      daily = data.daily || {};
      
      updateUI();
    } catch (error) {
      console.error("Lỗi kết nối Server:", error);
      // Fallback dùng tạm localStorage nếu server lỗi
      total = parseInt(localStorage.getItem("money") || 0);
      images = JSON.parse(localStorage.getItem("images") || "[]");
      daily = JSON.parse(localStorage.getItem("daily") || "{}");
      updateUI();
    }
  }

  // Gửi dữ liệu mới lên Server Python
  async function syncServer() {
    const payload = {
      money: total,
      images: images,
      daily: daily
    };
    
    try {
      await fetch(PYTHON_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("Không thể đồng bộ tới Python:", error);
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
    await syncServer(); // Đồng bộ ngay lên Python
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
        let base64 = ev.target.result.split(",")[1];
        
        // 1. Gửi ảnh lên Google Apps Script (Giữ nguyên API của bạn)
        let res = await fetch(IMAGE_HOSTING_API, {
          method: "POST",
          body: JSON.stringify({ image: base64 })
        });
        let data = await res.json();
        
        // 2. Sau khi có link ảnh, thêm vào mảng images
        let d = today();
        images.unshift({
          src: data.url,
          date: d,
          amount: daily[d] || 0
        });

        // 3. Đồng bộ toàn bộ dữ liệu mới lên Server Python
        updateUI();
        await syncServer();
        
      } catch (err) {
        alert("Lỗi upload ảnh!");
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

  // Chạy lần đầu để load dữ liệu từ Python file
  loadData();
});
