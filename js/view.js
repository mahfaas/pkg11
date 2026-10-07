/* ==========================================================================
   VIEW — Паттерн «Слушатель» (Observer) — только отображение
   -----------------------------------------------------------------------
   View подписывается на события ColorEventBus и обновляет DOM.
   View не вызывает Model напрямую и не содержит математики.
   Все действия пользователя передаются через callback-и в Controller.
   ========================================================================== */

window.ColorView = (function () {
  "use strict";

  // DOM-ссылки на поля/ползунки каждой модели
  // { modelKey: [ { num, slider, decimals, min, max }, ... ] }
  var uiRows = {};

  // ─── Вспомогательные ─────────────────────────────────────────────────────────
  function toCssColor(rgb255) {
    var r = Math.round(Math.max(0, Math.min(255, rgb255[0])));
    var g = Math.round(Math.max(0, Math.min(255, rgb255[1])));
    var b = Math.round(Math.max(0, Math.min(255, rgb255[2])));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function toHex(rgb255) {
    return rgb255.map(function (c) {
      return Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  // ─── Построение карточек модели ───────────────────────────────────────────────
  /**
   * @param {Array}    modelsDef   — конфигурация моделей (из Controller)
   * @param {Element}  gridElement — контейнер
   * @param {Function} onEdit      — (modelKey, vals[]) → void, вызывается при вводе
   */
  function buildModelCards(modelsDef, gridElement, onEdit) {
    gridElement.innerHTML = "";
    uiRows = {};

    modelsDef.forEach(function (model) {
      var card = document.createElement("div");
      card.className = "model-card";
      card.setAttribute("data-model", model.key);

      var h2 = document.createElement("h2");
      h2.innerHTML = model.title + " <small>" + model.sub + "</small>";
      card.appendChild(h2);

      uiRows[model.key] = [];

      model.channels.forEach(function (ch, idx) {
        var row = document.createElement("div");
        row.className = "channel";

        var head = document.createElement("div");
        head.className = "channel-head";

        var lab = document.createElement("label");
        lab.textContent = ch.label;

        var num = document.createElement("input");
        num.type = "number";
        num.min = ch.min;
        num.max = ch.max;
        num.step = ch.step;
        num.id = "num_" + model.key + "_" + idx;

        head.appendChild(lab);
        head.appendChild(num);

        var slider = document.createElement("input");
        slider.type = "range";
        slider.min = ch.min;
        slider.max = ch.max;
        slider.step = ch.step;
        slider.id = "slider_" + model.key + "_" + idx;

        row.appendChild(head);
        row.appendChild(slider);
        card.appendChild(row);

        uiRows[model.key].push({ num: num, slider: slider, decimals: ch.decimals, min: ch.min, max: ch.max });

        // ─── Обработчики (паттерн Слушатель: View слушает DOM-события) ────────
        // Флаг «пользователь сейчас редактирует» предотвращает рекурсивные обновления
        var editing = false;

        num.addEventListener("input", function () {
          var raw = parseFloat(num.value);
          if (isNaN(raw)) return;
          // Синхронизируем ползунок с числовым полем немедленно
          slider.value = raw;
          // Собираем текущие значения всех каналов, заменяем текущий
          var vals = uiRows[model.key].map(function (r, i) {
            if (i === idx) return raw;
            return parseFloat(r.num.value) || 0;
          });
          editing = true;
          onEdit(model.key, vals);
          editing = false;
        });

        slider.addEventListener("input", function () {
          var raw = parseFloat(slider.value);
          // Синхронизируем числовое поле со ползунком немедленно
          num.value = ch.decimals === 0 ? Math.round(raw) : raw.toFixed(ch.decimals);
          var vals = uiRows[model.key].map(function (r, i) {
            if (i === idx) return raw;
            return parseFloat(r.num.value) || 0;
          });
          editing = true;
          onEdit(model.key, vals);
          editing = false;
        });
      });

      gridElement.appendChild(card);
    });
  }

  // ─── Обновление полей из данных модели ────────────────────────────────────────
  /**
   * @param {Array}    modelsDef      — конфигурация
   * @param {Function} getModelValues — (key) → number[]
   * @param {string}   skipKey        — модель, которую редактирует пользователь (не обновляем)
   */
  function updateFields(modelsDef, getModelValues, skipKey) {
    modelsDef.forEach(function (model) {
      if (model.key === skipKey) return;
      var vals = getModelValues(model.key);
      if (!vals || !uiRows[model.key]) return;
      uiRows[model.key].forEach(function (row, idx) {
        var v = vals[idx];
        if (v === undefined || v === null || isNaN(v)) return;
        // Ограничиваем значения диапазоном ползунка
        var clamped = Math.min(row.max, Math.max(row.min, v));
        var displayed = row.decimals === 0 ? Math.round(clamped) : parseFloat(clamped.toFixed(row.decimals));
        row.num.value = row.decimals === 0 ? Math.round(displayed) : displayed.toFixed(row.decimals);
        row.slider.value = clamped;
      });
    });
  }

  // ─── Обновление только редактируемой модели (синхронизация поля со ползунком) ─
  function updateEditedModelDisplay(key, getModelValues) {
    if (!uiRows[key]) return;
    var vals = getModelValues(key);
    if (!vals) return;
    uiRows[key].forEach(function (row, idx) {
      var v = vals[idx];
      if (v === undefined || isNaN(v)) return;
      var clamped = Math.min(row.max, Math.max(row.min, v));
      row.slider.value = clamped;
    });
  }

  // ─── Динамические CSS-градиенты ползунков ─────────────────────────────────────
  function updateSliderGradients(modelsDef, getModelValues, simulateColor) {
    var STEPS = 16;
    modelsDef.forEach(function (model) {
      var current = getModelValues(model.key);
      if (!current || !uiRows[model.key]) return;
      model.channels.forEach(function (ch, idx) {
        var stops = [];
        for (var i = 0; i <= STEPS; i++) {
          var t = ch.min + (ch.max - ch.min) * i / STEPS;
          var vals = current.slice();
          vals[idx] = t;
          var rgb = simulateColor(model.key, vals);
          stops.push(toCssColor(rgb));
        }
        uiRows[model.key][idx].slider.style.background =
          "linear-gradient(90deg," + stops.join(",") + ")";
      });
    });
  }

  // ─── Обновление превью (свотч + HEX) ──────────────────────────────────────────
  function updatePreview(rgb255, outOfGamut) {
    var css = toCssColor(rgb255);
    document.getElementById("swatch").style.background = css;
    document.getElementById("hexInput").value = toHex(rgb255);
    document.getElementById("gamutWarning").classList.toggle("show", outOfGamut);
    // Синхронизация нативного пикера
    document.getElementById("nativePicker").value = "#" + toHex(rgb255).toLowerCase();
  }

  // ─── График МКО (CIE 1931 xy хроматическая диаграмма) ────────────────────────
  /**
   * Отрисовывает диаграмму хроматичности CIE 1931 на canvas.
   * Текущий цвет отображается как точка.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} currentXYZ — [X, Y, Z] текущего цвета
   */
  function drawCIEDiagram(canvas, currentXYZ) {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var W = canvas.width;
    var H = canvas.height;

    // Координаты подграфика (отступы для осей)
    var pad = { left: 36, right: 12, top: 10, bottom: 32 };
    var pw = W - pad.left - pad.right;
    var ph = H - pad.top - pad.bottom;

    // Диапазон xy
    var xMin = 0, xMax = 0.8, yMin = 0, yMax = 0.9;

    function mapXY(x, y) {
      return {
        px: pad.left + (x - xMin) / (xMax - xMin) * pw,
        py: pad.top + ph - (y - yMin) / (yMax - yMin) * ph
      };
    }

    // ─── Стандартные значения CMF (colour matching functions) CIE 1931 ────────
    // Спектральный локус (xbar, ybar для λ от 380 до 700 нм, шаг 5 нм)
    // Источник: CIE 1931 2° Standard Observer
    var LOCUS = [
      // [λ, x, y]
      [380,0.1741,0.0050],[385,0.1740,0.0050],[390,0.1738,0.0049],[395,0.1736,0.0049],
      [400,0.1733,0.0048],[405,0.1730,0.0048],[410,0.1726,0.0048],[415,0.1721,0.0048],
      [420,0.1714,0.0051],[425,0.1703,0.0058],[430,0.1689,0.0069],[435,0.1669,0.0086],
      [440,0.1644,0.0109],[445,0.1611,0.0138],[450,0.1566,0.0177],[455,0.1510,0.0227],
      [460,0.1440,0.0297],[465,0.1355,0.0399],[470,0.1241,0.0578],[475,0.1096,0.0868],
      [480,0.0913,0.1327],[485,0.0687,0.2007],[490,0.0454,0.2950],[495,0.0235,0.4127],
      [500,0.0082,0.5384],[505,0.0039,0.6548],[510,0.0139,0.7502],[515,0.0389,0.8120],
      [520,0.0743,0.8338],[525,0.1142,0.8262],[530,0.1547,0.8059],[535,0.1929,0.7816],
      [540,0.2296,0.7543],[545,0.2658,0.7243],[550,0.3016,0.6923],[555,0.3373,0.6589],
      [560,0.3731,0.6245],[565,0.4087,0.5896],[570,0.4441,0.5547],[575,0.4788,0.5202],
      [580,0.5125,0.4866],[585,0.5448,0.4544],[590,0.5752,0.4242],[595,0.6029,0.3965],
      [600,0.6270,0.3725],[605,0.6482,0.3514],[610,0.6658,0.3340],[615,0.6801,0.3197],
      [620,0.6915,0.3083],[625,0.7006,0.2993],[630,0.7079,0.2920],[635,0.7140,0.2859],
      [640,0.7190,0.2809],[645,0.7230,0.2770],[650,0.7260,0.2740],[655,0.7283,0.2717],
      [660,0.7300,0.2700],[665,0.7311,0.2689],[670,0.7320,0.2680],[675,0.7327,0.2673],
      [680,0.7334,0.2666],[685,0.7340,0.2660],[690,0.7344,0.2656],[695,0.7346,0.2654],
      [700,0.7347,0.2653]
    ];

    // ─── Очистка и фон ─────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--panel-bg") || "#191b21";
    ctx.fillRect(0, 0, W, H);

    // ─── Отрисовка цветного заполнения (видимый спектр) ───────────────────────
    // Растровый проход по пикселям для нахождения внутренних точек локуса
    var imageData = ctx.getImageData(pad.left, pad.top, pw, ph);
    var data = imageData.data;

    // Строим полигон локуса для теста «точка внутри»
    var locusPoly = LOCUS.map(function (p) { return mapXY(p[1], p[2]); });
    // Замыкаем через пурпурную линию (380 нм → 700 нм)
    locusPoly.push(mapXY(LOCUS[0][1], LOCUS[0][2]));

    // Упрощённая функция XY → RGB через матрицу XYZ→sRGB D65
    // Матрица (Bradford-adapted IEC 61966-2-1):
    var M_XYZ_sRGB = [
      [ 3.2406, -1.5372, -0.4986],
      [-0.9689,  1.8758,  0.0415],
      [ 0.0557, -0.2040,  1.0570]
    ];
    function xyzToSrgbClamped(X, Y, Z) {
      var linR =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
      var linG = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
      var linB =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
      function toS(c) {
        c = Math.max(0, c);
        return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      }
      return [toS(linR) * 255, toS(linG) * 255, toS(linB) * 255];
    }

    function pointInPolygon(px, py, poly) {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i].px, yi = poly[i].py;
        var xj = poly[j].px, yj = poly[j].py;
        if (((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }

    for (var py = 0; py < ph; py++) {
      for (var px = 0; px < pw; px++) {
        // Координаты в пикселях относительно графика
        var pointPx = { px: pad.left + px, py: pad.top + py };
        if (pointInPolygon(pointPx.px, pointPx.py, locusPoly)) {
          // Обратное преобразование пиксель → xy
          var cx = xMin + px / pw * (xMax - xMin);
          var cy = yMax - py / ph * (yMax - yMin);
          if (cy < 1e-6) cy = 1e-6;
          // xy → XYZ при Y=1
          var denom = cy;
          var Xn = cx / denom, Yn = 1, Zn = (1 - cx - cy) / denom;
          var rgb = xyzToSrgbClamped(Xn, Yn, Zn);
          // Нормализуем яркость
          var maxC = Math.max(rgb[0], rgb[1], rgb[2]);
          if (maxC > 1e-6) {
            rgb[0] = rgb[0] / maxC * 220;
            rgb[1] = rgb[1] / maxC * 220;
            rgb[2] = rgb[2] / maxC * 220;
          }
          var i4 = (py * pw + px) * 4;
          data[i4]     = Math.round(Math.max(0, Math.min(255, rgb[0])));
          data[i4 + 1] = Math.round(Math.max(0, Math.min(255, rgb[1])));
          data[i4 + 2] = Math.round(Math.max(0, Math.min(255, rgb[2])));
          data[i4 + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, pad.left, pad.top);

    // ─── Контур локуса ─────────────────────────────────────────────────────────
    ctx.beginPath();
    LOCUS.forEach(function (p, i) {
      var pt = mapXY(p[1], p[2]);
      if (i === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    });
    // Пурпурная линия
    ctx.lineTo(mapXY(LOCUS[0][1], LOCUS[0][2]).px, mapXY(LOCUS[0][1], LOCUS[0][2]).py);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ─── Оси ──────────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    // Ось X
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(pad.left + pw, pad.top + ph);
    ctx.stroke();
    // Ось Y
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ph);
    ctx.stroke();

    // Подписи осей
    ctx.fillStyle = "rgba(200,200,200,0.8)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (var xi = 0; xi <= 8; xi++) {
      var xv = xi * 0.1;
      var xpx = pad.left + (xv - xMin) / (xMax - xMin) * pw;
      ctx.fillText(xv.toFixed(1), xpx, H - 4);
    }
    ctx.textAlign = "right";
    for (var yi2 = 0; yi2 <= 9; yi2++) {
      var yv = yi2 * 0.1;
      var ypx = pad.top + ph - (yv - yMin) / (yMax - yMin) * ph;
      if (ypx > pad.top && ypx < pad.top + ph) {
        ctx.fillText(yv.toFixed(1), pad.left - 3, ypx + 3);
      }
    }
    // Подписи осей
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(200,200,200,0.9)";
    ctx.fillText("x", pad.left + pw / 2, H - 1);
    ctx.save();
    ctx.translate(10, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y", 0, 0);
    ctx.restore();

    // ─── Белая точка D65 ──────────────────────────────────────────────────────
    var d65x = 0.31271, d65y = 0.32902;
    var d65pt = mapXY(d65x, d65y);
    ctx.beginPath();
    ctx.arc(d65pt.px, d65pt.py, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("D65", d65pt.px + 6, d65pt.py + 3);

    // ─── Точка текущего цвета ──────────────────────────────────────────────────
    if (currentXYZ) {
      var X = currentXYZ[0], Y = currentXYZ[1], Z = currentXYZ[2];
      var sum = X + Y + Z;
      if (sum > 1e-6) {
        var cx2 = X / sum, cy2 = Y / sum;
        var pt2 = mapXY(cx2, cy2);
        // Внешнее кольцо
        ctx.beginPath();
        ctx.arc(pt2.px, pt2.py, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Цветная точка
        ctx.beginPath();
        ctx.arc(pt2.px, pt2.py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgb(" +
          Math.round(Math.max(0, Math.min(255, currentXYZ[3] || 128))) + "," +
          Math.round(Math.max(0, Math.min(255, currentXYZ[4] || 128))) + "," +
          Math.round(Math.max(0, Math.min(255, currentXYZ[5] || 128))) + ")";
        ctx.fill();
        // Тонкая линия к белой точке
        ctx.beginPath();
        ctx.moveTo(d65pt.px, d65pt.py);
        ctx.lineTo(pt2.px, pt2.py);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ─── Палитра HSV (для наглядного выбора цвета) ────────────────────────────────
  function drawHSVPicker(svCanvas, hueCanvas, currentRGB255) {
    if (!svCanvas || !hueCanvas) return;
    var svCtx = svCanvas.getContext("2d");
    var hCtx = hueCanvas.getContext("2d");
    var W = svCanvas.width, H = svCanvas.height;

    // Вычисляем HSV из текущего RGB
    var r = currentRGB255[0] / 255, g = currentRGB255[1] / 255, b = currentRGB255[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var hue = 0;
    if (d > 1e-9) {
      if (max === r) hue = 60 * (((g - b) / d) % 6);
      else if (max === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
    }
    var sat = max < 1e-9 ? 0 : d / max;
    var val = max;

    // Чистый цвет при данном тоне
    function hueRGB(h) {
      h = ((h % 360) + 360) % 360;
      var c = 1, x = 1 - Math.abs((h / 60) % 2 - 1), m = 0, rr, gg, bb;
      if      (h < 60)  { rr = c; gg = x; bb = 0; }
      else if (h < 120) { rr = x; gg = c; bb = 0; }
      else if (h < 180) { rr = 0; gg = c; bb = x; }
      else if (h < 240) { rr = 0; gg = x; bb = c; }
      else if (h < 300) { rr = x; gg = 0; bb = c; }
      else              { rr = c; gg = 0; bb = x; }
      return "rgb(" + Math.round(rr*255) + "," + Math.round(gg*255) + "," + Math.round(bb*255) + ")";
    }

    // SV-квадрат
    svCtx.clearRect(0, 0, W, H);
    var gW = svCtx.createLinearGradient(0, 0, W, 0);
    gW.addColorStop(0, "#ffffff");
    gW.addColorStop(1, hueRGB(hue));
    svCtx.fillStyle = gW; svCtx.fillRect(0, 0, W, H);
    var gB = svCtx.createLinearGradient(0, 0, 0, H);
    gB.addColorStop(0, "rgba(0,0,0,0)");
    gB.addColorStop(1, "#000000");
    svCtx.fillStyle = gB; svCtx.fillRect(0, 0, W, H);

    // Маркер текущей точки
    var mx = sat * W, my = (1 - val) * H;
    svCtx.beginPath(); svCtx.arc(mx, my, 6, 0, Math.PI*2);
    svCtx.strokeStyle = "#fff"; svCtx.lineWidth = 2; svCtx.stroke();
    svCtx.beginPath(); svCtx.arc(mx, my, 6, 0, Math.PI*2);
    svCtx.strokeStyle = "rgba(0,0,0,0.5)"; svCtx.lineWidth = 1; svCtx.stroke();

    // Полоса тона
    var hw = hueCanvas.width, hh = hueCanvas.height;
    var gH = hCtx.createLinearGradient(0, 0, 0, hh);
    for (var i = 0; i <= 6; i++) { gH.addColorStop(i / 6, hueRGB(i * 60)); }
    hCtx.clearRect(0, 0, hw, hh);
    hCtx.fillStyle = gH; hCtx.fillRect(0, 0, hw, hh);
    var hy = (hue / 360) * hh;
    hCtx.strokeStyle = "#fff"; hCtx.lineWidth = 2;
    hCtx.strokeRect(0, hy - 2, hw, 4);
    hCtx.strokeStyle = "rgba(0,0,0,0.5)"; hCtx.lineWidth = 1;
    hCtx.strokeRect(0, hy - 2, hw, 4);

    // Возвращаем HSV для использования в обработчиках
    return { hue: hue, sat: sat, val: val };
  }

  return {
    buildModelCards: buildModelCards,
    updateFields: updateFields,
    updateEditedModelDisplay: updateEditedModelDisplay,
    updateSliderGradients: updateSliderGradients,
    updatePreview: updatePreview,
    drawCIEDiagram: drawCIEDiagram,
    drawHSVPicker: drawHSVPicker,
    toCssColor: toCssColor
  };

})();
