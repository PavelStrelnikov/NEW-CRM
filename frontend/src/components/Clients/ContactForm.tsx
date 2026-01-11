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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/api/clients';
import { Contact, ContactCreate, ContactUpdate } from '@/types';

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: string;
  contact?: Contact;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  open,
  onClose,
  onSuccess,
  clientId,
  contact,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ContactCreate | ContactUpdate>({
    client_id: clientId,
    name: '',
    phone: '',
    email: '',
    position: '',
    notes: '',
    applies_to_all_sites: true,
    site_ids: [],
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch sites for this client
  const { data: sitesData } = useQuery({
    queryKey: ['sites', clientId],
    queryFn: () => clientsApi.listSites(clientId),
    enabled: open,
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        position: contact.position,
        notes: contact.notes,
        applies_to_all_sites: contact.applies_to_all_sites,
        site_ids: contact.site_ids || [],
      });
    } else {
      setFormData({
        client_id: clientId,
        name: '',
        phone: '',
        email: '',
        position: '',
        notes: '',
        applies_to_all_sites: true,
        site_ids: [],
      });
    }
  }, [contact, clientId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate site selection
    if (!formData.applies_to_all_sites && (!formData.site_ids || formData.site_ids.length === 0)) {
      setError(t('contacts.selectSitesRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (contact) {
        await clientsApi.updateContact(contact.id, formData);
      } else {
        await clientsApi.createContact(clientId, formData as ContactCreate);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('app.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sites = sitesData?.items || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {contact ? t('contacts.edit') : t('contacts.create')}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label={t('contacts.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label={t('contacts.position')}
            value={formData.position || ''}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('contacts.phone')}
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('contacts.email')}
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label={t('contacts.notes')}
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.applies_to_all_sites ?? true}
                onChange={(e) => setFormData({
                  ...formData,
                  applies_to_all_sites: e.target.checked,
                  site_ids: e.target.checked ? [] : formData.site_ids,
                })}
              />
            }
            label={t('contacts.appliesToAllSites')}
            sx={{ mt: 2 }}
          />

          {!formData.applies_to_all_sites && (
            <FormControl fullWidth margin="normal">
              <InputLabel>{t('contacts.selectSites')}</InputLabel>
              <Select
                multiple
                value={formData.site_ids || []}
                onChange={(e) => setFormData({
                  ...formData,
                  site_ids: typeof e.target.value === 'string'
                    ? [e.target.value]
                    : e.target.value,
                })}
                input={<OutlinedInput label={t('contacts.selectSites')} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((siteId) => {
                      const site = sites.find((s) => s.id === siteId);
                      return (
                        <Chip key={siteId} label={site?.name || siteId} size="small" />
                      );
                    })}
                  </Box>
                )}
              >
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
