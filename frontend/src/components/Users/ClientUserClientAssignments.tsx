/**
 * ClientUserClientAssignments: Admin dialog for managing multi-client assignments
 * for CLIENT_ADMIN users.
 *
 * Features:
 * - Checkbox list of all clients
 * - Primary client (disabled, always checked)
 * - Save button to update assignments
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { Business, CheckCircle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '../../api/clients';

interface ClientOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface ClientUserClientAssignmentsProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  primaryClientId: string;
  onSuccess?: () => void;
}

export const ClientUserClientAssignments: React.FC<ClientUserClientAssignmentsProps> = ({
  open,
  onClose,
  userId,
  userEmail,
  primaryClientId,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [availableClients, setAvailableClients] = useState<ClientOption[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available clients and current assignments
  useEffect(() => {
    if (open && userId) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all clients
      const clientsResponse = await clientsApi.listClients({ page: 1, page_size: 1000 });
      const clients = clientsResponse.items.map(client => ({
        id: client.id,
        name: client.name,
        isPrimary: client.id === primaryClientId
      }));

      // Sort: primary first, then alphabetically
      clients.sort((a, b) => {
        if (a.isPrimary) return -1;
        if (b.isPrimary) return 1;
        return a.name.localeCompare(b.name);
      });

      setAvailableClients(clients);

      // Load current assignments
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/admin/portal/client-users/${userId}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load current assignments');
      }

      const data = await response.json();
      const assignedIds = data.assigned_client_ids || [];

      setCurrentAssignments(assignedIds);
      setSelectedClientIds(new Set(assignedIds));
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleClient = (clientId: string) => {
    // Cannot uncheck primary client
    if (clientId === primaryClientId) {
      return;
    }

    setSelectedClientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    // Validation: primary client must be included
    if (!selectedClientIds.has(primaryClientId)) {
      setError('Primary client must be included in assignments');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/admin/portal/client-users/${userId}/clients`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_ids: Array.from(selectedClientIds)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update assignments');
      }

      // Success
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    if (currentAssignments.length !== selectedClientIds.size) {
      return true;
    }
    return !currentAssignments.every(id => selectedClientIds.has(id));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Business />
          <Typography variant="h6">
            {t('users.manageClientAssignments', 'Manage Client Assignments')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {userEmail}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('users.selectClientsDescription', 'Select which clients this CLIENT_ADMIN user can access. The primary client cannot be removed.')}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <FormGroup>
              {availableClients.map((client) => (
                <FormControlLabel
                  key={client.id}
                  control={
                    <Checkbox
                      checked={selectedClientIds.has(client.id)}
                      onChange={() => handleToggleClient(client.id)}
                      disabled={client.isPrimary || isSaving}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {client.name}
                      </Typography>
                      {client.isPrimary && (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: 'primary.lighter',
                            color: 'primary.main',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}
                        >
                          <CheckCircle sx={{ fontSize: 14 }} />
                          {t('users.primaryClient', 'Primary')}
                        </Box>
                      )}
                    </Box>
                  }
                />
              ))}
            </FormGroup>

            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                {t('users.selectedClientsCount', {
                  defaultValue: 'Selected: {{count}} client(s)',
                  count: selectedClientIds.size
                })}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading || isSaving || !hasChanges()}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
