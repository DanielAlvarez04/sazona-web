/**
 * La tabla de usuarios comparte las features del `DataTable` reutilizable.
 *
 * Se mantiene este módulo (y sus alias) para que las columnas y la tabla de
 * usuarios no dependan directamente del componente compartido.
 */
export {
  dataTableFeatures as usersTableFeatures,
  type DataTableFeatures as UsersTableFeatures,
} from "@/components/data-table/data-table-features"
