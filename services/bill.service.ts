    import api from "./api";
    import { BillCategory } from "../types";
    import { Bill } from "../types";


    export const getBillCategories = async (): Promise<BillCategory[]> => {
    const response = await api.get("/adminapi/billCategory/");
    return response.data;
    };

export const createBill = async (payload: {
  category: string;
  amount: number;
  recipient: string;
  date: string;
  status: string;
}): Promise<Bill> => {
  const response = await api.post("/adminapi/bills/", payload);
  return response.data;
};

export const getBills = async (): Promise<Bill[]> => {
  const response = await api.get("/adminapi/bills/");
  return Array.isArray(response.data) ? response.data : [response.data];
};