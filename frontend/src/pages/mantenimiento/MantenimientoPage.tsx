import { useState } from 'react';
import { Box, Paper, Tab, Tabs } from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../auth/use-auth';
import { TiposMantenimientoTab } from './TiposMantenimientoTab';
import { MaintenanceListTab } from './MaintenanceListTab';

/**
 * Maintenance module with tabs: Scheduled / History (built in the operation
 * sub-stage) and Types (this sub-stage). Type management is admin-only.
 */
export function MantenimientoPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const canManageTypes = user?.role === 'ADMIN';

  return (
    <Box>
      <PageHeader title="Mantenimiento" />
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
          <Tab label="Programados" />
          <Tab label="Historial" />
          <Tab label="Tipos" />
        </Tabs>
      </Paper>

      {tab === 0 && <MaintenanceListTab view="scheduled" />}
      {tab === 1 && <MaintenanceListTab view="history" />}
      {tab === 2 && <TiposMantenimientoTab canManage={canManageTypes} />}
    </Box>
  );
}
