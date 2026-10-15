// Fixed prices are authoritative; percentages are derived and rounded only for display.
export const STUDENT_PRICES = { individual:1500, package:3500 };
const discount = (regular, reduced) => (regular-reduced)/regular*100;
const regularPrices = { individual:1800, package:4500 };
export const PRICES = {
  ...regularPrices,
  studentIndividualDiscount:discount(regularPrices.individual,STUDENT_PRICES.individual),
  studentPackageDiscount:discount(regularPrices.package,STUDENT_PRICES.package),
};
export const PACKAGE_COMPARISON_PRICE = PRICES.individual*3;
export const PACKAGE_SAVINGS = PACKAGE_COMPARISON_PRICE-PRICES.package;
export const PACKAGE_DISCOUNT = discount(PACKAGE_COMPARISON_PRICE,PRICES.package);
export function discountLabel(percent,language='cs') {
  return new Intl.NumberFormat({cs:'cs-CZ',sk:'sk-SK',en:'en-GB'}[language],{maximumFractionDigits:1}).format(percent);
}
export function currencyLabel(price,language='cs') {
  if(price===0)return {cs:'Zdarma',sk:'Zadarmo',en:'Free'}[language];
  return new Intl.NumberFormat({cs:'cs-CZ',sk:'sk-SK',en:'en-GB'}[language],{
    style:'currency',currency:'CZK',minimumFractionDigits:Number.isInteger(price) ? 0 : 2,maximumFractionDigits:2,
  }).format(price);
}
