/**
 * Attachments API client.
 * Handles file uploads, downloads, and management for tickets, assets, and other entities.
 */
import { apiClient } from './client';

export type LinkedType = 'ticket' | 'asset' | 'project' | 'site' | 'client';

export interface Attachment {
  id: string;
  linked_type: LinkedType;
  linked_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_actor_display: string;
  created_at: string;
}

export interface AttachmentListResponse {
  items: Attachment[];
  total: number;
}

export const attachmentsApi = {
  /**
   * List attachments for an entity.
   */
  listAttachments: async (
    linkedType: LinkedType,
    linkedId: string
  ): Promise<AttachmentListResponse> => {
    const response = await apiClient.get<AttachmentListResponse>('/attachments', {
      params: { linked_type: linkedType, linked_id: linkedId },
    });
    return response.data;
  },

  /**
   * Upload a file attachment.
   */
  uploadAttachment: async (
    linkedType: LinkedType,
    linkedId: string,
    file: File
  ): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('linked_type', linkedType);
    formData.append('linked_id', linkedId);
    formData.append('file', file);

    const response = await apiClient.post<Attachment>('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Get download URL for an attachment.
   */
  getDownloadUrl: (attachmentId: string): string => {
    const baseUrl = apiClient.defaults.baseURL || '/api/v1';
    return `${baseUrl}/attachments/${attachmentId}/download`;
  },

  /**
   * Download an attachment (returns blob).
   */
  downloadAttachment: async (attachmentId: string): Promise<Blob> => {
    const response = await apiClient.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Delete an attachment (admin only).
   */
  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await apiClient.delete(`/attachments/${attachmentId}`);
  },
};
