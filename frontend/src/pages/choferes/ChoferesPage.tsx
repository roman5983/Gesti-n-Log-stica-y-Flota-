import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import DescriptionIcon from '@mui/icons-material/Description';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { driversApi, type Driver } from '../../api/drivers.api';
import { useAuth } from '../../auth/use-auth';
import { DriverFormDialog } from './DriverFormDialog';
import { DriverCredentialsDialog } from './DriverCredentialsDialog';
import { DriverDocumentsDialog } from './DriverDocumentsDialog';

export function ChoferesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [availableFilter, setAvailableFilter] = useState<'' | 'true' | 'false'>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      driversApi.list({
        ...params,
        available: availableFilter === '' ? undefined : availableFilter === 'true',
        search: appliedSearch || undefined,
      }),
    [availableFilter, appliedSearch],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Driver>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [credentialsFor, setCredentialsFor] = useState<Driver | null>(null);
  const [documentsFor, setDocumentsFor] = useState<Driver | null>(null);

  const columns = useMemo<Column<Driver>[]>(
    () => [
      { key: 'name', label: 'Nombre', render: (d) => d.name },
      { key: 'dni', label: 'DNI', render: (d) => d.dni },
      { key: 'license', label: 'Licencia', render: (d) => `Cat. ${d.licenseCategory}` },
      {
        key: 'expiry',
        label: 'Vencimiento',
        render: (d) => (
          <Chip
            size="small"
            label={new Date(d.licenseExpiryDate).toLocaleDateString('es-AR')}
            color={d.licenseValid ? 'default' : 'error'}
            variant={d.licenseValid ? 'outlined' : 'filled'}
          />
        ),
      },
      {
        key: 'available',
        label: 'Disponible',
        render: (d) => <Chip size="small" label={d.available ? 'Sí' : 'No'} color={d.available ? 'success' : 'default'} />,
      },
      { key: 'trips', label: 'Viajes', align: 'right', render: (d) => d.completedTrips },
      ...(canManage
        ? [
            {
              key: 'actions',
              label: 'Acciones',
              align: 'right' as const,
              render: (d: Driver) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => { setEditing(d); setFormOpen(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Credenciales">
                    <IconButton size="small" onClick={() => setCredentialsFor(d)}>
                      <KeyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Documentación">
                    <IconButton size="small" onClick={() => setDocumentsFor(d)}>
                      <DescriptionIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ),
            },
          ]
        : []),
    ],
    [canManage],
  );

  return (
    <Box>
      <PageHeader
        title="Choferes"
        action={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Nuevo chofer
            </Button>
          ) : undefined
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          label="Disponibilidad"
          size="small"
          value={availableFilter}
          onChange={(e) => { setAvailableFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="true">Disponibles</MenuItem>
          <MenuItem value="false">No disponibles</MenuItem>
        </TextField>
        <TextField
          label="Buscar por nombre o DNI"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setPage(1); } }}
          sx={{ minWidth: 260 }}
        />
        <Button onClick={() => { setAppliedSearch(search); setPage(1); }}>Buscar</Button>
      </Stack>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(d) => d.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage="No hay choferes que coincidan con los filtros"
      />

      <DriverFormDialog
        open={formOpen}
        driver={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />

      <DriverCredentialsDialog
        open={credentialsFor !== null}
        driver={credentialsFor}
        onClose={() => setCredentialsFor(null)}
      />

      <DriverDocumentsDialog
        driver={documentsFor}
        canManage={canManage}
        onClose={() => setDocumentsFor(null)}
      />
    </Box>
  );
}
