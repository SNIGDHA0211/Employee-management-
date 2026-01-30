    import api from "./api";
    import { BillCategory } from "../types";
    import { Bill } from "../types";
    import { StatusType } from "../types";



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

export const deleteBill = async (id: number): Promise<void> => {
  await api.delete(`/adminapi/bills/${id}/`);
};

// Backend → UI
export const backendToUiStatus = (status: string): StatusType => {
  switch (status) {
    case "INPROCESS":
      return "Inprocess";
    case "COMPLETED":
      return "Completed";
    case "PENDING":
    default:
      return "Pending";
  }
};

// UI → Backend
export const uiToBackendStatus = (status: StatusType): string => {
  return status.toUpperCase();
};



export const updateBillStatus = async (
  id: number,
  status: StatusType
): Promise<Bill> => {
  const response = await api.patch(`/adminapi/bills/${id}/`, {
    status: uiToBackendStatus(status),
  });
  return response.data;
};

export const updateBill = async (
  id: number,
  payload: {
    category: string;
    amount: number;
    recipient: string;
    date: string;
    status: string;
  }
): Promise<Bill> => {
  const response = await api.put(`/adminapi/bills/${id}/`, payload);
  return response.data;
};