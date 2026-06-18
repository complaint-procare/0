import type { Complaint } from './types'
import { fullPhone, isValidUaPhone } from './utils'

export interface ComplaintFormState {
  source_type: 'network' | 'client'
  retail_network_id: string
  retail_network_name: string
  phone_suffix: string
  brand_id: string
  product_name: string
  product_barcode: string
  batch_number: string
  complaint_group_id: string
  problem_description: string
  resolution_response: string
  severity_id: string
  status_id: string
  manager_id: string
}

export function createEmptyComplaintForm(managerId = ''): ComplaintFormState {
  return {
    source_type: 'network',
    retail_network_id: '',
    retail_network_name: '',
    phone_suffix: '',
    brand_id: '',
    product_name: '',
    product_barcode: '',
    batch_number: '',
    complaint_group_id: '',
    problem_description: '',
    resolution_response: '',
    severity_id: '',
    status_id: '',
    manager_id: managerId,
  }
}

export function complaintToForm(complaint: Complaint): ComplaintFormState {
  return {
    source_type: complaint.source_type ?? 'network',
    retail_network_id: complaint.retail_network_id ?? '',
    retail_network_name: '',
    phone_suffix: (complaint.client_phone ?? '').replace(/^\+?380/, ''),
    brand_id: complaint.brand_id ?? '',
    product_name: complaint.product_name ?? '',
    product_barcode: complaint.product_barcode ?? '',
    batch_number: complaint.batch_number,
    complaint_group_id: complaint.complaint_group_id ?? '',
    problem_description: complaint.problem_description,
    resolution_response: complaint.resolution_response ?? '',
    severity_id: complaint.severity_id ?? '',
    status_id: complaint.status_id ?? '',
    manager_id: complaint.manager_id,
  }
}

export function validateComplaintForm(form: ComplaintFormState): string | null {
  if (
    form.source_type === 'network' &&
    !form.retail_network_id &&
    !normalizeRetailNetworkName(form.retail_network_name)
  ) {
    return 'Вкажіть торгову мережу'
  }
  if (form.source_type === 'client' && !isValidUaPhone(form.phone_suffix)) {
    return 'Телефон має містити 9 цифр після +380'
  }
  if (
    !form.brand_id ||
    !form.product_name.trim() ||
    !form.batch_number.trim() ||
    !form.complaint_group_id ||
    !form.problem_description.trim() ||
    !form.severity_id ||
    !form.status_id
  ) {
    return 'Заповніть усі обовʼязкові поля'
  }
  return null
}

export function normalizeComplaintForm(form: ComplaintFormState) {
  return {
    source_type: form.source_type,
    retail_network_id:
      form.source_type === 'network' ? form.retail_network_id || null : null,
    client_phone: form.source_type === 'client' ? fullPhone(form.phone_suffix) : '',
    brand_id: form.brand_id || null,
    product_name: form.product_name.trim(),
    product_barcode: form.product_barcode.trim(),
    batch_number: form.batch_number.trim(),
    complaint_group_id: form.complaint_group_id,
    problem_description: form.problem_description.trim(),
    resolution_response: form.resolution_response.trim(),
    severity_id: form.severity_id,
    status_id: form.status_id,
    manager_id: form.manager_id,
  }
}

export function normalizeRetailNetworkName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
