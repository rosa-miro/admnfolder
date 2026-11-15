
"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const grid = $("productGrid");
  const search = $("searchInput");
  const empty = $("emptyState");
  const pay = $("paymentModal");
  const prev = $("previewModal");
  const summary = $("orderSummary");
  const toast = $("toast");

  const config = window.STORE_CONFIG || {};
  const telegram = "ADM_FOLDER021";

  let catalog = [];
  let active = null;
  let filter = "all";
  let toastTimer;

  const money = value =>
    "$" + Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 2
    });

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function notify(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
  }

  function products() {
    return catalog.filter(p =>
      p.published &&
      p.name &&
      Number(p.price) > 0
    );
  }

  function discount(p) {
    return Number(p.oldPrice) > Number(p.price)
      ? Math.round(
          (1 - Number(p.price) / Number(p.oldPrice)) * 100
        )
      : 0;
  }

  function cover(p) {
    if (p.coverImage) {
      const image = document.createElement("div");
      image.className = "cover-art";
      image.style.backgroundImage =
        "linear-gradient(0deg,#08080bd9,transparent 75%),url(" +
        JSON.stringify(p.coverImage) + ")";
      return image.outerHTML;
    }

    if (p.previewVideo) {
      return `
        <video class="cover-art cover-video"
          autoplay muted loop playsinline preload="metadata"
          style="width:100%;height:100%;object-fit:cover">
          <source src="${esc(p.previewVideo)}">
        </video>`;
    }

    return `<div class="cover-art theme-purple"></div>`;
  }

  function card(p) {
    const d = discount(p);

    return `
      <article class="product-card">
        <div class="cover">
          ${cover(p)}
          <div class="cover-overline">
            DIGITAL COLLECTION
          </div>
          <div class="cover-title">
            ${esc(p.coverText || p.name)}
          </div>
          ${p.left > 0
            ? `<div class="cover-count">${esc(p.left)} left</div>`
            : ""}
        </div>

        <div class="product-body">
          <div class="product-heading">
            <h2>${esc(p.name)}</h2>
            ${d ? `<span class="discount">-${d}%</span>` : ""}
          </div>

          ${p.purchases > 0
            ? `<p class="purchases">${esc(p.purchases)} purchases</p>`
            : ""}

          <p class="description">${esc(p.description)}</p>

          <div class="tags">
            ${[p.files, p.size].filter(Boolean)
              .map(t => `<span class="tag">${esc(t)}</span>`)
              .join("")}
          </div>

          <div class="price-row">
            ${Number(p.oldPrice) > Number(p.price)
              ? `<span class="old-price">${money(p.oldPrice)}</span>`
              : ""}
            <span class="new-price">${money(p.price)}</span>
          </div>

          <div class="card-actions">
            <button class="btn btn-preview"
              data-action="preview" data-id="${esc(p.id)}">
              PREVIEW
            </button>
            <button class="btn btn-primary"
              data-action="buy" data-id="${esc(p.id)}">
              BUY NOW<br>${money(p.price)}
            </button>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const q = search?.value.trim().toLowerCase() || "";

    const list = products().filter(p => {
      const matchesSearch = [
        p.name, p.description, p.coverText
      ].join(" ").toLowerCase().includes(q);

      const matchesFilter =
        filter === "all" ||
        (filter === "popular" && p.popular) ||
        (filter === "new" && p.isNew) ||
        (filter === "offers" &&
          Number(p.oldPrice) > Number(p.price));

      return matchesSearch && matchesFilter;
    });

    grid.innerHTML = list.map(card).join("");

    if (empty) {
      empty.classList.toggle("hidden", list.length > 0);
    }
  }

  function close(el) {
    if (!el) return;

    el.classList.add("hidden");

    if (el === prev) {
      const video = prev.querySelector("video");
      if (video) video.pause();
    }

    if (!document.querySelector(
      ".modal-backdrop:not(.hidden)"
    )) {
      document.body.style.overflow = "";
    }
  }

  function open(el) {
    if (!el) return;
    el.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function payment(p) {
    active = p;

    summary.innerHTML = `
      <span>${esc(p.name)}</span>
      <strong>${money(p.price)}</strong>`;

    close(prev);
    open(pay);
  }

  function preview(p) {
    active = p;

    $("previewTitle").textContent = p.name;
    $("previewDescription").textContent =
      p.description || "";

    const frame = $("videoFrame");
    frame.replaceChildren();

    if (p.previewVideo) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = p.previewVideo;
      video.style.width = "100%";
      video.style.maxHeight = "450px";
      video.style.objectFit = "contain";
      frame.append(video);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "video-placeholder";
      placeholder.textContent = "Pré-visualização indisponível";
      frame.append(placeholder);
    }

    $("previewBuy").textContent =
      "BUY NOW — " + money(p.price);

    open(prev);
  }

  function order(method) {
    if (!active) return;

    const message =
      `Hello! I would like to purchase "${active.name}" ` +
      `for ${money(active.price)}. ` +
      `Preferred payment method: ${method}. ` +
      `Please send payment instructions.`;

    const url = "https://t.me/" + telegram;

    // Abre a conversa. O comprador cola a mensagem.
    window.open(url, "_blank", "noopener");

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(message)
        .then(() => notify(
          "Mensagem copiada! Cola na conversa do Telegram."
        ))
        .catch(() => notify(
          "Telegram aberto. Envia a mensagem do pedido."
        ));
    } else {
      notify("Telegram aberto. Envia a mensagem do pedido.");
    }

    close(pay);
  }

  grid.addEventListener("click", e => {
    const button = e.target.closest("[data-action]");
    if (!button) return;

    const p = products().find(
      item => String(item.id) === button.dataset.id
    );

    if (!p) return;

    if (button.dataset.action === "buy") payment(p);
    if (button.dataset.action === "preview") preview(p);
  });

  search?.addEventListener("input", render);

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => {
        b.classList.toggle("active", b === button);
      });

      filter = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      close($(button.dataset.close));
    });
  });

  [pay, prev].forEach(modal => {
    modal?.addEventListener("click", e => {
      if (e.target === modal) close(modal);
    });
  });

  document.querySelectorAll(".payment-option")
    .forEach(button => {
      button.addEventListener("click", () => {
        order(button.dataset.method);
      });
    });

  $("previewBuy")?.addEventListener("click", () => {
    if (active) payment(active);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      close(pay);
      close(prev);
    }
  });

  function timer() {
    const end = new Date(config.offerEndsAt).getTime();

    const remaining = Number.isFinite(end)
      ? Math.max(0, end - Date.now())
      : 0;

    const values = [
      Math.floor(remaining / 86400000),
      Math.floor((remaining % 86400000) / 3600000),
      Math.floor((remaining % 3600000) / 60000),
      Math.floor((remaining % 60000) / 1000)
    ];

    ["days", "hours", "minutes", "seconds"]
      .forEach((id, i) => {
        const el = $(id);
        if (el) {
          el.textContent = String(values[i]).padStart(2, "0");
        }
      });

    if (remaining === 0) {
      const caption = document.querySelector(".timer-caption");
      if (caption) caption.textContent = "OFFER ENDED";
    }
  }

  // Ligações do Telegram
  ["telegramLink", "bottomTelegram", "footerTelegram"]
    .forEach(id => {
      const link = $(id);
      if (link) link.href = "https://t.me/" + telegram;
    });

  // Carrega os dados da base de dados.
  async function loadCollections() {
    try {
      const response = await fetch("/api/colecoes", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Erro HTTP " + response.status);
      }

      const rows = await response.json();

      if (!Array.isArray(rows)) {
        throw new Error("Resposta inválida da API.");
      }

      catalog = rows.map(row => ({
        id: String(row.id),
        name: row.nome,
        coverText: row.nome,
        description: row.descricao,
        price: Number(row.preco),
        oldPrice: Number(row.preco_antigo),
        files: row.etiqueta1,
        size: row.etiqueta2,
        coverImage: row.imagem,
        previewVideo: row.video,
        popular: row.popular,
        isNew: row.novo,
        published: row.publicado,
        purchases: 0,
        left: 0
      }));

      render();
    } catch (err) {
      console.error("ADM FOLDER:", err);
      notify("Não foi possível carregar as coleções.");
      grid.innerHTML = "";
      if (empty) {
        empty.textContent = "Erro ao carregar coleções.";
        empty.classList.remove("hidden");
      }
    }
  }

  timer();
  setInterval(timer, 1000);
  loadCollections();
})();
