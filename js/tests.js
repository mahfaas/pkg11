/* ==========================================================================
   TESTS — Автоматическая проверка математики модели
   Запускается при загрузке страницы. Результаты — в консоли браузера (F12).
   ========================================================================== */

(function () {
  "use strict";

  var passed = 0, failed = 0;

  function assert(name, actual, expected, tol) {
    tol = tol === undefined ? 0.5 : tol;
    var ok;
    if (Array.isArray(expected)) {
      ok = expected.every(function (exp, i) { return Math.abs(actual[i] - exp) <= tol; });
    } else {
      ok = Math.abs(actual - expected) <= tol;
    }
    if (ok) {
      console.log("✅ PASS:", name);
      passed++;
    } else {
      console.warn("❌ FAIL:", name, "| got:", actual, "| expected:", expected, "| tol:", tol);
      failed++;
    }
  }

  window.addEventListener("load", function () {
    console.groupCollapsed("=== Color Model Tests (RGB · XYZ · HLS) ===");

    // ─── RGB → XYZ ────────────────────────────────────────────────────────────
    ColorModel.setRGB(255, 0, 0);
    assert("RGB(255,0,0) → XYZ.X", ColorModel.getXYZ()[0], 41.24, 0.5);
    assert("RGB(255,0,0) → XYZ.Y", ColorModel.getXYZ()[1], 21.26, 0.5);
    assert("RGB(255,0,0) → XYZ.Z", ColorModel.getXYZ()[2],  1.93, 0.5);

    ColorModel.setRGB(0, 255, 0);
    assert("RGB(0,255,0) → XYZ.X", ColorModel.getXYZ()[0], 35.76, 0.5);
    assert("RGB(0,255,0) → XYZ.Y", ColorModel.getXYZ()[1], 71.52, 0.5);
    assert("RGB(0,255,0) → XYZ.Z", ColorModel.getXYZ()[2], 11.92, 0.5);

    ColorModel.setRGB(0, 0, 255);
    assert("RGB(0,0,255) → XYZ.X", ColorModel.getXYZ()[0], 18.05, 0.5);
    assert("RGB(0,0,255) → XYZ.Y", ColorModel.getXYZ()[1],  7.22, 0.5);
    assert("RGB(0,0,255) → XYZ.Z", ColorModel.getXYZ()[2], 95.05, 0.5);

    ColorModel.setRGB(255, 255, 255);
    assert("RGB(255,255,255) → XYZ.Y", ColorModel.getXYZ()[1], 100.0, 0.5);

    ColorModel.setRGB(0, 0, 0);
    assert("RGB(0,0,0) → XYZ = 0", ColorModel.getXYZ(), [0, 0, 0], 0.01);

    // ─── XYZ → RGB ────────────────────────────────────────────────────────────
    ColorModel.setXYZ(41.24, 21.26, 1.93);
    var rgb_red = ColorModel.getRGB();
    assert("XYZ(red) → RGB.R ≈ 255", rgb_red[0], 255, 1);
    assert("XYZ(red) → RGB.G ≈ 0",   rgb_red[1], 0,   2);
    assert("XYZ(red) → RGB.B ≈ 0",   rgb_red[2], 0,   2);

    ColorModel.setXYZ(95.05, 100.0, 108.88);
    var rgb_white = ColorModel.getRGB();
    assert("XYZ(white D65) → RGB = 255,255,255", rgb_white, [255, 255, 255], 1);

    // ─── RGB → HLS ────────────────────────────────────────────────────────────
    ColorModel.setRGB(255, 0, 0);
    var hls_red = ColorModel.getHLS();
    assert("RGB(255,0,0) → HLS.H = 0",   hls_red[0], 0,   1);
    assert("RGB(255,0,0) → HLS.L = 50",  hls_red[1], 50,  1);
    assert("RGB(255,0,0) → HLS.S = 100", hls_red[2], 100, 1);

    ColorModel.setRGB(0, 0, 255);
    var hls_blue = ColorModel.getHLS();
    assert("RGB(0,0,255) → HLS.H = 240", hls_blue[0], 240, 1);
    assert("RGB(0,0,255) → HLS.L = 50",  hls_blue[1], 50,  1);
    assert("RGB(0,0,255) → HLS.S = 100", hls_blue[2], 100, 1);

    ColorModel.setRGB(255, 255, 255);
    var hls_white = ColorModel.getHLS();
    assert("RGB(255,255,255) → HLS.L = 100", hls_white[1], 100, 1);
    assert("RGB(255,255,255) → HLS.S = 0",   hls_white[2], 0,   1);

    ColorModel.setRGB(0, 0, 0);
    var hls_black = ColorModel.getHLS();
    assert("RGB(0,0,0) → HLS.L = 0", hls_black[1], 0, 1);
    assert("RGB(0,0,0) → HLS.S = 0", hls_black[2], 0, 1);

    // ─── HLS → RGB → HLS (roundtrip) ─────────────────────────────────────────
    ColorModel.setHLS(120, 60, 80);
    var rgb_rt = ColorModel.getRGB();
    ColorModel.setRGB(rgb_rt[0], rgb_rt[1], rgb_rt[2]);
    var hls_rt = ColorModel.getHLS();
    assert("HLS(120,60,80) roundtrip H", hls_rt[0], 120, 2);
    assert("HLS(120,60,80) roundtrip L", hls_rt[1], 60,  1);
    assert("HLS(120,60,80) roundtrip S", hls_rt[2], 80,  1);

    console.groupEnd();
    console.log("Tests complete: " + passed + " passed, " + failed + " failed.");

    if (failed > 0) {
      console.warn("Some tests failed. Check the details above.");
    }
  });

})();
