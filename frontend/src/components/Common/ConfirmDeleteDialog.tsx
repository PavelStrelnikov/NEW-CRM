/**
 * Reusable two-stage deletion confirmation dialog.
 * Stage 1: Shows usage summary and what will be deleted
 * Stage 2: Final confirmation (optionally requires name input for force delete)
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Box,
  Alert,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Chip,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';

export interface DeletionSummaryBase {
  can_delete: boolean;
  blocking_reason?: string;
  will_be_deleted: Record<string, number>;
  will_be_affected: Record<string, number>;
}

export interface ConfirmDeleteDialogProps<T extends DeletionSummaryBase> {
  open: boolean;
  onClose: () => void;
  onConfirm: (force: boolean) => void;
  isLoading?: boolean;
  isDeleting?: boolean;
  title: string;
  entityName: string;
  entityType: string;
  summary: T | null;
  renderSummaryDetails?: (summary: T) => React.ReactNode;
  requireNameConfirmation?: boolean;
}

export function ConfirmDeleteDialog<T extends DeletionSummaryBase>({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  isDeleting = false,
  title,
  entityName,
  entityType,
  summary,
  renderSummaryDetails,
  requireNameConfirmation = true,
}: ConfirmDeleteDialogProps<T>) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<'summary' | 'confirm'>('summary');
  const [forceDelete, setForceDelete] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStage('summary');
      setForceDelete(false);
      setNameInput('');
    }
  }, [open]);

  const handleProceed = () => {
    setStage('confirm');
  };

  const handleConfirm = () => {
    onConfirm(forceDelete);
  };

  const handleClose = () => {
    setStage('summary');
    setForceDelete(false);
    setNameInput('');
    onClose();
  };

  // Check if name matches for confirmation
  const nameMatches = !requireNameConfirmation ||
    !forceDelete ||
    nameInput.trim().toLowerCase() === entityName.trim().toLowerCase();

  // Translate keys for display
  const translateKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      sites: t('delete.sites'),
      contacts: t('delete.contacts'),
      client_users: t('delete.clientUsers'),
      tickets: t('delete.tickets'),
      assets: t('delete.assets'),
      projects: t('delete.projects'),
      locations: t('delete.locations'),
      contact_links: t('delete.contactLinks'),
      work_logs: t('delete.workLogs'),
      events: t('delete.events'),
      line_items: t('delete.lineItems'),
      assignment_history: t('delete.assignmentHistory'),
    };
    return keyMap[key] || key;
  };

  // Show loading state
  if (isLoading) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>{t('delete.loadingSummary')}</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Summary stage
  if (stage === 'summary' && summary) {
    const hasBlockingRecords = !summary.can_delete;
    const willBeDeletedEntries = Object.entries(summary.will_be_deleted).filter(([_, v]) => v > 0);
    const willBeAffectedEntries = Object.entries(summary.will_be_affected).filter(([_, v]) => v > 0);

    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('delete.summaryDescription', { name: entityName, type: entityType })}
          </DialogContentText>

          {/* Custom summary details (e.g., client name, usage stats) */}
          {renderSummaryDetails && renderSummaryDetails(summary)}

          {/* Will be permanently deleted */}
          {willBeDeletedEntries.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'error.main' }}>
                {t('delete.willBeDeleted')}:
              </Typography>
              <Table size="small">
                <TableBody>
                  {willBeDeletedEntries.map(([key, count]) => (
                    <TableRow key={key}>
                      <TableCell>{translateKey(key)}</TableCell>
                      <TableCell align="right">
                        <Chip label={count} size="small" color="error" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Records requiring force delete */}
          {willBeAffectedEntries.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'warning.main' }}>
                {t('delete.willBeAffected')}:
              </Typography>
              <Table size="small">
                <TableBody>
                  {willBeAffectedEntries.map(([key, count]) => (
                    <TableRow key={key} sx={{ bgcolor: 'warning.lighter' }}>
                      <TableCell>{translateKey(key)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={count}
                          size="small"
                          color="warning"
                          icon={<WarningIcon />}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Blocking warning */}
          {hasBlockingRecords && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {summary.blocking_reason}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    {t('delete.forceDeleteLabel')}
                  </Typography>
                }
              />
            </Alert>
          )}

          {/* Force delete warning */}
          {forceDelete && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('delete.forceDeleteWarning')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            {t('app.cancel')}
          </Button>
          <Button
            onClick={handleProceed}
            color="error"
            variant="contained"
            disabled={hasBlockingRecords && !forceDelete}
            startIcon={<WarningIcon />}
          >
            {t('app.continue')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Confirm stage
  return (
    <Dialog open={open && stage === 'confirm'} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: 'error.main' }}>
        {t('delete.confirmTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('delete.confirmMessage', { name: entityName })}
        </DialogContentText>

        {/* Name confirmation for force delete */}
        {forceDelete && requireNameConfirmation && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('delete.typeNameToConfirm', { name: entityName })}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={entityName}
              error={nameInput.length > 0 && !nameMatches}
              helperText={nameInput.length > 0 && !nameMatches ? t('delete.nameMismatch') : ''}
              autoFocus
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          {t('app.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={isDeleting || !nameMatches}
          startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {isDeleting ? t('app.loading') : t('delete.deleteButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
