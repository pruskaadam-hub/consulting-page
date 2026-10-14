export function studentPrice(price, discountPercent) {
  return Math.round(price * 100 * (100 - discountPercent) / 100) / 100;
}
export const PRICES = {
  individual:1800,
  package:4050,
  studentIndividualDiscount:28,
  studentPackageDiscount:35,
};
export const STUDENT_PRICES = {
  individual:studentPrice(PRICES.individual,PRICES.studentIndividualDiscount),
  package:studentPrice(PRICES.package,PRICES.studentPackageDiscount),
};
export function currencyLabel(price,language='cs') {
  if(price===0)return {cs:'Zdarma',sk:'Zadarmo',en:'Free'}[language];
  return new Intl.NumberFormat({cs:'cs-CZ',sk:'sk-SK',en:'en-GB'}[language],{
    style:'currency',currency:'CZK',minimumFractionDigits:Number.isInteger(price) ? 0 : 2,maximumFractionDigits:2,
  }).format(price);
}
