import api from "./api";
import { Expense, StatusType } from "../types";

const mapBackendToExpense = (data: any): Expense => ({
  id: String(data.id),
  title: data.title ?? "",
  amount: Number(data.amount ?? 0),
  note: data.note ?? "",
  paidDate: data.paid_date ?? data.paidDate ?? "",
  status: backendToUiStatus(data.status),
});

export const getExpenses = async (): Promise<Expense[]> => {
  const response = await api.get("/adminapi/expenses/");
  const raw = response.data;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapBackendToExpense);
};

export const createExpense = async (payload: {
  title: string;
  amount: number;
  note: string;
  paid_date: string;
  status: string;
}): Promise<Expense> => {
  const response = await api.post("/adminapi/expenses/", payload);
  return mapBackendToExpense(response.data);
};

export type ExpenseUpdatePayload = Partial<{
  title: string;
  amount: number;
  note: string;
  paid_date: string;
  status: string;
}>;

export const updateExpense = async (
  id: string | number,
  payload: ExpenseUpdatePayload
): Promise<Expense> => {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.amount !== undefined) body.amount = payload.amount;
  if (payload.note !== undefined) body.note = payload.note;
  if (payload.paid_date !== undefined) body.paid_date = payload.paid_date;
  if (payload.status !== undefined) body.status = payload.status;
  const response = await api.patch(`/adminapi/expenses/${id}/`, body);
  return mapBackendToExpense(response.data);
};

export const deleteExpense = async (id: string | number): Promise<void> => {
  await api.delete(`/adminapi/expenses/${id}/`);
};

export const backendToUiStatus = (status: string): StatusType => {
  switch (String(status).toUpperCase()) {
    case "INPROCESS":
      return "Inprocess";
    case "COMPLETED":
      return "Completed";
    case "PENDING":
    default:
      return "Pending";
  }
};

export const uiToBackendStatus = (status: StatusType): string => {
  return status.toUpperCase();
};
