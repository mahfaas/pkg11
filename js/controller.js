/* ==========================================================================
   CONTROLLER
   Связующее звено между Model и View.
   Содержит конфигурацию отображаемых моделей (только RGB, LAB, CMYK по заданию).
   Управляет событиями, вызывает Model для пересчета, передает данные во View.
   ========================================================================== */

(function() {
  "use strict";

  // Конфигурация: только нужные по Варианту 1 модели
  var MODELS_DEF = [
    {
      key: "RGB", title: "RGB", sub: "устройство / sRGB",
      channels: [
        { label: "R", min: 0, max: 255, step: 1, decimals: 0 },
        { label: "G", min: 0, max: 255, step: 1, decimals: 0 },
        { label: "B", min: 0, max: 255, step: 1, decimals: 0 }
      ]
    },
    {
      key: "LAB", title: "LAB", sub: "CIE 1976",
      channels: [
        { label: "L", min: 0, max: 100, step: 0.1, decimals: 2 },
        { label: "a", min: -128, max: 127, step: 0.1, decimals: 2 },
        { label: "b", min: -128, max: 127, step: 0.1, decimals: 2 }
      ]
    },
    {
      key: "HSV", title: "HSV", sub: "тон / насыщ. / яркость",
      channels: [
        { label: "H", min: 0, max: 360, step: 1, decimals: 0 },
        { label: "S", min: 0, max: 100, step: 0.1, decimals: 1 },
        { label: "V", min: 0, max: 100, step: 0.1, decimals: 1 }
      ]
    },
    {
      key: "HLS", title: "HLS", sub: "тон / светлота / насыщ.",
      channels: [
        { label: "H", min: 0, max: 360, step: 1, decimals: 0 },
        { label: "L", min: 0, max: 100, step: 0.1, decimals: 1 },
        { label: "S", min: 0, max: 100, step: 0.1, decimals: 1 }
      ]
    },
    {
      key: "CMYK", title: "CMYK", sub: "полиграфия",
      channels: [
        { label: "C", min: 0, max: 100, step: 0.1, decimals: 1 },
        { label: "M", min: 0, max: 100, step: 0.1, decimals: 1 },
        { label: "Y", min: 0, max: 100, step: 0.1, decimals: 1 },
        { label: "K", min: 0, max: 100, step: 0.1, decimals: 1 }
      ]
    },
    {
      key: "XYZ", title: "XYZ", sub: "CIE 1931",
      channels: [
        { label: "X", min: 0, max: 120, step: 0.1, decimals: 2 },
        { label: "Y", min: 0, max: 120, step: 0.1, decimals: 2 },
        { label: "Z", min: 0, max: 120, step: 0.1, decimals: 2 }
      ]
    }
  ];

  // Вспомогательная функция для View
  function getModelValues(key) {
    if (key === "RGB") return ColorModel.getRGB();
    if (key === "HSV") return ColorModel.getHSV();
    if (key === "HLS") return ColorModel.getHLS();
    if (key === "LAB") return ColorModel.getLAB();
    if (key === "CMYK") return ColorModel.getCMYK();
    if (key === "XYZ") return ColorModel.getXYZ();
    return [];
  }

  // Обновление всего интерфейса
  function refreshAll(editedKey) {
    ColorView.updateFields(MODELS_DEF, getModelValues, editedKey);
    if (editedKey) {
      ColorView.updateEditedFieldsDisplay(editedKey, getModelValues);
    }
    ColorView.updateSliderGradients(MODELS_DEF, getModelValues, ColorModel.simulateColor);
    
    var state = ColorModel.getState();
    var w = ColorModel.getWhites()[state.illuminant];
    var whiteLabel = w.label + " (x=" + w.x.toFixed(5) + ", y=" + w.y.toFixed(5) + ")";
    
    var rgb = ColorModel.getRGB();
    ColorView.updatePreview(rgb, state.lastOutOfGamut, whiteLabel);
    
    // Синхронизация нативного пикера с текущим цветом
    var hex = rgb.map(function(c) {
      return Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0");
    }).join("");
    document.getElementById("nativePicker").value = "#" + hex;
    
    // Перерисовка канвасов
    drawPickers();
  }

  // Отрисовка канвасов для палитры
  function drawPickers() {
    var svCanvas = document.getElementById("svCanvas");
    var hueCanvas = document.getElementById("hueCanvas");
    if (!svCanvas || !hueCanvas) return;
    
    var svCtx = svCanvas.getContext("2d");
    var hueCtx = hueCanvas.getContext("2d");
    
    var rgb = ColorModel.getRGB();
    var hsv = ColorModel.rgb255ToHSV(rgb[0], rgb[1], rgb[2]);
    var h = hsv[0], s = hsv[1], v = hsv[2];

    var w = svCanvas.width, hgt = svCanvas.height;
    var base = ColorModel.hsvToRGB255(h, 100, 100);
    svCtx.clearRect(0, 0, w, hgt);
    
    var gradW = svCtx.createLinearGradient(0, 0, w, 0);
    gradW.addColorStop(0, "#ffffff");
    gradW.addColorStop(1, ColorView.toCssColor(base));
    svCtx.fillStyle = gradW; svCtx.fillRect(0, 0, w, hgt);
    
    var gradB = svCtx.createLinearGradient(0, 0, 0, hgt);
    gradB.addColorStop(0, "rgba(0,0,0,0)");
    gradB.addColorStop(1, "#000000");
    svCtx.fillStyle = gradB; svCtx.fillRect(0, 0, w, hgt);
    
    var mx = (s / 100) * w, my = (1 - v / 100) * hgt;
    svCtx.beginPath(); svCtx.arc(mx, my, 5, 0, 7); svCtx.strokeStyle = "#fff"; svCtx.lineWidth = 2; svCtx.stroke();
    svCtx.beginPath(); svCtx.arc(mx, my, 5, 0, 7); svCtx.strokeStyle = "rgba(0,0,0,.6)"; svCtx.lineWidth = 1; svCtx.stroke();

    var hw = hueCanvas.width, hh = hueCanvas.height;
    var gradH = hueCtx.createLinearGradient(0, 0, 0, hh);
    for (var i = 0; i <= 6; i++) {
      var hue = i * 60;
      var c = ColorModel.hsvToRGB255(hue, 100, 100);
      gradH.addColorStop(i / 6, ColorView.toCssColor(c));
    }
    hueCtx.clearRect(0, 0, hw, hh);
    hueCtx.fillStyle = gradH; hueCtx.fillRect(0, 0, hw, hh);
    var my2 = (h / 360) * hh;
    hueCtx.strokeStyle = "#fff"; hueCtx.lineWidth = 2;
    hueCtx.strokeRect(0, my2 - 2, hw, 4);
    hueCtx.strokeStyle = "rgba(0,0,0,.6)"; hueCtx.lineWidth = 1;
    hueCtx.strokeRect(0, my2 - 2, hw, 4);
  }

  // Обработка ручного редактирования полей (от View)
  function onFieldEdit(modelKey, vals) {
    if (modelKey === "RGB") ColorModel.setRGB(vals[0], vals[1], vals[2]);
    if (modelKey === "HSV") ColorModel.setHSV(vals[0], vals[1], vals[2]);
    if (modelKey === "HLS") ColorModel.setHLS(vals[0], vals[1], vals[2]);
    if (modelKey === "LAB") ColorModel.setLAB(vals[0], vals[1], vals[2]);
    if (modelKey === "CMYK") ColorModel.setCMYK(vals[0], vals[1], vals[2], vals[3]);
    if (modelKey === "XYZ") ColorModel.setXYZ(vals[0], vals[1], vals[2]);
    refreshAll(modelKey);
  }

  // Настройка слушателей верхних контролов
  function setupTopControls() {
    document.getElementById("illuminant").addEventListener("change", function(e) {
      ColorModel.setIlluminant(e.target.value);
      refreshAll(null);
    });

    document.querySelectorAll("[data-algo]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        document.querySelectorAll("[data-algo]").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        ColorModel.setCmykAlgo(btn.dataset.algo);
        document.getElementById("amountLabel").textContent = "Сила " + btn.dataset.algo;
        refreshAll(null);
      });
    });

    document.getElementById("cmykAmount").addEventListener("input", function(e) {
      ColorModel.setCmykAmount(parseFloat(e.target.value) / 100);
      document.getElementById("cmykAmountVal").textContent = e.target.value + "%";
      refreshAll(null);
    });

    document.querySelectorAll("[data-gamut]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        document.querySelectorAll("[data-gamut]").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        ColorModel.setGamutStrategy(btn.dataset.gamut);
        document.getElementById("gamutStrategyLabel").textContent = btn.dataset.gamut === "clip" ? "clipping" : "scaling";
        refreshAll(null);
      });
    });

    document.querySelectorAll("[data-theme]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        document.querySelectorAll("[data-theme]").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        document.documentElement.setAttribute("data-theme", btn.dataset.theme);
      });
    });

    document.getElementById("hexInput").addEventListener("change", function(e) {
      var hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").padEnd(6, "0").slice(0, 6);
      var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      ColorModel.setRGB(r, g, b);
      refreshAll(null);
    });

    document.getElementById("nativePicker").addEventListener("input", function(e) {
      var hex = e.target.value.replace("#", "");
      var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      ColorModel.setRGB(r, g, b);
      refreshAll(null);
    });

    document.getElementById("randomBtn").addEventListener("click", function() {
      ColorModel.setRGB(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
      refreshAll(null);
    });

    document.getElementById("resetBtn").addEventListener("click", function() {
      ColorModel.setRGB(136, 153, 221);
      refreshAll(null);
    });
  }

  // Инициализация при загрузке
  window.addEventListener("DOMContentLoaded", function() {
    var grid = document.getElementById("modelsGrid");
    
    // 1. Строим карточки (View)
    ColorView.buildModelCards(MODELS_DEF, grid, onFieldEdit);
    
    // 2. Настраиваем слушатели (Controller)
    setupTopControls();

    // Слушатели канвасов
    var svCanvas = document.getElementById("svCanvas");
    var hueCanvas = document.getElementById("hueCanvas");
    if (svCanvas && hueCanvas) {
      var draggingSV = false, draggingHue = false;
      function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
      function svPointer(e) {
        var rect = svCanvas.getBoundingClientRect();
        var x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        var y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        var rgb = ColorModel.getRGB(); 
        var hsv = ColorModel.rgb255ToHSV(rgb[0], rgb[1], rgb[2]);
        ColorModel.setHSV(hsv[0], x * 100, (1 - y) * 100);
        refreshAll(null);
      }
      function huePointer(e) {
        var rect = hueCanvas.getBoundingClientRect();
        var y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        var rgb = ColorModel.getRGB(); 
        var hsv = ColorModel.rgb255ToHSV(rgb[0], rgb[1], rgb[2]);
        ColorModel.setHSV(y * 360, hsv[1], hsv[2]);
        refreshAll(null);
      }
      svCanvas.addEventListener("mousedown", function(e) { draggingSV = true; svPointer(e); });
      window.addEventListener("mousemove", function(e) { if (draggingSV) svPointer(e); if (draggingHue) huePointer(e); });
      window.addEventListener("mouseup", function() { draggingSV = false; draggingHue = false; });
      hueCanvas.addEventListener("mousedown", function(e) { draggingHue = true; huePointer(e); });
      
      svCanvas.addEventListener("touchstart", function(e) { draggingSV = true; svPointer(e.touches[0]); e.preventDefault(); }, { passive: false });
      svCanvas.addEventListener("touchmove", function(e) { if (draggingSV) svPointer(e.touches[0]); e.preventDefault(); }, { passive: false });
      hueCanvas.addEventListener("touchstart", function(e) { draggingHue = true; huePointer(e.touches[0]); e.preventDefault(); }, { passive: false });
      hueCanvas.addEventListener("touchmove", function(e) { if (draggingHue) huePointer(e.touches[0]); e.preventDefault(); }, { passive: false });
      window.addEventListener("touchend", function() { draggingSV = false; draggingHue = false; });
    }

    // 3. Задаем начальный цвет и обновляем
    ColorModel.setRGB(136, 153, 221);
    refreshAll(null);
  });

})();
