/* ==========================================================================
   CONTROLLER — Связующее звено Model ↔ View
   -----------------------------------------------------------------------
   Паттерн «Мост» (Bridge):
     - ColorModel — Абстракция (публичный API)
     - ColorModelImpl — Реализация (математика)
   
   Паттерн «Слушатель» (Observer):
     - Controller подписывается на ColorEventBus.on("colorChanged")
     - View подписывается на те же события (через Controller)
     - Model испускает события при каждом изменении цвета
   
   Controller НЕ содержит математики и НЕ обращается к DOM напрямую —
   только координирует Model и View.
   ========================================================================== */

(function () {
  "use strict";

  // ─── Конфигурация моделей: только RGB, XYZ, HLS (по варианту) ───────────────
  // Диапазоны XYZ рассчитываются динамически из ColorModel
  var xyzMax = ColorModel.getXYZMax();

  var MODELS_DEF = [
    {
      key: "RGB", title: "RGB", sub: "sRGB / гамма-коррекция",
      channels: [
        { label: "R", min: 0,   max: 255,               step: 1,   decimals: 0 },
        { label: "G", min: 0,   max: 255,               step: 1,   decimals: 0 },
        { label: "B", min: 0,   max: 255,               step: 1,   decimals: 0 }
      ]
    },
    {
      key: "XYZ", title: "XYZ", sub: "CIE 1931, D65",
      channels: [
        { label: "X", min: 0, max: Math.ceil(xyzMax[0]), step: 0.01, decimals: 2 },
        { label: "Y", min: 0, max: Math.ceil(xyzMax[1]), step: 0.01, decimals: 2 },
        { label: "Z", min: 0, max: Math.ceil(xyzMax[2]), step: 0.01, decimals: 2 }
      ]
    },
    {
      key: "HLS", title: "HLS", sub: "тон / светлота / насыщ.",
      channels: [
        { label: "H°", min: 0,   max: 360, step: 1,   decimals: 0 },
        { label: "L%", min: 0,   max: 100, step: 0.1, decimals: 1 },
        { label: "S%", min: 0,   max: 100, step: 0.1, decimals: 1 }
      ]
    }
  ];

  // ─── Получение значений из модели для View ─────────────────────────────────
  function getModelValues(key) {
    if (key === "RGB") return ColorModel.getRGB();
    if (key === "XYZ") return ColorModel.getXYZ();
    if (key === "HLS") return ColorModel.getHLS();
    return [];
  }

  // ─── Обновление всего интерфейса ──────────────────────────────────────────
  // editedKey — ключ модели, которую пользователь сейчас редактирует (не перезаписываем)
  function refreshAll(editedKey) {
    var rgb = ColorModel.getRGB();
    var xyz = ColorModel.getXYZ();

    // Обновление полей (кроме той модели, которую редактируют)
    ColorView.updateFields(MODELS_DEF, getModelValues, editedKey);

    // Обновление градиентов ползунков
    ColorView.updateSliderGradients(MODELS_DEF, getModelValues, ColorModel.simulateColor);

    // Обновление превью (свотч, HEX, гамут-предупреждение)
    ColorView.updatePreview(rgb, ColorModel.isOutOfGamut());

    // Перерисовка диаграммы МКО
    var cieCanvas = document.getElementById("cieCanvas");
    // Передаём XYZ + RGB для окраски точки
    var xyzWithRgb = [xyz[0], xyz[1], xyz[2], rgb[0], rgb[1], rgb[2]];
    ColorView.drawCIEDiagram(cieCanvas, xyzWithRgb);

    // Перерисовка HSV-палитры
    var svCanvas  = document.getElementById("svCanvas");
    var hueCanvas = document.getElementById("hueCanvas");
    ColorView.drawHSVPicker(svCanvas, hueCanvas, rgb);
  }

  // ─── Обработка изменений от View ─────────────────────────────────────────
  // Вызывается, когда пользователь двигает ползунок или вводит значение
  function onFieldEdit(modelKey, vals) {
    if (modelKey === "RGB") ColorModel.setRGB(vals[0], vals[1], vals[2]);
    if (modelKey === "XYZ") ColorModel.setXYZ(vals[0], vals[1], vals[2]);
    if (modelKey === "HLS") ColorModel.setHLS(vals[0], vals[1], vals[2]);
    // Паттерн Слушатель: refreshAll вызовется через EventBus ниже
  }

  // ─── Подписка на событие от модели (Observer) ─────────────────────────────
  // Когда модель меняется (из любого источника) — обновляем View
  // lastEditedKey — сохраняем, чтобы не перезаписывать активное поле
  var lastEditedKey = null;

  ColorEventBus.on("colorChanged", function () {
    refreshAll(lastEditedKey);
    lastEditedKey = null;
  });

  // Переопределяем onFieldEdit чтобы сохранять lastEditedKey ДО emit
  function onFieldEditProxy(modelKey, vals) {
    lastEditedKey = modelKey;
    onFieldEdit(modelKey, vals);
  }

  // ─── Слушатели верхних контролов ──────────────────────────────────────────
  function setupTopControls() {
    // HEX input
    document.getElementById("hexInput").addEventListener("change", function (e) {
      var hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").padEnd(6, "0").slice(0, 6);
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      lastEditedKey = null;
      ColorModel.setRGB(r, g, b);
    });

    // Нативный пикер
    document.getElementById("nativePicker").addEventListener("input", function (e) {
      var hex = e.target.value.replace("#", "");
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      lastEditedKey = null;
      ColorModel.setRGB(r, g, b);
    });

    // Случайный
    document.getElementById("randomBtn").addEventListener("click", function () {
      lastEditedKey = null;
      ColorModel.setRGB(
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
      );
    });

    // Сброс
    document.getElementById("resetBtn").addEventListener("click", function () {
      lastEditedKey = null;
      ColorModel.setRGB(136, 153, 221);
    });

    // Переключение темы
    document.querySelectorAll("[data-theme]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-theme]").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        document.documentElement.setAttribute("data-theme", btn.dataset.theme);
      });
    });
  }

  // ─── Слушатели палитры HSV ────────────────────────────────────────────────
  function setupPickerControls() {
    var svCanvas  = document.getElementById("svCanvas");
    var hueCanvas = document.getElementById("hueCanvas");
    if (!svCanvas || !hueCanvas) return;

    var draggingSV  = false;
    var draggingHue = false;

    function clampF(v, a, b) { return Math.min(b, Math.max(a, v)); }

    function svPointer(e) {
      var rect = svCanvas.getBoundingClientRect();
      var saturation = clampF((e.clientX - rect.left) / rect.width, 0, 1);
      var value      = 1 - clampF((e.clientY - rect.top) / rect.height, 0, 1);
      // Сохраняем текущий тон
      var rgb = ColorModel.getRGB();
      var r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
      var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
      var hue = 0;
      if (d > 1e-9) {
        if (max === r) hue = 60 * (((g-b)/d) % 6);
        else if (max === g) hue = 60 * ((b-r)/d + 2);
        else hue = 60 * ((r-g)/d + 4);
        if (hue < 0) hue += 360;
      }
      // HSV → HLS → setHLS
      // Упрощение: перевести через RGB
      function hsvToRGB(h, s, v) {
        var c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c, rr,gg,bb;
        if(h<60){rr=c;gg=x;bb=0;}else if(h<120){rr=x;gg=c;bb=0;}
        else if(h<180){rr=0;gg=c;bb=x;}else if(h<240){rr=0;gg=x;bb=c;}
        else if(h<300){rr=x;gg=0;bb=c;}else{rr=c;gg=0;bb=x;}
        return [Math.round((rr+m)*255), Math.round((gg+m)*255), Math.round((bb+m)*255)];
      }
      var newRGB = hsvToRGB(hue, saturation, value);
      lastEditedKey = null;
      ColorModel.setRGB(newRGB[0], newRGB[1], newRGB[2]);
    }

    function huePointer(e) {
      var rect = hueCanvas.getBoundingClientRect();
      var hue = clampF((e.clientY - rect.top) / rect.height, 0, 1) * 360;
      // Получаем текущий sat/val
      var rgb = ColorModel.getRGB();
      var r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
      var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
      var sat = max < 1e-9 ? 0 : d / max;
      var val = max;
      function hsvToRGB(h, s, v) {
        var c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c, rr,gg,bb;
        if(h<60){rr=c;gg=x;bb=0;}else if(h<120){rr=x;gg=c;bb=0;}
        else if(h<180){rr=0;gg=c;bb=x;}else if(h<240){rr=0;gg=x;bb=c;}
        else if(h<300){rr=x;gg=0;bb=c;}else{rr=c;gg=0;bb=x;}
        return [Math.round((rr+m)*255), Math.round((gg+m)*255), Math.round((bb+m)*255)];
      }
      var newRGB = hsvToRGB(hue, sat, val);
      lastEditedKey = null;
      ColorModel.setRGB(newRGB[0], newRGB[1], newRGB[2]);
    }

    svCanvas.addEventListener("mousedown",  function (e) { draggingSV = true;  svPointer(e); });
    hueCanvas.addEventListener("mousedown", function (e) { draggingHue = true; huePointer(e); });
    window.addEventListener("mousemove", function (e) {
      if (draggingSV)  svPointer(e);
      if (draggingHue) huePointer(e);
    });
    window.addEventListener("mouseup", function () { draggingSV = false; draggingHue = false; });

    svCanvas.addEventListener("touchstart",  function (e) { draggingSV = true;  svPointer(e.touches[0]);  e.preventDefault(); }, { passive: false });
    svCanvas.addEventListener("touchmove",   function (e) { if (draggingSV)  svPointer(e.touches[0]);      e.preventDefault(); }, { passive: false });
    hueCanvas.addEventListener("touchstart", function (e) { draggingHue = true; huePointer(e.touches[0]); e.preventDefault(); }, { passive: false });
    hueCanvas.addEventListener("touchmove",  function (e) { if (draggingHue) huePointer(e.touches[0]);    e.preventDefault(); }, { passive: false });
    window.addEventListener("touchend", function () { draggingSV = false; draggingHue = false; });
  }

  // ─── Инициализация ────────────────────────────────────────────────────────
  window.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("modelsGrid");

    // 1. Строим карточки (View)
    ColorView.buildModelCards(MODELS_DEF, grid, onFieldEditProxy);

    // 2. Настраиваем слушатели (Controller)
    setupTopControls();
    setupPickerControls();

    // 3. Начальный цвет
    ColorModel.setRGB(136, 153, 221);
    // Событие colorChanged уже сгенерировано → refreshAll вызовется через Observer
  });

})();
