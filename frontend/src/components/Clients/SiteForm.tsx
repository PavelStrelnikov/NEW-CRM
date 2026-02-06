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
import { portalClientsApi } from '@/api/portalClients';
import { Site, SiteCreate, SiteUpdate } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface SiteFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: string;
  site?: Site;
}

export const SiteForm: React.FC<SiteFormProps> = ({
  open,
  onClose,
  onSuccess,
  clientId,
  site,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPortalUser = user?.user_type === 'portal';
  const [formData, setFormData] = useState<SiteCreate | SiteUpdate>({
    client_id: clientId,
    name: '',
    address: '',
    is_default: false,
    notes: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        address: site.address,
        is_default: site.is_default,
        notes: site.notes,
      });
    } else {
      setFormData({
        client_id: clientId,
        name: '',
        address: '',
        is_default: false,
        notes: '',
      });
    }
  }, [site, clientId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (site) {
        // Route update to correct API based on user type
        if (isPortalUser) {
          await portalClientsApi.updateSite(site.id, formData);
        } else {
          await clientsApi.updateSite(site.id, formData);
        }
      } else {
        // Route create to correct API based on user type
        if (isPortalUser) {
          await portalClientsApi.createSite(formData as SiteCreate);
        } else {
          await clientsApi.createSite(clientId, formData as SiteCreate);
        }
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
          {site ? t('sites.edit') : t('sites.create')}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label={t('sites.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label={t('sites.address')}
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            label={t('sites.notes')}
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_default ?? false}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              />
            }
            label={t('sites.isDefault')}
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
