export type Category =
  | 'Rapido'
  | 'Bus/GSRTC'
  | 'Food & Drinks'
  | 'Shopping'
  | 'Social'
  | 'Recharge/Bills'
  | 'Self Care'
  | 'Transfer/Sent'
  | 'Other';

export type Mode = 'Online' | 'Cash';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  message?: string;
}
