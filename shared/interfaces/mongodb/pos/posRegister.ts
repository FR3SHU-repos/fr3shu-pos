export type PosRegisterStatus = "active" | "archived";

export interface IPosRegister {
  _id?: string;

  orgId: string;
  locationId: string;
  name: string;
  code: string;
  status: PosRegisterStatus;

  createdAt?: Date;
  updatedAt?: Date;
}
