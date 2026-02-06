import React, { useContext } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
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
    <>
      <Toolbar sx={{ minHeight: 64 }} />
      <Box sx={{ px: 1, py: 2 }}>
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
            <Divider sx={{ my: 2 }} />
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
    </>
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
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
      open={open}
    >
      {drawerContent}
    </Drawer>
  );
};
