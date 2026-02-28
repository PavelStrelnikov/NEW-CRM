import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ticketsApi } from '@/api/tickets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { portalTicketsApi } from '@/api/portalTickets';
import { TicketCreate, Client, Site, Contact } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

interface TicketFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ticketId?: string) => void;
  ticketId?: string;
  initialData?: any;
  /** Pre-filled data for new tickets (e.g., from probe) */
  prefillData?: {
    client_id?: string;
    site_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    source_channel?: string;
    asset_id?: string; // Primary asset to link
  };
  /** @deprecated Use prefillData.asset_id instead. Kept for backwards compatibility. */
  linkAssetId?: string;
}

export const TicketForm: React.FC<TicketFormProps> = ({
  open,
  onClose,
  onSuccess,
  ticketId,
  initialData,
  prefillData,
  linkAssetId,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  const CHANNEL_OPTIONS = [
    { value: 'phone', label: t('tickets.channelPhone') },
    { value: 'whatsapp', label: t('tickets.channelWhatsapp') },
    { value: 'email', label: t('tickets.channelEmail') },
    { value: 'other', label: t('tickets.channelOther') },
  ];

  const [formData, setFormData] = useState<Partial<TicketCreate>>({
    title: '',
    description: '',
    category_id: undefined,
    priority: 'normal',
    source_channel: 'manual',
    reported_via: 'phone',
    service_scope: 'not_included',
    contact_phone: '',
    client_id: undefined,
    site_id: undefined,
    contact_person_id: undefined,
    callback_contact_id: undefined,
    asset_id: undefined, // Primary asset link
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedCallbackContact, setSelectedCallbackContact] = useState<Contact | null>(null);
  const [sameAsOpener, setSameAsOpener] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients', '', false, 'name', 'asc', 1],
    queryFn: async (): Promise<{ items: Client[]; total: number; page: number; page_size: number }> => {
      if (user?.user_type === 'portal') {
        // For portal users, use portal clients API
        const response = await portalClientsApi.list();
        // Convert PortalClient to Client format
        const items: Client[] = response.items.map(pc => ({
          id: pc.id,
          name: pc.name,
          status: pc.is_active ? 'active' : 'inactive',
        } as Client));
        return {
          items,
          total: response.total,
          page: 1,
          page_size: response.total,
        };
      } else {
        // For admin users, use admin API
        return clientsApi.listClients({
          page: 1,
          page_size: 100,
          sort: 'name',
          order: 'asc',
        });
      }
    },
    enabled: !!user, // Only load when user is available
  });

  // Fetch sites for selected client
  const { data: sites } = useQuery({
    queryKey: ['sites', selectedClient?.id, user?.user_type],
    queryFn: async (): Promise<{ items: Site[]; total: number }> => {
      if (user?.user_type === 'portal') {
        const response = await portalClientsApi.listSites(selectedClient!.id);
        // Convert PortalSite to Site format (note: PortalSite doesn't have city field)
        const items: Site[] = response.items.map(ps => ({
          id: ps.id,
          client_id: ps.client_id,
          name: ps.name,
          address: ps.address,
        } as Site));
        return { items, total: response.total };
      } else {
        return clientsApi.listSites(selectedClient!.id);
      }
    },
    enabled: !!selectedClient && !!user,
  });

  // Fetch contacts for selected client
  const { data: contacts } = useQuery({
    queryKey: ['contacts', selectedClient?.id, user?.user_type],
    queryFn: async (): Promise<{ items: Contact[]; total: number }> => {
      if (user?.user_type === 'portal') {
        const response = await portalClientsApi.listContacts(selectedClient!.id);
        // Convert PortalContact to Contact format
        const items: Contact[] = response.items.map(pc => ({
          id: pc.id,
          client_id: pc.client_id,
          name: pc.name,
          phone: pc.phone,
          email: pc.email,
          position: pc.position,
          notes: pc.notes,
          applies_to_all_sites: pc.applies_to_all_sites,
          site_ids: [], // Portal API doesn't return site_ids
        } as Contact));
        return { items, total: response.total };
      } else {
        return clientsApi.listContacts(selectedClient!.id);
      }
    },
    enabled: !!selectedClient && !!user,
  });

  // Fetch categories for dropdown (admin only - portal users don't have access)
  const { data: categories } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => ticketsApi.listTicketCategories(),
    enabled: user?.user_type === 'internal', // Only load for admin users
  });

  // Filter contacts by selected site (if applicable)
  const filteredContacts = React.useMemo(() => {
    if (!contacts?.items) return [];
    if (!selectedSite) return contacts.items;

    return contacts.items.filter((contact) => {
      // Portal API already filters by site access, so check applies_to_all_sites
      if (user?.user_type === 'portal') {
        return contact.applies_to_all_sites || true; // Portal backend handles filtering
      }
      // Internal API returns all contacts, filter by site_ids
      return contact.applies_to_all_sites || (contact.site_ids?.includes(selectedSite.id) ?? false);
    });
  }, [contacts, selectedSite, user?.user_type]);

  // Handle client change
  const handleClientChange = (client: Client | null) => {
    setSelectedClient(client);
    setSelectedSite(null);
    setSelectedContact(null);
    setSelectedCallbackContact(null);
    setFormData((prev) => ({
      ...prev,
      client_id: client?.id,
      site_id: undefined,
      contact_person_id: undefined,
      callback_contact_id: undefined,
    }));
  };

  // Handle site change
  const handleSiteChange = (site: Site | null) => {
    setSelectedSite(site);
    setSelectedContact(null);
    setSelectedCallbackContact(null);
    setFormData((prev) => ({
      ...prev,
      site_id: site?.id,
      contact_person_id: undefined,
      callback_contact_id: undefined,
    }));
  };

  // Handle contact change (opener)
  const handleContactChange = (contact: Contact | null) => {
    setSelectedContact(contact);
    setFormData((prev) => ({
      ...prev,
      contact_person_id: contact?.id,
      contact_phone: contact?.phone || prev.contact_phone || '',
      callback_contact_id: sameAsOpener ? contact?.id : prev.callback_contact_id,
    }));

    // If "same as opener" is checked, update callback contact too
    if (sameAsOpener) {
      setSelectedCallbackContact(contact);
    }
  };

  // Handle callback contact change
  const handleCallbackContactChange = (contact: Contact | null) => {
    setSelectedCallbackContact(contact);
    setFormData((prev) => ({
      ...prev,
      callback_contact_id: contact?.id,
      contact_phone: contact?.phone || prev.contact_phone || '',
    }));
  };

  // Handle "same as opener" checkbox
  const handleSameAsOpenerChange = (checked: boolean) => {
    setSameAsOpener(checked);
    if (checked && selectedContact) {
      setSelectedCallbackContact(selectedContact);
      setFormData((prev) => ({
        ...prev,
        callback_contact_id: selectedContact.id,
        contact_phone: selectedContact.phone || prev.contact_phone,
      }));
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TicketCreate) => {
      // Use portal API for portal users, admin API for internal users
      if (user?.user_type === 'portal') {
        return portalTicketsApi.create(data);
      } else {
        return ticketsApi.createTicket(data);
      }
    },
    onSuccess: (result) => {
      // asset_id is now included in the ticket data, no separate linking needed
      showSuccess(t('tickets.createSuccess'));
      onSuccess(result.id);
    },
    onError: (error: any) => {
      showError(error?.message || t('app.error'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) => {
      // Portal users cannot update tickets (no update endpoint in portal API)
      // Only admin users can update
      return ticketsApi.updateTicket(data.id, data.updates);
    },
    onSuccess: () => {
      showSuccess(t('tickets.updateSuccess'));
      onSuccess();
    },
    onError: (error: any) => {
      showError(error?.message || t('app.error'));
    },
  });

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id) {
      showError(t('tickets.clientRequired'));
      return;
    }
    if (!formData.site_id) {
      showError(t('tickets.siteRequired'));
      return;
    }
    if (!formData.contact_person_id) {
      showError(t('tickets.contactRequired'));
      return;
    }
    if (!formData.reported_via) {
      showError(t('tickets.channelRequired'));
      return;
    }

    if (ticketId) {
      updateMutation.mutate({
        id: ticketId,
        updates: formData,
      });
    } else {
      createMutation.mutate(formData as TicketCreate);
    }
  };

  // Reset form state completely
  const resetFormState = () => {
    setFormData({
      title: '',
      description: '',
      category_id: undefined,
      priority: 'normal',
      source_channel: 'manual',
      reported_via: 'phone',
      service_scope: 'not_included',
      contact_phone: '',
      client_id: undefined,
      site_id: undefined,
      contact_person_id: undefined,
      callback_contact_id: undefined,
    });
    setSelectedClient(null);
    setSelectedSite(null);
    setSelectedContact(null);
    setSelectedCallbackContact(null);
    setSameAsOpener(true);
    setIsInitializing(false);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow dialog close animation
      const timer = setTimeout(() => {
        resetFormState();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Initialize form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (!ticketId) {
      // Create mode - check for prefillData
      if (prefillData && clientsData?.items) {
        setIsInitializing(true);

        // Determine asset_id from prefillData or deprecated linkAssetId prop
        const assetId = prefillData.asset_id || linkAssetId;

        // Set form data from prefill
        setFormData((prev) => ({
          ...prev,
          title: prefillData.title || prev.title,
          description: prefillData.description || prev.description,
          priority: prefillData.priority || prev.priority,
          source_channel: prefillData.source_channel || 'system', // Auto-generated tickets use 'system'
          client_id: prefillData.client_id,
          site_id: prefillData.site_id,
          asset_id: assetId, // Link to primary asset
        }));

        // Find and set client
        const client = clientsData.items.find((c: Client) => c.id === prefillData.client_id);
        if (client) {
          setSelectedClient(client);
        }
      }
      return;
    }

    // Edit mode - wait for clientsData before initializing
    if (initialData && clientsData?.items) {
      setIsInitializing(true);

      // Set form data
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        category_id: initialData.category_id || undefined,
        priority: initialData.priority || 'normal',
        source_channel: initialData.source_channel || 'manual',
        reported_via: initialData.reported_via || 'phone',
        service_scope: initialData.service_scope || 'not_included',
        contact_phone: initialData.contact_phone || '',
        client_id: initialData.client_id,
        site_id: initialData.site_id,
        contact_person_id: initialData.contact_person_id,
        callback_contact_id: initialData.callback_contact_id,
      });

      // Find and set client
      const client = clientsData.items.find((c: Client) => c.id === initialData.client_id);
      if (client) {
        setSelectedClient(client);
      }

      // Set "same as opener" checkbox
      const isSame = !initialData.callback_contact_id ||
                     initialData.callback_contact_id === initialData.contact_person_id;
      setSameAsOpener(isSame);
    }
  }, [open, ticketId, initialData, clientsData]);

  // Once client is set and sites are loaded, set the site (edit mode or prefill)
  useEffect(() => {
    if (!isInitializing || !selectedClient) return;
    if (!sites?.items) return;

    // Determine target site_id from initialData (edit) or prefillData (create from probe)
    const targetSiteId = initialData?.site_id || prefillData?.site_id;
    if (!targetSiteId) return;

    // Only set if not already set to prevent loops
    if (selectedSite?.id === targetSiteId) return;

    const site = sites.items.find((s: Site) => s.id === targetSiteId);
    if (site) {
      setSelectedSite(site);
    }
  }, [isInitializing, selectedClient, sites, initialData, prefillData, selectedSite]);

  // Once site is set and contacts are loaded, set the contacts (edit mode) or finish init (prefill mode)
  useEffect(() => {
    if (!isInitializing || !selectedSite) return;
    if (!contacts?.items) return;

    // Prefill mode (no initialData) - just finish initialization, user picks contact
    if (!initialData) {
      setIsInitializing(false);
      return;
    }

    // Edit mode - set contacts from initialData
    const opener = contacts.items.find((c: Contact) => c.id === initialData.contact_person_id);
    const callback = contacts.items.find((c: Contact) => c.id === initialData.callback_contact_id);

    // Check if we need to update
    const needsOpenerUpdate = opener && selectedContact?.id !== opener.id;
    const needsCallbackUpdate = callback && selectedCallbackContact?.id !== callback.id;

    if (needsOpenerUpdate) {
      setSelectedContact(opener);
    }

    if (needsCallbackUpdate) {
      setSelectedCallbackContact(callback);
    }

    // Only finish initialization if opener is set (required field)
    if (opener && !needsOpenerUpdate) {
      setIsInitializing(false);
    }
  }, [isInitializing, selectedSite, contacts, initialData, selectedContact, selectedCallbackContact]);

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {ticketId ? t('tickets.editTicket') : t('tickets.createTicket')}
        </DialogTitle>
        <DialogContent>
          {isInitializing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Section A: Ticket Opening Details */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('tickets.ticketOpeningDetails')}
              </Typography>

              {/* Client */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  value={selectedClient}
                  onChange={(_, newValue) => handleClientChange(newValue)}
                  options={clientsData?.items || []}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('tickets.client') + ' *'}
                      required
                    />
                  )}
                />
              </Box>

              {/* Site/Branch */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  value={selectedSite}
                  onChange={(_, newValue) => handleSiteChange(newValue)}
                  options={sites?.items || []}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disabled={!selectedClient}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('tickets.site') + ' *'}
                      required
                    />
                  )}
                />
              </Box>

              {/* A) Contact Person (Opener) */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  value={selectedContact}
                  onChange={(_, newValue) => handleContactChange(newValue)}
                  options={filteredContacts}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disabled={!selectedClient}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('tickets.contactPerson') + ' *'}
                      required
                    />
                  )}
                />
                {/* Show opener contact info read-only */}
                {selectedContact && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {selectedContact.phone && `${t('tickets.phone')}: ${selectedContact.phone}`}
                      {selectedContact.email && ` • ${t('tickets.email')}: ${selectedContact.email}`}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* B) Callback Contact Selector */}
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sameAsOpener}
                      onChange={(e) => handleSameAsOpenerChange(e.target.checked)}
                    />
                  }
                  label={t('tickets.sameAsOpener')}
                  sx={{ mb: 1 }}
                />
                {!sameAsOpener && (
                  <>
                    <Autocomplete
                      value={selectedCallbackContact}
                      onChange={(_, newValue) => handleCallbackContactChange(newValue)}
                      options={filteredContacts}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      disabled={!selectedClient}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t('tickets.callbackContact')}
                        />
                      )}
                    />
                    {/* C) Show callback contact phone read-only */}
                    {selectedCallbackContact && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {selectedCallbackContact.phone && `${t('tickets.phone')}: ${selectedCallbackContact.phone}`}
                          {selectedCallbackContact.email && ` • ${t('tickets.email')}: ${selectedCallbackContact.email}`}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              {/* D) Callback Phone Override (editable) */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  required
                  label={t('tickets.contactPhoneForCallback') + ' *'}
                  value={formData.contact_phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))
                  }
                  helperText={t('tickets.phoneHelperText')}
                />
              </Box>

              {/* Channel (How ticket was opened) */}
              <FormControl fullWidth required>
                <InputLabel>{t('tickets.channel')}</InputLabel>
                <Select
                  value={formData.reported_via || 'phone'}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reported_via: e.target.value }))
                  }
                  label={t('tickets.channel')}
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Section B: Problem Details */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('tickets.problemDetails')}
              </Typography>

              {/* Title */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  required
                  label={t('tickets.titleField')}
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </Box>

              {/* Description */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={4}
                  label={t('tickets.description')}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </Box>

              {/* Category */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('tickets.category')}</InputLabel>
                <Select
                  value={formData.category_id || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, category_id: e.target.value || undefined }))
                  }
                  label={t('tickets.category')}
                >
                  <MenuItem value="">
                    <em>{t('tickets.noCategory')}</em>
                  </MenuItem>
                  {categories?.filter(c => c.is_active).map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name_en || category.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Priority */}
              <FormControl fullWidth>
                <InputLabel>{t('tickets.priority')}</InputLabel>
                <Select
                  value={formData.priority || 'normal'}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priority: e.target.value }))
                  }
                  label={t('tickets.priority')}
                >
                  <MenuItem value="low">{t('tickets.priorityLow')}</MenuItem>
                  <MenuItem value="normal">{t('tickets.priorityNormal')}</MenuItem>
                  <MenuItem value="high">{t('tickets.priorityHigh')}</MenuItem>
                  <MenuItem value="urgent">{t('tickets.priorityUrgent')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            {t('app.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {ticketId ? t('app.save') : t('app.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
