const $ = id => document.getElementById(id);

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  return { ok: response.ok, status: response.status, data };
}

function showDashboard() {
  $("loginScreen").setAttribute("hidden", "");
  $("dashboardScreen").removeAttribute("hidden");
}

function showLogin() {
  $("dashboardScreen").setAttribute("hidden", "");
  $("loginScreen").removeAttribute("hidden");
}

async function verifySession() {
  const result = await request("/api/admin/me");
  return result.ok && result.data && result.data.ok === true;
}

async function boot() {
  if (await verifySession()) {
    showDashboard();
    await loadDashboard();
  } else {
    showLogin();
  }
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginButton");
  const msg = $("loginMsg");

  button.disabled = true;
  button.textContent = "Masuk...";
  msg.textContent = "";

  const login = await request("/api/admin/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      email: $("email").value.trim(),
      password: $("password").value
    })
  });

  if (!login.ok) {
    msg.textContent = login.data?.error || "Email atau password salah.";
    button.disabled = false;
    button.textContent = "Masuk";
    return;
  }

  // The server has authenticated us. Verify the session, then switch screens.
  const sessionOK = await verifySession();

  if (!sessionOK) {
    msg.textContent = "Login berhasil, tetapi sesi belum terbaca.";
    button.disabled = false;
    button.textContent = "Masuk";
    return;
  }

  showDashboard();
  button.disabled = false;
  button.textContent = "Masuk";

  await loadDashboard();
});

$("logoutButton").addEventListener("click", async () => {
  await request("/api/admin/logout", {method:"POST"});
  $("password").value = "";
  showLogin();
});

async function loadDashboard() {
  await loadCategories();
  await loadPosts();
}

async function loadCategories() {
  const result = await request("/api/categories");
  const categories = result.ok ? (result.data || []) : [];

  $("category").innerHTML = categories.length
    ? categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("")
    : `<option value="">Belum ada kategori</option>`;
}

async function loadPosts() {
  const list = $("postList");
  list.innerHTML = "<p>Memuat berita...</p>";

  const result = await request("/api/admin/posts");

  if (!result.ok) {
    list.innerHTML = `<p>Gagal memuat berita (${result.status}).</p>`;
    return;
  }

  const posts = result.data || [];

  if (!posts.length) {
    list.innerHTML = "<p>Belum ada berita. Klik <b>+ Tulis Berita</b> untuk membuat berita pertama.</p>";
    return;
  }

  list.innerHTML = posts.map(post => `
    <article class="post">
      <div>
        <h3>${escapeHTML(post.title)}</h3>
        <div class="meta">
          ${escapeHTML(post.category_name || "Tanpa kategori")}
          · ${escapeHTML(post.status || "draft")}
          ${post.is_headline ? " · HEADLINE" : ""}
        </div>
      </div>
      <div class="actions">
        <button onclick="editPost(${post.id})">Edit</button>
        <button onclick="deletePost(${post.id})">Hapus</button>
      </div>
    </article>
  `).join("");
}

$("newPostButton").addEventListener("click", () => openEditor());

$("closeEditorButton").addEventListener("click", () => {
  $("editor").setAttribute("hidden", "");
});

function openEditor(post = null) {
  $("editor").removeAttribute("hidden");
  $("editorHeading").textContent = post ? "Edit Berita" : "Tulis Berita";

  $("postId").value = post?.id || "";
  $("title").value = post?.title || "";
  $("slug").value = post?.slug || "";
  $("image").value = post?.featured_image || "";
  $("excerpt").value = post?.excerpt || "";
  $("content").value = post?.content || "";
  $("headline").checked = !!post?.is_headline;
  $("status").value = post?.status || "draft";

  if (post?.category_id) $("category").value = post.category_id;
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

$("postForm").addEventListener("submit", async event => {
  event.preventDefault();

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

  const result = await request(
    id ? `/api/admin/posts/${id}` : "/api/admin/posts",
    {
      method: id ? "PUT" : "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    }
  );

  if (!result.ok) {
    msg.textContent = result.data?.error || "Gagal menyimpan.";
    return;
  }

  msg.style.color = "#079b58";
  msg.textContent = "Tersimpan";
  await loadPosts();

  setTimeout(() => {
    $("editor").setAttribute("hidden", "");
    msg.textContent = "";
  }, 500);
});

window.editPost = async id => {
  const result = await request(`/api/admin/posts/${id}`);
  if (result.ok) openEditor(result.data);
};

window.deletePost = async id => {
  if (!confirm("Hapus berita ini?")) return;

  const result = await request(`/api/admin/posts/${id}`, {
    method: "DELETE"
  });

  if (result.ok) await loadPosts();
  else alert(result.data?.error || "Gagal menghapus.");
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

boot();
