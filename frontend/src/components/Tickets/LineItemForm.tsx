import React, { useState } from 'react';
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
  MenuItem,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ticketsApi } from '@/api/tickets';
import { LineItemCreate } from '@/types';

interface LineItemFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticketId: string;
}

export const LineItemForm: React.FC<LineItemFormProps> = ({
  open,
  onClose,
  onSuccess,
  ticketId,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LineItemCreate>({
    item_type: 'part',
    description: '',
    quantity: 1,
    unit: 'unit',
    included_in_service: false,
    chargeable: true,
    external_reference: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await ticketsApi.createLineItem(ticketId, formData);
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
        <DialogTitle>{t('tickets.addLineItem')}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            select
            label={t('tickets.itemType')}
            value={formData.item_type}
            onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
            margin="normal"
            required
          >
            <MenuItem value="part">Part</MenuItem>
            <MenuItem value="service">Service</MenuItem>
            <MenuItem value="consumable">Consumable</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label={t('tickets.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            required
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            type="number"
            label={t('tickets.quantity')}
            value={formData.quantity}
            onChange={(e) =>
              setFormData({ ...formData, quantity: parseFloat(e.target.value) })
            }
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label={t('tickets.unit')}
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            margin="normal"
            required
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.included_in_service}
                onChange={(e) =>
                  setFormData({ ...formData, included_in_service: e.target.checked })
                }
              />
            }
            label={t('tickets.includedInService')}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.chargeable}
                onChange={(e) =>
                  setFormData({ ...formData, chargeable: e.target.checked })
                }
              />
            }
            label={t('tickets.chargeable')}
          />

          <TextField
            fullWidth
            label="External Reference"
            value={formData.external_reference || ''}
            onChange={(e) =>
              setFormData({ ...formData, external_reference: e.target.value })
            }
            margin="normal"
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
