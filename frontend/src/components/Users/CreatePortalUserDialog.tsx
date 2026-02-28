/**
 * Dialog for creating new portal users (CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Typography
} from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { portalUsersApi, PortalUserCreate } from '../../api/portalUsers';
import { clientsApi } from '../../api/clients';
import { Client } from '../../types';

interface CreatePortalUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (userId: string) => void;
}

export const CreatePortalUserDialog: React.FC<CreatePortalUserDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PortalUserCreate>({
    email: '',
    name: '',
    password: '',
    role: 'CLIENT_ADMIN',
    client_id: '',
    is_active: true
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clients on mount
  useEffect(() => {
    if (open) {
      loadClients();
      // Reset form
      setFormData({
        email: '',
        name: '',
        password: '',
        role: 'CLIENT_ADMIN',
        client_id: '',
        is_active: true
      });
      setError(null);
    }
  }, [open]);

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await clientsApi.listClients({ page_size: 1000 });
      setClients(response.items);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients list');
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleChange = (field: keyof PortalUserCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.email) {
      setError('Email is required');
      return;
    }
    if (!formData.name) {
      setError('Name is required');
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!formData.client_id) {
      setError('Primary client is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newUser = await portalUsersApi.create(formData);
      if (onSuccess) {
        onSuccess(newUser.id);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to create portal user:', err);
      setError(err.response?.data?.detail || 'Failed to create portal user');
    } finally {
      setIsSaving(false);
    }
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
          <PersonAdd />
          <Typography variant="h6">
            {t('portalUsers.createUser', 'Create Portal User')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          {/* Email */}
          <TextField
            label={t('portalUsers.email', 'Email')}
            type="email"
            value={formData.email}
            onChange={e => handleChange('email', e.target.value)}
            required
            fullWidth
            disabled={isSaving}
          />

          {/* Name */}
          <TextField
            label={t('portalUsers.name', 'Name')}
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            required
            fullWidth
            disabled={isSaving}
          />

          {/* Password */}
          <TextField
            label={t('portalUsers.password', 'Password')}
            type="password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            required
            fullWidth
            disabled={isSaving}
            helperText={t('portalUsers.passwordHelp', 'Minimum 8 characters')}
          />

          {/* Role */}
          <FormControl fullWidth required>
            <InputLabel>{t('portalUsers.role', 'Role')}</InputLabel>
            <Select
              value={formData.role}
              onChange={e => handleChange('role', e.target.value)}
              label={t('portalUsers.role', 'Role')}
              disabled={isSaving}
            >
              <MenuItem value="CLIENT_ADMIN">CLIENT_ADMIN</MenuItem>
              <MenuItem value="CLIENT_USER">CLIENT_USER</MenuItem>
              <MenuItem value="CLIENT_CONTACT">CLIENT_CONTACT</MenuItem>
            </Select>
          </FormControl>

          {/* Primary Client */}
          <FormControl fullWidth required>
            <InputLabel>{t('portalUsers.primaryClient', 'Primary Client')}</InputLabel>
            <Select
              value={formData.client_id}
              onChange={e => handleChange('client_id', e.target.value)}
              label={t('portalUsers.primaryClient', 'Primary Client')}
              disabled={isSaving || isLoadingClients}
            >
              {isLoadingClients ? (
                <MenuItem disabled>
                  <CircularProgress size={20} />
                  <Box ml={1}>Loading...</Box>
                </MenuItem>
              ) : (
                clients.map(client => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Info text */}
          {formData.role === 'CLIENT_ADMIN' && (
            <Alert severity="info">
              {t(
                'portalUsers.clientAdminInfo',
                'After creating this CLIENT_ADMIN user, you can assign additional clients using "Manage Clients" button.'
              )}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSaving || isLoadingClients}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {t('common.create', 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
