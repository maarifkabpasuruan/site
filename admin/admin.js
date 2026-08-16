const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
      "Accept": "application/json"
    }
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  return { ok: response.ok, status: response.status, data };
}

async function start() {
  // Check the existing session first.
  const session = await api("/api/admin/me");

  if (session.ok && session.data?.ok === true) {
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  $("login").hidden = false;
  $("app").hidden = true;
}

async function showApp() {
  $("login").hidden = true;
  $("app").hidden = false;
  $("editor").hidden = true;

  await loadCategories();
  await loadPosts();
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = $("loginMsg");
  msg.textContent = "Memeriksa...";
  msg.style.color = "";

  const result = await api("/api/admin/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: $("email").value.trim(),
      password: $("password").value
    })
  });

  if (!result.ok) {
    msg.textContent = result.data?.error || "Login gagal";
    return;
  }

  // Verify the session immediately after login.
  const session = await api("/api/admin/me");

  if (session.ok && session.data?.ok === true) {
    msg.textContent = "";
    await showApp();
    return;
  }

  msg.textContent = "Login berhasil, tetapi sesi belum terbaca. Silakan coba lagi.";
});

$("logout").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  showLogin();
  $("password").value = "";
});

async function loadCategories() {
  const result = await api("/api/categories");

  if (!result.ok) {
    $("category").innerHTML = '<option value="">Gagal memuat kategori</option>';
    return;
  }

  const categories = result.data || [];

  $("category").innerHTML = categories.length
    ? categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")
    : '<option value="">Belum ada kategori</option>';
}

async function loadPosts() {
  const list = $("list");
  list.innerHTML = "<p>Memuat berita...</p>";

  const result = await api("/api/admin/posts");

  if (!result.ok) {
    list.innerHTML = `<p>Gagal memuat berita (${result.status}).</p>`;
    return;
  }

  const posts = result.data || [];

  if (!posts.length) {
    list.innerHTML = "<p>Belum ada berita. Klik <b>+ Tulis Berita</b> untuk membuat berita pertama.</p>";
    return;
  }

  list.innerHTML = posts.map(p => `
    <article class="post">
      <div>
        <h3>${esc(p.title)}</h3>
        <div class="meta">
          ${esc(p.category_name || "Tanpa kategori")}
          · ${esc(p.status || "draft")}
          ${p.is_headline ? " · HEADLINE" : ""}
        </div>
      </div>
      <div class="actions">
        <button onclick="editPost(${p.id})">Edit</button>
        <button onclick="delPost(${p.id})">Hapus</button>
      </div>
    </article>
  `).join("");
}

$("newBtn").addEventListener("click", () => openEditor());

$("closeBtn").addEventListener("click", () => {
  $("editor").hidden = true;
});

function openEditor(post = null) {
  $("editor").hidden = false;
  $("editorTitle").textContent = post ? "Edit Berita" : "Tulis Berita";

  $("postId").value = post?.id || "";
  $("title").value = post?.title || "";
  $("slug").value = post?.slug || "";
  $("category").value = post?.category_id || $("category").options[0]?.value || "";
  $("image").value = post?.featured_image || "";
  $("excerpt").value = post?.excerpt || "";
  $("content").value = post?.content || "";
  $("headline").checked = !!post?.is_headline;
  $("status").value = post?.status || "draft";
}

$("title").addEventListener("input", () => {
  if ($("postId").value) return;

  $("slug").value = $("title").value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
});

$("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = $("saveMsg");
  msg.textContent = "Menyimpan...";
  msg.style.color = "";

  const body = {
    title: $("title").value.trim(),
    slug: $("slug").value.trim(),
    category_id: Number($("category").value) || null,
    featured_image: $("image").value.trim() || null,
    excerpt: $("excerpt").value.trim(),
    content: $("content").value,
    status: $("status").value,
    is_headline: $("headline").checked
  };

  const id = $("postId").value;

  const result = await api(
    id ? `/api/admin/posts/${id}` : "/api/admin/posts",
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!result.ok) {
    msg.textContent = result.data?.error || "Gagal menyimpan";
    return;
  }

  msg.style.color = "#079b58";
  msg.textContent = "Tersimpan";

  await loadPosts();

  setTimeout(() => {
    $("editor").hidden = true;
    msg.textContent = "";
  }, 400);
});

window.editPost = async (id) => {
  const result = await api(`/api/admin/posts/${id}`);

  if (result.ok) {
    openEditor(result.data);
  } else {
    alert(result.data?.error || "Gagal mengambil berita");
  }
};

window.delPost = async (id) => {
  if (!confirm("Hapus berita ini?")) return;

  const result = await api(`/api/admin/posts/${id}`, {
    method: "DELETE"
  });

  if (result.ok) {
    await loadPosts();
  } else {
    alert(result.data?.error || "Gagal menghapus");
  }
};

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

start();
