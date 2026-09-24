import { Box, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, Typography } from '@mui/material';
import type { DataTableProps } from './DataTable.types';

/** Reusable paginated table used by every listing screen. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  emptyMessage = 'No hay datos para mostrar',
  sort,
}: DataTableProps<T>) {
  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const sortable = sort && col.sortKey;
                const active = sortable && sort.by === col.sortKey;
                return (
                  <TableCell
                    key={col.key}
                    align={col.align}
                    sortDirection={active ? sort.order : false}
                  >
                    {sortable ? (
                      <TableSortLabel
                        active={Boolean(active)}
                        direction={active ? sort.order : 'asc'}
                        // Clicking the active column flips it; a new column starts ascending.
                        onClick={() =>
                          sort.onChange(col.sortKey!, active && sort.order === 'asc' ? 'desc' : 'asc')
                        }
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.align}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box>
        <TablePagination
          component="div"
          count={total}
          page={page - 1} // MUI is 0-based
          onPageChange={(_e, newPage) => onPageChange(newPage + 1)}
          rowsPerPage={limit}
          onRowsPerPageChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Box>
    </Paper>
  );
}
