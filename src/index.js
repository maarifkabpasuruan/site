export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      "Access-Control-Allow-Origin": url.origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      // Public API
      if (path === "/api/categories" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,name,slug,is_active,sort_order FROM categories WHERE is_active=1 ORDER BY sort_order,name"
        ).all();
        return json(results, cors);
      }

      if (path === "/api/posts" && request.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 10), 50);
        const { results } = await env.DB.prepare(`
          SELECT posts.id,posts.title,posts.slug,posts.excerpt,posts.featured_image,
                 posts.status,posts.is_headline,posts.published_at,posts.created_at,
                 categories.name category_name,categories.slug category_slug
          FROM posts
          LEFT JOIN categories ON categories.id=posts.category_id
          WHERE posts.status='published'
          ORDER BY posts.is_headline DESC,COALESCE(posts.published_at,posts.created_at) DESC
          LIMIT ?
        `).bind(limit).all();
        return json(results, cors);
      }

      if (path.startsWith("/api/posts/") && request.method === "GET") {
        const slug = decodeURIComponent(path.slice("/api/posts/".length));
        const post = await env.DB.prepare(`
          SELECT posts.*,categories.name category_name,categories.slug category_slug
          FROM posts
          LEFT JOIN categories ON categories.id=posts.category_id
          WHERE posts.slug=? AND posts.status='published'
          LIMIT 1
        `).bind(slug).first();

        if (!post) return json({error:"Berita tidak ditemukan"}, cors, 404);
        return json(post, cors);
      }

      if (path === "/api/banners" && request.method === "GET") {
        const type = url.searchParams.get("type");
        let sql = `
          SELECT id,title,image_url,banner_type,link_url,is_active,priority,start_at,end_at
          FROM banners
          WHERE is_active=1
          AND (start_at IS NULL OR start_at<=CURRENT_TIMESTAMP)
          AND (end_at IS NULL OR end_at>=CURRENT_TIMESTAMP)
        `;
        const params = [];

        if (type) {
          sql += " AND banner_type=?";
          params.push(type);
        }

        sql += " ORDER BY priority DESC,RANDOM()";

        const { results } = params.length
          ? await env.DB.prepare(sql).bind(...params).all()
          : await env.DB.prepare(sql).all();

        return json(results, cors);
      }

      // Admin API
      if (path.startsWith("/api/admin/")) {
        const cookie = request.headers.get("Cookie") || "";
        const authenticated = /(?:^|;\s*)maarif_admin=1(?:;|$)/.test(cookie);

        if (path === "/api/admin/login" && request.method === "POST") {
          const body = await request.json();

          if (
            body.email !== env.ADMIN_EMAIL ||
            body.password !== env.ADMIN_PASSWORD
          ) {
            return json({error:"Email atau password salah"}, cors, 401);
          }

          const headers = new Headers(cors);
          headers.set("Content-Type", "application/json");
          headers.append(
            "Set-Cookie",
            "maarif_admin=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400"
          );

          return new Response(JSON.stringify({success:true}), {
            status: 200,
            headers
          });
        }

        if (path === "/api/admin/logout" && request.method === "POST") {
          const headers = new Headers(cors);
          headers.set("Content-Type", "application/json");
          headers.append(
            "Set-Cookie",
            "maarif_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
          );

          return new Response(JSON.stringify({success:true}), {
            status: 200,
            headers
          });
        }

        if (!authenticated) {
          return json({error:"Unauthorized"}, cors, 401);
        }

        if (path === "/api/admin/me" && request.method === "GET") {
          return json({ok:true}, cors);
        }

        if (path === "/api/admin/posts" && request.method === "GET") {
          const {results} = await env.DB.prepare(`
            SELECT posts.*,categories.name category_name
            FROM posts
            LEFT JOIN categories ON categories.id=posts.category_id
            ORDER BY posts.created_at DESC
          `).all();

          return json(results, cors);
        }

        if (path === "/api/admin/posts" && request.method === "POST") {
          return savePost(request, env, cors);
        }

        const match = path.match(/^\/api\/admin\/posts\/(\d+)$/);

        if (match) {
          const id = Number(match[1]);

          if (request.method === "GET") {
            const post = await env.DB.prepare(
              "SELECT * FROM posts WHERE id=?"
            ).bind(id).first();

            return post
              ? json(post, cors)
              : json({error:"Tidak ditemukan"}, cors, 404);
          }

          if (request.method === "PUT") {
            return savePost(request, env, cors, id);
          }

          if (request.method === "DELETE") {
            await env.DB.prepare(
              "DELETE FROM posts WHERE id=?"
            ).bind(id).run();

            return json({success:true}, cors);
          }
        }
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not found", {
        status: 404,
        headers: cors
      });

    } catch (error) {
      return json({error:error.message}, cors, 500);
    }
  }
};

async function savePost(request, env, cors, id=null) {
  const body = await request.json();

  if (!body.title || !body.slug || !body.content) {
    return json(
      {error:"Judul, slug, dan isi wajib diisi"},
      cors,
      400
    );
  }

  const publishedAt =
    body.status === "published"
      ? new Date().toISOString()
      : null;

  if (id) {
    await env.DB.prepare(`
      UPDATE posts SET
        title=?,slug=?,excerpt=?,content=?,featured_image=?,
        category_id=?,status=?,is_headline=?,published_at=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      body.title,
      body.slug,
      body.excerpt || null,
      body.content,
      body.featured_image || null,
      body.category_id || null,
      body.status || "draft",
      body.is_headline ? 1 : 0,
      publishedAt,
      id
    ).run();

    return json({success:true,id}, cors);
  }

  const result = await env.DB.prepare(`
    INSERT INTO posts
      (title,slug,excerpt,content,featured_image,category_id,
       status,is_headline,published_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    body.title,
    body.slug,
    body.excerpt || null,
    body.content,
    body.featured_image || null,
    body.category_id || null,
    body.status || "draft",
    body.is_headline ? 1 : 0,
    publishedAt
  ).run();

  return json({
    success:true,
    id:result.meta.last_row_id
  }, cors, 201);
}

function json(data, cors={}, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":"application/json; charset=utf-8",
      ...cors
    }
  });
}
