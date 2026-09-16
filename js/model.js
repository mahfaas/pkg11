/* ==========================================================================
   MODEL
   Чистая математика перевода цветов и управление состоянием данных
   Никакой работы с DOM (интерфейсом) здесь нет.
   ========================================================================== */

window.ColorModel = (function() {
  "use strict";

  // Утилиты
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function invert3x3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2],
        d = m[1][0], e = m[1][1], f = m[1][2],
        g = m[2][0], h = m[2][1], i = m[2][2];
    var A = (e*i - f*h), B = -(d*i - f*g), C = (d*h - e*g);
    var D = -(b*i - c*h), E = (a*i - c*g), F = -(a*h - b*g);
    var G = (b*f - c*e), H = -(a*f - c*d), I = (a*e - b*d);
    var det = a*A + b*B + c*C;
    if (Math.abs(det) < 1e-12) det = 1e-12;
    return [
      [A/det, D/det, G/det],
      [B/det, E/det, H/det],
      [C/det, F/det, I/det]
    ];
  }

  function matVec3(m, v) {
    return [
      m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
      m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
      m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2]
    ];
  }

  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    c = clamp(c, 0, 1);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function xyToXYZ(x, y, Y) {
    Y = Y === undefined ? 1 : Y;
    return [(x / y) * Y, Y, ((1 - x - y) / y) * Y];
  }

  var PRIMARIES = {
    r: { x: 0.6400, y: 0.3300 },
    g: { x: 0.3000, y: 0.6000 },
    b: { x: 0.1500, y: 0.0600 }
  };

  var WHITES = {
    D65: { x: 0.31271, y: 0.32902, label: "D65 (дневной свет, sRGB)" },
    D50: { x: 0.34567, y: 0.35850, label: "D50 (полиграфия)" },
    E:   { x: 1/3,     y: 1/3,     label: "E (равноэнергетический)" }
  };

  function buildRGBtoXYZMatrix(whiteKey) {
    var w = WHITES[whiteKey];
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
      [Xr*S[0], Xg*S[1], Xb*S[2]],
      [1 *S[0], 1 *S[1], 1 *S[2]],
      [Zr*S[0], Zg*S[1], Zb*S[2]]
    ];
  }

  // Внутреннее состояние модели
  var state = {
    linR: 0.53, linG: 0.60, linB: 0.80, // Базовый цвет хранится в линейном RGB
    illuminant: "D65",
    cmykAlgo: "GCR",
    cmykAmount: 1.0,
    gamutStrategy: "clip",
    lastOutOfGamut: false
  };

  var mats = { N: null, Ninv: null, white: null };

  function rebuildMatrices() {
    mats.N = buildRGBtoXYZMatrix(state.illuminant);
    mats.Ninv = invert3x3(mats.N);
    mats.white = xyToXYZ(WHITES[state.illuminant].x, WHITES[state.illuminant].y, 100);
  }

  function mapGamut(r, g, b, strategy) {
    var out = (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1);
    if (!out) return { r: r, g: g, b: b, outOfGamut: false };
    if (strategy === "clip") {
      return { r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1), outOfGamut: true };
    } else {
      var lo = Math.min(0, r, g, b), hi = Math.max(1, r, g, b);
      var span = (hi - lo) || 1;
      return { r: (r - lo) / span, g: (g - lo) / span, b: (b - lo) / span, outOfGamut: true };
    }
  }

  /* ===================== Конвертации (прямые) ===================== */
  
  function getRGB255() {
    return [
      Math.round(linearToSrgb(state.linR) * 255),
      Math.round(linearToSrgb(state.linG) * 255),
      Math.round(linearToSrgb(state.linB) * 255)
    ];
  }

  function rgb255ToHSV(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    var s = max === 0 ? 0 : d / max;
    return [h, s * 100, max * 100];
  }

  function hsvToRGB255(h, s, v) {
    s /= 100; v /= 100;
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function rgb255ToHLS(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, h = 0, s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    return [h, l * 100, s * 100];
  }

  function hlsToRGB255(h, l, s) {
    l /= 100; s /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function rgb255ToCMYK(r, g, b, algo, amount) {
    var C0 = 1 - r / 255, M0 = 1 - g / 255, Y0 = 1 - b / 255;
    var Kraw = Math.min(C0, M0, Y0);
    var K = Kraw * amount;
    var C, M, Y;
    if (algo === "GCR") {
      var denom = 1 - K;
      C = denom > 1e-6 ? (C0 - K) / denom : 0;
      M = denom > 1e-6 ? (M0 - K) / denom : 0;
      Y = denom > 1e-6 ? (Y0 - K) / denom : 0;
    } else { // UCR
      C = C0 - K; M = M0 - K; Y = Y0 - K;
    }
    return [clamp(C, 0, 1) * 100, clamp(M, 0, 1) * 100, clamp(Y, 0, 1) * 100, clamp(K, 0, 1) * 100];
  }

  function cmykToRGB255(c, m, y, k) {
    c /= 100; m /= 100; y /= 100; k /= 100;
    var r = (1 - c) * (1 - k), g = (1 - m) * (1 - k), b = (1 - y) * (1 - k);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function linearRGBtoXYZ100() {
    var v = matVec3(mats.N, [state.linR, state.linG, state.linB]);
    return [v[0] * 100, v[1] * 100, v[2] * 100];
  }

  function fLab(t) {
    var d = 6 / 29;
    return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
  }

  function finvLab(t) {
    var d = 6 / 29;
    return t > d ? t * t * t : 3 * d * d * (t - 4 / 29);
  }

  function xyz100ToLab(X, Y, Z) {
    var xr = X / mats.white[0], yr = Y / mats.white[1], zr = Z / mats.white[2];
    var fx = fLab(xr), fy = fLab(yr), fz = fLab(zr);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function labToXyz100(L, a, b) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    return [ finvLab(fx) * mats.white[0], finvLab(fy) * mats.white[1], finvLab(fz) * mats.white[2] ];
  }

  /* ===================== Конвертации (обратные) ===================== */
  
  function setFromRGB255(r, g, b) {
    state.linR = srgbToLinear(clamp(r, 0, 255) / 255);
    state.linG = srgbToLinear(clamp(g, 0, 255) / 255);
    state.linB = srgbToLinear(clamp(b, 0, 255) / 255);
    state.lastOutOfGamut = false;
  }

  function setFromCMYK(c, m, y, k) {
    var rgb = cmykToRGB255(c, m, y, k);
    setFromRGB255(rgb[0], rgb[1], rgb[2]);
  }

  function setFromHSV(h, s, v) {
    var rgb = hsvToRGB255(h, s, v);
    setFromRGB255(rgb[0], rgb[1], rgb[2]);
  }

  function setFromHLS(h, l, s) {
    var rgb = hlsToRGB255(h, l, s);
    setFromRGB255(rgb[0], rgb[1], rgb[2]);
  }

  function setFromXYZ100(X, Y, Z) {
    var lin = matVec3(mats.Ninv, [X / 100, Y / 100, Z / 100]);
    var mapped = mapGamut(lin[0], lin[1], lin[2], state.gamutStrategy);
    state.linR = mapped.r; state.linG = mapped.g; state.linB = mapped.b;
    state.lastOutOfGamut = mapped.outOfGamut;
  }

  function setFromLab(L, a, b) {
    var xyz = labToXyz100(L, a, b);
    setFromXYZ100(xyz[0], xyz[1], xyz[2]);
  }

  // Первоначальная инициализация
  rebuildMatrices();

  // Публичный API модели
  return {
    getState: function() { return state; },
    getWhites: function() { return WHITES; },
    
    setIlluminant: function(key) {
      state.illuminant = key;
      rebuildMatrices();
    },
    setCmykAlgo: function(algo) { state.cmykAlgo = algo; },
    setCmykAmount: function(amount) { state.cmykAmount = amount; },
    setGamutStrategy: function(strategy) { state.gamutStrategy = strategy; },
    
    getRGB: getRGB255,
    getHSV: function() { var c = getRGB255(); return rgb255ToHSV(c[0], c[1], c[2]); },
    getHLS: function() { var c = getRGB255(); return rgb255ToHLS(c[0], c[1], c[2]); },
    getCMYK: function() { 
      var c = getRGB255(); 
      return rgb255ToCMYK(c[0], c[1], c[2], state.cmykAlgo, state.cmykAmount); 
    },
    getXYZ: linearRGBtoXYZ100,
    getLAB: function() {
      var xyz = linearRGBtoXYZ100();
      return xyz100ToLab(xyz[0], xyz[1], xyz[2]);
    },
    
    setRGB: setFromRGB255,
    setHSV: setFromHSV,
    setHLS: setFromHLS,
    setCMYK: setFromCMYK,
    setXYZ: setFromXYZ100,
    setLAB: setFromLab,
    
    hsvToRGB255: hsvToRGB255,
    rgb255ToHSV: rgb255ToHSV,

    // Вспомогательная функция для генерации градиентов
    // Просчитывает цвет без изменения стейта
    simulateColor: function(modelKey, vals) {
      if (modelKey === "RGB") {
        return [vals[0], vals[1], vals[2]];
      } else if (modelKey === "HSV") {
        return hsvToRGB255(vals[0], vals[1], vals[2]);
      } else if (modelKey === "HLS") {
        return hlsToRGB255(vals[0], vals[1], vals[2]);
      } else if (modelKey === "CMYK") {
        return cmykToRGB255(vals[0], vals[1], vals[2], vals[3]);
      } else if (modelKey === "XYZ") {
        var lin = matVec3(mats.Ninv, [vals[0] / 100, vals[1] / 100, vals[2] / 100]);
        var g = mapGamut(lin[0], lin[1], lin[2], state.gamutStrategy);
        return [linearToSrgb(g.r) * 255, linearToSrgb(g.g) * 255, linearToSrgb(g.b) * 255];
      } else if (modelKey === "LAB") {
        var xyz = labToXyz100(vals[0], vals[1], vals[2]);
        var lin2 = matVec3(mats.Ninv, [xyz[0] / 100, xyz[1] / 100, xyz[2] / 100]);
        var g2 = mapGamut(lin2[0], lin2[1], lin2[2], state.gamutStrategy);
        return [linearToSrgb(g2.r) * 255, linearToSrgb(g2.g) * 255, linearToSrgb(g2.b) * 255];
      }
    }
  };

})();
