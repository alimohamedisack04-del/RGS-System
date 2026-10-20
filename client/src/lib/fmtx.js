import { money } from './format';
/** "$95.12" or "$90.00 – $120.00" */
export const rentRange = (min, max) => (min === null || min === undefined ? '—' : Number(min) === Number(max) ? money(min) : `${money(min)} – ${money(max)}`);
