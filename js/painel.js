/* Painel da loja — login por e-mail e senha (Supabase Auth).
   Produtos e promoções ficam no banco; fotos no Storage. Cada alteração salva na hora e já aparece no site.
   Quem pode alterar é definido no banco (tabela admins + regras de segurança em supabase/setup.sql). */
(function () {
  const cfg = window.CDR_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseMoney = (s) => {
    s = String(s || "").trim().replace(/[R$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  };
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  const imgUrl = (v) => (/^https?:\/\//.test(v || "") ? v : "img/" + (v || ""));

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    $("#loginForm").hidden = true; $("#cfgErr").hidden = false; return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  let SETORES = [], PRODUTOS = [], PROMOCOES = [], view = "produtos", recovering = false;

  /* ---------- telas de entrada ---------- */
  function showForm(id) {
    ["#loginForm", "#resetForm", "#newPassForm"].forEach((f) => ($(f).hidden = f !== id));
    $("#loginTitle").textContent = id === "#resetForm" ? "Recuperar senha" : id === "#newPassForm" ? "Criar nova senha" : "Entrar no painel";
    $("#loginLead").hidden = id !== "#loginForm";
  }
  function showLogin() { $("#login").hidden = false; $("#app").hidden = true; $("#logout").hidden = true; $("#who").textContent = ""; }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#senha").value;
    const err = $("#loginErr");
    if (!email || !password) { err.textContent = "Informe o e-mail e a senha."; err.hidden = false; return; }
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Entrando…"; err.hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = "Entrar";
    if (error) {
      err.textContent = /invalid/i.test(error.message) ? "E-mail ou senha incorretos. Confira e tente de novo, ou toque em \"Esqueci minha senha\"."
        : /confirm/i.test(error.message) ? "Este e-mail ainda não foi confirmado. Abra o e-mail de confirmação e tente de novo."
        : "Não foi possível entrar agora. Verifique a internet e tente de novo.";
      err.hidden = false; $("#senha").select(); return;
    }
    $("#senha").value = "";
  });
  ["#email", "#senha"].forEach((s) => $(s).addEventListener("input", () => ($("#loginErr").hidden = true)));
  $("#forgot").onclick = () => { $("#remail").value = $("#email").value; $("#resetOk").hidden = true; $("#resetErr").hidden = true; showForm("#resetForm"); $("#remail").focus(); };
  $("#backLogin").onclick = () => { showForm("#loginForm"); $("#email").focus(); };
  $("#resetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#remail").value.trim();
    if (!email) { $("#resetErr").textContent = "Informe o e-mail cadastrado."; $("#resetErr").hidden = false; return; }
    const btn = $("#resetBtn"); btn.disabled = true; $("#resetErr").hidden = true;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    btn.disabled = false;
    if (error) { $("#resetErr").textContent = "Não foi possível enviar agora. Aguarde um minuto e tente de novo."; $("#resetErr").hidden = false; return; }
    $("#resetOk").textContent = "Se o e-mail estiver cadastrado, você vai receber um link em alguns minutos. Abra o link para criar a nova senha.";
    $("#resetOk").hidden = false;
  });
  $("#newPassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("#npass").value, b = $("#npass2").value, err = $("#npErr");
    if (a.length < 8) { err.textContent = "A senha precisa ter pelo menos 8 caracteres."; err.hidden = false; return; }
    if (a !== b) { err.textContent = "As duas senhas não são iguais."; err.hidden = false; return; }
    const btn = $("#npBtn"); btn.disabled = true; err.hidden = true;
    const { error } = await sb.auth.updateUser({ password: a });
    btn.disabled = false;
    if (error) { err.textContent = "Não foi possível salvar a senha. Peça um novo link e tente de novo."; err.hidden = false; return; }
    recovering = false; $("#npass").value = $("#npass2").value = "";
    toast("Senha alterada."); enterApp();
  });
  $("#logout").onclick = async () => { await sb.auth.signOut(); showForm("#loginForm"); showLogin(); };

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { recovering = true; showLogin(); showForm("#newPassForm"); $("#npass").focus(); return; }
    if (recovering) return;
    if (session) enterApp(); else showLogin();
  });

  /* ---------- carregar dados ---------- */
  let entering = false;
  async function enterApp() {
    if (entering || !$("#app").hidden) return; entering = true;
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { showLogin(); return; }
      const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adm) {
        await sb.auth.signOut(); showLogin(); showForm("#loginForm");
        $("#loginErr").textContent = "Esta conta não tem permissão para alterar o site."; $("#loginErr").hidden = false; return;
      }
      const cat = await (await fetch("data/catalogo.json?t=" + Date.now(), { cache: "no-store" })).json();
      SETORES = cat.SETORES;
      await reload();
      $("#who").textContent = user.email; $("#logout").hidden = false;
      $("#login").hidden = true; $("#app").hidden = false;
      $("#fs").innerHTML = `<option value="">Todos os setores</option>` + SETORES.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join("");
      render();
    } catch (e) {
      showLogin(); $("#loginErr").textContent = "Não foi possível carregar o painel. Verifique a internet e tente de novo."; $("#loginErr").hidden = false;
    } finally { entering = false; }
  }
  async function reload() {
    const [p, b] = await Promise.all([
      sb.from("produtos").select("*").order("ordem").order("nome"),
      sb.from("promocoes").select("*").order("ordem")
    ]);
    if (p.error || b.error) throw p.error || b.error;
    PRODUTOS = p.data.map((x) => ({ ...x, preco: x.preco == null ? null : Number(x.preco), de: x.de == null ? null : Number(x.de) }));
    PROMOCOES = b.data;
  }

  /* ---------- salvar no banco ---------- */
  let sbTimer;
  function status(text, bad) {
    const el = $("#savebar"); el.textContent = text; el.className = "savebar" + (bad ? " bad" : ""); el.hidden = false;
    clearTimeout(sbTimer); if (!/…$/.test(text)) sbTimer = setTimeout(() => (el.hidden = true), bad ? 6000 : 2600);
  }
  const failMsg = (e) => (e && (e.code === "42501" || /row-level|permission|policy/i.test(e.message || "")) ? "Sua conta não tem permissão para salvar. Entre de novo." : e && /JWT|token/i.test(e.message || "") ? "Sua sessão expirou. Saia e entre de novo." : "Não foi possível salvar. Verifique a internet e tente de novo.");
  async function saveRow(table, row) {
    status("Salvando…");
    const { error } = await sb.from(table).upsert({ ...row, atualizado_em: new Date().toISOString() });
    if (error) { status(failMsg(error), true); return false; }
    status("Salvo. Já está no site."); return true;
  }
  async function removeRow(table, id) {
    status("Excluindo…");
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) { status(failMsg(error), true); return false; }
    status("Excluído do site."); return true;
  }

  /* ---------- produtos ---------- */
  const setor = (id) => SETORES.find((s) => s.id === id) || { nome: id, nichos: [] };
  const nichoNome = (p) => { const n = setor(p.setor).nichos.find((x) => x.id === p.nicho); return n ? n.nome : ""; };
  function renderProducts() {
    const q = $("#fq").value.trim().toLowerCase(), fs = $("#fs").value;
    const list = PRODUTOS.filter((p) => (!fs || p.setor === fs) && (!q || (p.nome + " " + p.marca).toLowerCase().includes(q)));
    $("#nProd").textContent = "(" + PRODUTOS.length + ")";
    if (!list.length) { $("#prodList").innerHTML = `<div class="empty"><h3>Nenhum produto encontrado</h3><p>Mude a busca ou cadastre um produto novo.</p></div>`; return; }
    let html = "";
    SETORES.forEach((s) => {
      const items = list.filter((p) => p.setor === s.id); if (!items.length) return;
      html += `<h2 class="group-title">${esc(s.nome)}</h2>` + items.map((p) => `
        <div class="row${p.ativo === false ? " off" : ""}" data-id="${p.id}">
          <img src="${esc(imgUrl(p.imagem))}" alt="" loading="lazy">
          <div class="rinfo"><b>${esc(p.nome)}</b><small>${esc(nichoNome(p))} · ${esc(p.peso)}</small>
            <div class="badges">${p.ativo === false ? `<span class="badge grey">Oculto</span>` : ""}${p.de ? `<span class="badge red">Oferta</span>` : ""}${p.destaque ? `<span class="badge">Destaque</span>` : ""}</div></div>
          <div class="rprice"><label class="sr" for="pr-${p.id}">Preço de ${esc(p.nome)}</label><span>R$</span><input id="pr-${p.id}" inputmode="decimal" placeholder="Consultar" value="${p.preco != null ? brl(p.preco) : ""}" data-price="${p.id}"></div>
          <button class="edit-btn" type="button" data-edit="${p.id}">Editar</button></div>`).join("");
    });
    $("#prodList").innerHTML = html;
  }
  $("#fq").addEventListener("input", renderProducts);
  $("#fs").addEventListener("change", renderProducts);
  $("#prodList").addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-price]"); if (!inp) return;
    const p = PRODUTOS.find((x) => x.id === inp.dataset.price);
    const v = parseMoney(inp.value);
    if (Number.isNaN(v)) { inp.classList.add("bad"); status("Preço inválido. Use, por exemplo, 49,90", true); return; }
    inp.classList.remove("bad");
    const row = { ...p, preco: v };
    if (row.de != null && v != null && row.de <= v) row.de = null;
    const el = inp.closest(".row"); el.classList.add("saving");
    if (await saveRow("produtos", row)) Object.assign(p, row);
    else inp.value = p.preco != null ? brl(p.preco) : "";
    el.classList.remove("saving"); renderProducts();
  });
  $("#prodList").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) openProduct(b.dataset.edit); });
  $("#newProd").onclick = () => openProduct(null);

  let edImage = null;
  function nichoOptions(s, cur) { return s.nichos.map((n) => `<option value="${n.id}"${n.id === cur ? " selected" : ""}>${esc(n.nome)}</option>`).join(""); }
  function openProduct(id) {
    const p = id ? PRODUTOS.find((x) => x.id === id) : { ativo: true, setor: $("#fs").value || SETORES[0].id, nicho: "", marca: "", nome: "", info: "", peso: "", preco: null, imagem: "" };
    edImage = null;
    $("#edTitle").textContent = id ? "Editar produto" : "Novo produto";
    $("#edForm").innerHTML = `
      <div class="field"><span style="font-weight:800;font-size:.88rem">Foto</span>
        <div class="ed-img"><img id="edPic" src="${p.imagem ? esc(imgUrl(p.imagem)) : ""}" alt="" ${p.imagem ? "" : "hidden"}>
          <div style="display:grid;gap:6px"><span class="btn btn-line file">${p.imagem ? "Trocar foto" : "Escolher foto"}<input type="file" id="edFile" accept="image/*" aria-label="Escolher foto do produto"></span>
          <p class="hint">Use uma foto de frente, com fundo branco. Ela é ajustada sozinha para o formato quadrado.</p><p class="err" id="eFile" hidden></p></div></div></div>
      <div class="field"><label for="eNome">Nome do produto</label><input id="eNome" value="${esc(p.nome)}" placeholder="Ex.: Ração Golden Cães Adultos"><p class="err" id="eNomeErr" hidden>Informe o nome do produto.</p></div>
      <div class="two">
        <div class="field"><label for="eMarca">Marca</label><input id="eMarca" value="${esc(p.marca)}" placeholder="Ex.: Premier"></div>
        <div class="field"><label for="ePeso">Tamanho ou peso</label><input id="ePeso" value="${esc(p.peso)}" placeholder="Ex.: 15 kg"></div>
      </div>
      <div class="two">
        <div class="field"><label for="eSetor">Setor</label><select id="eSetor">${SETORES.map((x) => `<option value="${x.id}"${x.id === p.setor ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        <div class="field"><label for="eNicho">Tipo</label><select id="eNicho">${nichoOptions(setor(p.setor), p.nicho)}</select></div>
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
    foot(id ? "Salvar alterações" : "Adicionar produto", id ? "Excluir produto" : null);
    $("#edForm").dataset.kind = "produto"; $("#edForm").dataset.id = id || "";
    $("#eSetor").onchange = () => { $("#eNicho").innerHTML = nichoOptions(setor($("#eSetor").value), ""); };
    $("#edFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; $("#eFile").hidden = true;
      try { edImage = await processImage(f); $("#edPic").src = edImage.url; $("#edPic").hidden = false; }
      catch (err) { $("#eFile").textContent = "Não foi possível abrir essa imagem. Tente uma foto em JPG ou PNG."; $("#eFile").hidden = false; }
    };
    openEditor();
  }
  async function saveProduct() {
    const id = $("#edForm").dataset.id, nome = $("#eNome").value.trim();
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

    const btn = $("#edFoot [data-ed=save]"); btn.disabled = true; btn.textContent = "Salvando…";
    const old = id ? PRODUTOS.find((x) => x.id === id) : null;
    const pid = id || uniqueId(slug(nome), PRODUTOS);
    const opc = $("#eOpc").value.split(",").map((x) => x.trim()).filter(Boolean);
    const row = {
      id: pid, setor: $("#eSetor").value, nicho: $("#eNicho").value, marca: $("#eMarca").value.trim(), nome,
      info: $("#eInfo").value.trim(), peso: $("#ePeso").value.trim() || "Unidade", preco, de,
      opcoes: opc.length ? opc : null, tags: $("#eTags").value.trim() || null,
      destaque: $("#eDest").checked, ativo: $("#eAtivo").checked,
      imagem: old ? old.imagem : "", ordem: old ? old.ordem : PRODUTOS.length
    };
    if (edImage) {
      status("Enviando foto…");
      const path = `${pid}-${Date.now().toString(36)}.${edImage.ext}`;
      const up = await sb.storage.from("produtos").upload(path, edImage.blob, { contentType: edImage.blob.type, cacheControl: "31536000", upsert: false });
      if (up.error) { status(failMsg(up.error), true); btn.disabled = false; btn.textContent = id ? "Salvar alterações" : "Adicionar produto"; return; }
      row.imagem = sb.storage.from("produtos").getPublicUrl(path).data.publicUrl;
    }
    if (await saveRow("produtos", row)) {
      if (old) Object.assign(old, row); else PRODUTOS.push(row);
      closeEditor(); render();
    } else { btn.disabled = false; btn.textContent = id ? "Salvar alterações" : "Adicionar produto"; }
  }
  function uniqueId(base, list) { let id = base, i = 2; while (list.some((p) => p.id === id)) id = base + "-" + i++; return id; }

  async function processImage(file) {
    const bm = await createImageBitmap(file);
    const S = 600, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    const k = Math.min(S / bm.width, S / bm.height) * 0.92, w = bm.width * k, h = bm.height * k;
    x.imageSmoothingQuality = "high"; x.drawImage(bm, (S - w) / 2, (S - h) / 2, w, h);
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85)), ext = "webp";
    if (!blob || blob.type !== "image/webp") { blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88)); ext = "jpg"; }
    return { blob, ext, url: URL.createObjectURL(blob) };
  }

  /* ---------- promoções ---------- */
  function renderPromos() {
    $("#nPromo").textContent = "(" + PROMOCOES.length + ")";
    if (!PROMOCOES.length) { $("#promoList").innerHTML = `<div class="empty"><h3>Nenhuma promoção cadastrada</h3><p>Crie uma promoção para ela aparecer no topo da página inicial.</p></div>`; return; }
    $("#promoList").innerHTML = PROMOCOES.map((b, i) => `
      <div class="prow${b.ativo === false ? " off" : ""}">
        <button type="button" class="promo-card ${b.cor === "verde" ? "soft" : "sun"}" data-pedit="${b.id}" style="border:0;text-align:left;cursor:pointer;font:inherit" aria-label="Editar promoção ${esc(b.titulo)}">
          <div class="burst" aria-hidden="true"><div><small>${esc(b.selo_topo)}</small><span>${esc(b.selo_valor)}</span></div></div>
          <div><h3>${esc(b.titulo)}</h3>${b.texto ? `<p>${esc(b.texto)}</p>` : ""}<p class="badges">${b.ativo === false ? `<span class="badge grey">Oculta</span>` : ""}${b.produto && PRODUTOS.some((p) => p.id === b.produto) ? `<span class="badge">Leva ao produto</span>` : ""}</p></div>
        </button>
        <div class="pctl"><button class="mini" type="button" data-up="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button><button class="mini" type="button" data-down="${i}" aria-label="Descer" ${i === PROMOCOES.length - 1 ? "disabled" : ""}>↓</button></div>
      </div>`).join("");
  }
  $("#promoList").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-pedit]"); if (ed) return openPromo(ed.dataset.pedit);
    const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-down]");
    const i = up ? +up.dataset.up : dn ? +dn.dataset.down : -1; if (i < 0) return;
    const j = up ? i - 1 : i + 1; const a = PROMOCOES; [a[i], a[j]] = [a[j], a[i]];
    a.forEach((b, k) => (b.ordem = k)); renderPromos();
    status("Salvando…");
    const { error } = await sb.from("promocoes").upsert(a.map((b) => ({ ...b, atualizado_em: new Date().toISOString() })));
    if (error) { status(failMsg(error), true); await reload(); render(); } else status("Ordem salva. Já está no site.");
  });
  $("#newPromo").onclick = () => openPromo(null);
  function openPromo(id) {
    const b = id ? PROMOCOES.find((x) => x.id === id) : { titulo: "", texto: "", selo_topo: "", selo_valor: "", produto: "", cor: "amarelo", ativo: true };
    $("#edTitle").textContent = id ? "Editar promoção" : "Nova promoção";
    $("#edForm").innerHTML = `
      <div class="field"><label for="pTitulo">Título</label><input id="pTitulo" value="${esc(b.titulo)}" placeholder="Ex.: Ração Golden 15 kg com 10% de desconto"><p class="err" id="pTituloErr" hidden>Informe o título da promoção.</p></div>
      <div class="field"><label for="pTexto">Detalhes (opcional)</label><textarea id="pTexto" placeholder="Ex.: Válido até sábado ou enquanto durar o estoque.">${esc(b.texto)}</textarea></div>
      <div class="two">
        <div class="field"><label for="pTopo">Selo: texto pequeno</label><input id="pTopo" maxlength="10" value="${esc(b.selo_topo)}" placeholder="Ex.: POR"></div>
        <div class="field"><label for="pValor">Selo: destaque</label><input id="pValor" maxlength="7" value="${esc(b.selo_valor)}" placeholder="Ex.: 12,99"></div>
      </div>
      <p class="hint">O selo é a estrela ao lado do título. Use textos curtos.</p>
      <fieldset class="field"><legend>Cor</legend><div class="seg">
        <input type="radio" name="pcor" id="pc-am" value="amarelo"${b.cor !== "verde" ? " checked" : ""}><label for="pc-am">Amarelo</label>
        <input type="radio" name="pcor" id="pc-vd" value="verde"${b.cor === "verde" ? " checked" : ""}><label for="pc-vd">Branco</label></div></fieldset>
      <div class="field"><label for="pProd">Produto da promoção (opcional)</label><select id="pProd"><option value="">Nenhum</option>${PRODUTOS.map((p) => `<option value="${p.id}"${p.id === b.produto ? " selected" : ""}>${esc(p.nome)}</option>`).join("")}</select><p class="hint">Ao tocar na promoção, o cliente vai direto para o produto. Ele também aparece em "Produtos em oferta".</p></div>
      <div class="toggles"><label class="check"><input type="checkbox" id="pAtivo"${b.ativo !== false ? " checked" : ""}> Mostrar no site</label></div>`;
    foot(id ? "Salvar alterações" : "Adicionar promoção", id ? "Excluir promoção" : null);
    $("#edForm").dataset.kind = "promo"; $("#edForm").dataset.id = id || "";
    openEditor();
  }
  async function savePromo() {
    const id = $("#edForm").dataset.id, titulo = $("#pTitulo").value.trim();
    $("#pTituloErr").hidden = !!titulo; if (!titulo) { $("#pTitulo").focus(); return; }
    const old = id ? PROMOCOES.find((x) => x.id === id) : null;
    const row = {
      id: id || uniqueId(slug(titulo), PROMOCOES), titulo, texto: $("#pTexto").value.trim(),
      selo_topo: $("#pTopo").value.trim().toUpperCase(), selo_valor: $("#pValor").value.trim(),
      produto: $("#pProd").value || null, cor: document.querySelector('input[name="pcor"]:checked').value,
      ativo: $("#pAtivo").checked, ordem: old ? old.ordem : -1
    };
    const btn = $("#edFoot [data-ed=save]"); btn.disabled = true; btn.textContent = "Salvando…";
    if (await saveRow("promocoes", row)) {
      if (old) Object.assign(old, row); else PROMOCOES.unshift(row);
      closeEditor(); render();
    } else { btn.disabled = false; btn.textContent = id ? "Salvar alterações" : "Adicionar promoção"; }
  }

  /* ---------- gaveta de edição ---------- */
  function foot(saveLabel, delLabel) {
    $("#edFoot").innerHTML = `<button class="btn btn-line" type="button" data-ed="cancel">Cancelar</button><button class="btn btn-green" type="button" data-ed="save">${saveLabel}</button>${delLabel ? `<button class="btn btn-danger full" type="button" data-ed="del">${delLabel}</button>` : ""}`;
  }
  function askDelete() {
    const f = $("#edFoot"); if (f.querySelector(".confirm")) return;
    const kind = $("#edForm").dataset.kind, name = kind === "produto" ? $("#eNome").value.trim() : $("#pTitulo").value.trim();
    f.insertAdjacentHTML("beforeend", `<div class="confirm" role="alert"><p>Excluir “${esc(name)}”? ${kind === "produto" ? "O produto sai do site na hora. Se quiser só esconder, desmarque “Mostrar no site”." : "A promoção sai do site na hora."}</p><div><button class="btn btn-danger solid" type="button" data-ed="delok">Excluir</button><button class="btn btn-line" type="button" data-ed="delno">Manter</button></div></div>`);
    f.querySelector("[data-ed=delno]").focus();
  }
  async function doDelete() {
    const kind = $("#edForm").dataset.kind, id = $("#edForm").dataset.id;
    if (kind === "produto") {
      if (!(await removeRow("produtos", id))) return;
      PRODUTOS = PRODUTOS.filter((x) => x.id !== id);
    } else {
      if (!(await removeRow("promocoes", id))) return;
      PROMOCOES = PROMOCOES.filter((x) => x.id !== id);
    }
    closeEditor(); render();
  }
  let lastFocus = null;
  function openEditor() {
    lastFocus = document.activeElement;
    const d = $("#editor"); d.classList.add("open"); d.removeAttribute("inert"); d.setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("on"); document.body.style.overflow = "hidden"; $("#edForm").scrollTop = 0;
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
    const a = e.target.closest("[data-ed]"); if (!a || a.disabled) return;
    const kind = $("#edForm").dataset.kind;
    ({ cancel: closeEditor, save: kind === "produto" ? saveProduct : savePromo, del: askDelete, delok: doDelete, delno: () => { const c = $("#edFoot .confirm"); if (c) c.remove(); } })[a.dataset.ed]();
  });

  /* ---------- abas ---------- */
  function setView(v) {
    view = v;
    $("#tab-produtos").setAttribute("aria-selected", v === "produtos"); $("#tab-promos").setAttribute("aria-selected", v === "promos");
    $("#view-produtos").hidden = v !== "produtos"; $("#view-promos").hidden = v !== "promos";
  }
  $("#tab-produtos").onclick = () => setView("produtos");
  $("#tab-promos").onclick = () => setView("promos");
  function render() { renderProducts(); renderPromos(); }

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2400); }
})();
