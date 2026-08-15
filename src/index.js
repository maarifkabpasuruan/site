export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, {headers: cors});

    try {
      if (path === "/api/categories" && request.method === "GET") {
        const {results} = await env.DB.prepare(
          "SELECT id,name,slug,is_active,sort_order FROM categories WHERE is_active=1 ORDER BY sort_order,name"
        ).all();
        return json(results, cors);
      }

      if (path === "/api/posts" && request.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") || 10), 50);
        const {results} = await env.DB.prepare(`
          SELECT posts.id,posts.title,posts.slug,posts.excerpt,posts.featured_image,
                 posts.status,posts.is_headline,posts.published_at,posts.created_at,
                 categories.name category_name,categories.slug category_slug
          FROM posts LEFT JOIN categories ON categories.id=posts.category_id
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
          FROM posts LEFT JOIN categories ON categories.id=posts.category_id
          WHERE posts.slug=? AND posts.status='published' LIMIT 1
        `).bind(slug).first();
        if (!post) return json({error:"Berita tidak ditemukan"}, cors, 404);
        return json(post, cors);
      }

      if (path === "/api/banners" && request.method === "GET") {
        const type = url.searchParams.get("type");
        let sql = `SELECT id,title,image_url,banner_type,link_url,is_active,priority,start_at,end_at
                   FROM banners WHERE is_active=1
                   AND (start_at IS NULL OR start_at<=CURRENT_TIMESTAMP)
                   AND (end_at IS NULL OR end_at>=CURRENT_TIMESTAMP)`;
        const params = [];
        if (type) { sql += " AND banner_type=?"; params.push(type); }
        sql += " ORDER BY priority DESC,RANDOM()";
        const {results} = params.length
          ? await env.DB.prepare(sql).bind(...params).all()
          : await env.DB.prepare(sql).all();
        return json(results, cors);
      }

      if (path === "/api/posts" && request.method === "POST") {
        const body = await request.json();
        if (!body.title || !body.slug || !body.content)
          return json({error:"title, slug, dan content wajib diisi"}, cors, 400);

        const result = await env.DB.prepare(`
          INSERT INTO posts
          (title,slug,excerpt,content,featured_image,category_id,status,is_headline,published_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).bind(
          body.title, body.slug, body.excerpt || null, body.content,
          body.featured_image || null, body.category_id || null,
          body.status || "draft", body.is_headline ? 1 : 0,
          body.published_at || null
        ).run();

        return json({success:true,id:result.meta.last_row_id}, cors, 201);
      }

      return new Response("Ma'arif Worker API is running.", {
        status: 200,
        headers: cors
      });
    } catch (error) {
      return json({error:error.message}, cors, 500);
    }
  }
};

function json(data, cors={}, status=200) {
  return new Response(JSON.stringify(data,null,2), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8", ...cors}
  });
}
