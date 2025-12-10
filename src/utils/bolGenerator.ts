// Lightweight BOL (Bill of Lading) PDF generation using dynamic ESM imports
// - Avoids adding build-time deps (pdf-lib) by loading via CDN at runtime
// - Supports Cyrillic by embedding an open-fonts TTF (Noto Sans Cyrillic)
// - Attempts to load the provided PDF template and overlays text
//
// IMPORTANT: Place your template file into the public folder so it's served:
//   public/BOL template - Лист1.pdf
// The code also tries '/bol-template.pdf' and '/BOL_template.pdf' fallbacks.

import { TransferRequest, Warehouse, User } from '../types';

type AppStateForBOL = {
  warehouses: Warehouse[];
  users: User[];
};

const TEMPLATE_CANDIDATES = [
  '/BOL template - Лист1.pdf',
  '/bol-template.pdf',
  '/BOL_template.pdf',
];

async function loadPdfLib() {
  // Use skypack CDN to avoid bundler dependency
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const pdfLib = await import('https://cdn.skypack.dev/pdf-lib@1.17.1');
  return pdfLib;
}

async function registerFontkit(pdfDoc: any) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const fontkitMod = await import('https://cdn.skypack.dev/@pdf-lib/fontkit@0.0.4');
  const fontkit = (fontkitMod as any).default || fontkitMod;
  pdfDoc.registerFontkit(fontkit);
}

async function loadCyrillicFontBytes(): Promise<Uint8Array> {
  // OpenFonts Noto Sans Cyrillic TTF via jsDelivr (CORS-enabled)
  const fontUrl = 'https://cdn.jsdelivr.net/npm/@openfonts/noto-sans_cyrillic@1.44.2/files/noto-sans-cyrillic-latin-400-normal.ttf';
  const res = await fetch(fontUrl);
  if (!res.ok) throw new Error('Failed to load Cyrillic font');
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchTemplateBytes(): Promise<Uint8Array> {
  let lastErr: any = null;
  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      const url = encodeURI(candidate);
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      }
      lastErr = new Error(`Template not found at ${candidate} (status ${res.status})`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('BOL template not found');
}

function getWarehouseById(warehouses: Warehouse[], id?: string) {
  if (!id) return undefined;
  return warehouses.find(w => w.id === id);
}

function getUserById(users: User[], id?: string) {
  if (!id) return undefined;
  return users.find(u => u.id === id);
}

function shortId(id: string) {
  return id ? id.slice(-8).toUpperCase() : 'REQUEST';
}

export async function generateBOL(request: TransferRequest, appState: AppStateForBOL): Promise<void> {
  try {
    const pdfLib = await loadPdfLib();
    const { PDFDocument, rgb } = pdfLib as any;

    const templateBytes = await fetchTemplateBytes();
    const pdfDoc = await PDFDocument.load(templateBytes);

    await registerFontkit(pdfDoc);
    const cyrillicFontBytes = await loadCyrillicFontBytes();
    const font = await pdfDoc.embedFont(cyrillicFontBytes, { subset: true });

    const page = pdfDoc.getPages()[0];
    const fontSize = 10;
    const headerSize = 12;

    const sender = getWarehouseById(appState.warehouses, request.sourceWarehouse);
    const receiver = getWarehouseById(appState.warehouses, request.destinationWarehouse);
    const creator = getUserById(appState.users, request.createdBy);

    // Helpers to draw text with safe defaults
    const draw = (text: string, x: number, y: number, size = fontSize) => {
      page.drawText(text || '', { x, y, size, font, color: rgb(0, 0, 0) });
    };

    // Rough positions for a generic BOL; adjust as needed to fit your template
    // Header
    draw(`BOL № ${shortId(request.id)}`, 430, 770, headerSize);
    draw(`Дата: ${new Date(request.createdAt).toLocaleDateString('ru-RU')}`, 430, 752);

    // Shipper (Sender) block (left column)
    draw('ОТПРАВИТЕЛЬ:', 50, 740, headerSize);
    draw(sender?.name || '', 50, 724);
    draw(sender?.fullAddress || '', 50, 708);
    if (sender?.unit) draw(`Помещение: ${sender.unit}`, 50, 692);
    if (sender?.phoneNumber) draw(`Тел: ${sender.phoneNumber}`, 50, 676);

    // Consignee (Receiver) block (right column)
    draw('ПОЛУЧАТЕЛЬ:', 320, 740, headerSize);
    draw(receiver?.name || '', 320, 724);
    draw(receiver?.fullAddress || '', 320, 708);
    if (receiver?.unit) draw(`Помещение: ${receiver.unit}`, 320, 692);
    if (receiver?.phoneNumber) draw(`Тел: ${receiver.phoneNumber}`, 320, 676);

    // Meta
    draw(`Создал: ${creator ? `${creator.firstName} ${creator.lastName}` : ''}`, 50, 652);
    draw(`Статус: ${request.status}`, 50, 636);

    // Items table header
    draw('ПОЗИЦИИ', 50, 612, headerSize);
    draw('Наименование', 50, 596);
    draw('Тип', 300, 596);
    draw('Кол-во', 450, 596);

    // Items list
    let y = 580;
    const lineStep = 16;
    request.items.forEach((it) => {
      if (y < 80) return; // prevent overflow; simple safeguard
      draw(it.name || '', 50, y);
      draw(it.type || '', 300, y);
      draw(String(it.quantity ?? ''), 450, y);
      y -= lineStep;
    });

    // Notes if present
    if (request.notes) {
      draw('Примечания:', 50, y - 10);
      const noteY = y - 26;
      draw(request.notes.slice(0, 120), 50, noteY); // one-line clamp for simplicity
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOL_${shortId(request.id)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('❌ Ошибка генерации BOL:', error);
    alert(
      '❌ Не удалось сгенерировать BOL.\n\n' +
      'Убедитесь, что файл шаблона находится в папке public под именем:\n' +
      '• BOL template - Лист1.pdf\n\n' +
      `Детали: ${error?.message || error}`
    );
  }
}


