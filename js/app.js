/* Casa da Ração — lógica compartilhada (vitrine, busca, menu, pedido) */
(async function () {
  /* o catálogo fica em data/catalogo.json e é editado pelo painel do dono */
  let CAT;
  try {
    const r = await fetch("data/catalogo.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    CAT = await r.json();
  } catch (e) { CAT = null; }
  // produtos e promoções vêm do banco de dados quando ele está configurado
  const cfg = window.CDR_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    try {
      const h = { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY };
      const get = async (q) => { const r = await fetch(cfg.SUPABASE_URL + "/rest/v1/" + q, { headers: h, cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); };
      const [prods, promos] = await Promise.all([get("produtos?select=*&order=ordem.asc,nome.asc"), get("promocoes?select=*&order=ordem.asc")]);
      CAT = CAT || { WHATSAPP: "5579996554655", SETORES: [] };
      CAT.PRODUTOS = prods.map((p) => ({ ...p, preco: p.preco == null ? null : Number(p.preco), de: p.de == null ? null : Number(p.de), opcoes: p.opcoes && p.opcoes.length ? p.opcoes : null }));
      CAT.PROMOCOES = promos.map((b) => ({ ...b, seloTopo: b.selo_topo, seloValor: b.selo_valor }));
    } catch (e) { /* sem banco: segue com o catálogo do arquivo */ }
  }
  if (!CAT || !CAT.SETORES || !CAT.SETORES.length) {
    const box = document.getElementById("pageContent");
    if (box) box.insertAdjacentHTML("afterbegin", `<div class="wrap"><div class="empty" style="margin-top:24px"><h3>Não foi possível carregar os produtos</h3><p>Verifique sua internet e atualize a página. Se preferir, fale com a loja pelo WhatsApp.</p></div></div>`);
    return;
  }
  const WHATSAPP = CAT.WHATSAPP;
  const SETORES = CAT.SETORES;
  // só aceita dados no formato esperado (defesa extra caso o banco receba algo estranho)
  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
  const setoresOk = new Set(CAT.SETORES.map((s) => s.id));
  const PRODUTOS = (CAT.PRODUTOS || []).filter((p) => p && p.ativo !== false && SAFE_ID.test(p.id) && setoresOk.has(p.setor) && typeof p.nome === "string");
  const PROMOCOES = (CAT.PROMOCOES || []).filter((b) => b && b.ativo !== false && SAFE_ID.test(b.id) && typeof b.titulo === "string");
  const PAGE = document.body.dataset.page; // "inicio" ou id do setor
  const $ = (s) => document.querySelector(s);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const waLink = (t) => "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(t);
  const ico = (id, s = 18) => `<svg width="${s}" height="${s}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const byId = Object.fromEntries(PRODUTOS.map((p) => [p.id, p]));
  const setorById = Object.fromEntries(SETORES.map((s) => [s.id, s]));
  const STORAGE_IMG = /^https:\/\/unnmstazqkrjcuhvszza\.supabase\.co\/storage\/v1\/object\/public\/produtos\/[A-Za-z0-9._-]+$/;
  const img = (p) => esc(STORAGE_IMG.test(p.imagem || "") ? p.imagem : /^[A-Za-z0-9._-]+$/.test(p.imagem || "") ? "img/" + p.imagem : "");
  const linkProduto = (p) => esc(setorById[p.setor].pagina + "#p-" + p.id);
  const sel = {};

  /* ---------- pedido salvo no navegador (vale para todas as páginas) ---------- */
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("cdr-cart") || "[]")
      .filter((i) => i && byId[i.id] && (i.o == null || (byId[i.id].opcoes || []).includes(i.o)))
      .map((i) => ({ id: i.id, o: i.o ?? null, q: Math.min(99, Math.max(1, parseInt(i.q, 10) || 1)) }));
  } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem("cdr-cart", JSON.stringify(cart)); } catch (e) {} };
  const optOf = (id) => (byId[id].opcoes ? sel[id] || byId[id].opcoes[0] : null);

  /* ---------- aberto / fechado (horário de Aracaju) ---------- */
  function status() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Maceio", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const m = (+p.hour % 24) * 60 + +p.minute;
    const win = d === 0 ? [] : d === 6 ? [[480, 720]] : [[480, 720], [840, 1080]];
    const open = win.some(([a, b]) => m >= a && m < b);
    const next = win.find(([a]) => m < a);
    document.querySelectorAll(".js-status").forEach((el) => {
      el.classList.toggle("closed", !open);
      el.querySelector("span").textContent = open ? "Aberto agora" : next ? "Fechado · abre às " + next[0] / 60 + "h" : "Fechado agora";
    });
    document.querySelectorAll(".hours tr").forEach((tr) => { if (tr.dataset.d.split(",").includes(String(d))) tr.classList.add("today"); });
  }

  /* ---------- cartão de produto ---------- */
  function card(p, opts = {}) {
    const opt = optOf(p.id);
    const inCart = cart.find((i) => i.id === p.id && i.o === opt);
    const price = p.preco != null
      ? `<div class="price">${p.de ? `<s>${brl(p.de)}</s>` : ""}${brl(p.preco)}</div>`
      : `<div class="price ask">Valor no<br>WhatsApp</div>`;
    const ctl = inCart
      ? `<div class="stepper" role="group" aria-label="Quantidade"><button type="button" data-dec="${esc(p.id)}" aria-label="Diminuir">−</button><output>${inCart.q}</output><button type="button" data-inc="${esc(p.id)}" aria-label="Aumentar">+</button></div>`
      : `<button type="button" class="add" data-add="${esc(p.id)}" aria-label="Adicionar ${esc(p.nome)} ao pedido">${ico("i-plus", 16)}<span class="t">Adicionar</span></button>`;
    const s = setorById[p.setor];
    const nicho = s.nichos.find((n) => n.id === p.nicho);
    return `<article class="card"${opts.anchor ? ` id="p-${esc(p.id)}"` : ""} data-id="${esc(p.id)}" data-where="${opts.where ? 1 : ""}">
      <div class="pic">${p.de ? `<span class="ribbon">Oferta</span>` : ""}<img src="${img(p)}" alt="${esc(p.nome)}" loading="lazy" width="600" height="600"></div>
      <div class="body"><span class="brand">${esc(p.marca)}</span><h3>${esc(p.nome)}</h3><span class="meta">${esc(p.info)} · ${esc(p.peso)}</span>
      ${opts.where ? `<a class="where" href="${linkProduto(p)}">${esc(s.nome)} › ${esc(nicho ? nicho.nome : "")}</a>` : ""}
      ${p.opcoes ? `<div class="opts" role="group" aria-label="Opção">${p.opcoes.map((o) => `<button type="button" class="opt" data-opt="${esc(p.id)}" data-v="${esc(o)}" aria-pressed="${o === opt}">${esc(o)}</button>`).join("")}</div>` : ""}
      <div class="buy">${price}${ctl}</div></div></article>`;
  }
  function refreshCards() {
    document.querySelectorAll(".card").forEach((el) => {
      const t = document.createElement("div");
      t.innerHTML = card(byId[el.dataset.id], { anchor: !!el.id, where: !!el.dataset.where });
      el.replaceWith(t.firstElementChild);
    });
  }

  /* ---------- página inicial ---------- */
  function renderHome() {
    // promoções: banners cadastrados no painel + produtos com preço "de/por"
    $("#promoBanners").innerHTML = PROMOCOES.map((b) => {
      const p = b.produto && byId[b.produto];
      const tag = p ? "a" : "div";
      return `<${tag} class="promo-card ${b.cor === "verde" ? "soft" : "sun"}"${p ? ` href="${linkProduto(p)}"` : ""}>
        <div class="burst" aria-hidden="true"><div><small>${esc(b.seloTopo || "")}</small><span>${esc(b.seloValor || "")}</span></div></div>
        <div><h3>${esc(b.titulo)}</h3>${b.texto ? `<p>${esc(b.texto)}</p>` : ""}</div></${tag}>`;
    }).join("");
    const ids = new Set(PROMOCOES.map((b) => b.produto).filter((id) => byId[id]));
    PRODUTOS.forEach((p) => { if (p.de) ids.add(p.id); });
    const ofertas = [...ids].map((id) => byId[id]);
    $("#ofertas").innerHTML = ofertas.map((p) => card(p, { where: true })).join("");
    $("#ofertasWrap").hidden = !ofertas.length;
    $("#promocoes").hidden = !PROMOCOES.length && !ofertas.length;
    $("#sectors").innerHTML = SETORES.map((s) => {
      const items = PRODUTOS.filter((p) => p.setor === s.id);
      return `<a class="scard" href="${s.pagina}">
        <div class="pics">${items.slice(0, 2).map((p) => `<img src="${img(p)}" alt="" loading="lazy">`).join("")}</div>
        <div class="sb"><h3>${ico(s.icon, 20)}${esc(s.nome)}</h3><p>${s.nichos.map((n) => esc(n.nome)).join(" · ")}</p>
        <span class="go">Ver ${items.length} produtos ${ico("i-chev", 16)}</span></div></a>`;
    }).join("");
    const dest = PRODUTOS.filter((p) => p.destaque && !ids.has(p.id));
    $("#destaques").innerHTML = dest.map((p) => card(p, { where: true })).join("");
    $("#destaquesCount").textContent = dest.length + " produtos";
  }

  /* ---------- página de setor ---------- */
  function renderSector() {
    const s = setorById[PAGE];
    const items = PRODUTOS.filter((p) => p.setor === s.id);
    const nichos = s.nichos.filter((n) => items.some((p) => p.nicho === n.id));
    $("#niches").innerHTML =
      `<button type="button" class="niche-btn" data-niche="" aria-pressed="true">Todos <span>${items.length}</span></button>` +
      nichos.map((n) => `<button type="button" class="niche-btn" data-niche="${n.id}" aria-pressed="false">${esc(n.nome)} <span>${items.filter((p) => p.nicho === n.id).length}</span></button>`).join("");
    $("#vitrine").innerHTML = nichos.map((n) => {
      const list = items.filter((p) => p.nicho === n.id);
      return `<section class="niche" id="n-${n.id}" data-niche="${n.id}"><div class="shelf-head"><h2>${esc(n.nome)}</h2><small>${list.length} ${list.length > 1 ? "produtos" : "produto"}</small></div>
        <div class="grid">${list.map((p) => card(p, { anchor: true })).join("")}</div></section>`;
    }).join("");
    $("#others").innerHTML = SETORES.filter((o) => o.id !== s.id).map((o) => `<a class="chip" href="${o.pagina}">${ico(o.icon)}${esc(o.nome)}</a>`).join("");
  }
  function setNiche(id) {
    document.querySelectorAll(".niche-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.niche === id)));
    document.querySelectorAll(".niche").forEach((sec) => (sec.hidden = !!id && sec.dataset.niche !== id));
  }
  function applyHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (h.startsWith("n-") && document.getElementById(h)) {
      setNiche(h.slice(2));
      window.scrollTo({ top: $("#vitrine").offsetTop - 140 });
    } else if (h.startsWith("p-") && document.getElementById(h)) {
      setNiche("");
      const el = document.getElementById(h);
      el.scrollIntoView({ block: "center" });
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    }
  }

  /* ---------- menu lateral (3 barrinhas) ---------- */
  function renderNav() {
    const cur = (pg) => (pg === PAGE ? " current" : "");
    $("#navBody").innerHTML =
      `<a class="nav-link${cur("inicio")}" href="index.html"><span class="nav-ico">${ico("i-home")}</span>Início</a>
       <a class="nav-link" href="index.html#promocoes"><span class="nav-ico">${ico("i-tag")}</span>Promoções</a>
       <div class="d-sep"></div><div class="d-label">Setores</div>` +
      SETORES.map((s) => {
        const items = PRODUTOS.filter((p) => p.setor === s.id);
        const open = s.id === PAGE;
        return `<button class="nav-link${cur(s.id)}" type="button" aria-expanded="${open}" aria-controls="sub-${s.id}" data-sec="${s.id}"><span class="nav-ico">${ico(s.icon)}</span>${esc(s.nome)}<span class="n">${items.length}</span>${ico("i-chev", 16).replace("<svg", '<svg class="chev"')}</button>
        <div class="sub" id="sub-${s.id}"${open ? "" : " hidden"}><a class="all" href="${s.pagina}">Ver tudo <span>${items.length}</span></a>
        ${s.nichos.map((n) => {
          const q = items.filter((p) => p.nicho === n.id).length;
          return q ? `<a href="${s.pagina}#n-${n.id}">${esc(n.nome)} <span>${q}</span></a>` : "";
        }).join("")}</div>`;
      }).join("") +
      `<div class="d-sep"></div>
       <a class="nav-link" href="index.html#loja"><span class="nav-ico">${ico("i-clock")}</span>Horários e endereço</a>
       <a class="nav-link" href="${waLink("Olá, Casa da Ração! Vim pelo site.")}" target="_blank" rel="noopener"><span class="nav-ico">${ico("i-wa")}</span>Falar no WhatsApp</a>`;
  }
  $("#navBody").addEventListener("click", (e) => {
    const sec = e.target.closest("[data-sec]");
    if (sec) {
      const on = sec.getAttribute("aria-expanded") !== "true";
      sec.setAttribute("aria-expanded", on);
      document.getElementById("sub-" + sec.dataset.sec).hidden = !on;
      return;
    }
    const a = e.target.closest("a");
    if (a && !a.target) {
      // link para a própria página: fecha o menu e aplica o filtro/destaque
      const u = new URL(a.href, location.href);
      if (u.pathname === location.pathname) { closeDrawers(true); clearSearch(); if (u.hash === location.hash) applyHash(); }
    }
  });

  /* ---------- gavetas ---------- */
  let lastFocus = null;
  function openDrawer(id) {
    closeDrawers(true); lastFocus = document.activeElement;
    const d = document.getElementById(id);
    d.classList.add("open"); d.removeAttribute("inert"); d.setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("on"); document.body.style.overflow = "hidden";
    (id === "nav" ? $("#menuBtn") : $("#cartBtn")).setAttribute("aria-expanded", "true");
    setTimeout(() => d.querySelector(".d-head .iconbtn").focus(), 50);
  }
  function closeDrawers(silent) {
    document.querySelectorAll(".drawer.open").forEach((d) => { d.classList.remove("open"); d.setAttribute("inert", ""); d.setAttribute("aria-hidden", "true"); });
    $("#scrim").classList.remove("on"); document.body.style.overflow = "";
    $("#menuBtn").setAttribute("aria-expanded", "false"); $("#cartBtn").setAttribute("aria-expanded", "false");
    if (!silent && lastFocus) lastFocus.focus();
  }
  $("#menuBtn").onclick = () => openDrawer("nav");
  $("#cartBtn").onclick = () => { renderCart(); openDrawer("cart"); };
  $("#navClose").onclick = $("#cartClose").onclick = $("#scrim").onclick = () => closeDrawers();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawers(); });

  /* ---------- pedido ---------- */
  function add(id) {
    const p = byId[id], o = optOf(id);
    const it = cart.find((i) => i.id === id && i.o === o);
    if (it) it.q++; else cart.push({ id, o, q: 1 });
    changed(); toast(`${p.nome}${o ? " (" + o + ")" : ""} adicionado ao pedido`);
  }
  function inc(id, d) {
    const o = optOf(id), it = cart.find((i) => i.id === id && i.o === o);
    if (!it) return; it.q += d; if (it.q <= 0) cart = cart.filter((i) => i !== it); changed();
  }
  function updateCount(bump) {
    const c = $("#count"); c.textContent = cart.reduce((a, i) => a + i.q, 0);
    if (bump) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
  }
  function changed() { save(); refreshCards(); renderCart(); updateCount(true); }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]"); if (a) return add(a.dataset.add);
    const i = e.target.closest("[data-inc]"); if (i) return inc(i.dataset.inc, 1);
    const d = e.target.closest("[data-dec]"); if (d) return inc(d.dataset.dec, -1);
    const o = e.target.closest("[data-opt]"); if (o) { sel[o.dataset.opt] = o.dataset.v; refreshCards(); return; }
    const n = e.target.closest("[data-niche]"); if (n && n.classList.contains("niche-btn")) {
      setNiche(n.dataset.niche);
      try { history.replaceState(null, "", n.dataset.niche ? "#n-" + n.dataset.niche : location.pathname); } catch (err) {}
    }
  });
  function renderCart() {
    const box = $("#cartItems"), has = cart.length > 0;
    $("#orderForm").hidden = !has; $("#cartFoot").hidden = !has;
    if (!has) {
      box.innerHTML = `<div class="c-empty"><b>Seu pedido está vazio</b>Toque em “Adicionar” nos produtos para montar o pedido.<div style="margin-top:16px"><a class="btn btn-sun" href="index.html#setores">Ver setores</a></div></div>`;
      return;
    }
    box.innerHTML = cart.map((it, k) => {
      const p = byId[it.id];
      return `<div class="c-item"><img src="${img(p)}" alt=""><div style="min-width:0"><div class="nm">${esc(p.nome)}</div><div class="sm">${esc(p.peso)}${it.o ? " · " + esc(it.o) : ""}</div><div class="sm">${p.preco != null ? brl(p.preco) + " cada" : "Valor a confirmar"}</div><button class="rm" type="button" data-rm="${k}">Remover</button></div>
      <div class="stepper" role="group" aria-label="Quantidade"><button type="button" data-ck="${k}" data-d="-1" aria-label="Diminuir">−</button><output>${it.q}</output><button type="button" data-ck="${k}" data-d="1" aria-label="Aumentar">+</button></div></div>`;
    }).join("");
    const priced = cart.filter((i) => byId[i.id].preco != null);
    const tot = priced.reduce((a, i) => a + byId[i.id].preco * i.q, 0);
    const ask = cart.length - priced.length;
    $("#total").textContent = brl(tot);
    $("#totNote").textContent = ask ? `${ask} ${ask > 1 ? "itens" : "item"} com valor a confirmar pela loja` : "Valores confirmados pela loja";
    updateSend();
  }
  $("#cartItems").addEventListener("click", (e) => {
    const r = e.target.closest("[data-rm]"); if (r) { cart.splice(+r.dataset.rm, 1); changed(); return; }
    const s = e.target.closest("[data-ck]");
    if (s) { const it = cart[+s.dataset.ck]; it.q += +s.dataset.d; if (it.q <= 0) cart.splice(+s.dataset.ck, 1); changed(); }
  });
  function message() {
    const rec = document.querySelector('input[name="rec"]:checked').value;
    const L = ["Olá, Casa da Ração! Quero fazer um pedido pelo site:", ""];
    cart.forEach((it) => {
      const p = byId[it.id];
      L.push(`• ${it.q}x ${p.nome}${p.peso !== "Unidade" ? " – " + p.peso : ""}${it.o ? " (" + it.o + ")" : ""}${p.preco != null ? " – " + brl(p.preco * it.q) : ""}`);
    });
    const priced = cart.filter((i) => byId[i.id].preco != null), ask = cart.length - priced.length;
    L.push("");
    if (priced.length) L.push(`Total parcial: ${brl(priced.reduce((a, i) => a + byId[i.id].preco * i.q, 0))}${ask ? " (+ itens com valor a confirmar)" : ""}`);
    else L.push("Por favor, me informe os valores.");
    const nome = $("#f-nome").value.trim(), end = $("#f-end").value.trim(), pag = $("#f-pag").value, tr = $("#f-troco").value.trim(), obs = $("#f-obs").value.trim();
    L.push("", rec === "Entrega" ? `Entrega: ${end || "vou informar o endereço"}` : "Vou retirar na loja");
    L.push(`Pagamento: ${pag}${pag === "Dinheiro" && tr ? ` (troco para R$ ${tr})` : ""}`);
    if (nome) L.push(`Nome: ${nome}`);
    if (obs) L.push(`Obs.: ${obs}`);
    return L.join("\n");
  }
  function updateSend() { if (cart.length) $("#sendBtn").href = waLink(message()); }
  $("#orderForm").addEventListener("input", () => {
    $("#addrField").hidden = !$("#rec-ent").checked;
    $("#trocoField").hidden = $("#f-pag").value !== "Dinheiro";
    updateSend();
  });
  $("#orderForm").addEventListener("change", () => $("#orderForm").dispatchEvent(new Event("input")));
  $("#orderForm").addEventListener("submit", (e) => e.preventDefault());
  $("#sendBtn").addEventListener("click", () => { updateSend(); toast("Abrindo o WhatsApp com seu pedido"); });

  /* ---------- busca (procura em todos os setores) ---------- */
  const idx = PRODUTOS.map((p) => {
    const s = setorById[p.setor], n = s.nichos.find((x) => x.id === p.nicho);
    return { p, t: norm([p.nome, p.marca, p.info, p.peso, p.tags, s.nome, n ? n.nome : "", (p.opcoes || []).join(" ")].join(" ")) };
  });
  function search(q) {
    const n = norm(q.trim()); $("#qClear").hidden = !q;
    if (!n) { $("#results").hidden = true; $("#pageContent").hidden = false; return; }
    const words = n.split(/\s+/);
    const hits = idx.filter((x) => words.every((w) => x.t.includes(w))).map((x) => x.p);
    $("#pageContent").hidden = true; $("#results").hidden = false;
    $("#resultsTitle").textContent = hits.length ? `${hits.length} ${hits.length > 1 ? "produtos" : "produto"} para “${q.trim()}”` : `Nada encontrado para “${q.trim()}”`;
    $("#resultsGrid").innerHTML = hits.map((p) => card(p, { where: true })).join("");
    $("#resultsGrid").hidden = !hits.length; $("#noResults").hidden = !!hits.length;
    $("#askWa").href = waLink(`Olá, Casa da Ração! Vocês têm "${q.trim()}"?`);
  }
  function clearSearch() { if ($("#q").value) { $("#q").value = ""; search(""); } }
  $("#q").addEventListener("input", (e) => { search(e.target.value); window.scrollTo({ top: 0 }); });
  $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); $("#q").blur(); });
  $("#qClear").onclick = () => { clearSearch(); $("#q").focus(); };
  $("#backPage").onclick = () => clearSearch();
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
  });

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 1800); }

  /* ---------- início ---------- */
  $("#fab").href = waLink("Olá, Casa da Ração! Vim pelo site e gostaria de tirar uma dúvida.");
  status();
  if (PAGE === "inicio") renderHome(); else if (setorById[PAGE]) renderSector();
  renderNav(); renderCart(); updateCount(false);
  window.addEventListener("hashchange", applyHash);
  if (setorById[PAGE]) requestAnimationFrame(applyHash);
})();
