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
import { WorkLogCreate } from '@/types';

interface WorkLogFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticketId: string;
}

export const WorkLogForm: React.FC<WorkLogFormProps> = ({
  open,
  onClose,
  onSuccess,
  ticketId,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<WorkLogCreate>({
    work_type: 'on_site',
    description: '',
    duration_minutes: 0,
    included_in_service: true,
    billing_note: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await ticketsApi.createWorkLog(ticketId, formData);
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
        <DialogTitle>{t('tickets.addWorkLog')}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            select
            label={t('tickets.workType')}
            value={formData.work_type}
            onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
            margin="normal"
            required
          >
            <MenuItem value="on_site">On Site</MenuItem>
            <MenuItem value="remote">Remote</MenuItem>
            <MenuItem value="phone">Phone</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label={t('tickets.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            required
            multiline
            rows={3}
          />

          <TextField
            fullWidth
            type="number"
            label={t('tickets.duration')}
            value={formData.duration_minutes}
            onChange={(e) =>
              setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
            }
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

          <TextField
            fullWidth
            label="Billing Note"
            value={formData.billing_note || ''}
            onChange={(e) => setFormData({ ...formData, billing_note: e.target.value })}
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
