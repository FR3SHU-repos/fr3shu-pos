export interface ICategory {
  _id?: string;

  orgId: string;
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
