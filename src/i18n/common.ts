/**
 * Shared, generic UI labels. Dialogs and forms use these instead of
 * action-specific wording ("Save", not "Add device model" / "Update IP"),
 * so each string is translated once when localization is added.
 */
export const common = {
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  delete: "Delete",
  confirm: "Confirm",
  continue: "Continue",
  retry: "Retry",
  clearAll: "Clear all",
  applyFilters: "Apply filters",
} as const;
