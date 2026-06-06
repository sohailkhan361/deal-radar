export interface Deal {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}
