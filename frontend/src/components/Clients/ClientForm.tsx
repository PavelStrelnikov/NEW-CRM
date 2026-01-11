import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { Client, ClientCreate, ClientUpdate } from '@/types';

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: Client;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  open,
  onClose,
  onSuccess,
  client,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ClientCreate | ClientUpdate>({
    name: '',
    tax_id: '',
    main_phone: '',
    main_email: '',
    main_address: '',
    is_active: true,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        tax_id: client.tax_id,
        main_phone: client.main_phone,
        main_email: client.main_email,
        main_address: client.main_address,
        is_active: client.is_active,
      });
    } else {
      setFormData({
        name: '',
        tax_id: '',
        main_phone: '',
        main_email: '',
        main_address: '',
        is_active: true,
      });
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (client) {
        await clientsApi.updateClient(client.id, formData);
      } else {
        await clientsApi.createClient(formData as ClientCreate);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('app.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {client ? t('clients.edit') : t('clients.create')}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label={t('clients.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label={t('clients.taxId')}
            value={formData.tax_id || ''}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('clients.phone')}
            value={formData.main_phone || ''}
            onChange={(e) => setFormData({ ...formData, main_phone: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('clients.email')}
            type="email"
            value={formData.main_email || ''}
            onChange={(e) => setFormData({ ...formData, main_email: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('clients.address')}
            value={formData.main_address || ''}
            onChange={(e) => setFormData({ ...formData, main_address: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_active ?? true}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
            }
            label={t('clients.isActive')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('app.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? t('app.loading') : t('app.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
