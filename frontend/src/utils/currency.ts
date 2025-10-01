const formatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number | null | undefined): string => {
  const numeric = typeof value === 'number' ? value : Number(value || 0);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return formatter.format(rounded);
};

