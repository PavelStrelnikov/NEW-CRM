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
  Box,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/contexts/ToastContext';
import { ticketsApi } from '@/api/tickets';

interface WorkLogFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticketId: string;
  workLogId?: string;
  initialData?: any;
}

interface WorkLogFormData {
  work_type: string;
  description: string;
  time_mode: 'range' | 'duration';
  start_at: string;
  end_at: string;
  duration_minutes: number;
  included_in_service: boolean;
  billing_note: string;
}

const WORK_TYPES = [
  { value: 'phone', labelKey: 'tickets.workTypePhone' },
  { value: 'email', labelKey: 'tickets.workTypeEmail' },
  { value: 'whatsapp', labelKey: 'tickets.workTypeWhatsapp' },
  { value: 'remote', labelKey: 'tickets.workTypeRemote' },
  { value: 'onsite', labelKey: 'tickets.workTypeOnsite' },
  { value: 'travel', labelKey: 'tickets.workTypeTravel' },
  { value: 'repair_lab', labelKey: 'tickets.workTypeRepairLab' },
  { value: 'admin', labelKey: 'tickets.workTypeAdmin' },
  { value: 'other', labelKey: 'tickets.workTypeOther' },
];

export const WorkLogForm: React.FC<WorkLogFormProps> = ({
  open,
  onClose,
  onSuccess,
  ticketId,
  workLogId,
  initialData,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const getInitialFormData = (): WorkLogFormData => {
    if (initialData) {
      const hasTimeRange = initialData.end_at != null;
      return {
        work_type: initialData.work_type || 'phone',
        description: initialData.description || '',
        time_mode: hasTimeRange ? 'range' : 'duration',
        start_at: initialData.start_at ? new Date(initialData.start_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        end_at: initialData.end_at ? new Date(initialData.end_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        duration_minutes: initialData.duration_minutes || 30,
        included_in_service: initialData.included_in_service ?? true,
        billing_note: initialData.billing_note || '',
      };
    }
    return {
      work_type: 'phone',
      description: '',
      time_mode: 'duration',
      start_at: new Date().toISOString().slice(0, 16),
      end_at: new Date().toISOString().slice(0, 16),
      duration_minutes: 30,
      included_in_service: true,
      billing_note: '',
    };
  };

  const [formData, setFormData] = useState<WorkLogFormData>(getInitialFormData());

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (workLogId) {
        return await ticketsApi.updateWorkLog(workLogId, data);
      } else {
        return await ticketsApi.createWorkLog(ticketId, data);
      }
    },
    onSuccess: () => {
      showSuccess(workLogId ? t('tickets.activityUpdated') : t('tickets.activityCreated'));
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || error?.message || t('app.error'));
    },
  });

  React.useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, initialData]);

  const handleClose = () => {
    setFormData(getInitialFormData());
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build request payload based on time mode
    let payload: any = {
      work_type: formData.work_type,
      description: formData.description,
      included_in_service: formData.included_in_service,
      billing_note: formData.billing_note || null,
    };

    if (formData.time_mode === 'range') {
      // Mode A: Time range (start_at + end_at, duration computed by backend)
      payload.start_at = new Date(formData.start_at).toISOString();
      payload.end_at = new Date(formData.end_at).toISOString();
    } else {
      // Mode B: Duration only (start_at at 00:00 + duration_minutes)
      const dateOnly = formData.start_at.split('T')[0];
      payload.start_at = `${dateOnly}T00:00:00Z`;
      payload.end_at = null;
      payload.duration_minutes = formData.duration_minutes;
    }

    saveMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{workLogId ? t('tickets.editActivity') : t('tickets.addActivity')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Activity Type */}
            <TextField
              fullWidth
              select
              label={t('tickets.activityType') + ' *'}
              value={formData.work_type}
              onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
              required
            >
              {WORK_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {t(type.labelKey)}
                </MenuItem>
              ))}
            </TextField>

            {/* Description */}
            <TextField
              fullWidth
              label={t('tickets.description')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              multiline
              rows={3}
              placeholder={t('tickets.description') + '...'}
            />

            {/* Time Tracking Mode Selector */}
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('tickets.timeMode')}</FormLabel>
              <RadioGroup
                value={formData.time_mode}
                onChange={(e) => setFormData({ ...formData, time_mode: e.target.value as 'range' | 'duration' })}
              >
                <FormControlLabel
                  value="range"
                  control={<Radio />}
                  label={t('tickets.timeModeRange')}
                />
                <FormControlLabel
                  value="duration"
                  control={<Radio />}
                  label={t('tickets.timeModeDuration')}
                />
              </RadioGroup>
            </FormControl>

            {/* Time Range Mode */}
            {formData.time_mode === 'range' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 4, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label={t('tickets.startTime') + ' *'}
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  type="datetime-local"
                  label={t('tickets.endTime') + ' *'}
                  value={formData.end_at}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}

            {/* Duration Only Mode */}
            {formData.time_mode === 'duration' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 4, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                <TextField
                  fullWidth
                  type="date"
                  label={t('tickets.activityDate') + ' *'}
                  value={formData.start_at.split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value + 'T00:00' })}
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label={t('tickets.durationMinutes') + ' *'}
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                  required
                  inputProps={{ min: 1 }}
                />
              </Box>
            )}

            {/* Billing Options */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.included_in_service}
                  onChange={(e) => setFormData({ ...formData, included_in_service: e.target.checked })}
                />
              }
              label={t('tickets.includedInService')}
            />

            <TextField
              fullWidth
              label={t('tickets.billingNote')}
              value={formData.billing_note}
              onChange={(e) => setFormData({ ...formData, billing_note: e.target.value })}
              placeholder={t('tickets.billingNote') + '...'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saveMutation.isPending}>
            {t('app.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? t('app.loading') : t('app.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
