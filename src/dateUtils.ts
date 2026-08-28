export const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};
