import { daysInMonth } from './format';
/** "12 days left this month" */
export function daysLeft() {
  const d = new Date();
  const left = daysInMonth(d.getFullYear(), d.getMonth() + 1) - d.getDate();
  return left === 0 ? 'last day of the month' : left === 1 ? '1 day left this month' : `${left} days left this month`;
}
