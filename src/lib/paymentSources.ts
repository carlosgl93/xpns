import { PaymentSource } from '../types/models';

export { PaymentSource };

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  [PaymentSource.CorporateCredit]: 'Tarjeta de crédito corporativa',
  [PaymentSource.CorporateDebit]: 'Tarjeta de débito corporativa',
  [PaymentSource.PersonalCredit]: 'Tarjeta de crédito personal',
  [PaymentSource.PersonalDebit]: 'Tarjeta de débito personal',
  [PaymentSource.Cash]: 'Efectivo',
};

export type ReimbursementGroup = 'corporate' | 'personal';

export const PAYMENT_SOURCE_GROUP: Record<PaymentSource, ReimbursementGroup> = {
  [PaymentSource.CorporateCredit]: 'corporate',
  [PaymentSource.CorporateDebit]: 'corporate',
  [PaymentSource.PersonalCredit]: 'personal',
  [PaymentSource.PersonalDebit]: 'personal',
  [PaymentSource.Cash]: 'personal',
};
