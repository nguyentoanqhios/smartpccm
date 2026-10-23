/**
 * Print & Export Document Service
 * Hỗ trợ in ấn văn bản, biểu mẫu phân công chuyên môn và báo cáo chuẩn A4 (ngang/dọc).
 * Giải quyết triệt để lỗi sandbox iframe và tối ưu hiển thị in ấn chuyên nghiệp.
 */

export interface PrintDocumentOptions {
  title?: string;
  orientation?: 'landscape' | 'portrait';
  schoolName?: string;
  authorityName?: string;
  autoPrint?: boolean;
}

/**
 * Kiểm tra xem ứng dụng có đang chạy trong khung iframe hay không
 */
export function isRunningInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Tạo tài liệu HTML hoàn chỉnh chuẩn A4 để in ấn hoặc lưu trữ
 */
export function generatePrintDocumentHtml(
  contentHtml: string,
  options: PrintDocumentOptions = {}
): string {
  const {
    title = 'Biểu mẫu Phân công Chuyên môn',
    orientation = 'landscape',
    schoolName = 'TRƯỜNG THCS',
  } = options;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${schoolName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 ${orientation};
      margin: 8mm 8mm 10mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #0f172a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print,
    .print\:hidden,
    .report4-toggle-btn {
      display: none !important;
    }
    .report4-extra-subject {
      display: block !important;
    }
    thead th {
      text-align: center !important;
      vertical-align: middle !important;
    }
    /* Toolbar on top of standalone print tab */
    .print-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-size: 12px;
    }
    .print-toolbar-actions {
      display: flex;
      gap: 8px;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
    .close-btn {
      background: #334155;
      color: #e2e8f0;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    .close-btn:hover {
      background: #475569;
    }

    /* Print Paper Styles */
    .sheet-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-top: 6px;
      font-size: 10px;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th, td {
      border: 1px solid #334155;
      padding: 4px 5px;
      vertical-align: middle;
      text-align: left;
    }
    th {
      background-color: #f1f5f9 !important;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .font-bold { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .uppercase { text-transform: uppercase !important; }
    
    /* Signatures container */
    .signatures-block {
      page-break-inside: avoid;
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      text-align: center;
      gap: 16px;
    }

    @media print {
      body {
        padding: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <div style="font-weight: 600;">
      🖨️ Trang in: <strong>${title}</strong> (${orientation === 'landscape' ? 'Khổ A4 Ngang' : 'Khổ A4 Dọc'})
    </div>
    <div class="print-toolbar-actions">
      <button class="print-btn" onclick="window.print()">
        <span>Bấm để In ngay (Ctrl + P)</span>
      </button>
      <button class="close-btn" onclick="window.close()">Đóng tab</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    ${contentHtml}
  </div>

  ${options.autoPrint ? `
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print was blocked:', e);
        }
      }, 400);
    });
  </script>
  ` : ''}
</body>
</html>`;
}

/**
 * Thực hiện in nội dung thông qua thẻ iframe ẩn
 */
export async function printViaIframe(
  contentHtml: string,
  options: PrintDocumentOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const fullHtml = generatePrintDocumentHtml(contentHtml, options);
      
      // Xóa iframe cũ nếu có
      const oldFrame = document.getElementById('app-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'app-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1024px';
      iframe.style.height = '768px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-1';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!frameDoc) {
        iframe.remove();
        resolve(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              resolve(true);
            } else {
              resolve(false);
            }
          } catch (err) {
            console.warn('Iframe print blocked or failed:', err);
            resolve(false);
          } finally {
            // Giữ lại một lúc rồi dọn dẹp
            setTimeout(() => {
              iframe.remove();
            }, 3000);
          }
        }, 300);
      };
    } catch (err) {
      console.warn('Error initiating iframe print:', err);
      resolve(false);
    }
  });
}

/**
 * Mở cửa sổ/tab mới độc lập để in (bỏ qua mọi hạn chế sandbox iframe của trình duyệt)
 */
export function openPrintInNewTab(
  contentHtml: string,
  options: PrintDocumentOptions = {}
): boolean {
  try {
    const fullHtml = generatePrintDocumentHtml(contentHtml, { ...options, autoPrint: true });
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) {
      // Nếu popup bị chặn, thử mở trực tiếp bằng window.open rỗng
      const directWin = window.open('', '_blank');
      if (directWin) {
        directWin.document.open();
        directWin.document.write(fullHtml);
        directWin.document.close();
        return true;
      }
      return false;
    }
    
    // Tự động giải phóng blob URL sau một thời gian
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);

    return true;
  } catch (err) {
    console.error('Failed to open print tab:', err);
    return false;
  }
}

/**
 * Tải file HTML in ấn về máy để mở bằng bất kỳ trình duyệt nào và in ngoại tuyến
 */
export function downloadPrintableHtml(
  contentHtml: string,
  filename: string = 'bieu-mau-phan-cong-chuyen-mon.html',
  options: PrintDocumentOptions = {}
): void {
  try {
    const fullHtml = generatePrintDocumentHtml(contentHtml, options);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error('Failed to download print HTML:', err);
  }
}

/**
 * Sao chép bảng sang Clipboard để dán trực tiếp vào Word hoặc Excel
 */
export async function copyTableToClipboard(element: HTMLElement): Promise<boolean> {
  try {
    const html = element.outerHTML;
    const text = element.innerText;

    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return true;
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard copy failed:', err);
    return false;
  }
}
