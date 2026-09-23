export const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const isOlderThan30Days = (dateString?: string | null) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return date < thirtyDaysAgo;
};

export const isExpiringWithin30Days = (dateString?: string | null) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return date <= thirtyDaysFromNow;
};

export const isExpiringWithin6Months = (dateString?: string | null) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  return date <= sixMonthsFromNow;
};
