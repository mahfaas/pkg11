/* ==========================================================================
   MODEL — Паттерн «Мост» (Bridge)
   -----------------------------------------------------------------------
   Абстракция: ColorModel (публичный API)
   Реализация: ColorModelImpl (математика, хранение состояния)
   Таким образом, интерфейс (абстракция) и математика (реализация) меняются
   независимо друг от друга — классический паттерн Bridge.
   
   Паттерн «Слушатель» (Observer) реализован через ColorEventBus:
   Модель сама не знает ни о View, ни о Controller. Она только генерирует
   события при изменении состояния.
   ========================================================================== */

/* ===================== EventBus — Паттерн Слушатель (Observer) ===================== */
window.ColorEventBus = (function () {
  "use strict";
  var listeners = {};

  return {
    /**
     * Подписаться на событие
     * @param {string} event  — имя события
     * @param {Function} fn   — обработчик
     */
    on: function (event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    /**
     * Отписаться от события
     */
    off: function (event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(function (f) { return f !== fn; });
    },
    /**
     * Испустить событие (все подписчики получат уведомление)
     */
    emit: function (event, data) {
      if (!listeners[event]) return;
      listeners[event].forEach(function (fn) { fn(data); });
    }
  };
})();


/* ===================== ColorModelImpl — Реализация (Bridge: Implementor) ===================== */
window.ColorModelImpl = (function () {
  "use strict";

  // ─── Утилиты ─────────────────────────────────────────────────────────────────
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function invert3x3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2],
        d = m[1][0], e = m[1][1], f = m[1][2],
        g = m[2][0], h = m[2][1], i = m[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
    var G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    var det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) det = 1e-12;
    return [
      [A / det, D / det, G / det],
      [B / det, E / det, H / det],
      [C / det, F / det, I / det]
    ];
  }

  function matVec3(m, v) {
    return [
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    ];
  }

  function srgbToLinear(c) {
    c = clamp(c, 0, 1);
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    c = clamp(c, 0, 1);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function xyToXYZ(x, y, Y) {
    Y = (Y === undefined) ? 1 : Y;
    return [(x / y) * Y, Y, ((1 - x - y) / y) * Y];
  }

  // ─── Прайм эри sRGB и опорные белые ──────────────────────────────────────────
  var PRIMARIES = {
    r: { x: 0.6400, y: 0.3300 },
    g: { x: 0.3000, y: 0.6000 },
    b: { x: 0.1500, y: 0.0600 }
  };

  // Только D65 — стандарт sRGB, используется для sRGB ↔ XYZ
  var WHITE_D65 = { x: 0.31271, y: 0.32902 };

  // ─── Построение матрицы RGB→XYZ (метод Брюса Линдблума) ──────────────────────
  function buildRGBtoXYZMatrix() {
    var w = WHITE_D65;
    var Xr = PRIMARIES.r.x / PRIMARIES.r.y, Zr = (1 - PRIMARIES.r.x - PRIMARIES.r.y) / PRIMARIES.r.y;
    var Xg = PRIMARIES.g.x / PRIMARIES.g.y, Zg = (1 - PRIMARIES.g.x - PRIMARIES.g.y) / PRIMARIES.g.y;
    var Xb = PRIMARIES.b.x / PRIMARIES.b.y, Zb = (1 - PRIMARIES.b.x - PRIMARIES.b.y) / PRIMARIES.b.y;
    var M = [
      [Xr, Xg, Xb],
      [1,  1,  1 ],
      [Zr, Zg, Zb]
    ];
    var W = xyToXYZ(w.x, w.y, 1);
    var S = matVec3(invert3x3(M), W);
    return [
      [Xr * S[0], Xg * S[1], Xb * S[2]],
      [1  * S[0], 1  * S[1], 1  * S[2]],
      [Zr * S[0], Zg * S[1], Zb * S[2]]
    ];
  }

  // Матрицы (строятся один раз)
  var M_RGB_TO_XYZ = buildRGBtoXYZMatrix();
  var M_XYZ_TO_RGB = invert3x3(M_RGB_TO_XYZ);
  // Белая точка D65 в XYZ (Y=100 нормировка)
  var WHITE_XYZ = xyToXYZ(WHITE_D65.x, WHITE_D65.y, 100);

  // ─── Максимальные значения XYZ для белого D65 (для диапазонов ползунков) ─────
  // При R=G=B=255: XYZ = M * [1,1,1] * 100
  var XYZ_MAX = (function () {
    var v = matVec3(M_RGB_TO_XYZ, [1, 1, 1]);
    return [v[0] * 100, v[1] * 100, v[2] * 100];
  })();

  // ─── Внутреннее состояние ──────────────────────────────────────────────────────
  var state = {
    // Цвет хранится в линейном RGB [0..1]
    linR: 0,
    linG: 0,
    linB: 0,
    lastOutOfGamut: false
  };

  // ─── Вспомогательные функции гамут-мэппинга ───────────────────────────────────
  function mapGamutClip(r, g, b) {
    var out = (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1);
    return {
      r: clamp(r, 0, 1),
      g: clamp(g, 0, 1),
      b: clamp(b, 0, 1),
      outOfGamut: out
    };
  }

  // ─── RGB ↔ HLS ────────────────────────────────────────────────────────────────
  function _rgb01ToHLS(r, g, b) {
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2;
    var h = 0, s = 0;
    if (d > 1e-9) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r)      h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else                h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    return [h, l * 100, s * 100];
  }

  function _hlsToRGB01(h, l, s) {
    l /= 100; s /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if      (h < 60)  { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
  }

  // ─── RGB → XYZ (через линейный RGB) ─────────────────────────────────────────
  function _rgb01ToXYZ(r, g, b) {
    // r,g,b — гамма-скорректированный sRGB [0..1]
    var linR = srgbToLinear(r);
    var linG = srgbToLinear(g);
    var linB = srgbToLinear(b);
    var v = matVec3(M_RGB_TO_XYZ, [linR, linG, linB]);
    return [v[0] * 100, v[1] * 100, v[2] * 100];
  }

  // ─── XYZ → RGB (с гамут-мэппингом) ─────────────────────────────────────────
  function _xyz100ToRGB01WithGamut(X, Y, Z) {
    var lin = matVec3(M_XYZ_TO_RGB, [X / 100, Y / 100, Z / 100]);
    var mapped = mapGamutClip(lin[0], lin[1], lin[2]);
    return {
      r: linearToSrgb(mapped.r),
      g: linearToSrgb(mapped.g),
      b: linearToSrgb(mapped.b),
      outOfGamut: mapped.outOfGamut
    };
  }

  // ─── Публичный API реализации ────────────────────────────────────────────────
  return {
    // Геттеры
    getRGB255: function () {
      var r = linearToSrgb(state.linR);
      var g = linearToSrgb(state.linG);
      var b = linearToSrgb(state.linB);
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },
    getHLS: function () {
      var r = linearToSrgb(state.linR);
      var g = linearToSrgb(state.linG);
      var b = linearToSrgb(state.linB);
      return _rgb01ToHLS(r, g, b);
    },
    getXYZ: function () {
      var v = matVec3(M_RGB_TO_XYZ, [state.linR, state.linG, state.linB]);
      return [v[0] * 100, v[1] * 100, v[2] * 100];
    },
    isOutOfGamut: function () { return state.lastOutOfGamut; },

    // Сеттеры
    setFromRGB255: function (r, g, b) {
      state.linR = srgbToLinear(clamp(r, 0, 255) / 255);
      state.linG = srgbToLinear(clamp(g, 0, 255) / 255);
      state.linB = srgbToLinear(clamp(b, 0, 255) / 255);
      state.lastOutOfGamut = false;
    },
    setFromHLS: function (h, l, s) {
      h = ((h % 360) + 360) % 360; // нормировка H
      l = clamp(l, 0, 100);
      s = clamp(s, 0, 100);
      var rgb01 = _hlsToRGB01(h, l, s);
      state.linR = srgbToLinear(clamp(rgb01[0], 0, 1));
      state.linG = srgbToLinear(clamp(rgb01[1], 0, 1));
      state.linB = srgbToLinear(clamp(rgb01[2], 0, 1));
      state.lastOutOfGamut = false;
    },
    setFromXYZ: function (X, Y, Z) {
      var res = _xyz100ToRGB01WithGamut(X, Y, Z);
      state.linR = srgbToLinear(res.r);
      state.linG = srgbToLinear(res.g);
      state.linB = srgbToLinear(res.b);
      state.lastOutOfGamut = res.outOfGamut;
    },

    // Для симуляции градиентов (без изменения состояния)
    simulateRGB255: function (modelKey, vals) {
      if (modelKey === "RGB") {
        return [clamp(Math.round(vals[0]), 0, 255),
                clamp(Math.round(vals[1]), 0, 255),
                clamp(Math.round(vals[2]), 0, 255)];
      }
      if (modelKey === "HLS") {
        var h = ((vals[0] % 360) + 360) % 360;
        var l = clamp(vals[1], 0, 100);
        var s = clamp(vals[2], 0, 100);
        var rgb01 = _hlsToRGB01(h, l, s);
        return [
          Math.round(clamp(rgb01[0], 0, 1) * 255),
          Math.round(clamp(rgb01[1], 0, 1) * 255),
          Math.round(clamp(rgb01[2], 0, 1) * 255)
        ];
      }
      if (modelKey === "XYZ") {
        var res = _xyz100ToRGB01WithGamut(vals[0], vals[1], vals[2]);
        return [Math.round(res.r * 255), Math.round(res.g * 255), Math.round(res.b * 255)];
      }
      return [128, 128, 128];
    },

    // Диапазон XYZ для ползунков (зависит от D65)
    getXYZMax: function () { return XYZ_MAX; },

    // Вспомогательные для палитры
    hlsToRGB01: _hlsToRGB01,
    rgb01ToHLS: _rgb01ToHLS
  };

})();


