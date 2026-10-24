/* eslint-disable no-unused-vars */

export type OdSheetView = {
  id: string;
  title: string;
  status: 'OPEN' | 'CLOSED' | 'APPROVED';
  student_fields: string[];
  event_fields: string[];
  event_data: unknown;
};

export type OdSheetStudentView = { id: string; student_data: unknown };

type Column = { key: string; label: string; read: (student: OdSheetStudentView) => string };

const studentLabels: Record<string, string> = {
  full_name: 'Full name',
  roll_number: 'Register number',
  department: 'Department',
  year_of_study: 'Year of study',
  email: 'Email',
  phone: 'Phone',
};

const eventLabels: Record<string, string> = {
  title: 'Event name',
  club_name: 'Club',
  start_time: 'Event date and time',
  end_time: 'Event end time',
  venue: 'Venue',
  category: 'Category',
  registration_deadline: 'Registration deadline',
  description: 'Description',
};

export function odSheetColumns(sheet: OdSheetView): Column[] {
  const eventData = asRecord(sheet.event_data);
  return [
    ...sheet.event_fields.map((field) => ({
      key: `event:${field}`,
      label: eventLabels[field] ?? field,
      read: () => recordValue(eventData[field]),
    })),
    ...sheet.student_fields.map((field) => ({
      key: `student:${field}`,
      label: studentLabels[field] ?? field,
      read: (student: OdSheetStudentView) => recordValue(asRecord(student.student_data)[field]),
    })),
    {
      key: 'attendance_status',
      label: 'Attendance status',
      read: (student: OdSheetStudentView) =>
        recordValue(asRecord(student.student_data).attendance_status),
    },
  ];
}

export function downloadOdSheetCsv(sheet: OdSheetView, students: OdSheetStudentView[]) {
  const columns = odSheetColumns(sheet);
  const lines = [
    columns.map((column) => csvCell(column.label)).join(','),
    ...students.map((student) => columns.map((column) => csvCell(column.read(student))).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileStem(sheet.title)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function printOdSheetPdf(sheet: OdSheetView, students: OdSheetStudentView[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  const columns = odSheetColumns(sheet);
  const headings = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const rows = students
    .map(
      (student) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(column.read(student))}</td>`).join('')}</tr>`,
    )
    .join('');
  printWindow.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sheet.title)}</title><style>
      body{font:12px Arial,sans-serif;padding:24px;color:#172033}h1{font-size:20px}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:7px;text-align:left;overflow-wrap:anywhere}
      th{background:#eee}tr{break-inside:avoid}@media print{body{padding:0}}
    </style></head><body><h1>${escapeHtml(sheet.title)}</h1>
    <table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`,
  );
  printWindow.document.close();
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function csvCell(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function fileStem(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'od-sheet'
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}
