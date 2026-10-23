/**
 * Cloudflare Multi-Tenant Storage Service
 * Dịch vụ đồng bộ và lưu trữ dữ liệu đa trường học (Multi-tenant) trên hạ tầng Cloudflare Serverless (Pages + KV / Worker)
 */

export interface CloudflareTenantConfig {
  workerUrl: string;       // Ví dụ: https://pccm-api.your-subdomain.workers.dev
  apiKey?: string;         // Khóa bí mật bảo vệ Worker (nếu có)
  autoSync: boolean;       // Tự động đồng bộ mỗi khi lưu dữ liệu
}

export interface CloudflareTenantSyncPayload {
  schoolId: string;
  schoolInfo: any;
  teachers: any[];
  classes: any[];
  assignments: any[];
  departments: any[];
  subjects: any[];
  duties: any[];
  branches: any[];
  versions: any[];
  updatedAt: string;
}

const CONFIG_STORAGE_KEY = 'pccm_cloudflare_tenant_config';

class CloudflareTenantService {
  private config: CloudflareTenantConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  public getConfig(): CloudflareTenantConfig | null {
    return this.config;
  }

  public saveConfig(config: CloudflareTenantConfig): void {
    this.config = config;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      } catch (e) {
        console.warn('Lỗi lưu cấu hình Cloudflare:', e);
      }
    }
  }

  public clearConfig(): void {
    this.config = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        this.config = JSON.parse(raw);
      }
    } catch {
      this.config = null;
    }
  }

  /**
   * Kiểm tra kết nối tới Cloudflare Worker
   */
  public async testConnection(workerUrl: string, apiKey?: string): Promise<{ success: boolean; message: string }> {
    try {
      const cleanUrl = workerUrl.trim().replace(/\/$/, '');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-API-KEY'] = apiKey.trim();
      }

      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          message: data.message || 'Kết nối máy chủ Cloudflare Worker thành công 100%!',
        };
      } else {
        return {
          success: false,
          message: `Máy chủ phản hồi mã lỗi HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Không thể kết nối tới Cloudflare Worker: ${err?.message || 'Lỗi mạng hoặc CORS'}`,
      };
    }
  }

  /**
   * Đẩy toàn bộ dữ liệu của một trường (Tenant) lên Cloudflare KV
   */
  public async syncTenantToCloudflare(payload: CloudflareTenantSyncPayload): Promise<{ success: boolean; message: string }> {
    if (!this.config || !this.config.workerUrl) {
      throw new Error('Chưa thiết lập URL Cloudflare Worker trong Cài đặt.');
    }

    const cleanUrl = this.config.workerUrl.trim().replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['X-API-KEY'] = this.config.apiKey.trim();
    }

    const res = await fetch(`${cleanUrl}/api/tenants/${encodeURIComponent(payload.schoolId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cloudflare lỗi (${res.status}): ${errText || res.statusText}`);
    }

    return {
      success: true,
      message: `Đã đồng bộ an toàn dữ liệu trường [${payload.schoolInfo?.schoolName || payload.schoolId}] lên Cloudflare KV!`,
    };
  }

  /**
   * Tải dữ liệu của một trường (Tenant) từ Cloudflare KV về
   */
  public async pullTenantFromCloudflare(schoolId: string): Promise<CloudflareTenantSyncPayload | null> {
    if (!this.config || !this.config.workerUrl) {
      throw new Error('Chưa thiết lập URL Cloudflare Worker trong Cài đặt.');
    }

    const cleanUrl = this.config.workerUrl.trim().replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['X-API-KEY'] = this.config.apiKey.trim();
    }

    const res = await fetch(`${cleanUrl}/api/tenants/${encodeURIComponent(schoolId)}`, {
      method: 'GET',
      headers,
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cloudflare lỗi (${res.status}): ${errText || res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Liệt kê danh sách tất cả các trường đang lưu trên Cloudflare
   */
  public async listTenants(): Promise<{ id: string; schoolName: string; updatedAt: string }[]> {
    if (!this.config || !this.config.workerUrl) {
      return [];
    }

    const cleanUrl = this.config.workerUrl.trim().replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['X-API-KEY'] = this.config.apiKey.trim();
    }

    const res = await fetch(`${cleanUrl}/api/tenants`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }
}

export const cloudflareTenantService = new CloudflareTenantService();
