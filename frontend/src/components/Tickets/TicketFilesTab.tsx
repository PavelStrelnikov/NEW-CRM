/**
 * Files tab content for Ticket Details page.
 */
import React, { useState } from 'react';
import { Box, Paper, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { attachmentsApi } from '@/api/attachments';
import { portalAttachmentsApi } from '@/api/portalAttachments';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { FileUpload } from '@/components/Common/FileUpload';
import { AttachmentsList } from '@/components/Common/AttachmentsList';

interface TicketFilesTabProps {
  ticketId: string;
}

export const TicketFilesTab: React.FC<TicketFilesTabProps> = ({ ticketId }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Determine if portal user
  const isPortalUser = user?.user_type === 'client';

  // Can delete: admin only OR CLIENT_ADMIN for portal users
  const canDelete = isPortalUser
    ? user?.role === 'CLIENT_ADMIN'
    : user?.user_type === 'internal' && user?.role === 'admin';

  // Fetch attachments - use portal API for portal users
  const { data, isLoading, error } = useQuery({
    queryKey: ['attachments', 'ticket', ticketId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser
      ? portalAttachmentsApi.listAttachments('ticket', ticketId)
      : attachmentsApi.listAttachments('ticket', ticketId),
    enabled: !!ticketId,
  });

  // Upload mutation - use portal API for portal users
  const uploadMutation = useMutation({
    mutationFn: (file: File) => isPortalUser
      ? portalAttachmentsApi.uploadAttachment('ticket', ticketId, file)
      : attachmentsApi.uploadAttachment('ticket', ticketId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'ticket', ticketId] });
    },
    onError: (err: any) => {
      showError(err?.response?.data?.detail || t('files.uploadError'));
    },
  });

  // Delete mutation - use portal API for portal users
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => isPortalUser
      ? portalAttachmentsApi.deleteAttachment(attachmentId)
      : attachmentsApi.deleteAttachment(attachmentId),
    onMutate: (attachmentId) => {
      setDeletingId(attachmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'ticket', ticketId] });
      showSuccess(t('files.deleteSuccess'));
    },
    onError: (err: any) => {
      showError(err?.response?.data?.detail || t('files.deleteError'));
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleFileSelect = async (files: FileList) => {
    setIsUploading(true);
    let successCount = 0;
    try {
      // Upload files sequentially
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
        successCount++;
      }
      if (successCount > 0) {
        showSuccess(t('files.uploadSuccess'));
      }
    } catch {
      // Error already shown by mutation
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (attachmentId: string) => {
    deleteMutation.mutate(attachmentId);
  };

  return (
    <Box>
      {/* Upload Section */}
      <Box sx={{ mb: 3 }}>
        <FileUpload
          onFileSelect={handleFileSelect}
          disabled={uploadMutation.isPending}
          isUploading={isUploading}
          multiple
        />
      </Box>

      {/* Files List */}
      <Paper sx={{ overflow: 'hidden' }}>
        {error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {t('app.error')}
          </Alert>
        ) : (
          <AttachmentsList
            attachments={data?.items || []}
            isLoading={isLoading}
            canDelete={canDelete}
            onDelete={handleDelete}
            isDeleting={deletingId}
          />
        )}
      </Paper>
    </Box>
  );
};

export default TicketFilesTab;
