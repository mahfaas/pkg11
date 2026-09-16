/* ==========================================================================
   VIEW
   Только внешний вид, отрисовка ползунков, обработчики DOM, интерфейс.
   Модель не вызывается отсюда напрямую. Все действия передаются в Controller.
   ========================================================================== */

window.ColorView = (function() {
  "use strict";

  var uiRows = {}; // Хранит DOM-ссылки на поля ввода и ползунки

  function toCssColor(rgb255) {
    var r = Math.round(Math.max(0, Math.min(255, rgb255[0])));
    var g = Math.round(Math.max(0, Math.min(255, rgb255[1])));
    var b = Math.round(Math.max(0, Math.min(255, rgb255[2])));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // Отрисовка карточек для моделей
  function buildModelCards(modelsDef, gridElement, onFieldEdit) {
    gridElement.innerHTML = ""; // Очищаем сетку
    uiRows = {};

    modelsDef.forEach(function(model) {
      var card = document.createElement("div");
      card.className = "model-card";
      var h2 = document.createElement("h2");
      h2.innerHTML = model.title + " <small>" + model.sub + "</small>";
      card.appendChild(h2);

      uiRows[model.key] = [];

      model.channels.forEach(function(ch, idx) {
        var row = document.createElement("div");
        row.className = "channel";

        var head = document.createElement("div");
        head.className = "channel-head";
        var lab = document.createElement("label");
        lab.textContent = ch.label;

        var num = document.createElement("input");
        num.type = "number";
        num.min = ch.min; num.max = ch.max; num.step = ch.step;
        
        head.appendChild(lab); head.appendChild(num);

        var slider = document.createElement("input");
        slider.type = "range";
        slider.min = ch.min; slider.max = ch.max; slider.step = ch.step;

        row.appendChild(head); row.appendChild(slider);
        card.appendChild(row);

        uiRows[model.key].push({ num: num, slider: slider, decimals: ch.decimals });

        // Обработчики изменений полей и ползунков
        function triggerEdit(rawVal) {
          var vals = uiRows[model.key].map(function(r, i) {
            return i === idx ? rawVal : parseFloat(r.num.value || 0);
          });
          onFieldEdit(model.key, vals);
        }

        num.addEventListener("input", function() { triggerEdit(parseFloat(num.value) || 0); });
        slider.addEventListener("input", function() { triggerEdit(parseFloat(slider.value)); });
      });

      gridElement.appendChild(card);
    });
  }

  // Обновление значений в полях интерфейса (кроме того, которое сейчас редактируется)
  function updateFields(modelsDef, getModelValues, skipKey) {
    modelsDef.forEach(function(model) {
      if (model.key === skipKey) return;
      var vals = getModelValues(model.key);
      uiRows[model.key].forEach(function(row, idx) {
        var v = vals[idx];
        row.num.value = row.decimals === 0 ? Math.round(v) : v.toFixed(row.decimals);
        row.slider.value = v;
      });
    });
  }

  // Обновляем ползунки для редактируемого поля
  function updateEditedFieldsDisplay(key, getModelValues) {
    if (!uiRows[key]) return;
    var vals = getModelValues(key);
    uiRows[key].forEach(function(row, idx) {
      row.slider.value = vals[idx];
    });
  }

  // Отрисовка динамических градиентов под ползунками
  function updateSliderGradients(modelsDef, getModelValues, simulateColor) {
    modelsDef.forEach(function(model) {
      var current = getModelValues(model.key);
      model.channels.forEach(function(ch, idx) {
        var stops = [];
        var STEPS = 14;
        for (var i = 0; i <= STEPS; i++) {
          var t = ch.min + (ch.max - ch.min) * i / STEPS;
          var vals = current.slice();
          vals[idx] = t;
          var rgb = simulateColor(model.key, vals);
          stops.push(toCssColor(rgb));
        }
        uiRows[model.key][idx].slider.style.background = "linear-gradient(90deg," + stops.join(",") + ")";
      });
    });
  }

  // Отрисовка превью
  function updatePreview(rgb, outOfGamut, whiteLabel) {
    var css = toCssColor(rgb);
    document.getElementById("swatch").style.background = css;

    var hex = rgb.map(function(c) {
      return Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0");
    }).join("");
    document.getElementById("hexInput").value = hex.toUpperCase();

    document.getElementById("gamutWarning").classList.toggle("show", outOfGamut);
    if(whiteLabel) {
       document.getElementById("whiteInfo").textContent = "Опорный белый: " + whiteLabel;
    }
  }

  return {
    buildModelCards: buildModelCards,
    updateFields: updateFields,
    updateEditedFieldsDisplay: updateEditedFieldsDisplay,
    updateSliderGradients: updateSliderGradients,
    updatePreview: updatePreview,
    toCssColor: toCssColor
  };

})();