/* ===================== ColorModel — Абстракция (Bridge: Abstraction) ===================== */
/*
  ColorModel — это публичный фасад над реализацией ColorModelImpl.
  Если понадобится другой движок конвертации, достаточно заменить ColorModelImpl
  не трогая остальной код — это и есть суть паттерна Bridge.
*/
window.ColorModel = (function (impl, bus) {
  "use strict";

  function notify() {
    bus.emit("colorChanged", {
      rgb: impl.getRGB255(),
      hls: impl.getHLS(),
      xyz: impl.getXYZ(),
      outOfGamut: impl.isOutOfGamut()
    });
  }

  return {
    // ─── Геттеры ────────────────────────────────────────────────────────────────
    getRGB: function () { return impl.getRGB255(); },
    getHLS: function () { return impl.getHLS(); },
    getXYZ: function () { return impl.getXYZ(); },
    isOutOfGamut: function () { return impl.isOutOfGamut(); },
    getXYZMax: function () { return impl.getXYZMax(); },

    // ─── Сеттеры (каждый обновляет состояние и оповещает слушателей) ────────────
    setRGB: function (r, g, b) {
      impl.setFromRGB255(r, g, b);
      notify();
    },
    setHLS: function (h, l, s) {
      impl.setFromHLS(h, l, s);
      notify();
    },
    setXYZ: function (X, Y, Z) {
      impl.setFromXYZ(X, Y, Z);
      notify();
    },

    // ─── Вспомогательные ────────────────────────────────────────────────────────
    simulateColor: function (modelKey, vals) {
      return impl.simulateRGB255(modelKey, vals);
    },
    hlsToRGB01: function (h, l, s) { return impl.hlsToRGB01(h, l, s); },
    rgb01ToHLS: function (r, g, b) { return impl.rgb01ToHLS(r, g, b); }
  };

})(window.ColorModelImpl, window.ColorEventBus);
