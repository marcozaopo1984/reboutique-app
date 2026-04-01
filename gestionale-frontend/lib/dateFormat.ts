export function formatDateIT(value: any): string {
  if (!value) return '';

  let ymd = '';

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      ymd = s;
    } else if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      ymd = s.slice(0, 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      return s;
    } else {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      ymd = d.toISOString().slice(0, 10);
    }
  } else if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    ymd = value.toISOString().slice(0, 10);
  } else if (typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    ymd = d.toISOString().slice(0, 10);
  } else if (typeof value === 'object' && typeof value._seconds === 'number') {
    const d = new Date(value._seconds * 1000);
    if (Number.isNaN(d.getTime())) return '';
    ymd = d.toISOString().slice(0, 10);
  } else {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [yyyy, mm, dd] = ymd.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
