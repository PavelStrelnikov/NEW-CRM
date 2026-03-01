import React, { useContext } from 'react';
import {
  Avatar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Typography,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import DevicesIcon from '@mui/icons-material/Devices';
import FolderIcon from '@mui/icons-material/Folder';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupIcon from '@mui/icons-material/Group';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { AuthContext } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';

const DRAWER_WIDTH = 240;

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { isMobile } = useResponsive();

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { label: t('nav.clients'), icon: <PeopleIcon />, path: '/clients' },
    { label: t('nav.tickets'), icon: <ConfirmationNumberIcon />, path: '/tickets' },
    { label: t('nav.assets'), icon: <DevicesIcon />, path: '/assets' },
    { label: t('nav.projects'), icon: <FolderIcon />, path: '/projects' },
    { label: t('nav.reports'), icon: <AssessmentIcon />, path: '/reports' },
  ];

  const adminItems = [
    { label: t('nav.internalUsers'), icon: <GroupIcon />, path: '/users' },
    { label: t('nav.portalUsers', 'Portal Users'), icon: <SupervisorAccountIcon />, path: '/portal-users' },
    { label: t('nav.admin'), icon: <AdminPanelSettingsIcon />, path: '/admin' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    // Close drawer on mobile after navigation
    if (onClose && isMobile) {
      onClose();
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ minHeight: 64 }} />

      {/* ── Branding block ──────────────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 1, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00d2b4 0%, #00b89c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"IBM Plex Mono", monospace',
            fontWeight: 700,
            fontSize: 18,
            color: '#0a0e17',
            flexShrink: 0,
          }}
        >
          C
        </Box>
        <Box>
          <Typography
            sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.08em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            CRM
          </Typography>
          <Typography
            sx={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: 500,
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'primary.main',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            SURVEILLANCE
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── Navigation ──────────────────────────────────────── */}
      <Box sx={{ px: 1, py: 2, flex: 1, overflow: 'auto' }}>
        <List sx={{ px: 0 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={location.pathname.startsWith(item.path)}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: location.pathname.startsWith(item.path) ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {isAdmin && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
            <List sx={{ px: 0 }}>
              {adminItems.map((item) => (
                <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={location.pathname.startsWith(item.path)}
                    onClick={() => handleNavigate(item.path)}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 14,
                        fontWeight: location.pathname.startsWith(item.path) ? 600 : 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Box>

      {/* ── User info block ─────────────────────────────────── */}
      {user && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(0, 210, 180, 0.12)',
                color: 'primary.main',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.display_name || user.username}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {user.role}
              </Typography>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );

  // On mobile, just return the content (drawer is handled by AppLayout)
  if (isMobile) {
    return <>{drawerContent}</>;
  }

  // On desktop, render permanent drawer
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
      open={open}
    >
      {drawerContent}
    </Drawer>
  );
};
