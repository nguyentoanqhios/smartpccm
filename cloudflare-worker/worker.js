/**
 * CLOUDFLARE WORKER: Multi-Tenant Data Backend for VN-School PCCM
 * Tự động phân vùng và lưu trữ dữ liệu riêng biệt cho từng trường học trên Cloudflare KV
 * Miễn phí 100.000 requests/ngày, tốc độ cực nhanh, bảo mật toàn cầu.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Headers CORS cho phép mọi tên miền của trường truy cập an toàn
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Kiểm tra API KEY bảo mật nếu có thiết lập SECRET_API_KEY trong Worker Settings
    if (env.SECRET_API_KEY) {
      const clientApiKey = request.headers.get('X-API-KEY');
      if (clientApiKey !== env.SECRET_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Sai hoặc thiếu API Key bảo vệ' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Đảm bảo KV Namespace SCHOOL_TENANTS đã được liên kết
    if (!env.SCHOOL_TENANTS) {
      return new Response(
        JSON.stringify({
          error: 'Chưa liên kết KV Namespace! Vui lòng vào Worker -> Settings -> Variables -> KV Namespace Bindings và thêm biến tên: SCHOOL_TENANTS',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Healthcheck
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: 'Cloudflare Worker Multi-Tenant Backend đang hoạt động ổn định 100%!',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. GET /api/tenants - Lấy danh sách tất cả các trường
    if (url.pathname === '/api/tenants' && request.method === 'GET') {
      try {
        const list = await env.SCHOOL_TENANTS.list({ prefix: 'tenant_meta:' });
        const tenants = [];
        for (const key of list.keys) {
          const raw = await env.SCHOOL_TENANTS.get(key.name);
          if (raw) {
            tenants.push(JSON.parse(raw));
          }
        }
        return new Response(JSON.stringify(tenants), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Định tuyến theo từng trường: /api/tenants/:schoolId
    const match = url.pathname.match(/^\/api\/tenants\/([^/]+)$/);
    if (match) {
      const schoolId = decodeURIComponent(match[1]);
      const dataKey = `tenant_data:${schoolId}`;
      const metaKey = `tenant_meta:${schoolId}`;

      // GET - Lấy dữ liệu của 1 trường
      if (request.method === 'GET') {
        const data = await env.SCHOOL_TENANTS.get(dataKey);
        if (!data) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy dữ liệu trường này trên Cloudflare' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // PUT - Lưu/Cập nhật dữ liệu của 1 trường
      if (request.method === 'PUT' || request.method === 'POST') {
        try {
          const body = await request.json();
          body.updatedAt = new Date().toISOString();

          // Lưu toàn bộ dữ liệu nghiệp vụ
          await env.SCHOOL_TENANTS.put(dataKey, JSON.stringify(body));

          // Lưu metadata để liệt kê danh sách các trường
          const meta = {
            id: schoolId,
            schoolName: body.schoolInfo?.schoolName || schoolId,
            teacherCount: Array.isArray(body.teachers) ? body.teachers.length : 0,
            classCount: Array.isArray(body.classes) ? body.classes.length : 0,
            updatedAt: body.updatedAt,
          };
          await env.SCHOOL_TENANTS.put(metaKey, JSON.stringify(meta));

          return new Response(
            JSON.stringify({
              success: true,
              message: `Đã lưu thành công dữ liệu trường ${meta.schoolName} lên Cloudflare KV!`,
              meta,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Dữ liệu không hợp lệ: ' + e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // DELETE - Xóa trường
      if (request.method === 'DELETE') {
        await env.SCHOOL_TENANTS.delete(dataKey);
        await env.SCHOOL_TENANTS.delete(metaKey);
        return new Response(JSON.stringify({ success: true, message: `Đã xóa dữ liệu trường ${schoolId}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('API endpoint not found', { status: 404, headers: corsHeaders });
  },
};
