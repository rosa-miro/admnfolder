
(function () {
  "use strict";

  function configureBrand() {
    const config = window.STORE_CONFIG || {};
    const brandName = config.brandName || "ADM FOLDER";
    const username = String(
      config.telegramUsername || ""
    ).replace(/^@/, "").trim();

    document.title = brandName;

    document.querySelectorAll(
      ".brand, .footer-brand"
    ).forEach(element => {
      element.textContent = brandName;
    });

    if (!username) {
      console.warn(
        "Configure o username do Telegram em products.js."
      );
      return;
    }

    const telegramURL =
      "https://t.me/" + encodeURIComponent(username);

    [
      "telegramLink",
      "bottomTelegram",
      "footerTelegram"
    ].forEach(id => {
      const link = document.getElementById(id);

      if (link) {
        link.href = telegramURL;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      configureBrand
    );
  } else {
    configureBrand();
  }
})();
