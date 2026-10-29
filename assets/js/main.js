/* ==========================================================================
   СК «Тёплый Угол» — поведение страницы
   Без зависимостей. Формы отправляются через data-endpoint, когда он задан;
   иначе показывается подтверждение (заглушка до подключения бэкенда).
   ========================================================================== */

(function () {
  "use strict";

  var PHONE_MASK = "+7 (___) ___-__-__";

  /** Приводит значение к виду +7 (999) 123-45-67. */
  function formatPhone(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (digits.indexOf("8") === 0) digits = "7" + digits.slice(1);
    if (digits.indexOf("7") !== 0) digits = "7" + digits;
    digits = digits.slice(1);

    var out = "+7";
    if (digits.length) out += " (" + digits.slice(0, 3);
    if (digits.length >= 3) out += ")";
    if (digits.length > 3) out += " " + digits.slice(3, 6);
    if (digits.length > 6) out += "-" + digits.slice(6, 8);
    if (digits.length > 8) out += "-" + digits.slice(8, 10);
    return out;
  }

  function digitsOf(value) {
    return String(value || "").replace(/\D/g, "").length;
  }

  /** Плавный скролл с поправкой на липкую шапку (в CSS есть scroll-margin фолбэк). */
  function scrollToTarget(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    var header = document.querySelector(".site-header");
    var offset = header ? header.offsetHeight + 12 : 0;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  function initPhoneMasks() {
    document.querySelectorAll('input[type="tel"]').forEach(function (input) {
      if (!input.placeholder) input.placeholder = PHONE_MASK;
      input.addEventListener("input", function () {
        var atEnd = input.selectionStart === input.value.length;
        input.value = formatPhone(input.value);
        if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
      });
      input.addEventListener("focus", function () {
        if (!input.value) input.value = formatPhone("");
      });
      input.addEventListener("blur", function () {
        if (digitsOf(input.value) < 10) input.value = "";
      });
    });
  }

  function setError(form, field, on) {
    field.setAttribute("aria-invalid", on ? "true" : "false");
    var described = field.getAttribute("aria-describedby");
    if (!described) return;
    var err = form.querySelector("#" + described);
    if (err) err.hidden = !on;
  }

  function validate(form) {
    var ok = true;
    var firstBad = null;
    form.querySelectorAll("input, select").forEach(function (field) {
      var valid = field.checkValidity();
      if (field.type === "tel") valid = digitsOf(field.value) >= 11;
      if (field.type === "email" && !field.required && !field.value) valid = true;
      setError(form, field, !valid);
      if (!valid && !firstBad) firstBad = field;
      ok = ok && valid;
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  function submitTo(form, payload) {
    var endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) {
      if (window.console) console.info("[Тёплый Угол] Заявка (заглушка):", payload);
      return Promise.resolve();
    }
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
    });
  }

  function showFormError(form, text) {
    var box = form.querySelector(".form__ok");
    form.classList.add("is-sent");
    if (box) {
      box.textContent = text;
      box.setAttribute("role", "alert");
      box.setAttribute("tabindex", "-1");
      box.focus({ preventScroll: false });
    }
  }

  function initForms() {
    document.querySelectorAll("form[data-form]").forEach(function (form) {
      form.querySelectorAll("input, select").forEach(function (field) {
        field.addEventListener("input", function () {
          setError(form, field, false);
        });
        field.addEventListener("change", function () {
          setError(form, field, false);
        });
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!validate(form)) return;

        var data = {};
        new FormData(form).forEach(function (value, key) {
          data[key] = value;
        });
        data.form = form.getAttribute("data-form");
        data.page = location.pathname;
        data.referrer = document.referrer || "";

        var button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;

        submitTo(form, data)
          .then(function () {
            form.classList.add("is-sent");
            var ok = form.querySelector(".form__ok");
            if (ok) ok.focus({ preventScroll: false });
          })
          .catch(function (error) {
            if (window.console) console.error("[Тёплый Угол] Отправка не удалась:", error);
            showFormError(
              form,
              "Не удалось отправить заявку. Позвоните нам: +7 812 220-96-63, ответим сразу."
            );
          })
          .finally(function () {
            if (button) button.disabled = false;
          });
      });
    });
  }

  function initCallback() {
    document.querySelectorAll("[data-callback]").forEach(function (button) {
      button.addEventListener("click", function () {
        var field = document.querySelector('input[type="tel"]');
        if (field && field.closest("form").id) {
          scrollToTarget("#" + field.closest("form").id);
          field.focus({ preventScroll: true });
        }
      });
    });
  }

  /** Ипотечный калькулятор: аннуитет 6% годовых на 30 лет. */
  function initMortgage() {
    var button = document.querySelector("[data-mortgage-calc]");
    var input = document.getElementById("credit");
    var out = document.querySelector(".mortgage__result");
    if (!button || !input || !out) return;

    function calc() {
      var amount = Number(String(input.value).replace(/\D/g, ""));
      out.hidden = false;
      if (!amount) {
        out.textContent = "Введите сумму кредита цифрами.";
        input.focus();
        return;
      }

      var rate = 0.06 / 12;
      var months = 30 * 12;
      var payment = (amount * rate) / (1 - Math.pow(1 + rate, -months));
      var formatted = Math.round(payment).toLocaleString("ru-RU");
      out.innerHTML =
        "Платёж ≈ <strong>" +
        formatted +
        " ₽/мес</strong> · 6% годовых, 30 лет, аннуитет. Не оферта.";
    }

    button.addEventListener("click", calc);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        calc();
      }
    });
  }

  function initBurger() {
    var burger = document.querySelector(".burger");
    var nav = document.getElementById("site-nav");
    if (!burger || !nav) return;
    var close = function () {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.textContent = "Меню";
    };
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.textContent = open ? "Закрыть" : "Меню";
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
  }

  function initAnchors() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash === "#" || !document.querySelector(hash)) return;
      event.preventDefault();
      scrollToTarget(hash);
      history.replaceState(null, "", hash);
    });
  }

  /* ==========================================================================
     Блок «Живые кадры» (reels): lightbox + горизонтальный скролл + прогресс
     ========================================================================== */
  function initReels() {
    var rail = document.querySelector("[data-rail]");
    if (!rail) return;

    var cards = rail.querySelectorAll(".reel");
    if (!cards.length) return;

    var prevBtn = document.querySelector("[data-reel-prev]");
    var nextBtn = document.querySelector("[data-reel-next]");
    var progress = rail.querySelector("[data-rail-progress]");
    var section = rail.closest(".reels");
    var container = rail.parentElement;

    var visible = 1;
    var step = 0;

    function cardWidth() {
      var card = cards[0];
      return card ? card.getBoundingClientRect().width : 0;
    }

    function maxScroll() {
      if (!cards.length) return 0;
      var cw = cardWidth();
      var total = cards.length * cw;
      var wrap = container.getBoundingClientRect().width;
      return Math.max(0, total - wrap);
    }

    function update() {
      step = Math.max(0, Math.min(step, maxScroll()));
      rail.style.transform = "translateX(" + (-step) + "px)";
      var ms = maxScroll();
      if (progress && ms > 0) {
        progress.style.width = (ms ? (step / ms * 100) : 0) + "%";
      } else if (progress) {
        progress.style.width = "0%";
      }
      if (prevBtn) prevBtn.disabled = step <= 0;
      if (nextBtn) nextBtn.disabled = step >= maxScroll();
    }

    function scrollBy(dir) {
      var cw = cardWidth();
      if (!cw) return;
      step += dir * cw;
      update();
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { scrollBy(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { scrollBy(1); });

    // Touch / swipe
    var touchStartX = 0;
    rail.addEventListener("touchstart", function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    rail.addEventListener("touchend", function (e) {
      var dx = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 40) scrollBy(dx > 0 ? 1 : -1);
    });

    // Wheel on rail
    rail.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      scrollBy(e.deltaX > 0 ? 1 : -1);
    }, { passive: false });

    window.addEventListener("resize", update);

    // Lightbox
    document.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-lightbox]");
      if (!btn) return;
      var img = btn.getAttribute("data-img");
      var title = btn.getAttribute("data-title") || "";
      var spec = btn.getAttribute("data-spec") || "";
      var price = btn.getAttribute("data-price") || "";
      var link = btn.getAttribute("data-link") || "";
      if (!img) return;

      var existing = document.getElementById("lightbox");
      if (existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "lightbox";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", title);
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(6,8,13,.92);z-index:9999;" +
        "display:flex;align-items:center;justify-content:center;padding:24px;" +
        "backdrop-filter:blur(4px);";

      var inner = document.createElement("div");
      inner.style.cssText =
        "position:relative;max-width:960px;max-height:92vh;width:100%;";

      var imgEl = document.createElement("img");
      imgEl.src = img;
      imgEl.alt = title;
      imgEl.style.cssText = "width:100%;height:auto;border-radius:12px;";

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Закрыть");
      closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      closeBtn.style.cssText =
        "position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);" +
        "border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;" +
        "color:#fff;display:flex;align-items:center;justify-content:center;";

      var meta = document.createElement("div");
      meta.style.cssText =
        "margin-top:16px;color:#faf5ea;text-align:center;";
      meta.innerHTML =
        '<p style="font-size:20px;font-weight:700;margin:0 0 4px;">' +
        title + '</p>' +
        (spec ? '<p style="font-size:14px;color:#c4b5a0;margin:0 0 8px;">' + spec + '</p>' : '') +
        (price ? '<p style="font-size:18px;font-weight:700;color:#D4AD6E;margin:0 0 16px;">' + price + '</p>' : '') +
        (link ? '<a href="' + link + '" style="display:inline-block;padding:10px 22px;background:#D4AD6E;color:#1a1410;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Смотреть проект</a>' : '');

      closeBtn.addEventListener("click", function () { overlay.remove(); });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) overlay.remove();
      });
      document.addEventListener("keydown", function lbKey(e) {
        if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", lbKey); }
      });

      inner.appendChild(closeBtn);
      inner.appendChild(imgEl);
      inner.appendChild(meta);
      overlay.appendChild(inner);
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          overlay.remove();
          document.body.style.overflow = "";
        }
      });
      overlay._close = function () {
        overlay.remove();
        document.body.style.overflow = "";
      };
    });

    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPhoneMasks();
    initForms();
    initCallback();
    initMortgage();
    initBurger();
    initAnchors();
    initReels();
  });
})();
