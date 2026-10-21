/* Painel da loja — edita data/catalogo.json e as fotos em img/ direto no GitHub.
   Cada "Publicar no site" vira um commit no repositório; o GitHub Pages republica sozinho. */
(function () {
  const OWNER = "Osmario2006", REPO = "casadaracao", BRANCH = "main", PATH = "data/catalogo.json";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
  const KEY = "cdr-painel-token";

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const brl = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseMoney = (s) => {
    s = String(s || "").trim().replace(/[R$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  };
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "produto";

  let token = null, cat = null, original = "", fileSha = null;
  let pending = {};            // "img/arquivo.webp" -> { b64, url }
  let view = "produtos";

  /* ---------- GitHub ---------- */
  async function gh(path, opts = {}) {
    const r = await fetch(API + path, {
      ...opts,
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) }
    });
    if (!r.ok) { const e = new Error("GitHub " + r.status); e.status = r.status; try { e.detail = (await r.json()).message; } catch (x) {} throw e; }
    return r.status === 204 ? null : r.json();
  }
  const b64ToText = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  async function loadCatalog() {
    const f = await gh(`/contents/${PATH}?ref=${BRANCH}`);
    fileSha = f.sha;
    cat = JSON.parse(b64ToText(f.content));
    cat.PROMOCOES = cat.PROMOCOES || [];
    original = JSON.stringify(cat);
    pending = {};
  }

  /* ---------- entrada ---------- */
  function storedToken() { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function storeToken(t, remember) {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); (remember ? localStorage : sessionStorage).setItem(KEY, t); } catch (e) {}
  }
  async function enter(t, remember) {
    token = t;
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Entrando…";
    $("#loginErr").hidden = true;
    try {
      const repo = await gh("");
      if (!repo.permissions || !repo.permissions.push) throw Object.assign(new Error(), { status: 403 });
      await loadCatalog();
      storeToken(t, remember);
      $("#login").hidden = true; $("#app").hidden = false; $("#logout").hidden = false;
      fillSetorFilter(); render();
    } catch (e) {
      token = null;
      const msg = e.status === 401 ? "Chave inválida ou expirada. Gere uma nova chave e tente de novo."
        : e.status === 403 || e.status === 404 ? "Essa chave não tem permissão para alterar o site. Confira se ela dá acesso ao repositório casadaracao com Contents em Read and write."
        : "Não foi possível conectar. Verifique a internet e tente de novo.";
      $("#loginErr").textContent = msg; $("#loginErr").hidden = false;
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (x) {}
      $("#login").hidden = false; $("#app").hidden = true;
    } finally { btn.disabled = false; btn.textContent = "Entrar"; }
  }
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("#token").value.trim();
    if (!t) { $("#loginErr").textContent = "Cole a chave de acesso para entrar."; $("#loginErr").hidden = false; return; }
    enter(t, $("#remember").checked);
  });
  $("#token").addEventListener("input", () => { $("#loginErr").hidden = true; });
  $("#logout").onclick = () => {
    if (isDirty() && !$("#logout").dataset.sure) { $("#logout").dataset.sure = "1"; $("#logout").textContent = "Sair sem publicar?"; setTimeout(() => { delete $("#logout").dataset.sure; $("#logout").textContent = "Sair"; }, 4000); return; }
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };

  /* ---------- utilidades do catálogo ---------- */
  const setor = (id) => cat.SETORES.find((s) => s.id === id);
  const nichoNome = (p) => { const s = setor(p.setor); const n = s && s.nichos.find((x) => x.id === p.nicho); return n ? n.nome : ""; };
  const imgSrc = (file) => (pending["img/" + file] ? pending["img/" + file].url : "img/" + file);
  const isDirty = () => JSON.stringify(cat) !== original || Object.keys(pending).length > 0;
  function origOf(id) { try { return JSON.parse(original).PRODUTOS.find((p) => p.id === id); } catch (e) { return null; } }

  /* ---------- lista de produtos ---------- */
  function fillSetorFilter() {
    $("#fs").innerHTML = `<option value="">Todos os setores</option>` + cat.SETORES.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join("");
  }
  function renderProducts() {
    const q = $("#fq").value.trim().toLowerCase(), fs = $("#fs").value;
    const list = cat.PRODUTOS.filter((p) => (!fs || p.setor === fs) && (!q || (p.nome + " " + p.marca).toLowerCase().includes(q)));
    $("#nProd").textContent = "(" + cat.PRODUTOS.length + ")";
    if (!list.length) { $("#prodList").innerHTML = `<div class="empty"><h3>Nenhum produto encontrado</h3><p>Mude a busca ou cadastre um produto novo.</p></div>`; return; }
    let html = "";
    cat.SETORES.forEach((s) => {
      const items = list.filter((p) => p.setor === s.id);
      if (!items.length) return;
      html += `<h2 class="group-title">${esc(s.nome)}</h2>`;
      html += items.map((p) => {
        const o = origOf(p.id), changed = !o || JSON.stringify(o) !== JSON.stringify(p);
        return `<div class="row${changed ? " changed" : ""}${p.ativo === false ? " off" : ""}" data-id="${p.id}">
          <img src="${esc(imgSrc(p.imagem))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${RAW}img/${esc(p.imagem)}'">
          <div class="rinfo"><b>${esc(p.nome)}</b><small>${esc(nichoNome(p))} · ${esc(p.peso)}</small>
            <div class="badges">${!o ? `<span class="badge sun">Novo</span>` : changed ? `<span class="badge sun">Alterado</span>` : ""}${p.ativo === false ? `<span class="badge grey">Oculto</span>` : ""}${p.de ? `<span class="badge red">Oferta</span>` : ""}${p.destaque ? `<span class="badge">Destaque</span>` : ""}</div></div>
          <div class="rprice"><label class="sr" for="pr-${p.id}">Preço de ${esc(p.nome)}</label><span>R$</span><input id="pr-${p.id}" inputmode="decimal" placeholder="Consultar" value="${p.preco != null ? brl(p.preco) : ""}" data-price="${p.id}"></div>
          <button class="edit-btn" type="button" data-edit="${p.id}">Editar</button></div>`;
      }).join("");
    });
    $("#prodList").innerHTML = html;
  }
  $("#fq").addEventListener("input", renderProducts);
  $("#fs").addEventListener("change", renderProducts);
  $("#prodList").addEventListener("change", (e) => {
    const inp = e.target.closest("[data-price]"); if (!inp) return;
    const p = cat.PRODUTOS.find((x) => x.id === inp.dataset.price);
    const v = parseMoney(inp.value);
    if (Number.isNaN(v)) { inp.classList.add("bad"); toast("Preço inválido. Use, por exemplo, 49,90"); return; }
    inp.classList.remove("bad");
    p.preco = v;
    if (p.de != null && v != null && p.de <= v) { delete p.de; toast("Preço antigo removido porque ficou menor que o novo preço"); }
    render();
  });
  $("#prodList").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) openProduct(b.dataset.edit); });
  $("#newProd").onclick = () => openProduct(null);

  /* ---------- editor de produto ---------- */
  let edImage = null; // { file, b64, url } da foto nova
  function openProduct(id) {
    const p = id ? cat.PRODUTOS.find((x) => x.id === id) : { ativo: true, setor: $("#fs").value || cat.SETORES[0].id, nicho: "", marca: "", nome: "", info: "", peso: "", preco: null, imagem: "" };
    edImage = null;
    $("#edTitle").textContent = id ? "Editar produto" : "Novo produto";
    const s = setor(p.setor);
    $("#edForm").innerHTML = `
      <div class="field"><span class="lbl" style="font-weight:800;font-size:.88rem">Foto</span>
        <div class="ed-img"><img id="edPic" src="${p.imagem ? esc(imgSrc(p.imagem)) : ""}" alt="" ${p.imagem ? "" : "hidden"}>
          <div style="display:grid;gap:6px"><span class="btn btn-line file">${p.imagem ? "Trocar foto" : "Escolher foto"}<input type="file" id="edFile" accept="image/*" aria-label="Escolher foto do produto"></span>
          <p class="hint">Use uma foto de frente, com fundo branco. Ela é ajustada sozinha para o formato quadrado.</p><p class="err" id="eFile" hidden></p></div></div></div>
      <div class="field"><label for="eNome">Nome do produto</label><input id="eNome" value="${esc(p.nome)}" placeholder="Ex.: Ração Golden Cães Adultos"><p class="err" id="eNomeErr" hidden>Informe o nome do produto.</p></div>
      <div class="two">
        <div class="field"><label for="eMarca">Marca</label><input id="eMarca" value="${esc(p.marca)}" placeholder="Ex.: Premier"></div>
        <div class="field"><label for="ePeso">Tamanho ou peso</label><input id="ePeso" value="${esc(p.peso)}" placeholder="Ex.: 15 kg"></div>
      </div>
      <div class="two">
        <div class="field"><label for="eSetor">Setor</label><select id="eSetor">${cat.SETORES.map((x) => `<option value="${x.id}"${x.id === p.setor ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        <div class="field"><label for="eNicho">Tipo</label><select id="eNicho">${nichoOptions(s, p.nicho)}</select></div>
      </div>
      <div class="field"><label for="eInfo">Descrição curta</label><input id="eInfo" value="${esc(p.info)}" placeholder="Ex.: Frango e arroz · Raças pequenas"></div>
      <div class="two">
        <div class="field"><label for="ePreco">Preço</label><div class="money"><span>R$</span><input id="ePreco" inputmode="decimal" value="${p.preco != null ? brl(p.preco) : ""}" placeholder="Consultar"></div><p class="hint">Vazio mostra "Valor no WhatsApp".</p></div>
        <div class="field"><label for="eDe">Preço antigo (opcional)</label><div class="money"><span>R$</span><input id="eDe" inputmode="decimal" value="${p.de != null ? brl(p.de) : ""}" placeholder="—"></div><p class="hint">Aparece riscado, com selo "Oferta".</p></div>
      </div>
      <p class="err" id="ePrecoErr" hidden></p>
      <div class="field"><label for="eOpc">Variações (opcional)</label><input id="eOpc" value="${esc((p.opcoes || []).join(", "))}" placeholder="Ex.: Carne, Frango, Salmão"><p class="hint">Separe por vírgula. O cliente escolhe uma ao adicionar.</p></div>
      <div class="field"><label for="eTags">Palavras para a busca (opcional)</label><input id="eTags" value="${esc(p.tags || "")}" placeholder="Ex.: racao cachorro filhote"></div>
      <div class="toggles">
        <label class="check"><input type="checkbox" id="eAtivo"${p.ativo !== false ? " checked" : ""}> Mostrar no site</label>
        <label class="check"><input type="checkbox" id="eDest"${p.destaque ? " checked" : ""}> Destaque na página inicial</label>
      </div>`;
    $("#edFoot").innerHTML = `<button class="btn btn-line" type="button" data-ed="cancel">Cancelar</button><button class="btn btn-green" type="button" data-ed="save">${id ? "Salvar alterações" : "Adicionar produto"}</button>${id ? `<button class="btn btn-danger full" type="button" data-ed="del">Excluir produto</button>` : ""}`;
    $("#edForm").dataset.kind = "produto"; $("#edForm").dataset.id = id || "";
    $("#eSetor").onchange = () => { $("#eNicho").innerHTML = nichoOptions(setor($("#eSetor").value), ""); };
    $("#edFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      $("#eFile").hidden = true;
      try { edImage = await processImage(f); $("#edPic").src = edImage.url; $("#edPic").hidden = false; }
      catch (err) { $("#eFile").textContent = "Não foi possível abrir essa imagem. Tente uma foto em JPG ou PNG."; $("#eFile").hidden = false; }
    };
    openEditor();
  }
  function nichoOptions(s, cur) { return s.nichos.map((n) => `<option value="${n.id}"${n.id === cur ? " selected" : ""}>${esc(n.nome)}</option>`).join(""); }

  function saveProduct() {
    const id = $("#edForm").dataset.id;
    const nome = $("#eNome").value.trim();
    $("#eNomeErr").hidden = !!nome;
    const preco = parseMoney($("#ePreco").value), de = parseMoney($("#eDe").value);
    let perr = "";
    if (Number.isNaN(preco) || Number.isNaN(de)) perr = "Confira os preços. Use, por exemplo, 49,90.";
    else if (de != null && preco == null) perr = "Para usar preço antigo, informe também o preço atual.";
    else if (de != null && de <= preco) perr = "O preço antigo precisa ser maior que o preço atual.";
    $("#ePrecoErr").textContent = perr; $("#ePrecoErr").hidden = !perr;
    const noImg = !id && !edImage;
    $("#eFile").textContent = "Escolha uma foto para o produto."; $("#eFile").hidden = !noImg;
    if (!nome || perr || noImg) { (!nome ? $("#eNome") : perr ? $("#ePreco") : $("#edFile")).focus(); return; }

    const p = id ? cat.PRODUTOS.find((x) => x.id === id) : { id: uniqueId(slug(nome)) };
    Object.assign(p, {
      setor: $("#eSetor").value, nicho: $("#eNicho").value, marca: $("#eMarca").value.trim(), nome,
      info: $("#eInfo").value.trim(), peso: $("#ePeso").value.trim() || "Unidade", preco, ativo: $("#eAtivo").checked
    });
    if (de != null) p.de = de; else delete p.de;
    const opc = $("#eOpc").value.split(",").map((x) => x.trim()).filter(Boolean);
    if (opc.length) p.opcoes = opc; else delete p.opcoes;
    const tags = $("#eTags").value.trim(); if (tags) p.tags = tags; else delete p.tags;
    if ($("#eDest").checked) p.destaque = true; else delete p.destaque;
    if (edImage) {
      const file = `${p.id}-${Date.now().toString(36)}.${edImage.ext}`;
      if (p.imagem && pending["img/" + p.imagem]) delete pending["img/" + p.imagem];
      pending["img/" + file] = { b64: edImage.b64, url: edImage.url };
      p.imagem = file;
    }
    if (!id) cat.PRODUTOS.push(p);
    closeEditor(); render(); toast(id ? "Alterações guardadas. Publique para enviar ao site." : "Produto adicionado. Publique para enviar ao site.");
  }
  function uniqueId(base) { let id = base, i = 2; while (cat.PRODUTOS.some((p) => p.id === id)) id = base + "-" + i++; return id; }

  function askDelete(kind) {
    const foot = $("#edFoot");
    if (foot.querySelector(".confirm")) return;
    const name = kind === "produto" ? $("#eNome").value.trim() : $("#pTitulo").value.trim();
    foot.insertAdjacentHTML("beforeend", `<div class="confirm" role="alert"><p>Excluir “${esc(name)}”? ${kind === "produto" ? "O produto sai do site quando você publicar." : "A promoção sai do site quando você publicar."}</p><div><button class="btn btn-danger solid" type="button" data-ed="delok">Excluir</button><button class="btn btn-line" type="button" data-ed="delno">Manter</button></div></div>`);
    foot.querySelector("[data-ed=delno]").focus();
  }
  function doDelete() {
    const kind = $("#edForm").dataset.kind, id = $("#edForm").dataset.id;
    if (kind === "produto") {
      const p = cat.PRODUTOS.find((x) => x.id === id);
      if (p && pending["img/" + p.imagem]) delete pending["img/" + p.imagem];
      cat.PRODUTOS = cat.PRODUTOS.filter((x) => x.id !== id);
      cat.PROMOCOES.forEach((b) => { if (b.produto === id) b.produto = ""; });
    } else cat.PROMOCOES = cat.PROMOCOES.filter((x) => x.id !== id);
    closeEditor(); render(); toast("Excluído. Publique para enviar ao site.");
  }

  /* ---------- foto: ajusta para 600×600 com fundo branco ---------- */
  async function processImage(file) {
    const bm = await createImageBitmap(file);
    const S = 600, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    const k = Math.min(S / bm.width, S / bm.height) * 0.92, w = bm.width * k, h = bm.height * k;
    x.imageSmoothingQuality = "high"; x.drawImage(bm, (S - w) / 2, (S - h) / 2, w, h);
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85)), ext = "webp";
    if (!blob || blob.type !== "image/webp") { blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88)); ext = "jpg"; }
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    return { b64, ext, url: URL.createObjectURL(blob) };
  }

  /* ---------- promoções ---------- */
  function renderPromos() {
    $("#nPromo").textContent = "(" + cat.PROMOCOES.length + ")";
    if (!cat.PROMOCOES.length) { $("#promoList").innerHTML = `<div class="empty"><h3>Nenhuma promoção cadastrada</h3><p>Crie uma promoção para ela aparecer no topo da página inicial.</p></div>`; return; }
    $("#promoList").innerHTML = cat.PROMOCOES.map((b, i) => `
      <div class="prow${b.ativo === false ? " off" : ""}">
        <button type="button" class="promo-card ${b.cor === "verde" ? "soft" : "sun"}" data-pedit="${b.id}" style="border:0;text-align:left;cursor:pointer;font:inherit" aria-label="Editar promoção ${esc(b.titulo)}">
          <div class="burst" aria-hidden="true"><div><small>${esc(b.seloTopo)}</small><span>${esc(b.seloValor)}</span></div></div>
          <div><h3>${esc(b.titulo)}</h3>${b.texto ? `<p>${esc(b.texto)}</p>` : ""}<p class="badges">${b.ativo === false ? `<span class="badge grey">Oculta</span>` : ""}${b.produto && cat.PRODUTOS.some((p) => p.id === b.produto) ? `<span class="badge">Leva ao produto</span>` : ""}</p></div>
        </button>
        <div class="pctl"><button class="mini" type="button" data-up="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button><button class="mini" type="button" data-down="${i}" aria-label="Descer" ${i === cat.PROMOCOES.length - 1 ? "disabled" : ""}>↓</button></div>
      </div>`).join("");
  }
  $("#promoList").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-pedit]"); if (ed) return openPromo(ed.dataset.pedit);
    const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-down]");
    const i = up ? +up.dataset.up : dn ? +dn.dataset.down : -1; if (i < 0) return;
    const j = up ? i - 1 : i + 1; const a = cat.PROMOCOES; [a[i], a[j]] = [a[j], a[i]]; render();
  });
  $("#newPromo").onclick = () => openPromo(null);
  function openPromo(id) {
    const b = id ? cat.PROMOCOES.find((x) => x.id === id) : { titulo: "", texto: "", seloTopo: "", seloValor: "", produto: "", cor: "amarelo", ativo: true };
    $("#edTitle").textContent = id ? "Editar promoção" : "Nova promoção";
    $("#edForm").innerHTML = `
      <div class="field"><label for="pTitulo">Título</label><input id="pTitulo" value="${esc(b.titulo)}" placeholder="Ex.: Ração Golden 15 kg com 10% de desconto"><p class="err" id="pTituloErr" hidden>Informe o título da promoção.</p></div>
      <div class="field"><label for="pTexto">Detalhes (opcional)</label><textarea id="pTexto" placeholder="Ex.: Válido até sábado ou enquanto durar o estoque.">${esc(b.texto)}</textarea></div>
      <div class="two">
        <div class="field"><label for="pTopo">Selo: texto pequeno</label><input id="pTopo" maxlength="10" value="${esc(b.seloTopo)}" placeholder="Ex.: POR"></div>
        <div class="field"><label for="pValor">Selo: destaque</label><input id="pValor" maxlength="7" value="${esc(b.seloValor)}" placeholder="Ex.: 12,99"></div>
      </div>
      <p class="hint">O selo é a estrela vermelha ao lado do título. Use textos curtos.</p>
      <fieldset class="field"><legend>Cor</legend><div class="seg">
        <input type="radio" name="pcor" id="pc-am" value="amarelo"${b.cor !== "verde" ? " checked" : ""}><label for="pc-am">Amarelo</label>
        <input type="radio" name="pcor" id="pc-vd" value="verde"${b.cor === "verde" ? " checked" : ""}><label for="pc-vd">Branco</label></div></fieldset>
      <div class="field"><label for="pProd">Produto da promoção (opcional)</label><select id="pProd"><option value="">Nenhum</option>${cat.PRODUTOS.map((p) => `<option value="${p.id}"${p.id === b.produto ? " selected" : ""}>${esc(p.nome)}</option>`).join("")}</select><p class="hint">Ao tocar na promoção, o cliente vai direto para o produto. Ele também aparece em "Produtos em oferta".</p></div>
      <div class="toggles"><label class="check"><input type="checkbox" id="pAtivo"${b.ativo !== false ? " checked" : ""}> Mostrar no site</label></div>`;
    $("#edFoot").innerHTML = `<button class="btn btn-line" type="button" data-ed="cancel">Cancelar</button><button class="btn btn-green" type="button" data-ed="save">${id ? "Salvar alterações" : "Adicionar promoção"}</button>${id ? `<button class="btn btn-danger full" type="button" data-ed="del">Excluir promoção</button>` : ""}`;
    $("#edForm").dataset.kind = "promo"; $("#edForm").dataset.id = id || "";
    openEditor();
  }
  function savePromo() {
    const id = $("#edForm").dataset.id, titulo = $("#pTitulo").value.trim();
    $("#pTituloErr").hidden = !!titulo; if (!titulo) { $("#pTitulo").focus(); return; }
    const b = id ? cat.PROMOCOES.find((x) => x.id === id) : { id: (() => { let s = slug(titulo), n = s, i = 2; while (cat.PROMOCOES.some((x) => x.id === n)) n = s + "-" + i++; return n; })() };
    Object.assign(b, { titulo, texto: $("#pTexto").value.trim(), seloTopo: $("#pTopo").value.trim().toUpperCase(), seloValor: $("#pValor").value.trim(), produto: $("#pProd").value, cor: document.querySelector('input[name="pcor"]:checked').value, ativo: $("#pAtivo").checked });
    if (!id) cat.PROMOCOES.unshift(b);
    closeEditor(); render(); toast(id ? "Promoção guardada. Publique para enviar ao site." : "Promoção adicionada. Publique para enviar ao site.");
  }

  /* ---------- gaveta ---------- */
  let lastFocus = null;
  function openEditor() {
    lastFocus = document.activeElement;
    const d = $("#editor"); d.classList.add("open"); d.removeAttribute("inert"); d.setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("on"); document.body.style.overflow = "hidden";
    $("#edForm").scrollTop = 0;
    setTimeout(() => (d.querySelector("#eNome, #pTitulo") || d.querySelector(".iconbtn")).focus(), 60);
  }
  function closeEditor() {
    const d = $("#editor"); d.classList.remove("open"); d.setAttribute("inert", ""); d.setAttribute("aria-hidden", "true");
    $("#scrim").classList.remove("on"); document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  $("#edClose").onclick = $("#scrim").onclick = closeEditor;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#editor").classList.contains("open")) closeEditor(); });
  $("#edForm").addEventListener("submit", (e) => e.preventDefault());
  $("#edFoot").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ed]"); if (!a) return;
    const kind = $("#edForm").dataset.kind;
    ({ cancel: closeEditor, save: kind === "produto" ? saveProduct : savePromo, del: () => askDelete(kind), delok: doDelete, delno: () => { const c = $("#edFoot .confirm"); if (c) c.remove(); } })[a.dataset.ed]();
  });

  /* ---------- abas ---------- */
  function setView(v) {
    view = v;
    $("#tab-produtos").setAttribute("aria-selected", v === "produtos"); $("#tab-promos").setAttribute("aria-selected", v === "promos");
    $("#view-produtos").hidden = v !== "produtos"; $("#view-promos").hidden = v !== "promos";
  }
  $("#tab-produtos").onclick = () => setView("produtos");
  $("#tab-promos").onclick = () => setView("promos");

  /* ---------- publicar ---------- */
  function countChanges() {
    const o = JSON.parse(original), n = { prod: 0, promo: 0 };
    const om = Object.fromEntries(o.PRODUTOS.map((p) => [p.id, JSON.stringify(p)]));
    cat.PRODUTOS.forEach((p) => { if (om[p.id] !== JSON.stringify(p)) n.prod++; });
    n.prod += o.PRODUTOS.filter((p) => !cat.PRODUTOS.some((x) => x.id === p.id)).length;
    if (JSON.stringify(o.PROMOCOES || []) !== JSON.stringify(cat.PROMOCOES)) n.promo = 1;
    return n;
  }
  function renderBar(state, text) {
    const dirty = isDirty();
    $("#pubbar").hidden = !dirty && !state;
    const msg = $("#pubMsg"); msg.className = "pub-msg" + (state ? " " + state : "");
    if (text) msg.innerHTML = text;
    else if (dirty) { const n = countChanges(); const parts = []; if (n.prod) parts.push(`${n.prod} ${n.prod > 1 ? "produtos alterados" : "produto alterado"}`); if (n.promo) parts.push("promoções alteradas"); msg.innerHTML = `${parts.join(" e ") || "Alterações"} sem publicar<small>O site só muda depois de tocar em Publicar.</small>`; }
    $("#publish").hidden = !dirty; $("#discard").hidden = !dirty;
  }
  function render() { renderProducts(); renderPromos(); renderBar(); }

  $("#discard").onclick = async () => {
    const b = $("#discard");
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmar descarte"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Descartar"; }, 4000); return; }
    delete b.dataset.sure; b.textContent = "Descartar";
    cat = JSON.parse(original); pending = {}; render(); toast("Alterações descartadas");
  };

  $("#publish").onclick = async () => {
    const btn = $("#publish"); btn.disabled = true; btn.textContent = "Publicando…"; $("#discard").disabled = true;
    try {
      const cur = await gh(`/contents/${PATH}?ref=${BRANCH}`);
      if (cur.sha !== fileSha) {
        renderBar("bad", `O catálogo foi alterado em outro aparelho depois que você abriu o painel.<small>Toque em Recarregar para pegar a versão mais nova. As alterações feitas aqui serão perdidas.</small>`);
        btn.textContent = "Recarregar"; btn.disabled = false; btn.hidden = false;
        btn.onclick = () => location.reload();
        return;
      }
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const base = ref.object.sha;
      const commit = await gh(`/git/commits/${base}`);
      const used = new Set(cat.PRODUTOS.map((p) => "img/" + p.imagem));
      const entries = [];
      for (const [path, im] of Object.entries(pending)) {
        if (!used.has(path)) continue;
        const blob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: im.b64, encoding: "base64" }) });
        entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const jb = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: JSON.stringify(cat, null, 2) + "\n", encoding: "utf-8" }) });
      entries.push({ path: PATH, mode: "100644", type: "blob", sha: jb.sha });
      const tree = await gh(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries }) });
      const n = countChanges();
      const resumo = [n.prod ? `${n.prod} produto(s)` : "", n.promo ? "promoções" : ""].filter(Boolean).join(" e ") || "catálogo";
      const nc = await gh(`/git/commits`, { method: "POST", body: JSON.stringify({ message: `Painel da loja: atualiza ${resumo}`, tree: tree.sha, parents: [base] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: nc.sha }) });
      const f = await gh(`/contents/${PATH}?ref=${BRANCH}`); fileSha = f.sha;
      original = JSON.stringify(cat); pending = {};
      render();
      renderBar("ok", `Publicado! O site atualiza em 1 a 2 minutos.<small>Se ainda aparecer a versão antiga, atualize a página do site.</small>`);
      setTimeout(() => { if (!isDirty()) $("#pubbar").hidden = true; }, 9000);
    } catch (e) {
      const why = e.status === 401 ? "A chave de acesso expirou. Saia e entre com uma chave nova." : e.status === 409 || e.status === 422 ? "O site foi alterado ao mesmo tempo por outra pessoa. Toque em Publicar de novo." : "Não foi possível publicar. Verifique a internet e tente de novo.";
      renderBar("bad", `${why}<small>Suas alterações continuam aqui, nada foi perdido.</small>`);
      $("#publish").hidden = false; $("#discard").hidden = false;
    } finally { if (btn.textContent === "Publicando…") btn.textContent = "Publicar no site"; btn.disabled = false; $("#discard").disabled = false; }
  };

  window.addEventListener("beforeunload", (e) => { if (cat && isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2400); }

  /* ---------- início ---------- */
  const saved = storedToken();
  if (saved) { $("#token").value = ""; enter(saved, !!(function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } })()); }
})();
