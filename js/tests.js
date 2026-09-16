/* ==========================================================================
   TESTS
   Микро-тесты для проверки корректности математики
   ========================================================================== */

(function() {
  "use strict";
  
  function assertAlmostEqual(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
      console.error("ТЕСТ ПРОВАЛЕН:", message, "\nОжидалось:", expected, "\nПолучено:", actual);
      return false;
    }
    return true;
  }

  function runTests() {
    console.log("=== ЗАПУСК АВТОМАТИЧЕСКИХ МИКРО-ТЕСТОВ МАТЕМАТИКИ ===");
    var passed = 0;
    var total = 0;

    // Сохраняем стейт, чтобы не испортить
    var oldIllum = ColorModel.getState().illuminant;
    ColorModel.setIlluminant("D65");
    ColorModel.setCmykAlgo("GCR");
    ColorModel.setCmykAmount(1.0);

    // ТЕСТ 1: Чистый красный (RGB: 255, 0, 0)
    ColorModel.setRGB(255, 0, 0);
    var lab = ColorModel.getLAB();
    var cmyk = ColorModel.getCMYK();

    // D65 Красный -> Lab: L≈53.24, a≈80.09, b≈67.20
    total++;
    if (
      assertAlmostEqual(lab[0], 53.24, 0.5, "Красный (L)") &&
      assertAlmostEqual(lab[1], 80.09, 0.5, "Красный (a)") &&
      assertAlmostEqual(lab[2], 67.20, 0.5, "Красный (b)")
    ) passed++;

    // Красный -> CMYK (GCR 100%): C=0, M=100, Y=100, K=0
    total++;
    if (
      assertAlmostEqual(cmyk[0], 0, 0.1, "Красный (C)") &&
      assertAlmostEqual(cmyk[1], 100, 0.1, "Красный (M)") &&
      assertAlmostEqual(cmyk[2], 100, 0.1, "Красный (Y)") &&
      assertAlmostEqual(cmyk[3], 0, 0.1, "Красный (K)")
    ) passed++;

    // ТЕСТ 2: Белый (RGB: 255, 255, 255)
    ColorModel.setRGB(255, 255, 255);
    lab = ColorModel.getLAB();
    cmyk = ColorModel.getCMYK();

    // Белый -> Lab: L=100, a=0, b=0
    total++;
    if (
      assertAlmostEqual(lab[0], 100, 0.1, "Белый (L)") &&
      assertAlmostEqual(lab[1], 0, 0.1, "Белый (a)") &&
      assertAlmostEqual(lab[2], 0, 0.1, "Белый (b)")
    ) passed++;

    // Белый -> CMYK: C=0, M=0, Y=0, K=0
    total++;
    if (
      assertAlmostEqual(cmyk[0], 0, 0.1, "Белый (C)") &&
      assertAlmostEqual(cmyk[1], 0, 0.1, "Белый (M)") &&
      assertAlmostEqual(cmyk[2], 0, 0.1, "Белый (Y)") &&
      assertAlmostEqual(cmyk[3], 0, 0.1, "Белый (K)")
    ) passed++;

    // Возвращаем настройки
    ColorModel.setIlluminant(oldIllum);
    
    console.log("=== РЕЗУЛЬТАТЫ ТЕСТОВ: " + passed + " из " + total + " пройдено ===");
    
    // Покажем в UI результат для преподавателя
    setTimeout(function() {
        var warnCard = document.querySelector(".warn-card");
        if (warnCard) {
            var div = document.createElement("div");
            div.style.color = passed === total ? "#4CAF50" : "#F44336";
            div.style.fontWeight = "bold";
            div.style.marginTop = "8px";
            div.textContent = "Авто-тесты математики: " + passed + " / " + total + " успешно. (См. консоль F12)";
            warnCard.appendChild(div);
        }
    }, 1000);
  }

  // Запуск тестов при загрузке
  window.addEventListener('load', runTests);

})();
