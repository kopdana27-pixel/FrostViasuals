(() => {
  const db = window.frostSupabase;
  if (!db) {
    console.error("Frost: Supabase client не найден");
    return;
  }

  let session = null;
  let profile = null;
  let busy = false;
  let message = "";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])
  );

  async function refresh() {
    const { data } = await db.auth.getSession();
    session = data.session;
    profile = null;

    if (session?.user) {
      const result = await db.from("profiles")
        .select("id,username,role")
        .eq("id", session.user.id)
        .maybeSingle();
      profile = result.data || null;
    }

    window.frostUser = session?.user || null;
    window.frostRole = profile?.role || "player";
    role = window.frostRole === "owner" ? "Owner" :
           window.frostRole === "admin" ? "Admin" : "Player";
    window.frostIsStaff = ["admin", "owner", "moderator"].includes(window.frostRole);
    window.frostIsOwner = window.frostRole === "owner";

    if (typeof render === "function") render();
  }

  const originalPageContent = pageContent;
  pageContent = function() {
    if (page === "account") {
      const user = session?.user;
      return `<div class="grid">
        <div class="card">
          <div class="eyebrow">FROST ACCOUNT</div>
          <h3>${user ? "Твой аккаунт" : "Вход и регистрация"}</h3>
          ${message ? `<div class="notice">${esc(message)}</div>` : ""}
          ${user ? `
            <p>Почта: <b>${esc(user.email)}</b></p>
            <p>Имя: <b>${esc(profile?.username || user.email)}</b></p>
            <p>Роль: <span class="role">${esc(profile?.role || "player").toUpperCase()}</span></p>
            <button class="primary" id="frostLogout">Выйти из аккаунта</button>
          ` : `
            <div class="field"><label>Email</label><input id="frostEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
            <div class="field"><label>Пароль</label><input id="frostPassword" type="password" autocomplete="current-password" placeholder="Минимум 8 символов"></div>
            <div class="field"><label>Имя игрока</label><input id="frostUsername" maxlength="24" placeholder="Frost Player"></div>
            <button class="primary" id="frostLogin">Войти</button>
            <button class="secondary" id="frostSignup">Создать аккаунт</button>
          `}
        </div>
        <div class="card">
          <div class="eyebrow">SECURITY</div>
          <h3>Роли и доступ</h3>
          <p><b>Player</b> — визуалы, HUD и профили.</p>
          <p><b>Admin</b> — управление новостями и релизами.</p>
                    <p><b>Moderator</b> — модерация пользователей.</p>
                    <p><b>YouTuber</b> — специальная отметка автора.</p>
          <p><b>Owner</b> — управление проектом и ролями.</p>
          <div class="notice">Права загружаются из Supabase. Выбор роли в браузере больше не выдаёт привилегий.</div>
        </div>
      </div>`;
    }

    if (page === "admin") {
      if (!session) return `<div class="card"><h3>Вход необходим</h3><p>Войди в аккаунт, чтобы открыть панель управления.</p><button class="primary" data-go="account">Перейти к аккаунту</button></div>`;
      if (!window.frostIsStaff) return `<div class="card"><h3>Доступ ограничен</h3><p>Текущая роль: PLAYER. Панель доступна только администраторам и владельцу.</p></div>`;
      return `<div class="grid">
        <div class="card"><div class="eyebrow">USER MANAGEMENT</div><h3>Пользователи</h3><div id="frostUsers">Загрузка...</div></div>
        <div class="card"><div class="eyebrow">RELEASE CENTER</div><h3>Релизы</h3><div id="frostReleases">Загрузка...</div></div>
        <div class="card"><div class="eyebrow">NEWS</div><h3>Новости</h3><div id="frostNews">Загрузка...</div></div>
        <div class="card"><div class="eyebrow">ACCESS CONTROL</div><h3>Твои права</h3><p>Подтверждённая роль: <b>${esc(window.frostRole.toUpperCase())}</b></p><p>${window.frostIsOwner ? "Полный доступ владельца." : "Доступ администратора."}</p></div>
      </div>`;
    }
    return originalPageContent();
  };

  const originalRender = render;
  render = function() {
    originalRender();
    bindAccount();
    if (page === "admin" && window.frostIsStaff) loadAdmin();
  };

  function bindAccount() {
    const login = document.querySelector("#frostLogin");
    const signup = document.querySelector("#frostSignup");
    const logout = document.querySelector("#frostLogout");

    if (login) login.onclick = async () => {
      if (busy) return;
      busy = true;
      message = "";
      const email = document.querySelector("#frostEmail").value.trim();
      const password = document.querySelector("#frostPassword").value;
      const { error } = await db.auth.signInWithPassword({ email, password });
      message = error ? error.message : "Вход выполнен.";
      busy = false;
      await refresh();
    };

    if (signup) signup.onclick = async () => {
      if (busy) return;
      busy = true;
      const email = document.querySelector("#frostEmail").value.trim();
      const password = document.querySelector("#frostPassword").value;
      const username = document.querySelector("#frostUsername").value.trim() || "Frost Player";
      if (password.length < 8) {
        message = "Пароль должен содержать минимум 8 символов.";
        busy = false;
        render();
        return;
      }
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { data: { username }, emailRedirectTo: window.location.origin }
      });
      message = error ? error.message :
        (data.session ? "Аккаунт создан." : "Проверь почту и подтверди регистрацию.");
      busy = false;
      await refresh();
      if (!data.session) render();
    };

    if (logout) logout.onclick = async () => {
      await db.auth.signOut();
      message = "Ты вышел из аккаунта.";
      await refresh();
    };
  }

  async function loadAdmin() {
    const usersBox = document.querySelector("#frostUsers");
    const releasesBox = document.querySelector("#frostReleases");
    const newsBox = document.querySelector("#frostNews");
    if (!usersBox) return;

    const [users, releases, news] = await Promise.all([
      db.from("profiles").select("id,username,role,created_at").order("created_at", {ascending:false}).limit(50),
      db.from("mod_releases").select("version,minecraft_version,published,created_at").order("created_at", {ascending:false}),
      db.from("news").select("title,published,created_at").order("created_at", {ascending:false})
    ]);

    usersBox.innerHTML = users.error
      ? `<p>${esc(users.error.message)}</p>`
      : (users.data || []).map(u => `
        <div class="card" style="margin:10px 0">
          <b>${esc(u.username || "Player")}</b>
          <p>Роль: <b>${esc(u.role)}</b></p>
          ${window.frostIsOwner ? `
            <select data-frost-role="${esc(u.id)}">
              <option value="player" ${u.role === "player" ? "selected" : ""}>Player</option>
              <option value="moderator" ${u.role === "moderator" ? "selected" : ""}>Moderator</option>
              <option value="youtuber" ${u.role === "youtuber" ? "selected" : ""}>YouTuber</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
            <button class="primary" data-frost-save-role="${esc(u.id)}" ${u.id === window.frostUser?.id ? "disabled" : ""}>Сохранить роль</button>
          ` : ""}
        </div>
      `).join("") || "<p>Пользователей пока нет.</p>";

    usersBox.querySelectorAll("[data-frost-save-role]").forEach(button => {
      button.onclick = async () => {
        if (!window.frostIsOwner) return;
        const id = button.dataset.frostSaveRole;
        const select = usersBox.querySelector(`[data-frost-role="${id}"]`);
        const nextRole = select?.value;
        if (!["player", "admin", "moderator", "youtuber"].includes(nextRole)) return;
        if (!confirm(`Изменить роль на ${nextRole.toUpperCase()}?`)) return;

        button.disabled = true;
        const result = await db.from("profiles")
          .update({ role: nextRole })
          .eq("id", id);

        if (result.error) {
          alert("Ошибка: " + result.error.message);
          button.disabled = false;
          return;
        }

        await db.from("audit_logs").insert({
          actor_id: window.frostUser.id,
          target_id: id,
          action: "role_changed",
          details: { role: nextRole }
        });

        alert("Роль изменена.");
        await loadAdmin();
      };
    });

    if (releasesBox) releasesBox.innerHTML = releases.error
      ? `<p>${esc(releases.error.message)}</p>`
      : (releases.data || []).map(r => `<p><b>${esc(r.version)}</b> · Minecraft ${esc(r.minecraft_version)} · ${r.published ? "Опубликован" : "Черновик"}</p>`).join("") || "<p>Релизов пока нет.</p>";

    if (newsBox) newsBox.innerHTML = news.error
      ? `<p>${esc(news.error.message)}</p>`
      : (news.data || []).map(n => `<p><b>${esc(n.title)}</b> · ${n.published ? "Опубликована" : "Черновик"}</p>`).join("") || "<p>Новостей пока нет.</p>";
  }

  db.auth.onAuthStateChange(() => {
    setTimeout(refresh, 0);
  });

  refresh();
})();
