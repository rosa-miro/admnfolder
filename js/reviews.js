
"use strict";

(() => {
  const proof = document.getElementById("proof");

  if (!proof) return;

  // Atualiza este número apenas com pedidos
  // realmente concluídos.
  const completedOrders = 0;

  proof.innerHTML = `
    <div class="feedback-section">

      <p class="eyebrow">
        CUSTOMER FEEDBACK
      </p>

      <h2 class="feedback-title">
        What customers say
      </h2>

      <div class="feedback-stats">

        <div class="feedback-stat-card">
          <strong>${completedOrders}+</strong>
          <span>ORDERS COMPLETED</span>
        </div>

      </div>

    </div>
  `;

  proof.classList.remove("hidden");
})();
