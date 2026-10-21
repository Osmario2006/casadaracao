/* Painel da loja — login por e-mail e senha + verificação em duas etapas (Supabase Auth).
   Produtos e promoções ficam no banco; fotos no Storage. Cada alteração salva na hora e já aparece no site.
   Quem pode alterar é decidido pelo BANCO (tabela admins + regras em supabase/*.sql), nunca só por este arquivo. */
(function () {
  "use strict";
  // não deixa o painel ser aberto dentro de outro site (clickjacking)
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; window.top.location.replace(window.location.href); return; }

  const cfg = window.CDR_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MAX_PRECO = 99999.99;
  const parseMoney = (s) => {
    s = String(s || "").trim().replace(/[R$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    const n = Number(s);
    return n >= 0 && n <= MAX_PRECO ? Math.round(n * 100) / 100 : NaN;
  };
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
  const STORAGE_IMG = new RegExp("^" + (cfg.SUPABASE_URL || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/storage/v1/object/public/produtos/[A-Za-z0-9._-]+$");
  const imgUrl = (v) => (STORAGE_IMG.test(v || "") ? v : /^[A-Za-z0-9._-]+$/.test(v || "") ? "img/" + v : "");
  const LIM = { nome: 120, marca: 60, info: 200, peso: 40, tags: 300, opcao: 40, opcoes: 12, titulo: 120, texto: 300, seloTopo: 10, seloValor: 7 };
  const senhaForte = (s) => s.length >= 12 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    $("#loginForm").hidden = true; $("#cfgErr").hidden = false; return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  let SETORES = [], PRODUTOS = [], PROMOCOES = [], recovering = false, appOn = false, lastFocus = null, idleT = null;

  /* ================= entrada ================= */
  const FORMS = ["#loginForm", "#mfaForm", "#resetForm", "#newPassForm"];
  const TITLES = { "#loginForm": "Entrar no painel", "#mfaForm": "Verificação em duas etapas", "#resetForm": "Recuperar senha", "#newPassForm": "Criar nova senha" };
  function showForm(id) {
    FORMS.forEach((f) => ($(f).hidden = f !== id));
    $("#loginTitle").textContent = TITLES[id];
    $("#loginLead").hidden = id !== "#loginForm";
    const first = $(id).querySelector("input"); if (first) setTimeout(() => first.focus(), 30);
  }
  function showLogin(form) {
    appOn = false; stopIdle();
    $("#login").hidden = false; $("#app").hidden = true; $("#logout").hidden = true; $("#who").textContent = "";
    closeEditor(true); showForm(form || "#loginForm");
  }
  const errBox = (sel, msg) => { const e = $(sel); e.textContent = msg; e.hidden = !msg; };

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#senha").value;
    if (!email || !password) return errBox("#loginErr", "Informe o e-mail e a senha.");
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Entrando…"; errBox("#loginErr", "");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = "Entrar"; $("#senha").value = "";
    if (error) {
      errBox("#loginErr", /invalid/i.test(error.message) ? "E-mail ou senha incorretos. Confira e tente de novo, ou toque em \"Esqueci minha senha\"."
        : /rate|too many/i.test(error.message) ? "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."
        : /confirm/i.test(error.message) ? "Este e-mail ainda não foi confirmado."
        : "Não foi possível entrar agora. Verifique a internet e tente de novo.");
      return;
    }
    route();
  });
  ["#email", "#senha"].forEach((s) => $(s).addEventListener("input", () => errBox("#loginErr", "")));
  $("#forgot").onclick = () => { $("#remail").value = $("#email").value; $("#resetOk").hidden = true; errBox("#resetErr", ""); showForm("#resetForm"); };
  $("#backLogin").onclick = () => showForm("#loginForm");
  $("#resetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#remail").value.trim();
    if (!email) return errBox("#resetErr", "Informe o e-mail cadastrado.");
    const btn = $("#resetBtn"); btn.disabled = true; errBox("#resetErr", "");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    btn.disabled = false;
    if (error && /rate|too many/i.test(error.message)) return errBox("#resetErr", "Muitos pedidos seguidos. Aguarde alguns minutos.");
    // mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados
    $("#resetOk").textContent = "Se o e-mail estiver cadastrado, você vai receber um link em alguns minutos. Abra o link para criar a nova senha.";
    $("#resetOk").hidden = false;
  });

  async function trocarSenha(a, b, errSel, btn) {
    if (!senhaForte(a)) { errBox(errSel, "A senha precisa ter pelo menos 12 caracteres, com letra maiúscula, minúscula, número e símbolo."); return false; }
    if (a !== b) { errBox(errSel, "As duas senhas não são iguais."); return false; }
    btn.disabled = true; errBox(errSel, "");
    const { error } = await sb.auth.updateUser({ password: a });
    btn.disabled = false;
    if (error) {
      errBox(errSel, /aal2|mfa|assurance/i.test(error.message) ? "Confirme o código de verificação antes de trocar a senha. Saia e entre de novo."
        : /weak|password/i.test(error.message) ? "Essa senha não atende às regras de segurança. Escolha outra."
        : "Não foi possível salvar a senha. Tente de novo.");
      return false;
    }
    return true;
  }
  $("#newPassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await trocarSenha($("#npass").value, $("#npass2").value, "#npErr", $("#npBtn"))) {
      $("#npass").value = $("#npass2").value = ""; recovering = false; toast("Senha alterada."); route();
    }
  });
  $("#chgForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await trocarSenha($("#cpass").value, $("#cpass2").value, "#chgErr", $("#chgBtn"))) {
      $("#cpass").value = $("#cpass2").value = ""; status("Senha alterada.");
    }
  });

  /* ---------- verificação em duas etapas no login ---------- */
  $("#mfaCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); errBox("#mfaErr", ""); });
  $("#mfaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("#mfaCode").value;
    if (!/^\d{6}$/.test(code)) return errBox("#mfaErr", "Digite os 6 números do app autenticador.");
    const btn = $("#mfaBtn"); btn.disabled = true;
    const f = await sb.auth.mfa.listFactors();
    const totp = f.data && f.data.totp.find((x) => x.status === "verified");
    if (!totp) { btn.disabled = false; return recovering ? showForm("#newPassForm") : route(); }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
    btn.disabled = false; $("#mfaCode").value = "";
    if (error) return errBox("#mfaErr", /rate|too many/i.test(error.message) ? "Muitas tentativas. Aguarde um pouco." : "Código incorreto ou expirado. Confira o horário do celular e digite o código atual.");
    if (recovering) return showForm("#newPassForm");
    route();
  });
  $("#mfaCancel").onclick = async () => { recovering = false; await sb.auth.signOut(); showLogin(); };

  /* ---------- decide o que mostrar ---------- */
  let routing = false;
  async function route() {
    if (recovering || routing) return; routing = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return showLogin();
      const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data && aal.data.nextLevel === "aal2" && aal.data.currentLevel !== "aal2") { showLogin("#mfaForm"); return; }
      await enterApp();
    } finally { routing = false; }
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      // com 2FA ativa, o Supabase exige o código antes de trocar a senha
      setTimeout(async () => {
        const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        showLogin(aal.data && aal.data.nextLevel === "aal2" && aal.data.currentLevel !== "aal2" ? "#mfaForm" : "#newPassForm");
      }, 0);
      return;
    }
    if (event === "SIGNED_OUT") { recovering = false; showLogin(); return; }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") setTimeout(route, 0);
  });
  $("#logout").onclick = async () => { await sb.auth.signOut(); };

  /* ================= painel ================= */
  async function enterApp() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return showLogin();
    const { data: adm, error: aerr } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (aerr || !adm) {
      await sb.auth.signOut(); showLogin();
      return errBox("#loginErr", "Esta conta não tem permissão para alterar o site.");
    }
    if (appOn) return;
    try {
      const cat = await (await fetch("data/catalogo.json?t=" + Date.now(), { cache: "no-store" })).json();
      SETORES = cat.SETORES;
      await reload();
    } catch (e) { showLogin(); return errBox("#loginErr", "Não foi possível carregar o painel. Verifique a internet e tente de novo."); }
    appOn = true;
    $("#who").textContent = user.email; $("#logout").hidden = false;
    $("#login").hidden = true; $("#app").hidden = false;
    $("#fs").innerHTML = `<option value="">Todos os setores</option>` + SETORES.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join("");
    render(); startIdle(); refreshMfaBanner();
  }
  async function reload() {
    const [p, b] = await Promise.all([
      sb.from("produtos").select("*").order("ordem").order("nome"),
      sb.from("promocoes").select("*").order("ordem")
    ]);
    if (p.error || b.error) throw p.error || b.error;
    PRODUTOS = p.data.filter((x) => SAFE_ID.test(x.id)).map((x) => ({ ...x, preco: x.preco == null ? null : Number(x.preco), de: x.de == null ? null : Number(x.de) }));
    PROMOCOES = b.data.filter((x) => SAFE_ID.test(x.id));
  }

  /* ---------- saída por inatividade (30 min) ---------- */
  const IDLE_MS = 30 * 60 * 1000;
  const bump = () => { if (!appOn) return; clearTimeout(idleT); idleT = setTimeout(async () => { await sb.auth.signOut(); errBox("#loginErr", "Saímos do painel por segurança depois de 30 minutos sem uso. Entre de novo."); }, IDLE_MS); };
  function startIdle() { ["click", "keydown", "pointermove", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, bump, { passive: true })); bump(); }
  function stopIdle() { clearTimeout(idleT); }

  /* ---------- salvar ---------- */
  let sbTimer;
  function status(text, bad) {
    const el = $("#savebar"); el.textContent = text; el.className = "savebar" + (bad ? " bad" : ""); el.hidden = false;
    clearTimeout(sbTimer); if (!/…$/.test(text)) sbTimer = setTimeout(() => (el.hidden = true), bad ? 7000 : 2600);
  }
  const failMsg = (e) => {
    const m = (e && e.message) || "", c = e && e.code;
    if (c === "23514" || c === "22001") return "Algum campo está fora do permitido (texto longo demais ou valor inválido). Confira e tente de novo.";
    if (c === "23505") return "Já existe um item com esse identificador. Mude o nome e tente de novo.";
    if (c === "23503") return "O produto ligado a esta promoção não existe mais.";
    if (c === "42501" || /row-level|permission|policy/i.test(m)) return "Sem permissão para salvar. Saia e entre de novo, com o código de verificação se ele estiver ativo.";
    if (/JWT|token|expired/i.test(m)) return "Sua sessão expirou. Saia e entre de novo.";
    if (/size|too large|413/i.test(m)) return "A foto é grande demais. Use uma imagem menor.";
    if (/mime|type/i.test(m)) return "Formato de foto não aceito. Use JPG, PNG ou WebP.";
    return "Não foi possível salvar. Verifique a internet e tente de novo.";
  };
  async function saveRow(table, row) {
    status("Salvando…");
    const { atualizado_em, ...clean } = row;
    const { error } = await sb.from(table).upsert(clean);
    if (error) { status(failMsg(error), true); return false; }
    status("Salvo. Já está no site."); return true;
  }
  async function removeRow(table, id) {
    status("Excluindo…");
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) { status(failMsg(error), true); return false; }
    status("Excluído do site."); return true;
  }

  /* ================= produtos ================= */
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
      html += `<h2 class="group-title">${esc(s.nome)}</h2>` + items.map((p) => {
        const id = esc(p.id);
        return `<div class="row${p.ativo === false ? " off" : ""}" data-id="${id}">
          <img src="${esc(imgUrl(p.imagem))}" alt="" loading="lazy">
          <div class="rinfo"><b>${esc(p.nome)}</b><small>${esc(nichoNome(p))} · ${esc(p.peso)}</small>
            <div class="badges">${p.ativo === false ? `<span class="badge grey">Oculto</span>` : ""}${p.de ? `<span class="badge red">Oferta</span>` : ""}${p.destaque ? `<span class="badge">Destaque</span>` : ""}</div></div>
          <div class="rprice"><label class="sr" for="pr-${id}">Preço de ${esc(p.nome)}</label><span>R$</span><input id="pr-${id}" inputmode="decimal" maxlength="9" placeholder="Consultar" value="${p.preco != null ? brl(p.preco) : ""}" data-price="${id}"></div>
          <button class="edit-btn" type="button" data-edit="${id}">Editar</button></div>`;
      }).join("");
    });
    $("#prodList").innerHTML = html;
  }
  $("#fq").addEventListener("input", renderProducts);
  $("#fs").addEventListener("change", renderProducts);
  $("#prodList").addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-price]"); if (!inp) return;
    const p = PRODUTOS.find((x) => x.id === inp.dataset.price); if (!p) return;
    const v = parseMoney(inp.value);
    if (Number.isNaN(v)) { inp.classList.add("bad"); status("Preço inválido. Use, por exemplo, 49,90 (máximo 99.999,99).", true); return; }
    inp.classList.remove("bad");
    const row = { ...p, preco: v };
    if (row.de != null && (v == null || row.de <= v)) row.de = null;
    const el = inp.closest(".row"); el.classList.add("saving");
    if (await saveRow("produtos", row)) Object.assign(p, row);
    el.classList.remove("saving"); renderProducts();
  });
  $("#prodList").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) openProduct(b.dataset.edit); });
  $("#newProd").onclick = () => openProduct(null);

  let edImage = null;
  function nichoOptions(s, cur) { return s.nichos.map((n) => `<option value="${esc(n.id)}"${n.id === cur ? " selected" : ""}>${esc(n.nome)}</option>`).join(""); }
  function openProduct(id) {
    const p = id ? PRODUTOS.find((x) => x.id === id) : { ativo: true, setor: $("#fs").value || SETORES[0].id, nicho: "", marca: "", nome: "", info: "", peso: "", preco: null, imagem: "" };
    if (!p) return;
    edImage = null;
    $("#edTitle").textContent = id ? "Editar produto" : "Novo produto";
    const pic = imgUrl(p.imagem);
    $("#edForm").innerHTML = `
      <div class="field"><span style="font-weight:800;font-size:.88rem">Foto</span>
        <div class="ed-img"><img id="edPic" src="${esc(pic)}" alt="" ${pic ? "" : "hidden"}>
          <div style="display:grid;gap:6px"><span class="btn btn-line file">${pic ? "Trocar foto" : "Escolher foto"}<input type="file" id="edFile" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto do produto"></span>
          <p class="hint">JPG, PNG ou WebP. Use uma foto de frente, com fundo branco. Ela é ajustada sozinha para o formato quadrado.</p><p class="err" id="eFile" hidden></p></div></div></div>
      <div class="field"><label for="eNome">Nome do produto</label><input id="eNome" maxlength="${LIM.nome}" value="${esc(p.nome)}" placeholder="Ex.: Ração Golden Cães Adultos"><p class="err" id="eNomeErr" hidden>Informe o nome do produto.</p></div>
      <div class="two">
        <div class="field"><label for="eMarca">Marca</label><input id="eMarca" maxlength="${LIM.marca}" value="${esc(p.marca)}" placeholder="Ex.: Premier"></div>
        <div class="field"><label for="ePeso">Tamanho ou peso</label><input id="ePeso" maxlength="${LIM.peso}" value="${esc(p.peso)}" placeholder="Ex.: 15 kg"></div>
      </div>
      <div class="two">
        <div class="field"><label for="eSetor">Setor</label><select id="eSetor">${SETORES.map((x) => `<option value="${esc(x.id)}"${x.id === p.setor ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></div>
        <div class="field"><label for="eNicho">Tipo</label><select id="eNicho">${nichoOptions(setor(p.setor), p.nicho)}</select></div>
      </div>
      <div class="field"><label for="eInfo">Descrição curta</label><input id="eInfo" maxlength="${LIM.info}" value="${esc(p.info)}" placeholder="Ex.: Frango e arroz · Raças pequenas"></div>
      <div class="two">
        <div class="field"><label for="ePreco">Preço</label><div class="money"><span>R$</span><input id="ePreco" inputmode="decimal" maxlength="9" value="${p.preco != null ? brl(p.preco) : ""}" placeholder="Consultar"></div><p class="hint">Vazio mostra "Valor no WhatsApp".</p></div>
        <div class="field"><label for="eDe">Preço antigo (opcional)</label><div class="money"><span>R$</span><input id="eDe" inputmode="decimal" maxlength="9" value="${p.de != null ? brl(p.de) : ""}" placeholder="—"></div><p class="hint">Aparece riscado, com selo "Oferta".</p></div>
      </div>
      <p class="err" id="ePrecoErr" hidden></p>
      <div class="field"><label for="eOpc">Variações (opcional)</label><input id="eOpc" maxlength="400" value="${esc((p.opcoes || []).join(", "))}" placeholder="Ex.: Carne, Frango, Salmão"><p class="hint">Separe por vírgula. Até ${LIM.opcoes} variações de até ${LIM.opcao} letras.</p><p class="err" id="eOpcErr" hidden></p></div>
      <div class="field"><label for="eTags">Palavras para a busca (opcional)</label><input id="eTags" maxlength="${LIM.tags}" value="${esc(p.tags || "")}" placeholder="Ex.: racao cachorro filhote"></div>
      <div class="toggles">
        <label class="check"><input type="checkbox" id="eAtivo"${p.ativo !== false ? " checked" : ""}> Mostrar no site</label>
        <label class="check"><input type="checkbox" id="eDest"${p.destaque ? " checked" : ""}> Destaque na página inicial</label>
      </div>`;
    foot(id ? "Salvar alterações" : "Adicionar produto", id ? "Excluir produto" : null);
    $("#edForm").dataset.kind = "produto"; $("#edForm").dataset.id = id || "";
    $("#eSetor").onchange = () => { $("#eNicho").innerHTML = nichoOptions(setor($("#eSetor").value), ""); };
    $("#edFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; $("#eFile").hidden = true;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { $("#eFile").textContent = "Formato não aceito. Use JPG, PNG ou WebP."; $("#eFile").hidden = false; e.target.value = ""; return; }
      if (f.size > 15 * 1024 * 1024) { $("#eFile").textContent = "Essa foto passa de 15 MB. Escolha uma menor."; $("#eFile").hidden = false; e.target.value = ""; return; }
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
    if (Number.isNaN(preco) || Number.isNaN(de)) perr = "Confira os preços. Use, por exemplo, 49,90 (máximo 99.999,99).";
    else if (de != null && preco == null) perr = "Para usar preço antigo, informe também o preço atual.";
    else if (de != null && de <= preco) perr = "O preço antigo precisa ser maior que o preço atual.";
    $("#ePrecoErr").textContent = perr; $("#ePrecoErr").hidden = !perr;
    const opc = [...new Set($("#eOpc").value.split(",").map((x) => x.trim()).filter(Boolean))];
    const oerr = opc.length > LIM.opcoes ? `Use no máximo ${LIM.opcoes} variações.` : opc.some((o) => o.length > LIM.opcao) ? `Cada variação pode ter até ${LIM.opcao} letras.` : "";
    $("#eOpcErr").textContent = oerr; $("#eOpcErr").hidden = !oerr;
    const noImg = !id && !edImage;
    $("#eFile").textContent = "Escolha uma foto para o produto."; if (noImg) $("#eFile").hidden = false;
    if (!nome || perr || oerr || noImg) { (!nome ? $("#eNome") : perr ? $("#ePreco") : oerr ? $("#eOpc") : $("#edFile")).focus(); return; }

    const btn = $("#edFoot [data-ed=save]"); btn.disabled = true; btn.textContent = "Salvando…";
    const old = id ? PRODUTOS.find((x) => x.id === id) : null;
    const pid = id || uniqueId(slug(nome), PRODUTOS);
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
    // redesenhar no canvas descarta metadados da foto original (como localização GPS)
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85)), ext = "webp";
    if (!blob || blob.type !== "image/webp") { blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88)); ext = "jpg"; }
    return { blob, ext, url: URL.createObjectURL(blob) };
  }

  /* ================= promoções ================= */
  function renderPromos() {
    $("#nPromo").textContent = "(" + PROMOCOES.length + ")";
    if (!PROMOCOES.length) { $("#promoList").innerHTML = `<div class="empty"><h3>Nenhuma promoção cadastrada</h3><p>Crie uma promoção para ela aparecer no topo da página inicial.</p></div>`; return; }
    $("#promoList").innerHTML = PROMOCOES.map((b, i) => `
      <div class="prow${b.ativo === false ? " off" : ""}">
        <button type="button" class="promo-card ${b.cor === "verde" ? "soft" : "sun"}" data-pedit="${esc(b.id)}" style="border:0;text-align:left;cursor:pointer;font:inherit" aria-label="Editar promoção ${esc(b.titulo)}">
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
    const j = up ? i - 1 : i + 1; const a = PROMOCOES; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; a.forEach((b, k) => (b.ordem = k)); renderPromos();
    status("Salvando…");
    const { error } = await sb.from("promocoes").upsert(a.map(({ atualizado_em, ...b }) => b));
    if (error) { status(failMsg(error), true); await reload(); render(); } else status("Ordem salva. Já está no site.");
  });
  $("#newPromo").onclick = () => openPromo(null);
  function openPromo(id) {
    const b = id ? PROMOCOES.find((x) => x.id === id) : { titulo: "", texto: "", selo_topo: "", selo_valor: "", produto: "", cor: "amarelo", ativo: true };
    if (!b) return;
    $("#edTitle").textContent = id ? "Editar promoção" : "Nova promoção";
    $("#edForm").innerHTML = `
      <div class="field"><label for="pTitulo">Título</label><input id="pTitulo" maxlength="${LIM.titulo}" value="${esc(b.titulo)}" placeholder="Ex.: Ração Golden 15 kg com 10% de desconto"><p class="err" id="pTituloErr" hidden>Informe o título da promoção.</p></div>
      <div class="field"><label for="pTexto">Detalhes (opcional)</label><textarea id="pTexto" maxlength="${LIM.texto}" placeholder="Ex.: Válido até sábado ou enquanto durar o estoque.">${esc(b.texto)}</textarea></div>
      <div class="two">
        <div class="field"><label for="pTopo">Selo: texto pequeno</label><input id="pTopo" maxlength="${LIM.seloTopo}" value="${esc(b.selo_topo)}" placeholder="Ex.: POR"></div>
        <div class="field"><label for="pValor">Selo: destaque</label><input id="pValor" maxlength="${LIM.seloValor}" value="${esc(b.selo_valor)}" placeholder="Ex.: 12,99"></div>
      </div>
      <p class="hint">O selo é a estrela ao lado do título. Use textos curtos.</p>
      <fieldset class="field"><legend>Cor</legend><div class="seg">
        <input type="radio" name="pcor" id="pc-am" value="amarelo"${b.cor !== "verde" ? " checked" : ""}><label for="pc-am">Amarelo</label>
        <input type="radio" name="pcor" id="pc-vd" value="verde"${b.cor === "verde" ? " checked" : ""}><label for="pc-vd">Branco</label></div></fieldset>
      <div class="field"><label for="pProd">Produto da promoção (opcional)</label><select id="pProd"><option value="">Nenhum</option>${PRODUTOS.map((p) => `<option value="${esc(p.id)}"${p.id === b.produto ? " selected" : ""}>${esc(p.nome)}</option>`).join("")}</select><p class="hint">Ao tocar na promoção, o cliente vai direto para o produto. Ele também aparece em "Produtos em oferta".</p></div>
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
      produto: $("#pProd").value || null, cor: document.querySelector('input[name="pcor"]:checked').value === "verde" ? "verde" : "amarelo",
      ativo: $("#pAtivo").checked, ordem: old ? old.ordem : -1
    };
    const btn = $("#edFoot [data-ed=save]"); btn.disabled = true; btn.textContent = "Salvando…";
    if (await saveRow("promocoes", row)) {
      if (old) Object.assign(old, row); else PROMOCOES.unshift(row);
      closeEditor(); render();
    } else { btn.disabled = false; btn.textContent = id ? "Salvar alterações" : "Adicionar promoção"; }
  }

  /* ================= histórico ================= */
  const CAMPOS = { nome: "Nome", marca: "Marca", info: "Descrição", peso: "Peso", preco: "Preço", de: "Preço antigo", opcoes: "Variações", destaque: "Destaque", ativo: "Mostrar no site", imagem: "Foto", tags: "Busca", setor: "Setor", nicho: "Tipo", ordem: "Ordem", titulo: "Título", texto: "Detalhes", selo_topo: "Selo", selo_valor: "Selo", produto: "Produto", cor: "Cor" };
  const fmtVal = (k, v) => v == null ? "vazio" : (k === "preco" || k === "de") ? "R$ " + brl(v) : k === "imagem" ? "nova foto" : typeof v === "boolean" ? (v ? "sim" : "não") : Array.isArray(v) ? v.join(", ") : String(v);
  async function renderHist() {
    const box = $("#histList"); box.innerHTML = `<p class="muted">Carregando…</p>`;
    const { data, error } = await sb.from("auditoria").select("*").order("em", { ascending: false }).limit(100);
    if (error) { box.innerHTML = `<div class="empty"><h3>Histórico indisponível</h3><p>${error.code === "42P01" || /does not exist|schema cache/i.test(error.message) ? "O histórico começa a funcionar depois da atualização de segurança do banco." : "Não foi possível carregar agora. Toque em Atualizar."}</p></div>`; return; }
    if (!data.length) { box.innerHTML = `<div class="empty"><h3>Nenhuma alteração ainda</h3><p>Cada mudança de preço, foto, produto ou promoção vai aparecer aqui.</p></div>`; return; }
    box.innerHTML = data.map((h) => {
      const a = h.antes || {}, d = h.depois || {}, nome = d.nome || d.titulo || a.nome || a.titulo || h.registro;
      const acao = h.acao === "INSERT" ? ["Criado", "blue"] : h.acao === "DELETE" ? ["Excluído", "red"] : ["Alterado", "sun"];
      const mud = h.acao === "UPDATE" ? Object.keys(CAMPOS).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k])) : [];
      const quando = new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
      return `<div class="hrow"><div class="hhead"><span class="badge ${acao[1]}">${acao[0]}</span><b>${esc(nome)}</b><span class="muted small">${h.tabela === "promocoes" ? "Promoção" : "Produto"}</span></div>
        <div class="hhead"><time>${esc(quando)}</time><span class="by">por ${esc(h.email || "sistema")}</span></div>
        ${mud.length ? `<div class="diff">${mud.map((k) => `${esc(CAMPOS[k])}: <s>${esc(fmtVal(k, a[k]))}</s> → <ins>${esc(fmtVal(k, d[k]))}</ins>`).join(" · ")}</div>` : ""}</div>`;
    }).join("");
  }
  $("#histReload").onclick = renderHist;

  /* ================= segurança ================= */
  let enrolling = null;
  async function renderSec() {
    const box = $("#mfaBox"); box.innerHTML = `<p class="muted">Carregando…</p>`;
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) { box.innerHTML = `<p class="err">Não foi possível consultar agora. Tente de novo.</p>`; return; }
    const ok = data.totp.find((f) => f.status === "verified");
    if (ok) {
      box.innerHTML = `<p class="mfa-on"><i></i>Ativa desde ${esc(new Date(ok.created_at).toLocaleDateString("pt-BR"))}</p>
        <p class="muted small">Ao entrar, o painel pede a senha e o código do app autenticador. Se trocar de celular, desative aqui e ative de novo no aparelho novo.</p>
        <div id="mfaOffBox"><button class="btn btn-danger" type="button" id="mfaOff">Desativar verificação em duas etapas</button></div>`;
      $("#mfaOff").onclick = () => {
        $("#mfaOffBox").innerHTML = `<div class="confirm" role="alert"><p>Desativar deixa o painel protegido só pela senha. Tem certeza?</p><div><button class="btn btn-danger solid" type="button" id="mfaOffOk">Desativar</button><button class="btn btn-line" type="button" id="mfaOffNo">Manter ativa</button></div></div>`;
        $("#mfaOffNo").onclick = renderSec;
        $("#mfaOffOk").onclick = async () => {
          const r = await sb.auth.mfa.unenroll({ factorId: ok.id });
          if (r.error) { status("Não foi possível desativar. Saia, entre com o código e tente de novo.", true); return; }
          await sb.auth.refreshSession(); status("Verificação em duas etapas desativada."); renderSec(); refreshMfaBanner();
        };
      };
      return;
    }
    box.innerHTML = `<p class="muted">Além da senha, o painel vai pedir um código de 6 números que muda a cada 30 segundos no seu celular.</p>
      <ol class="steps-list"><li>Instale um app autenticador no celular (Google Authenticator, Microsoft Authenticator ou similar).</li><li>Toque em "Começar" e escaneie o QR code com o app.</li><li>Digite o código que aparecer no app para confirmar.</li></ol>
      <button class="btn btn-green" type="button" id="mfaStart">Começar</button>`;
    $("#mfaStart").onclick = startEnroll;
  }
  async function startEnroll() {
    const box = $("#mfaBox"); box.innerHTML = `<p class="muted">Gerando QR code…</p>`;
    // remove tentativas anteriores que não foram concluídas
    const f = await sb.auth.mfa.listFactors();
    for (const x of ((f.data && f.data.all) || []).filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Painel Casa da Ração " + Date.now().toString(36) });
    if (error) { box.innerHTML = `<p class="err">Não foi possível iniciar a ativação. Saia, entre de novo e tente outra vez.</p>`; return; }
    enrolling = data.id;
    const qr = /^data:image\/svg\+xml/.test(data.totp.qr_code) ? data.totp.qr_code : "";
    box.innerHTML = `<div class="qr"><img alt="QR code para o app autenticador" src="${esc(qr)}">
        <div><p style="margin:0 0 8px"><b>1.</b> Escaneie com o app autenticador.</p><p class="muted small" style="margin:0 0 6px">Se não conseguir escanear, digite esta chave no app:</p><div class="secret">${esc(data.totp.secret)}</div></div></div>
      <form id="enrollForm" class="form" novalidate>
        <div class="field"><label for="enrollCode"><b>2.</b> Código que aparece no app</label><input id="enrollCode" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>
        <p class="err" id="enrollErr" role="alert" hidden></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-green" type="submit" id="enrollBtn">Ativar</button><button class="btn btn-line" type="button" id="enrollCancel">Cancelar</button></div>
      </form>`;
    $("#enrollCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); errBox("#enrollErr", ""); });
    $("#enrollCancel").onclick = async () => { if (enrolling) await sb.auth.mfa.unenroll({ factorId: enrolling }); enrolling = null; renderSec(); };
    $("#enrollForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = $("#enrollCode").value;
      if (!/^\d{6}$/.test(code)) return errBox("#enrollErr", "Digite os 6 números do app autenticador.");
      $("#enrollBtn").disabled = true;
      const r = await sb.auth.mfa.challengeAndVerify({ factorId: enrolling, code });
      $("#enrollBtn").disabled = false;
      if (r.error) return errBox("#enrollErr", "Código incorreto. Confira se o horário do celular está automático e digite o código atual.");
      enrolling = null; status("Verificação em duas etapas ativada."); renderSec(); refreshMfaBanner();
    });
    $("#enrollCode").focus();
  }
  async function refreshMfaBanner() {
    const { data } = await sb.auth.mfa.listFactors();
    $("#mfaBanner").hidden = !!(data && data.totp.some((f) => f.status === "verified"));
  }
  $("#goSec").onclick = () => setView("sec");
  function askAllOut() {
    $("#allOutBox").innerHTML = `<div class="confirm" role="alert"><p>Encerrar a sessão em todos os aparelhos, inclusive neste?</p><div><button class="btn btn-danger solid" type="button" id="allOutOk">Sair de todos</button><button class="btn btn-line" type="button" id="allOutNo">Cancelar</button></div></div>`;
    $("#allOutNo").onclick = () => { $("#allOutBox").innerHTML = `<button class="btn btn-danger" type="button" id="allOut">Sair de todos os aparelhos</button>`; $("#allOut").onclick = askAllOut; };
    $("#allOutOk").onclick = async () => { await sb.auth.signOut({ scope: "global" }); };
  }
  $("#allOut").onclick = askAllOut;

  /* ================= gaveta de edição ================= */
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
      PROMOCOES.forEach((b) => { if (b.produto === id) b.produto = null; });
    } else {
      if (!(await removeRow("promocoes", id))) return;
      PROMOCOES = PROMOCOES.filter((x) => x.id !== id);
    }
    closeEditor(); render();
  }
  function openEditor() {
    lastFocus = document.activeElement;
    const d = $("#editor"); d.classList.add("open"); d.removeAttribute("inert"); d.setAttribute("aria-hidden", "false");
    $("#scrim").classList.add("on"); document.body.style.overflow = "hidden"; $("#edForm").scrollTop = 0;
    setTimeout(() => (d.querySelector("#eNome, #pTitulo") || d.querySelector(".iconbtn")).focus(), 60);
  }
  function closeEditor(silent) {
    const d = $("#editor"); d.classList.remove("open"); d.setAttribute("inert", ""); d.setAttribute("aria-hidden", "true");
    $("#scrim").classList.remove("on"); document.body.style.overflow = "";
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  $("#edClose").onclick = () => closeEditor(); $("#scrim").onclick = () => closeEditor();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#editor").classList.contains("open")) closeEditor(); });
  $("#edForm").addEventListener("submit", (e) => e.preventDefault());
  $("#edFoot").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ed]"); if (!a || a.disabled) return;
    const kind = $("#edForm").dataset.kind;
    ({ cancel: () => closeEditor(), save: kind === "produto" ? saveProduct : savePromo, del: askDelete, delok: doDelete, delno: () => { const c = $("#edFoot .confirm"); if (c) c.remove(); } })[a.dataset.ed]();
  });

  /* ================= abas ================= */
  const VIEWS = { produtos: "#view-produtos", promos: "#view-promos", hist: "#view-hist", sec: "#view-sec" };
  const TABS = { produtos: "#tab-produtos", promos: "#tab-promos", hist: "#tab-hist", sec: "#tab-sec" };
  function setView(v) {
    Object.keys(VIEWS).forEach((k) => { $(TABS[k]).setAttribute("aria-selected", String(k === v)); $(VIEWS[k]).hidden = k !== v; });
    if (v === "hist") renderHist();
    if (v === "sec") renderSec();
  }
  Object.keys(TABS).forEach((k) => ($(TABS[k]).onclick = () => setView(k)));
  function render() { renderProducts(); renderPromos(); }

  let tt;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 2400); }
})();
