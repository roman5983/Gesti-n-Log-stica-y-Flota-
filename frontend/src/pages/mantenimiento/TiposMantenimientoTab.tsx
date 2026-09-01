import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataTable, type Column } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { maintenanceTypesApi, type MaintenanceType } from '../../api/maintenance-types.api';
import { apiErrorMessage } from '../../api/axios';
import { MaintenanceTypeFormDialog } from './MaintenanceTypeFormDialog';

/** CRUD of maintenance types (admin). Rendered inside the Maintenance tabs. */
export function TiposMantenimientoTab({ canManage }: { canManage: boolean }) {
  const fetchFn = useCallback((params: PageParams) => maintenanceTypesApi.list(params), []);
  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<MaintenanceType>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceType | null>(null);
  const [toDelete, setToDelete] = useState<MaintenanceType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await maintenanceTypesApi.remove(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<Column<MaintenanceType>[]>(
    () => [
      { key: 'name', label: 'Nombre', render: (t) => t.name },
      { key: 'description', label: 'Descripción', render: (t) => t.description },
      { key: 'kmAlert', label: 'Km alerta', align: 'right', render: (t) => t.kmAlert.toLocaleString('es-AR') },
      { key: 'kmTarget', label: 'Km objetivo', align: 'right', render: (t) => t.kmTarget.toLocaleString('es-AR') },
      { key: 'months', label: 'Meses (alerta/obj.)', render: (t) => `${t.monthsAlert ?? '—'} / ${t.monthsTarget ?? '—'}` },
      ...(canManage
        ? [
            {
              key: 'actions',
              label: 'Acciones',
              align: 'right' as const,
              render: (t: MaintenanceType) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => { setEditing(t); setFormOpen(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton size="small" color="error" onClick={() => setToDelete(t)}>
                      <DeleteIcon fontSize="small" />
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
      {canManage && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Nuevo tipo
          </Button>
        </Stack>
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(t) => t.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage="No hay tipos de mantenimiento cargados"
      />

      <MaintenanceTypeFormDialog
        open={formOpen}
        type={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar tipo de mantenimiento"
        message={`¿Eliminar "${toDelete?.name}"? No se puede eliminar si está en uso por algún mantenimiento.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  );
}
