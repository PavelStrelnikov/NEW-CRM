/**
 * Portal Attachments API - for portal users to upload/download files
 * Uses /api/v1/portal/attachments endpoints
 */
import { apiClient } from './client';

export interface PortalAttachment {
  id: string;
  linked_type: string;
  linked_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_by_actor_display: string;
  created_at: string;
}

export interface PortalAttachmentListResponse {
  items: PortalAttachment[];
  total: number;
}

export const portalAttachmentsApi = {
  /**
   * List attachments for an entity (portal users must specify linked_id)
   */
  listAttachments: async (linkedType: string, linkedId: string): Promise<PortalAttachmentListResponse> => {
    const response = await apiClient.get<PortalAttachmentListResponse>('/portal/attachments', {
      params: {
        linked_type: linkedType,
        linked_id: linkedId,
      },
    });
    return response.data;
  },

  /**
   * Upload an attachment file
   */
  uploadAttachment: async (linkedType: string, linkedId: string, file: File): Promise<PortalAttachment> => {
    const formData = new FormData();
    formData.append('linked_type', linkedType);
    formData.append('linked_id', linkedId);
    formData.append('file', file);

    const response = await apiClient.post<PortalAttachment>('/portal/attachments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Delete an attachment (CLIENT_ADMIN only)
   */
  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await apiClient.delete(`/portal/attachments/${attachmentId}`);
  },

  /**
   * Get download URL for an attachment
   */
  getDownloadUrl: (attachmentId: string): string => {
    return `/api/v1/portal/attachments/${attachmentId}/download`;
  },
};
