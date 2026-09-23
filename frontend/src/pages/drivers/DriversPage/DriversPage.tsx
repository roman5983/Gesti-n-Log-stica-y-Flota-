import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import DescriptionIcon from '@mui/icons-material/Description';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable.types';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { SearchField } from '@/components/SearchField/SearchField';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { driversApi, type Driver } from '@/api/drivers.api';
import { usersApi } from '@/api/users.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { useAuth } from '@/hooks/useAuth';
import { DriverFormDialog } from '@/pages/drivers/DriverFormDialog/DriverFormDialog';
import { DriverCredentialsDialog } from '@/pages/drivers/DriverCredentialsDialog/DriverCredentialsDialog';
import { DriverDocumentsDialog } from '@/pages/drivers/DriverDocumentsDialog/DriverDocumentsDialog';
import { formatDateOnly } from '@/utils/datetime';

export function DriversPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [availableFilter, setAvailableFilter] = useState<'' | 'true' | 'false'>('');
  const [search, setSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      driversApi.list({
        ...params,
        available: availableFilter === '' ? undefined : availableFilter === 'true',
        search: search || undefined,
      }),
    [availableFilter, search],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Driver>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [credentialsFor, setCredentialsFor] = useState<Driver | null>(null);
  const [documentsFor, setDocumentsFor] = useState<Driver | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toToggle, setToToggle] = useState<Driver | null>(null);
  const [toggling, setToggling] = useState(false);
  const notify = useNotify();

  async function confirmToggle() {
    if (!toToggle) return;
    setToggling(true);
    setToggleError(null);
    try {
      await usersApi.setActive(toToggle.id, !toToggle.isActive);
      notify.success(`${toToggle.name} ${toToggle.isActive ? 'dado de baja' : 'reactivado'}`);
      setToToggle(null);
      await reload();
    } catch (err) {
      // Stays open with the reason (e.g. "tiene un viaje en curso").
      setToggleError(apiErrorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  // Deep link from Alertas ("ir al origen"): DRIVER alerts open the chofer's
  // form, DRIVER_DOCUMENT alerts open its documentation (open=docs).
  const [searchParams, setSearchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const openDocs = searchParams.get('open') === 'docs';
  useEffect(() => {
    if (!highlight || !canManage) return;
    driversApi
      .getById(Number(highlight))
      .then((d) => {
        if (openDocs) {
          setDocumentsFor(d);
        } else {
          setEditing(d);
          setFormOpen(true);
        }
      })
      .catch(() => notify.warning('No se encontró el chofer indicado. Puede haber sido eliminado.'))
      .finally(() => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('highlight');
            next.delete('open');
            return next;
          },
          { replace: true },
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, canManage]);

  const columns = useMemo<Column<Driver>[]>(
    () => [
      {
        key: 'name',
        label: 'Nombre',
        render: (d) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <span>{d.name}</span>
            {!d.isActive && <Chip size="small" label="Inactivo" color="warning" variant="outlined" />}
          </Stack>
        ),
      },
      { key: 'dni', label: 'DNI', render: (d) => d.dni },
      { key: 'license', label: 'Licencia', render: (d) => `Cat. ${d.licenseCategory}` },
      {
        key: 'expiry',
        label: 'Vencimiento',
        render: (d) => (
          <Chip
            size="small"
            label={formatDateOnly(d.licenseExpiryDate)}
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
                  <Tooltip title={d.isActive ? 'Dar de baja' : 'Reactivar'}>
                    <IconButton size="small" color={d.isActive ? 'error' : 'success'} onClick={() => setToToggle(d)}>
                      {d.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
        <SearchField
          placeholder="Nombre o DNI"
          value={search}
          onSearch={(text) => { setSearch(text); setPage(1); }}
        />
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
        onSaved={() => { notify.success(editing ? 'Chofer actualizado' : 'Chofer creado'); setFormOpen(false); void reload(); }}
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

      <ConfirmDialog
        open={toToggle !== null}
        title={toToggle?.isActive ? 'Dar de baja al chofer' : 'Reactivar chofer'}
        message={
          toToggle?.isActive
            ? `¿Dar de baja a ${toToggle.name}? No podrá iniciar sesión ni recibir viajes, y se cerrarán sus sesiones abiertas.`
            : `¿Reactivar a ${toToggle?.name}?`
        }
        confirmLabel={toToggle?.isActive ? 'Dar de baja' : 'Reactivar'}
        confirmColor={toToggle?.isActive ? 'error' : 'primary'}
        loading={toggling}
        error={toggleError}
        onConfirm={confirmToggle}
        onCancel={() => { setToToggle(null); setToggleError(null); }}
      />
    </Box>
  );
}
