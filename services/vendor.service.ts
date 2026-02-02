import api from "./api";
import { Vendor } from "../types";

const mapBackendToVendor = (data: any): Vendor => ({
  id: String(data.id),
  name: data.business_name ?? "",
  address: data.office_address ?? "",
  email: data.email ?? "",
  phone: String(data.primary_phone ?? ""),
  altPhone: data.alternate_phone != null ? String(data.alternate_phone) : undefined,
  gstNumber: data.gst_number ?? "",
  status: "Pending",
});

export const getVendors = async (): Promise<Vendor[]> => {
  const response = await api.get("/adminapi/vendors/");
  const raw = response.data;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapBackendToVendor);
};

export const createVendor = async (payload: {
  business_name: string;
  gst_number: string;
  office_address: string;
  email: string;
  primary_phone: string | number;
  alternate_phone?: string | number;
}): Promise<Vendor> => {
  const body: Record<string, unknown> = {
    business_name: payload.business_name.trim(),
    gst_number: payload.gst_number.trim(),
    office_address: payload.office_address.trim(),
    email: payload.email.trim(),
    primary_phone: payload.primary_phone,
  };
  if (payload.alternate_phone !== undefined && payload.alternate_phone !== "") {
    body.alternate_phone = payload.alternate_phone;
  }
  const response = await api.post("/adminapi/vendors/", body);
  return mapBackendToVendor(response.data);
};

export type VendorUpdatePayload = Partial<{
  business_name: string;
  gst_number: string;
  office_address: string;
  email: string;
  primary_phone: string | number;
  alternate_phone: string | number | null;
}>;

export const updateVendor = async (
  id: string | number,
  payload: VendorUpdatePayload
): Promise<Vendor> => {
  const body: Record<string, unknown> = {};
  if (payload.business_name !== undefined) body.business_name = payload.business_name;
  if (payload.gst_number !== undefined) body.gst_number = payload.gst_number;
  if (payload.office_address !== undefined) body.office_address = payload.office_address;
  if (payload.email !== undefined) body.email = payload.email;
  if (payload.primary_phone !== undefined) body.primary_phone = payload.primary_phone;
  if (payload.alternate_phone !== undefined) body.alternate_phone = payload.alternate_phone;
  const response = await api.patch(`/adminapi/vendors/${id}/`, body);
  return mapBackendToVendor(response.data);
};

export const deleteVendor = async (id: string | number): Promise<void> => {
  await api.delete(`/adminapi/vendors/${id}/`);
};
