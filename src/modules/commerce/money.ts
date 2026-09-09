export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}
