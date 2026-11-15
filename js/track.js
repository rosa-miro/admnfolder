
(function () {
  "use strict";

  const events = [];

  function trackEvent(name, details = {}) {
    const event = {
      name,
      details,
      timestamp: new Date().toISOString()
    };

    events.push(event);
    console.info("[ADM FOLDER]", event);
  }

  window.STORE_TRACKING = {
    events,
    trackEvent
  };

  function initializeTracking() {
    trackEvent("page_view", {
      page: window.location.pathname
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("button");

      if (button) {
        trackEvent("button_click", {
          label: button.textContent.trim().slice(0, 80)
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeTracking
    );
  } else {
    initializeTracking();
  }
})();
